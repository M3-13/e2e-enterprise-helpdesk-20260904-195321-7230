import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { apiGet, apiPatch, apiPost, ApiError } from '../api/client'
import { useAuth } from '../context/AuthContext'
import type {
  TicketDetail,
  TicketPriority,
  TicketStatus,
  User,
} from '../types'

const PRIORITY_LABELS: Record<TicketPriority, string> = {
  low: 'Niedrig',
  medium: 'Mittel',
  high: 'Hoch',
  critical: 'Kritisch',
}

const STATUS_LABELS: Record<TicketStatus, string> = {
  open: 'Offen',
  in_progress: 'In Bearbeitung',
  closed: 'Geschlossen',
}

function formatDateTime(value: string | null): string {
  if (!value) return '–'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('de-DE')
}

function isOverdue(ticket: TicketDetail): boolean {
  if (ticket.status === 'closed' || !ticket.due_date) return false
  const due = new Date(ticket.due_date)
  if (Number.isNaN(due.getTime())) return false
  return due.getTime() < Date.now()
}

interface EditForm {
  title: string
  description: string
  category: string
  priority: TicketPriority
  status: TicketStatus
}

export default function TicketDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()

  const [ticket, setTicket] = useState<TicketDetail | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  const [commentBody, setCommentBody] = useState<string>('')
  const [submittingComment, setSubmittingComment] = useState<boolean>(false)

  const [editing, setEditing] = useState<boolean>(false)
  const [editForm, setEditForm] = useState<EditForm>({
    title: '',
    description: '',
    category: '',
    priority: 'medium',
    status: 'open',
  })
  const [savingEdit, setSavingEdit] = useState<boolean>(false)

  const [agents, setAgents] = useState<User[]>([])
  const [assignAgentId, setAssignAgentId] = useState<string>('')
  const [assigning, setAssigning] = useState<boolean>(false)
  const [closing, setClosing] = useState<boolean>(false)

  const [actionError, setActionError] = useState<string | null>(null)

  const ticketId = Number(id)
  const canEdit = Boolean(user && (user.role === 'agent' || user.role === 'admin'))
  const isAdmin = Boolean(user && user.role === 'admin')

  const load = useCallback(async () => {
    if (!Number.isInteger(ticketId) || ticketId <= 0) {
      setError('Ungültige Ticket-ID.')
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const data = await apiGet<TicketDetail>(`/api/tickets/${ticketId}`)
      setTicket(data)
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) {
        setError('Ticket nicht gefunden.')
      } else {
        setError('Das Ticket konnte nicht geladen werden.')
      }
    } finally {
      setLoading(false)
    }
  }, [ticketId])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!isAdmin) return
    let cancelled = false
    apiGet<User[]>('/api/users')
      .then((users) => {
        if (!cancelled) setAgents(users.filter((u) => u.role === 'agent'))
      })
      .catch(() => {
        if (!cancelled) setAgents([])
      })
    return () => {
      cancelled = true
    }
  }, [isAdmin])

  const handleCommentSubmit = async (e: FormEvent): Promise<void> => {
    e.preventDefault()
    const body = commentBody.trim()
    if (!body) return
    setSubmittingComment(true)
    setActionError(null)
    try {
      await apiPost(`/api/tickets/${ticketId}/comments`, { body })
      setCommentBody('')
      await load()
    } catch {
      setActionError('Der Kommentar konnte nicht gespeichert werden.')
    } finally {
      setSubmittingComment(false)
    }
  }

  const startEditing = (): void => {
    if (!ticket) return
    setEditForm({
      title: ticket.title,
      description: ticket.description,
      category: ticket.category,
      priority: ticket.priority,
      status: ticket.status,
    })
    setActionError(null)
    setEditing(true)
  }

  const cancelEditing = (): void => {
    setEditing(false)
    setActionError(null)
  }

  const handleEditSubmit = async (e: FormEvent): Promise<void> => {
    e.preventDefault()
    setSavingEdit(true)
    setActionError(null)
    try {
      const updated = await apiPatch<TicketDetail>(`/api/tickets/${ticketId}`, {
        title: editForm.title,
        description: editForm.description,
        category: editForm.category,
        priority: editForm.priority,
        status: editForm.status,
      })
      setTicket({ ...updated, comments: ticket?.comments ?? [], audit_log: ticket?.audit_log ?? [] })
      setEditing(false)
    } catch {
      setActionError('Die Änderungen konnten nicht gespeichert werden.')
    } finally {
      setSavingEdit(false)
    }
  }

  const handleAssign = async (agentId: number | null): Promise<void> => {
    setAssigning(true)
    setActionError(null)
    try {
      const updated = await apiPost<TicketDetail>(`/api/tickets/${ticketId}/assign`, {
        agent_id: agentId,
      })
      setTicket({ ...updated, comments: ticket?.comments ?? [], audit_log: ticket?.audit_log ?? [] })
      if (agentId === null) setAssignAgentId('')
    } catch {
      setActionError('Die Zuweisung konnte nicht geändert werden.')
    } finally {
      setAssigning(false)
    }
  }

  const handleClose = async (): Promise<void> => {
    setClosing(true)
    setActionError(null)
    try {
      const updated = await apiPost<TicketDetail>(`/api/tickets/${ticketId}/close`)
      setTicket({ ...updated, comments: ticket?.comments ?? [], audit_log: ticket?.audit_log ?? [] })
    } catch {
      setActionError('Das Ticket konnte nicht geschlossen werden.')
    } finally {
      setClosing(false)
    }
  }

  if (loading) {
    return (
      <div className="page">
        <h1>Ticket</h1>
        <p className="page-muted">Wird geladen …</p>
      </div>
    )
  }

  if (error || !ticket) {
    return (
      <div className="page">
        <h1>Ticket</h1>
        <p className="page-muted">{error ?? 'Ticket nicht gefunden.'}</p>
        <Link to="/tickets">Zurück zur Liste</Link>
      </div>
    )
  }

  const overdue = isOverdue(ticket)

  return (
    <div className="ticket-detail">
      <Link to="/tickets" className="ticket-detail__back">
        ← Zurück zur Liste
      </Link>

      <div className="ticket-detail__head">
        <h1 className="ticket-detail__title">{ticket.title}</h1>
        <div className="ticket-detail__badges">
          <span className={`badge badge--status badge--status-${ticket.status}`}>
            {STATUS_LABELS[ticket.status]}
          </span>
          <span className={`badge badge--priority badge--priority-${ticket.priority}`}>
            {PRIORITY_LABELS[ticket.priority]}
          </span>
          {overdue && <span className="badge badge--overdue">Überfällig</span>}
        </div>
      </div>

      {actionError && (
        <div className="alert alert--error" role="alert">
          {actionError}
        </div>
      )}

      <section className="card ticket-detail__fields">
        <h2>Ticketdetails</h2>
        <dl className="detail-grid">
          <dt>Kategorie</dt>
          <dd>{ticket.category || '–'}</dd>
          <dt>Beschreibung</dt>
          <dd className="detail-grid__wide">{ticket.description || '–'}</dd>
          <dt>Fälligkeit</dt>
          <dd>{formatDateTime(ticket.due_date)}</dd>
          <dt>Zugewiesen an</dt>
          <dd>{ticket.assignee_id ? `Agent #${ticket.assignee_id}` : '–'}</dd>
          <dt>Ersteller</dt>
          <dd>#{ticket.requester_id}</dd>
          <dt>Erstellt</dt>
          <dd>{formatDateTime(ticket.created_at)}</dd>
          <dt>Aktualisiert</dt>
          <dd>{formatDateTime(ticket.updated_at)}</dd>
        </dl>
      </section>

      {canEdit && (
        <section className="card ticket-detail__actions">
          <h2>Bearbeitung</h2>

          {!editing ? (
            <div className="ticket-detail__action-row">
              <button type="button" className="btn btn--primary" onClick={startEditing}>
                Bearbeiten
              </button>
              {ticket.status !== 'closed' && (
                <button
                  type="button"
                  className="btn btn--danger"
                  onClick={() => void handleClose()}
                  disabled={closing}
                >
                  {closing ? 'Wird geschlossen …' : 'Ticket schließen'}
                </button>
              )}
            </div>
          ) : (
            <form onSubmit={handleEditSubmit} className="form">
              <div className="form-field">
                <label className="form-field__label" htmlFor="edit-title">
                  Titel
                </label>
                <input
                  id="edit-title"
                  className="input"
                  value={editForm.title}
                  onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))}
                />
              </div>
              <div className="form-field">
                <label className="form-field__label" htmlFor="edit-description">
                  Beschreibung
                </label>
                <textarea
                  id="edit-description"
                  className="input"
                  rows={4}
                  value={editForm.description}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, description: e.target.value }))
                  }
                />
              </div>
              <div className="form-field">
                <label className="form-field__label" htmlFor="edit-category">
                  Kategorie
                </label>
                <input
                  id="edit-category"
                  className="input"
                  value={editForm.category}
                  onChange={(e) => setEditForm((f) => ({ ...f, category: e.target.value }))}
                />
              </div>
              <div className="form-field">
                <label className="form-field__label" htmlFor="edit-priority">
                  Priorität
                </label>
                <select
                  id="edit-priority"
                  className="input"
                  value={editForm.priority}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, priority: e.target.value as TicketPriority }))
                  }
                >
                  <option value="low">Niedrig</option>
                  <option value="medium">Mittel</option>
                  <option value="high">Hoch</option>
                  <option value="critical">Kritisch</option>
                </select>
              </div>
              <div className="form-field">
                <label className="form-field__label" htmlFor="edit-status">
                  Status
                </label>
                <select
                  id="edit-status"
                  className="input"
                  value={editForm.status}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, status: e.target.value as TicketStatus }))
                  }
                >
                  <option value="open">Offen</option>
                  <option value="in_progress">In Bearbeitung</option>
                  <option value="closed">Geschlossen</option>
                </select>
              </div>
              <div className="ticket-detail__action-row">
                <button type="submit" className="btn btn--primary" disabled={savingEdit}>
                  {savingEdit ? 'Wird gespeichert …' : 'Speichern'}
                </button>
                <button type="button" className="btn btn--secondary" onClick={cancelEditing}>
                  Abbrechen
                </button>
              </div>
            </form>
          )}

          <div className="ticket-detail__assign">
            <h3>Zuweisung</h3>
            <div className="ticket-detail__assign-row">
              {isAdmin ? (
                <select
                  className="input"
                  aria-label="Zugewiesener Agent"
                  value={assignAgentId}
                  onChange={(e) => setAssignAgentId(e.target.value)}
                >
                  <option value="">Nicht zugewiesen</option>
                  {agents.map((agent) => (
                    <option key={agent.id} value={String(agent.id)}>
                      {agent.username} (#{agent.id})
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  className="input"
                  aria-label="Agent-ID"
                  type="number"
                  placeholder="Agent-ID"
                  value={assignAgentId}
                  onChange={(e) => setAssignAgentId(e.target.value)}
                />
              )}
              <button
                type="button"
                className="btn btn--secondary"
                disabled={assigning}
                onClick={() =>
                  void handleAssign(assignAgentId === '' ? null : Number(assignAgentId))
                }
              >
                Zuweisen
              </button>
              <button
                type="button"
                className="btn btn--ghost"
                disabled={assigning}
                onClick={() => void handleAssign(null)}
              >
                Zuweisung entfernen
              </button>
            </div>
          </div>
        </section>
      )}

      <section className="card ticket-detail__comments">
        <h2>Kommentare</h2>
        {ticket.comments.length === 0 ? (
          <p className="page-muted">Noch keine Kommentare.</p>
        ) : (
          <ul className="comment-list">
            {ticket.comments.map((comment) => (
              <li key={comment.id} className="comment">
                <div className="comment__meta">
                  <span className="comment__author">Autor #{comment.author_id}</span>
                  <span className="comment__time">{formatDateTime(comment.created_at)}</span>
                </div>
                <p className="comment__body">{comment.body}</p>
              </li>
            ))}
          </ul>
        )}

        <form onSubmit={handleCommentSubmit} className="form comment-form">
          <div className="form-field">
            <label className="form-field__label" htmlFor="comment-body">
              Neuer Kommentar
            </label>
            <textarea
              id="comment-body"
              className="input"
              rows={3}
              value={commentBody}
              onChange={(e) => setCommentBody(e.target.value)}
              placeholder="Kommentar schreiben …"
            />
          </div>
          <button
            type="submit"
            className="btn btn--primary"
            disabled={submittingComment || commentBody.trim() === ''}
          >
            {submittingComment ? 'Wird gesendet …' : 'Kommentieren'}
          </button>
        </form>
      </section>

      <section className="card ticket-detail__audit">
        <h2>Änderungsprotokoll</h2>
        {ticket.audit_log.length === 0 ? (
          <p className="page-muted">Noch keine Änderungen protokolliert.</p>
        ) : (
          <ul className="audit-list">
            {ticket.audit_log.map((entry) => (
              <li key={entry.id} className="audit-entry">
                <span className="audit-entry__time">{formatDateTime(entry.created_at)}</span>
                <span className="audit-entry__field">{entry.field}</span>
                <span className="audit-entry__change">
                  {entry.old_value ?? '–'} → {entry.new_value ?? '–'}
                </span>
                <span className="audit-entry__user">von #{entry.user_id}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
