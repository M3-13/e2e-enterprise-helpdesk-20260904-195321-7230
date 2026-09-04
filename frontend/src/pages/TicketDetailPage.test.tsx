import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import TicketDetailPage from './TicketDetailPage'
import { AuthProvider } from '../context/AuthContext'
import { apiGet, apiPost, apiPatch } from '../api/client'

vi.mock('../api/client', () => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  apiPatch: vi.fn(),
  apiDelete: vi.fn(),
  ApiError: class ApiError extends Error {
    status: number
    constructor(status: number, detail: unknown) {
      super(String(detail))
      this.status = status
    }
  },
}))

const mockedApiGet = apiGet as unknown as ReturnType<typeof vi.fn>
const mockedApiPost = apiPost as unknown as ReturnType<typeof vi.fn>
const mockedApiPatch = apiPatch as unknown as ReturnType<typeof vi.fn>

const baseTicket = {
  id: 7,
  title: 'Drucker defekt',
  description: 'Der Drucker im 3. Stock druckt nicht.',
  category: 'Hardware',
  priority: 'high',
  status: 'open',
  due_date: new Date(Date.now() + 86400000).toISOString(),
  assignee_id: null,
  requester_id: 3,
  created_at: '2026-09-01T08:00:00Z',
  updated_at: '2026-09-01T08:00:00Z',
  comments: [
    {
      id: 1,
      ticket_id: 7,
      author_id: 3,
      body: 'Erste Meldung.',
      created_at: '2026-09-01T08:00:00Z',
    },
  ],
  audit_log: [
    {
      id: 1,
      ticket_id: 7,
      user_id: 4,
      field: 'priority',
      old_value: 'medium',
      new_value: 'high',
      created_at: '2026-09-01T09:00:00Z',
    },
  ],
}

function renderPage(user: { id: number; role: string } | null = null) {
  if (user) {
    localStorage.setItem('token', 'test-token')
    localStorage.setItem(
      'user',
      JSON.stringify({
        id: user.id,
        username: 'tester',
        email: 't@example.com',
        role: user.role,
        is_active: true,
      }),
    )
  } else {
    localStorage.clear()
  }

  return render(
    <MemoryRouter initialEntries={['/tickets/7']}>
      <AuthProvider>
        <Routes>
          <Route path="/tickets/:id" element={<TicketDetailPage />} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  )
}

afterEach(() => {
  cleanup()
  localStorage.clear()
  vi.restoreAllMocks()
})

beforeEach(() => {
  mockedApiGet.mockReset()
  mockedApiPost.mockReset()
  mockedApiPatch.mockReset()
})

