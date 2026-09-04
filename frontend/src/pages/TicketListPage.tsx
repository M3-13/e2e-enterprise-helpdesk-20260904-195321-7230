import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { apiGet, ApiError } from '../api/client'
import type { Ticket, TicketListResponse, TicketPriority, TicketStatus } from '../types'
import styles from './TicketListPage.module.css'

const STATUS_OPTIONS: { value: '' | TicketStatus; label: string }[] = [
  { value: '', label: 'Alle Status' },
  { value: 'open', label: 'Offen' },
  { value: 'in_progress', label: 'In Bearbeitung' },
  { value: 'closed', label: 'Geschlossen' },
]

const PRIORITY_OPTIONS: { value: '' | TicketPriority; label: string }[] = [
  { value: '', label: 'Alle Prioritäten' },
  { value: 'low', label: 'Niedrig' },
  { value: 'medium', label: 'Mittel' },
  { value: 'high', label: 'Hoch' },
  { value: 'critical', label: 'Kritisch' },
]

const SORT_OPTIONS: { value: '' | 'priority' | 'due_date'; label: string }[] = [
  { value: '', label: 'Neueste zuerst' },
  { value: 'priority', label: 'Priorität' },
  { value: 'due_date', label: 'Fälligkeit' },
]

const STATUS_LABELS: Record<TicketStatus, string> = {
  open: 'Offen',
  in_progress: 'In Bearbeitung',
  closed: 'Geschlossen',
}

const PRIORITY_LABELS: Record<TicketPriority, string> = {
  low: 'Niedrig',
  medium: 'Mittel',
  high: 'Hoch',
  critical: 'Kritisch',
}

const STATUS_CLASS: Record<TicketStatus, string> = {
  open: styles.statusOpen,
  in_progress: styles.statusInProgress,
  closed: styles.statusClosed,
}

const PRIORITY_CLASS: Record<TicketPriority, string> = {
  low: styles.priorityLow,
  medium: styles.priorityMedium,
  high: styles.priorityHigh,
  critical: styles.priorityCritical,
}

function buildQuery(params: Record<string, string | number | undefined>): string {
  const q = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') q.set(key, String(value))
  }
  const s = q.toString()
  return s ? `?${s}` : ''
}

function isOverdue(ticket: Ticket): boolean {
  if (ticket.status === 'closed' || !ticket.due_date) return false
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  return new Date(ticket.due_date).getTime() < todayStart
}

function formatDate(value: string | null): string {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('de-DE')
}

export default function TicketListPage() {
  const navigate = useNavigate()

  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<'' | TicketStatus>('')
  const [priority, setPriority] = useState<'' | TicketPriority>('')
  const [assignee, setAssignee] = useState('')
  const [sort, setSort] = useState<'' | 'priority' | 'due_date'>('')
  const [page, setPage] = useState(1)
  const pageSize = 20

  const [data, setData] = useState<TicketListResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim())
      setPage(1)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchInput])

  useEffect(() => {
    let cancelled = false
    const assigneeId = /^\d+$/.test(assignee.trim()) ? Number(assignee.trim()) : undefined

    const query = buildQuery({
      search: search || undefined,
      status: status || undefined,
      priority: priority || undefined,
      assignee_id: assigneeId,
      sort: sort || undefined,
      page,
      page_size: pageSize,
    })

    setLoading(true)
    setError(null)

    apiGet<TicketListResponse>(`/api/tickets${query}`)
      .then((res) => {
        if (cancelled) return
        setData(res)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        if (err instanceof ApiError && err.status === 401) {
          navigate('/login')
          return
        }
        setError(
          err instanceof ApiError ? err.message : 'Tickets konnten nicht geladen werden.',
        )
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [search, status, priority, assignee, sort, page, pageSize, navigate])

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.page_size)) : 1

  const changeFilter = <T,>(setter: (value: T) => void) => {
    return (value: T) => {
      setter(value)
      setPage(1)
    }
  }

  return (
    <div>
      <div className={styles.header}>
        <h1>Tickets</h1>
        <Link to="/tickets/new" className={`${styles.button} ${styles.buttonPrimary}`}>
          Neues Ticket
        </Link>
      </div>

      <div className={styles.toolbar}>
        <div className={`${styles.field} ${styles.searchField}`}>
          <label className={styles.label} htmlFor="ticket-search">
            Suche
          </label>
          <input
            id="ticket-search"
            className={styles.input}
            type="search"
            placeholder="Titel oder Beschreibung durchsuchen"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="ticket-status">
            Status
          </label>
          <select
            id="ticket-status"
            className={styles.select}
            value={status}
            onChange={(e) => changeFilter(setStatus)(e.target.value as '' | TicketStatus)}
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="ticket-priority">
            Priorität
          </label>
          <select
            id="ticket-priority"
            className={styles.select}
            value={priority}
            onChange={(e) => changeFilter(setPriority)(e.target.value as '' | TicketPriority)}
          >
            {PRIORITY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="ticket-assignee">
            Zuständigkeit (Agent-ID)
          </label>
          <input
            id="ticket-assignee"
            className={styles.input}
            type="text"
            inputMode="numeric"
            placeholder="Alle"
            value={assignee}
            onChange={(e) => changeFilter(setAssignee)(e.target.value)}
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="ticket-sort">
            Sortierung
          </label>
          <select
            id="ticket-sort"
            className={styles.select}
            value={sort}
            onChange={(e) =>
              changeFilter(setSort)(e.target.value as '' | 'priority' | 'due_date')
            }
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div className={styles.error} role="alert">
          {error}
        </div>
      )}

      {loading && !data && <p className={styles.empty}>Lade Tickets …</p>}

      {!loading && !error && data && data.items.length === 0 && (
        <p className={styles.empty}>Keine Tickets gefunden.</p>
      )}

      {data && data.items.length > 0 && (
        <>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Titel</th>
                  <th>Kategorie</th>
                  <th>Priorität</th>
                  <th>Status</th>
                  <th>Fälligkeit</th>
                  <th>Zuständigkeit</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((ticket) => (
                  <tr key={ticket.id}>
                    <td>
                      <Link to={`/tickets/${ticket.id}`} className={styles.titleLink}>
                        {ticket.title}
                      </Link>
                    </td>
                    <td>{ticket.category}</td>
                    <td>
                      <span className={`${styles.badge} ${PRIORITY_CLASS[ticket.priority]}`}>
                        {PRIORITY_LABELS[ticket.priority]}
                      </span>
                    </td>
                    <td>
                      <span className={`${styles.badge} ${STATUS_CLASS[ticket.status]}`}>
                        {STATUS_LABELS[ticket.status]}
                      </span>
                      {isOverdue(ticket) && (
                        <span className={`${styles.badge} ${styles.overdue}`}>Überfällig</span>
                      )}
                    </td>
                    <td>{formatDate(ticket.due_date)}</td>
                    <td className={styles.muted}>
                      {ticket.assignee_id === null ? '—' : `#${ticket.assignee_id}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className={styles.pagination}>
            <span className={styles.paginationInfo}>
              Seite {data.page} von {totalPages}
            </span>
            <button
              type="button"
              className={styles.button}
              disabled={data.page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Zurück
            </button>
            <button
              type="button"
              className={styles.button}
              disabled={data.page >= totalPages || loading}
              onClick={() => setPage((p) => p + 1)}
            >
              Weiter
            </button>
          </div>
        </>
      )}
    </div>
  )
}
