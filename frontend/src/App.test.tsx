import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import App from './App'
import { AuthProvider } from './context/AuthContext'

const routes = [
  '/',
  '/login',
  '/tickets',
  '/tickets/new',
  '/tickets/42',
  '/dashboard',
  '/admin/users',
  '/datenschutz',
  '/impressum',
]

describe('App-Shell', () => {
  it('zeigt auf jeder Seite die Fuß-Links zu Datenschutz und Impressum', () => {
    for (const route of routes) {
      const { unmount } = render(
        <MemoryRouter initialEntries={[route]}>
          <AuthProvider>
            <App />
          </AuthProvider>
        </MemoryRouter>,
      )

      expect(screen.getByRole('link', { name: 'Datenschutz' })).toBeInTheDocument()
      expect(screen.getByRole('link', { name: 'Impressum' })).toBeInTheDocument()
      expect(screen.getByRole('link', { name: 'Datenschutz' })).toHaveAttribute(
        'href',
        '/datenschutz',
      )
      expect(screen.getByRole('link', { name: 'Impressum' })).toHaveAttribute(
        'href',
        '/impressum',
      )

      unmount()
    }
  })

  it('zeigt die Hauptnavigation', () => {
    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <AuthProvider>
          <App />
        </AuthProvider>
      </MemoryRouter>,
    )

    expect(screen.getByRole('link', { name: 'Dashboard' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Tickets' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Neues Ticket' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Benutzer' })).toBeInTheDocument()
  })
})
