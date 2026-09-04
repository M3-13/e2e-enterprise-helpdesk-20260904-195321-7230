import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Layout from './Layout'
import { AuthProvider } from '../context/AuthContext'

describe('Layout', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    cleanup()
  })

  function renderLayout(): void {
    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <AuthProvider>
          <Layout />
        </AuthProvider>
      </MemoryRouter>,
    )
  }

  it('bietet einen Skip-Link, der zum Hauptinhalt springt', () => {
    renderLayout()

    const skipLink = screen.getByRole('link', { name: 'Zum Inhalt springen' })
    expect(skipLink).toBeInTheDocument()
    expect(skipLink).toHaveAttribute('href', '#main-content')
    expect(skipLink).toHaveClass('skip-link')
  })

  it('markiert das Hauptelement als Sprungziel des Skip-Links', () => {
    renderLayout()

    const main = screen.getByRole('main')
    expect(main).toBeInTheDocument()
    expect(main).toHaveAttribute('id', 'main-content')
  })
})
