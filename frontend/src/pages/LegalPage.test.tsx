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

  it('nennt Art. 88 DSGVO i. V. m. § 26 BDSG als Rechtsgrundlage', () => {
    render(<LegalPage />)

    expect(screen.getByText(/Art\. 88 DSGVO/)).toBeInTheDocument()
    expect(screen.getByText(/§ 26 BDSG/)).toBeInTheDocument()
  })

  it('beschreibt die lokale Speicherung des JWT', () => {
    render(<LegalPage />)

    expect(
      screen.getByRole('heading', { name: /Lokale Speicherung/ }),
    ).toBeInTheDocument()
    expect(screen.getByText(/localStorage/)).toBeInTheDocument()
    expect(screen.getByText(/30 Minuten/)).toBeInTheDocument()
  })

  it('nennt den Verantwortlichen und eine Datenschutz-E-Mail-Adresse', () => {
    render(<LegalPage />)

    expect(screen.getByText(/Enterprise Helpdesk GmbH/)).toBeInTheDocument()
    expect(
      screen.getAllByText(/datenschutz@enterprise-helpdesk\.de/).length,
    ).toBeGreaterThan(0)
  })

  it('weist auf den integrierten Datenexport hin', () => {
    render(<LegalPage />)

    expect(screen.getByText(/Datenexport/)).toBeInTheDocument()
  })
})
