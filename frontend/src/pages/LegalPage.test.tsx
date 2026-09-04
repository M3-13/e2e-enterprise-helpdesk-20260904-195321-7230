import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import LegalPage from './LegalPage'

afterEach(cleanup)

describe('LegalPage', () => {
  it('zeigt die Überschrift Datenschutzerklärung', () => {
    render(<LegalPage />)

    expect(
      screen.getByRole('heading', { level: 1, name: 'Datenschutzerklärung' }),
    ).toBeInTheDocument()
  })

  it('zeigt mindestens einen Inhaltsabschnitt', () => {
    render(<LegalPage />)

    expect(
      screen.getByRole('heading', { name: /Verarbeitete Daten/ }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: /Ihre Rechte/ }),
    ).toBeInTheDocument()
  })
})