describe('TicketDetailPage', () => {
  it('zeigt Titel und Felder des Tickets', async () => {
    mockedApiGet.mockResolvedValue(baseTicket)
    renderPage()

    await waitFor(() => expect(screen.getByText('Drucker defekt')).toBeInTheDocument())

    expect(screen.getByText('Der Drucker im 3. Stock druckt nicht.')).toBeInTheDocument()
    expect(screen.getByText('Hardware')).toBeInTheDocument()
  })

  it('zeigt Kommentarverlauf mit Autor und Zeitstempel', async () => {
    mockedApiGet.mockResolvedValue(baseTicket)
    renderPage()

    await waitFor(() => expect(screen.getByText('Erste Meldung.')).toBeInTheDocument())
    expect(screen.getByText('Autor #3')).toBeInTheDocument()
  })

  it('zeigt das Änderungsprotokoll', async () => {
    mockedApiGet.mockResolvedValue(baseTicket)
    renderPage()

    await waitFor(() => expect(screen.getByText('Änderungsprotokoll')).toBeInTheDocument())
    expect(screen.getByText('priority')).toBeInTheDocument()
  })

  it('kennzeichnet überfällige Tickets', async () => {
    mockedApiGet.mockResolvedValue({
      ...baseTicket,
      due_date: new Date(Date.now() - 86400000).toISOString(),
    })
    renderPage()

    await waitFor(() => expect(screen.getByText('Überfällig')).toBeInTheDocument())
  })

  it('rendert Kommentarinhalt als reinen Text (kein HTML)', async () => {
    mockedApiGet.mockResolvedValue({
      ...baseTicket,
      comments: [
        {
          id: 1,
          ticket_id: 7,
          author_id: 3,
          body: '<script>alert("xss")</script>',
          created_at: '2026-09-01T08:00:00Z',
        },
      ],
    })
    const { container } = renderPage()

    await waitFor(() =>
      expect(screen.getByText('<script>alert("xss")</script>')).toBeInTheDocument(),
    )
    expect(container.querySelector('script')).toBeNull()
  })

  it('zeigt für Agenten Bearbeiten-, Zuweisen- und Schließen-Steuerungen', async () => {
    mockedApiGet.mockResolvedValue(baseTicket)
    renderPage({ id: 4, role: 'agent' })

    await waitFor(() => expect(screen.getByText('Drucker defekt')).toBeInTheDocument())

    expect(screen.getByRole('button', { name: 'Bearbeiten' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ticket schließen' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Zuweisen' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Zuweisung entfernen' })).toBeInTheDocument()
  })

  it('zeigt für Requester keine Bearbeitungs-Steuerungen', async () => {
    mockedApiGet.mockResolvedValue(baseTicket)
    renderPage({ id: 3, role: 'requester' })

    await waitFor(() => expect(screen.getByText('Drucker defekt')).toBeInTheDocument())

    expect(screen.queryByRole('button', { name: 'Bearbeiten' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Ticket schließen' })).not.toBeInTheDocument()
  })

  it('sendet einen Kommentar über den Endpunkt und lädt neu', async () => {
    mockedApiGet.mockResolvedValue(baseTicket)
    mockedApiPost.mockResolvedValue({ id: 2 })
    renderPage()

    await waitFor(() => expect(screen.getByText('Drucker defekt')).toBeInTheDocument())

    fireEvent.change(screen.getByLabelText('Neuer Kommentar'), {
      target: { value: 'Das Problem besteht weiterhin.' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Kommentieren' }))

    await waitFor(() =>
      expect(mockedApiPost).toHaveBeenCalledWith('/api/tickets/7/comments', {
        body: 'Das Problem besteht weiterhin.',
      }),
    )
  })

  it('sendet eine Zuweisung an einen Agenten', async () => {
    mockedApiGet.mockResolvedValue(baseTicket)
    mockedApiPost.mockResolvedValue({ ...baseTicket, assignee_id: 4 })
    renderPage({ id: 4, role: 'agent' })

    await waitFor(() => expect(screen.getByText('Drucker defekt')).toBeInTheDocument())

    fireEvent.change(screen.getByLabelText('Agent-ID'), { target: { value: '4' } })
    fireEvent.click(screen.getByRole('button', { name: 'Zuweisen' }))

    await waitFor(() =>
      expect(mockedApiPost).toHaveBeenCalledWith('/api/tickets/7/assign', { agent_id: 4 }),
    )
  })

  it('speichert Bearbeitungen über den Patch-Endpunkt', async () => {
    mockedApiGet.mockResolvedValue(baseTicket)
    mockedApiPatch.mockResolvedValue({ ...baseTicket, title: 'Drucker (aktualisiert)' })
    renderPage({ id: 4, role: 'agent' })

    await waitFor(() => expect(screen.getByText('Drucker defekt')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: 'Bearbeiten' }))
    fireEvent.change(screen.getByLabelText('Titel'), {
      target: { value: 'Drucker (aktualisiert)' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }))

    await waitFor(() => expect(mockedApiPatch).toHaveBeenCalled())
    const call = mockedApiPatch.mock.calls[0]
    expect(call[0]).toBe('/api/tickets/7')
    expect(call[1]).toMatchObject({ title: 'Drucker (aktualisiert)' })
  })
})
