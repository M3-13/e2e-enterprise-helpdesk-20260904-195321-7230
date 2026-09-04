import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import TicketNewPage from './TicketNewPage'
import { apiPost, ApiError } from '../api/client'

vi.mock('../api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/client')>()
  return { ...actual, apiPost: vi.fn() }
})

const mockedApiPost = vi.mocked(apiPost)

function ListStub() {
  return <div>Ticketliste</div>
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/tickets/new']}>
      <Routes>
        <Route path="/tickets/new" element={<TicketNewPage />} />
        <Route path="/tickets" element={<ListStub />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('TicketNewPage', () => {
  beforeEach(() => {
    mockedApiPost.mockReset()
  })

  afterEach(() => {
    cleanup()
  })

  it('rendert alle Formularfelder und den Absende-Button', () => {
    renderPage()
    expect(screen.getByLabelText(/Titel/)).toBeInTheDocument()
    expect(screen.getByLabelText(/Beschreibung/)).toBeInTheDocument()
    expect(screen.getByLabelText(/Kategorie/)).toBeInTheDocument()
    expect(screen.getByLabelText(/Priorität/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Ticket anlegen/ })).toBeInTheDocument()
  })

  it('zeigt Client-Validierungsfehler bei leerem Formular und sendet nicht', async () => {
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: /Ticket anlegen/ }))

    expect(await screen.findByText('Titel ist erforderlich.')).toBeInTheDocument()
    expect(screen.getByText('Beschreibung ist erforderlich.')).toBeInTheDocument()
    expect(screen.getByText('Kategorie ist erforderlich.')).toBeInTheDocument()
    expect(screen.getByText('Priorität ist erforderlich.')).toBeInTheDocument()
    expect(mockedApiPost).not.toHaveBeenCalled()
  })

  it('sendet die Eingaben und navigiert zur Liste', async () => {
    mockedApiPost.mockResolvedValue({ id: 1 } as never)

    renderPage()
    fireEvent.change(screen.getByLabelText(/Titel/), {
      target: { value: 'Drucker kaputt' },
    })
    fireEvent.change(screen.getByLabelText(/Beschreibung/), {
      target: { value: 'Kein Toner' },
    })
    fireEvent.change(screen.getByLabelText(/Kategorie/), {
      target: { value: 'hardware' },
    })
    fireEvent.change(screen.getByLabelText(/Priorität/), {
      target: { value: 'high' },
    })
    fireEvent.click(screen.getByRole('button', { name: /Ticket anlegen/ }))

    await waitFor(() => {
      expect(mockedApiPost).toHaveBeenCalledWith('/api/tickets', {
        title: 'Drucker kaputt',
        description: 'Kein Toner',
        category: 'hardware',
        priority: 'high',
      })
    })

    expect(await screen.findByText('Ticketliste')).toBeInTheDocument()
  })

  it('zeigt serverseitige Validierungsfehler an', async () => {
    mockedApiPost.mockRejectedValue(
      new ApiError(422, [
        { loc: ['body', 'title'], msg: 'zu kurz', type: 'string_too_short' },
      ]),
    )

    renderPage()
    fireEvent.change(screen.getByLabelText(/Titel/), {
      target: { value: 'x' },
    })
    fireEvent.change(screen.getByLabelText(/Beschreibung/), {
      target: { value: 'Beschreibung' },
    })
    fireEvent.change(screen.getByLabelText(/Kategorie/), {
      target: { value: 'hardware' },
    })
    fireEvent.change(screen.getByLabelText(/Priorität/), {
      target: { value: 'low' },
    })
    fireEvent.click(screen.getByRole('button', { name: /Ticket anlegen/ }))

    expect(await screen.findByText('zu kurz')).toBeInTheDocument()
    expect(screen.queryByText('Ticketliste')).not.toBeInTheDocument()
  })

  it('zeigt eine allgemeine Fehlermeldung bei String-Detail', async () => {
    mockedApiPost.mockRejectedValue(new ApiError(500, 'Serverfehler'))

    renderPage()
    fireEvent.change(screen.getByLabelText(/Titel/), {
      target: { value: 'Titel' },
    })
    fireEvent.change(screen.getByLabelText(/Beschreibung/), {
      target: { value: 'Beschreibung' },
    })
    fireEvent.change(screen.getByLabelText(/Kategorie/), {
      target: { value: 'hardware' },
    })
    fireEvent.change(screen.getByLabelText(/Priorität/), {
      target: { value: 'medium' },
    })
    fireEvent.click(screen.getByRole('button', { name: /Ticket anlegen/ }))

    expect(await screen.findByText('Serverfehler')).toBeInTheDocument()
  })
})
