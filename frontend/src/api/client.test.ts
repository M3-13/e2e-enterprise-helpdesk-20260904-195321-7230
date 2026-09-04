import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { apiGet, apiPost, apiPatch, apiDelete, ApiError, clearAuth } from './client'

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('api client', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('apiGet fügt den Bearer-Token aus localStorage hinzu', async () => {
    localStorage.setItem('token', 'abc123')
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { id: 1 }))
    vi.stubGlobal('fetch', fetchMock)

    await apiGet<{ id: number }>('/api/tickets')

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('http://localhost:8000/api/tickets')
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer abc123')
  })

  it('apiPost sendet den Body als JSON', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(201, { id: 1 }))
    vi.stubGlobal('fetch', fetchMock)

    await apiPost('/api/tickets', { title: 'Test' })

    const [, init] = fetchMock.mock.calls[0]
    expect(init.method).toBe('POST')
    expect(init.body).toBe(JSON.stringify({ title: 'Test' }))
  })

  it('wirft einen ApiError mit extrahiertem detail bei Fehlerantwort', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse(422, { detail: [{ loc: ['body'], msg: 'invalid', type: 'x' }] }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(apiPost('/api/tickets', {})).rejects.toMatchObject({
      status: 422,
    })
  })

  it('löst bei 401 den Logout aus und entfernt den Token', async () => {
    localStorage.setItem('token', 'expired')
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(401, { detail: 'Unauthorized' }))
    vi.stubGlobal('fetch', fetchMock)

    const listener = vi.fn()
    window.addEventListener('auth:logout', listener)

    await expect(apiGet('/api/tickets')).rejects.toBeInstanceOf(ApiError)
    expect(localStorage.getItem('token')).toBeNull()
    expect(listener).toHaveBeenCalled()

    window.removeEventListener('auth:logout', listener)
  })

  it('apiPatch und apiDelete verwenden die richtigen Methoden', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, { id: 1 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetchMock)

    await apiPatch('/api/tickets/1', { status: 'closed' })
    await apiDelete('/api/users/me')

    expect(fetchMock.mock.calls[0][1].method).toBe('PATCH')
    expect(fetchMock.mock.calls[1][1].method).toBe('DELETE')
  })

  it('clearAuth entfernt Token und Benutzer', () => {
    localStorage.setItem('token', 'x')
    localStorage.setItem('user', '{}')
    clearAuth()
    expect(localStorage.getItem('token')).toBeNull()
    expect(localStorage.getItem('user')).toBeNull()
  })
})
