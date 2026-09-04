import { useParams } from 'react-router-dom'

export default function TicketDetailPage() {
  const { id } = useParams<{ id: string }>()

  return (
    <div className="page">
      <h1>Ticket {id ?? ''}</h1>
      <p className="page-muted">
        Die Detailansicht mit Kommentaren und Änderungsprotokoll wird in einem
        späteren Schritt implementiert.
      </p>
    </div>
  )
}
