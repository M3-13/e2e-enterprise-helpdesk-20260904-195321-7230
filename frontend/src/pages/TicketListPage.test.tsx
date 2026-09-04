import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import TicketListPage from './TicketListPage'
import { apiGet, ApiError } from '../api/client'
import type { Ticket, TicketListResponse } from '../types'

vi.mock('../api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/client')>()
  return { ...actual, apiGet: vi.fn() }
})

const mockedApiGet = vi.mocked(apiGet)

const ticket = (overrides: Partial<Ticket> = {}): Ticket => ({
  id: 1,
  title: 'Drucker kaputt',
  description: 'Kein Toner',
  category: 'hardware',
  priority: 'high',
  status: 'open',
  due_date: '2099-01-01T00:00:00Z',
  assignee_id: 7,
  requester_id: 2,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  ...overrides,
})

function listResponse(items: Ticket[], total = items.length): TicketListResponse {
  return { items, total, page: 1, page_size: 20 }
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/tickets']}>
      <Routes>
        <Route path="/tickets" element={<TicketListPage />} />
        <Route path="/tickets/new" element={<div>Neues Ticket Formular</div>} />
        <Route path="/tickets/:id" element={<div>Ticket Detail</div>} />
        <Route path="/login" element={<div>Login</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('TicketListPage', () => {
  beforeEach(() => {
    mockedApiGet.mockReset()
  })

  afterEach(() => {
    cleanup()
  })

  it('lädt Tickets und zeigt sie in der Tabelle', async () => {
    mockedApiGet.mockResolvedValue(
      listResponse([
        ticket({ id: 1, title: 'Drucker kaputt', category: 'hardware' }),
        ticket({ id: 2, title: 'VPN geht nicht', category: 'network', status: 'closed', assignee_id: null }),
      ]),
    )

    renderPage()

    expect(await screen.findByText('Drucker kaputt')).toBeInTheDocument()
    expect(screen.getByText('VPN geht nicht')).toBeInTheDocument()
    expect(screen.getByText('hardware')).toBeInTheDocument()
    expect(screen.getByText('network')).toBeInTheDocument()
    expect(mockedApiGet).toHaveBeenCalledWith('/api/tickets?page=1&page_size=20')
  })

  it('überträgt Suche, Filter und Sortierung als Query-Parameter', async () => {
    mockedApiGet.mockResolvedValue(listResponse([]))

    renderPage()

    await waitFor(() => expect(mockedApiGet).toHaveBeenCalled())

    fireEvent.change(screen.getByLabelText('Suche'), { target: { value: 'drucker' } })
    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'open' } })
    fireEvent.change(screen.getByLabelText('Priorität'), { target: { value: 'high' } })
    fireEvent.change(screen.getByLabelText(/Zuständigkeit/), { target: { value: '7' } })
    fireEvent.change(screen.getByLabelText('Sortierung'), { target: { value: 'priority' } })

    await waitFor(() => {
      const lastCall = mockedApiGet.mock.calls[mockedApiGet.mock.calls.length - 1][0]
      expect(lastCall).toContain('search=drucker')
      expect(lastCall).toContain('status=open')
      expect(lastCall).toContain('priority=high')
      expect(lastCall).toContain('assignee_id=7')
      expect(lastCall).toContain('sort=priority')
    })
  })

  it('blättert mit dem Weiter-Button auf die nächste Seite', async () => {
    mockedApiGet.mockResolvedValue(
      listResponse(
        [ticket({ id: 1 })],
        45,
      ),
    )

    renderPage()

    await screen.findByText('Drucker kaputt')

    fireEvent.click(screen.getByRole('button', { name: 'Weiter' }))

    await waitFor(() => {
      const lastCall = mockedApiGet.mock.calls[mockedApiGet.mock.calls.length - 1][0]
      expect(lastCall).toContain('page=2')
    })
  })

  it('zeigt einen Leerzustand, wenn keine Tickets vorhanden sind', async () => {
    mockedApiGet.mockResolvedValue(listResponse([]))

    renderPage()

    expect(await screen.findByText('Keine Tickets gefunden.')).toBeInTheDocument()
  })

  it('zeigt eine Fehlermeldung bei fehlgeschlagenem Laden', async () => {
    mockedApiGet.mockRejectedValue(new ApiError(500, 'Serverfehler'))

    renderPage()

    expect(await screen.findByText('Serverfehler')).toBeInTheDocument()
  })

  it('navigiert bei 401 zur Anmeldung', async () => {
    mockedApiGet.mockRejectedValue(new ApiError(401, 'Unauthorized'))

    renderPage()

    expect(await screen.findByText('Login')).toBeInTheDocument()
  })
})
