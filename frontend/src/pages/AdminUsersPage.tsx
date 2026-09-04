import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { apiGet, apiPost, apiPatch, ApiError } from '../api/client'
import { useAuth } from '../context/AuthContext'
import type { Role, User } from '../types'
import styles from './AdminUsersPage.module.css'

const ROLES: { value: Role; label: string }[] = [
  { value: 'requester', label: 'Melder' },
  { value: 'agent', label: 'Agent' },
  { value: 'admin', label: 'Administrator' },
]

interface ValidationError {
  loc?: (string | number)[]
  msg?: string
  type?: string
}

function fieldErrors(detail: unknown): Record<string, string> {
  const result: Record<string, string> = {}
  if (!Array.isArray(detail)) return result
  for (const item of detail) {
    if (!item || typeof item !== 'object') continue
    const err = item as ValidationError
    const loc = Array.isArray(err.loc) ? err.loc : []
    const last = loc[loc.length - 1]
    const field = typeof last === 'string' ? last : 'form'
    const msg = typeof err.msg === 'string' ? err.msg : 'Ungültige Eingabe'
    result[field] = result[field] ? `${result[field]}; ${msg}` : msg
  }
  return result
}

export default function AdminUsersPage() {
  const { user, isAuthenticated } = useAuth()

  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<Role>('requester')
  const [submitting, setSubmitting] = useState(false)
  const [fieldErrorsMap, setFieldErrorsMap] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const [updatingId, setUpdatingId] = useState<number | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const loadUsers = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const data = await apiGet<User[]>('/api/users')
      setUsers(data)
    } catch (error) {
      if (error instanceof ApiError && error.status === 403) {
        setLoadError('Keine Berechtigung für die Benutzerverwaltung.')
      } else {
        setLoadError('Die Benutzerliste konnte nicht geladen werden.')
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadUsers()
  }, [loadUsers])

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  if (user?.role !== 'admin') {
    return <Navigate to="/dashboard" replace />
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setFormError(null)
    setSuccessMessage(null)

    const errors: Record<string, string> = {}
    if (!username.trim()) errors.username = 'Benutzername ist erforderlich.'
    if (!email.trim()) errors.email = 'E-Mail ist erforderlich.'
    if (!password) errors.password = 'Passwort ist erforderlich.'
    setFieldErrorsMap(errors)
    if (Object.keys(errors).length > 0) return

    setSubmitting(true)
    try {
      await apiPost<User>('/api/users', {
        username: username.trim(),
        email: email.trim(),
        password,
        role,
      })
      setUsername('')
      setEmail('')
      setPassword('')
      setRole('requester')
      setSuccessMessage('Benutzer wurde angelegt.')
      await loadUsers()
    } catch (error) {
      if (error instanceof ApiError) {
        const serverErrors = fieldErrors(error.detail)
        if (Object.keys(serverErrors).length > 0) {
          setFieldErrorsMap(serverErrors)
        } else {
          setFormError(error.message)
        }
      } else {
        setFormError('Der Benutzer konnte nicht angelegt werden. Bitte versuche es erneut.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  const changeRole = async (id: number, newRole: Role) => {
    setUpdatingId(id)
    setActionError(null)
    setSuccessMessage(null)
    try {
      const updated = await apiPatch<User>(`/api/users/${id}`, { role: newRole })
      setUsers((prev) => prev.map((u) => (u.id === id ? updated : u)))
      setSuccessMessage('Rolle wurde geändert.')
    } catch (error) {
      setActionError(
        error instanceof ApiError ? error.message : 'Die Rolle konnte nicht geändert werden.',
      )
    } finally {
      setUpdatingId(null)
    }
  }

  const toggleActive = async (id: number, current: boolean) => {
    setUpdatingId(id)
    setActionError(null)
    setSuccessMessage(null)
    try {
      const updated = await apiPatch<User>(`/api/users/${id}`, { is_active: !current })
      setUsers((prev) => prev.map((u) => (u.id === id ? updated : u)))
      setSuccessMessage(updated.is_active ? 'Benutzer wurde aktiviert.' : 'Benutzer wurde deaktiviert.')
    } catch (error) {
      setActionError(
        error instanceof ApiError ? error.message : 'Der Status konnte nicht geändert werden.',
      )
    } finally {
      setUpdatingId(null)
    }
  }

  return (
    <div className="page">
      <h1>Benutzerverwaltung</h1>

      {successMessage && (
        <div className={styles.successMessage} role="status">
          {successMessage}
        </div>
      )}
      {actionError && (
        <div className={styles.formError} role="alert">
          {actionError}
        </div>
      )}

      <section className={styles.card}>
        <h2>Benutzer anlegen</h2>
        {formError && (
          <div className={styles.formError} role="alert">
            {formError}
          </div>
        )}
        <form className={styles.form} onSubmit={handleSubmit} noValidate>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="user-username">
              Benutzername <span className={styles.required}>*</span>
            </label>
            <input
              id="user-username"
              className={`${styles.input}${fieldErrorsMap.username ? ` ${styles.invalid}` : ''}`}
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              aria-invalid={Boolean(fieldErrorsMap.username)}
            />
            {fieldErrorsMap.username && (
              <span className={styles.fieldError}>{fieldErrorsMap.username}</span>
            )}
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="user-email">
              E-Mail <span className={styles.required}>*</span>
            </label>
            <input
              id="user-email"
              className={`${styles.input}${fieldErrorsMap.email ? ` ${styles.invalid}` : ''}`}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-invalid={Boolean(fieldErrorsMap.email)}
            />
            {fieldErrorsMap.email && (
              <span className={styles.fieldError}>{fieldErrorsMap.email}</span>
            )}
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="user-password">
              Passwort <span className={styles.required}>*</span>
            </label>
            <input
              id="user-password"
              className={`${styles.input}${fieldErrorsMap.password ? ` ${styles.invalid}` : ''}`}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-invalid={Boolean(fieldErrorsMap.password)}
            />
            {fieldErrorsMap.password && (
              <span className={styles.fieldError}>{fieldErrorsMap.password}</span>
            )}
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="user-role">
              Rolle <span className={styles.required}>*</span>
            </label>
            <select
              id="user-role"
              className={styles.select}
              value={role}
              onChange={(e) => setRole(e.target.value as Role)}
            >
              {ROLES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.actions}>
            <button type="submit" className={styles.buttonPrimary} disabled={submitting}>
              {submitting ? 'Wird angelegt …' : 'Benutzer anlegen'}
            </button>
          </div>
        </form>
      </section>

      <section className={styles.card}>
        <h2>Benutzer</h2>
        {loading ? (
          <p className={styles.muted}>Benutzer werden geladen …</p>
        ) : loadError ? (
          <div className={styles.formError} role="alert">
            {loadError}
          </div>
        ) : users.length === 0 ? (
          <p className={styles.muted}>Keine Benutzer vorhanden.</p>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Benutzername</th>
                  <th>E-Mail</th>
                  <th>Rolle</th>
                  <th>Status</th>
                  <th>Aktionen</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td>{u.username}</td>
                    <td>{u.email}</td>
                    <td>
                      <select
                        className={styles.selectInline}
                        value={u.role}
                        onChange={(e) => void changeRole(u.id, e.target.value as Role)}
                        disabled={updatingId === u.id}
                        aria-label={`Rolle für ${u.username}`}
                      >
                        {ROLES.map((r) => (
                          <option key={r.value} value={r.value}>
                            {r.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <span
                        className={`${styles.badge} ${u.is_active ? styles.badgeActive : styles.badgeInactive}`}
                      >
                        {u.is_active ? 'Aktiv' : 'Deaktiviert'}
                      </span>
                    </td>
                    <td>
                      <button
                        type="button"
                        className={u.is_active ? styles.buttonDanger : styles.buttonSecondary}
                        onClick={() => void toggleActive(u.id, u.is_active)}
                        disabled={updatingId === u.id}
                      >
                        {u.is_active ? 'Deaktivieren' : 'Aktivieren'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
