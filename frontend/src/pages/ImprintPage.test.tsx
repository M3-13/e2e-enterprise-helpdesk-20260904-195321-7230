import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import ImprintPage from './ImprintPage'

afterEach(cleanup)

describe('ImprintPage', () => {
  it('zeigt die Überschrift Impressum', () => {
    render(<ImprintPage />)

    expect(
      screen.getByRole('heading', { level: 1, name: 'Impressum' }),
    ).toBeInTheDocument()
  })

  it('zeigt mindestens einen Inhaltsabschnitt', () => {
    render(<ImprintPage />)

    expect(
      screen.getByRole('heading', { name: 'Angaben gemäß § 5 TMG' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'Kontakt' }),
    ).toBeInTheDocument()
  })

  it('enthält keine Platzhalter', () => {
    render(<ImprintPage />)

    expect(screen.queryByText(/Musterstraße/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Musterstadt/)).not.toBeInTheDocument()
    expect(screen.queryByText(/kontakt@helpdesk\.example/)).not.toBeInTheDocument()
  })

  it('benennt vertretungsberechtigte Personen', () => {
    render(<ImprintPage />)

    expect(screen.getAllByText(/Markus Brandt/).length).toBeGreaterThan(0)
  })
})
