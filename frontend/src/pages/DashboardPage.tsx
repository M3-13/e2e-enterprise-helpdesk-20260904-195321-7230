import { useEffect, useState } from 'react'
import { apiGet } from '../api/client'
import type { DashboardStats, TicketPriority } from '../types'
import './DashboardPage.css'

const PRIORITY_LABELS: Record<TicketPriority, string> = {
  low: 'Niedrig',
  medium: 'Mittel',
  high: 'Hoch',
  critical: 'Kritisch',
}

const PRIORITY_ORDER: TicketPriority[] = ['critical', 'high', 'medium', 'low']

interface Kpi {
  key: string
  label: string
  value: number
  tone: 'accent' | 'danger' | 'success'
}

function buildKpis(stats: DashboardStats): Kpi[] {
  return [
    { key: 'open', label: 'Offene Tickets', value: stats.open, tone: 'accent' },
    { key: 'overdue', label: 'Überfällige Tickets', value: stats.overdue, tone: 'danger' },
    { key: 'closed_today', label: 'Heute geschlossen', value: stats.closed_today, tone: 'success' },
  ]
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    apiGet<DashboardStats>('/api/dashboard')
      .then((data) => {
        if (active) setStats(data)
      })
      .catch((err: unknown) => {
        if (!active) return
        const message = err instanceof Error ? err.message : 'Unbekannter Fehler'
        setError(message)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  return (
    <div className="dashboard">
      <h1>Dashboard</h1>

      {loading && <p className="dashboard__status">Kennzahlen werden geladen…</p>}

      {!loading && error && (
        <div className="dashboard__error" role="alert">
          <p>Die Kennzahlen konnten nicht geladen werden.</p>
          <p className="dashboard__error-detail">{error}</p>
        </div>
      )}

      {!loading && !error && stats && (
        <>
          <div className="dashboard__kpis">
            {buildKpis(stats).map((kpi) => (
              <div key={kpi.key} className={`kpi-card kpi-card--${kpi.tone}`}>
                <div className="kpi-card__label">{kpi.label}</div>
                <div className="kpi-card__value">{kpi.value}</div>
              </div>
            ))}
          </div>

          <section className="dashboard__section">
            <h2>Prioritätsverteilung</h2>
            <ul className="priority-list">
              {PRIORITY_ORDER.map((priority) => (
                <li key={priority} className="priority-list__item">
                  <span className={`priority-badge priority-badge--${priority}`}>
                    {PRIORITY_LABELS[priority]}
                  </span>
                  <span className="priority-list__bar" aria-hidden="true">
                    <span
                      className={`priority-list__fill priority-list__fill--${priority}`}
                      style={{
                        width: `${priorityShare(stats.by_priority[priority], stats)}%`,
                      }}
                    />
                  </span>
                  <span className="priority-list__count">{stats.by_priority[priority]}</span>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  )
}

function priorityShare(value: number, stats: DashboardStats): number {
  const total =
    stats.by_priority.low +
    stats.by_priority.medium +
    stats.by_priority.high +
    stats.by_priority.critical
  if (total === 0) return 0
  return Math.round((value / total) * 100)
}
