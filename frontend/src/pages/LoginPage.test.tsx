import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import LoginPage from './LoginPage'
import { AuthProvider } from '../context/AuthContext'

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function renderLogin() {
  return render(
    <MemoryRouter initialEntries={['/login']}>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/dashboard" element={<div>Dashboard-Seite</div>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  )
}

describe('LoginPage', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('wechselt zwischen Anmelden und Registrieren', async () => {
    renderLogin()

    expect(screen.getByRole('heading', { name: 'Anmelden' })).toBeInTheDocument()
    expect(screen.getByLabelText('Benutzername oder E-Mail *')).toBeInTheDocument()

    await fireEvent.click(screen.getByRole('tab', { name: 'Registrieren' }))

    expect(screen.getByRole('heading', { name: 'Registrieren' })).toBeInTheDocument()
    expect(screen.getByLabelText('Benutzername *')).toBeInTheDocument()
    expect(screen.getByLabelText('E-Mail *')).toBeInTheDocument()
  })

  it('validiert leere Pflichtfelder beim Anmelden', async () => {
    renderLogin()

    await fireEvent.click(screen.getByRole('button', { name: 'Anmelden' }))

    expect(
      await screen.findByText('Benutzername oder E-Mail ist erforderlich.'),
    ).toBeInTheDocument()
    expect(screen.getByText('Passwort ist erforderlich.')).toBeInTheDocument()
  })

  it('meldet einen Benutzer an und speichert Token und Benutzer', async () => {
    const user = {
      id: 1,
      username: 'alice',
      email: 'alice@example.com',
      role: 'requester',
      is_active: true,
    }
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, { access_token: 'tok-123', token_type: 'bearer', user }),
    )
    vi.stubGlobal('fetch', fetchMock)

    renderLogin()

    await fireEvent.change(screen.getByLabelText('Benutzername oder E-Mail *'), { target: { value: 'alice' } })
    await fireEvent.change(screen.getByLabelText('Passwort *'), { target: { value: 'geheim123' } })
    await fireEvent.click(screen.getByRole('button', { name: 'Anmelden' }))

    expect(await screen.findByText('Dashboard-Seite')).toBeInTheDocument()
    expect(localStorage.getItem('token')).toBe('tok-123')
    expect(JSON.parse(localStorage.getItem('user') ?? '{}')).toEqual(user)
  })

  it('zeigt eine Fehlermeldung bei falschen Anmeldedaten', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse(401, { detail: 'Invalid username or password' }))
    vi.stubGlobal('fetch', fetchMock)

    renderLogin()

    await fireEvent.change(screen.getByLabelText('Benutzername oder E-Mail *'), { target: { value: 'alice' } })
    await fireEvent.change(screen.getByLabelText('Passwort *'), { target: { value: 'falsch123' } })
    await fireEvent.click(screen.getByRole('button', { name: 'Anmelden' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Ungültiger Benutzername oder falsches Passwort.',
    )
  })

  it('registriert einen Benutzer und wechselt zum Anmeldeformular', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(201, {
        id: 1,
        username: 'bob',
        email: 'bob@example.com',
        role: 'requester',
        is_active: true,
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    renderLogin()

    await fireEvent.click(screen.getByRole('tab', { name: 'Registrieren' }))
    await fireEvent.change(screen.getByLabelText('Benutzername *'), { target: { value: 'bob' } })
    await fireEvent.change(screen.getByLabelText('E-Mail *'), { target: { value: 'bob@example.com' } })
    await fireEvent.change(screen.getByLabelText('Passwort *'), { target: { value: 'geheim123' } })
    await fireEvent.click(screen.getByRole('button', { name: 'Registrieren' }))

    expect(
      await screen.findByText('Registrierung erfolgreich. Bitte melde dich an.'),
    ).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Anmelden' })).toBeInTheDocument()
    expect(localStorage.getItem('token')).toBeNull()
  })
})
