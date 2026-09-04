import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import AdminUsersPage from './AdminUsersPage'
import { apiGet, apiPost, apiPatch } from '../api/client'
import { useAuth } from '../context/AuthContext'
import type { User } from '../types'

vi.mock('../api/client', () => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  apiPatch: vi.fn(),
  ApiError: class ApiError extends Error {
    status: number
    detail: unknown
    constructor(status: number, detail: unknown) {
      super(typeof detail === 'string' ? detail : 'Request failed')
      this.status = status
      this.detail = detail
    }
  },
}))

vi.mock('../context/AuthContext', () => ({
  useAuth: vi.fn(),
}))

const mockedApiGet = vi.mocked(apiGet)
const mockedApiPost = vi.mocked(apiPost)
const mockedApiPatch = vi.mocked(apiPatch)
const mockedUseAuth = vi.mocked(useAuth)

const adminUser: User = {
  id: 1,
  username: 'admin',
  email: 'admin@example.com',
  role: 'admin',
  is_active: true,
}

function mockAdmin() {
  mockedUseAuth.mockReturnValue({
    user: adminUser,
    token: 'token',
    isAuthenticated: true,
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
  })
}

const sampleUsers: User[] = [
  { id: 1, username: 'admin', email: 'admin@example.com', role: 'admin', is_active: true },
  { id: 2, username: 'agent1', email: 'agent@example.com', role: 'agent', is_active: true },
  { id: 3, username: 'req1', email: 'req@example.com', role: 'requester', is_active: false },
]

describe('AdminUsersPage', () => {
  beforeEach(() => {
    mockedApiGet.mockReset()
    mockedApiPost.mockReset()
    mockedApiPatch.mockReset()
    mockAdmin()
  })

  afterEach(() => {
    cleanup()
  })

  it('rendert die Benutzerliste mit Rolle und Status', async () => {
    mockedApiGet.mockResolvedValue(sampleUsers)

    render(
      <MemoryRouter>
        <AdminUsersPage />
      </MemoryRouter>,
    )

    expect(await screen.findByText('agent1')).toBeInTheDocument()
    expect(screen.getByText('agent@example.com')).toBeInTheDocument()
    expect(screen.getByText('req1')).toBeInTheDocument()
    expect(screen.getAllByText('Aktiv')).toHaveLength(2)
    expect(screen.getByText('Deaktiviert')).toBeInTheDocument()
  })

  it('legt einen neuen Benutzer an', async () => {
    mockedApiGet.mockResolvedValue(sampleUsers)
    mockedApiPost.mockResolvedValue({
      id: 4,
      username: 'neu',
      email: 'neu@example.com',
      role: 'agent',
      is_active: true,
    })

    render(
      <MemoryRouter>
        <AdminUsersPage />
      </MemoryRouter>,
    )

    await screen.findByText('agent1')

    fireEvent.change(screen.getByLabelText(/Benutzername/), {
      target: { value: 'neu' },
    })
    fireEvent.change(screen.getByLabelText(/E-Mail/), {
      target: { value: 'neu@example.com' },
    })
    fireEvent.change(screen.getByLabelText(/Passwort/), {
      target: { value: 'geheim' },
    })
    const roleSelect = document.getElementById('user-role') as HTMLSelectElement
    fireEvent.change(roleSelect, { target: { value: 'agent' } })
    fireEvent.click(screen.getByRole('button', { name: /Benutzer anlegen/ }))

    await waitFor(() => {
      expect(mockedApiPost).toHaveBeenCalledWith('/api/users', {
        username: 'neu',
        email: 'neu@example.com',
        password: 'geheim',
        role: 'agent',
      })
    })
  })

  it('ändert die Rolle eines Benutzers', async () => {
    mockedApiGet.mockResolvedValue(sampleUsers)
    mockedApiPatch.mockResolvedValue({
      ...sampleUsers[2],
      role: 'agent',
    })

    render(
      <MemoryRouter>
        <AdminUsersPage />
      </MemoryRouter>,
    )

    await screen.findByText('req1')

    const select = screen.getByLabelText('Rolle für req1')
    fireEvent.change(select, { target: { value: 'agent' } })

    await waitFor(() => {
      expect(mockedApiPatch).toHaveBeenCalledWith('/api/users/3', { role: 'agent' })
    })
  })

  it('deaktiviert einen Benutzer', async () => {
    mockedApiGet.mockResolvedValue(sampleUsers)
    mockedApiPatch.mockResolvedValue({
      ...sampleUsers[1],
      is_active: false,
    })

    render(
      <MemoryRouter>
        <AdminUsersPage />
      </MemoryRouter>,
    )

    await screen.findByText('agent1')

    const deactivateButtons = screen.getAllByRole('button', { name: 'Deaktivieren' })
    fireEvent.click(deactivateButtons[1])

    await waitFor(() => {
      expect(mockedApiPatch).toHaveBeenCalledWith('/api/users/2', { is_active: false })
    })
  })
})
