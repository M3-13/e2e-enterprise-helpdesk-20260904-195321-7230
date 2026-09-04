import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import DashboardPage from './DashboardPage'

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('DashboardPage', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('zeigt Kennzahlen und Prioritätsverteilung aus der API', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        open: 12,
        overdue: 3,
        closed_today: 5,
        by_priority: { low: 4, medium: 6, high: 2, critical: 0 },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    render(<DashboardPage />)

    expect(await screen.findByText('Offene Tickets')).toBeInTheDocument()
    expect(screen.getByText('Überfällige Tickets')).toBeInTheDocument()
    expect(screen.getByText('Heute geschlossen')).toBeInTheDocument()
    expect(screen.getByText('12')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByText('5')).toBeInTheDocument()

    expect(screen.getByText('Prioritätsverteilung')).toBeInTheDocument()
    expect(screen.getByText('Niedrig')).toBeInTheDocument()
    expect(screen.getByText('Mittel')).toBeInTheDocument()
    expect(screen.getByText('Hoch')).toBeInTheDocument()
    expect(screen.getByText('Kritisch')).toBeInTheDocument()
  })

  it('zeigt eine verständliche Fehlermeldung, wenn die API fehlschlägt', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(500, { detail: 'Internal Server Error' }))
    vi.stubGlobal('fetch', fetchMock)

    render(<DashboardPage />)

    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(
      screen.getByText('Die Kennzahlen konnten nicht geladen werden.'),
    ).toBeInTheDocument()
  })
})
