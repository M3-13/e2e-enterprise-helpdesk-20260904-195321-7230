import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiPost, ApiError } from '../api/client'
import type { Ticket, TicketPriority } from '../types'
import styles from './TicketNewPage.module.css'

const PRIORITIES: { value: TicketPriority; label: string }[] = [
  { value: 'low', label: 'Niedrig' },
  { value: 'medium', label: 'Mittel' },
  { value: 'high', label: 'Hoch' },
  { value: 'critical', label: 'Kritisch' },
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

export default function TicketNewPage() {
  const navigate = useNavigate()

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('')
  const [priority, setPriority] = useState<TicketPriority | ''>('')
  const [submitting, setSubmitting] = useState(false)
  const [fieldErrorsMap, setFieldErrorsMap] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setFormError(null)

    const errors: Record<string, string> = {}
    if (!title.trim()) errors.title = 'Titel ist erforderlich.'
    if (!description.trim()) errors.description = 'Beschreibung ist erforderlich.'
    if (!category.trim()) errors.category = 'Kategorie ist erforderlich.'
    if (!priority) errors.priority = 'Priorität ist erforderlich.'
    setFieldErrorsMap(errors)
    if (Object.keys(errors).length > 0) return

    setSubmitting(true)
    try {
      await apiPost<Ticket>('/api/tickets', {
        title: title.trim(),
        description: description.trim(),
        category: category.trim(),
        priority,
      })
      navigate('/tickets')
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.status === 401) {
          navigate('/login')
          return
        }
        const serverErrors = fieldErrors(error.detail)
        if (Object.keys(serverErrors).length > 0) {
          setFieldErrorsMap(serverErrors)
        } else {
          setFormError(error.message)
        }
      } else {
        setFormError('Das Ticket konnte nicht angelegt werden. Bitte versuche es erneut.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  const handleCancel = () => {
    navigate('/tickets')
  }

  return (
    <div className="page">
      <h1>Neues Ticket</h1>
      {formError && (
        <div className={styles.formError} role="alert">
          {formError}
        </div>
      )}
      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="ticket-title">
            Titel <span className={styles.required}>*</span>
          </label>
          <input
            id="ticket-title"
            className={`${styles.input}${fieldErrorsMap.title ? ` ${styles.invalid}` : ''}`}
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            aria-invalid={Boolean(fieldErrorsMap.title)}
            aria-describedby={fieldErrorsMap.title ? 'ticket-title-error' : undefined}
          />
          {fieldErrorsMap.title && (
            <span id="ticket-title-error" className={styles.fieldError}>
              {fieldErrorsMap.title}
            </span>
          )}
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="ticket-description">
            Beschreibung <span className={styles.required}>*</span>
          </label>
          <textarea
            id="ticket-description"
            className={`${styles.textarea}${fieldErrorsMap.description ? ` ${styles.invalid}` : ''}`}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            aria-invalid={Boolean(fieldErrorsMap.description)}
            aria-describedby={fieldErrorsMap.description ? 'ticket-description-error' : undefined}
          />
          {fieldErrorsMap.description && (
            <span id="ticket-description-error" className={styles.fieldError}>
              {fieldErrorsMap.description}
            </span>
          )}
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="ticket-category">
            Kategorie <span className={styles.required}>*</span>
          </label>
          <input
            id="ticket-category"
            className={`${styles.input}${fieldErrorsMap.category ? ` ${styles.invalid}` : ''}`}
            type="text"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            aria-invalid={Boolean(fieldErrorsMap.category)}
            aria-describedby={fieldErrorsMap.category ? 'ticket-category-error' : undefined}
          />
          {fieldErrorsMap.category && (
            <span id="ticket-category-error" className={styles.fieldError}>
              {fieldErrorsMap.category}
            </span>
          )}
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="ticket-priority">
            Priorität <span className={styles.required}>*</span>
          </label>
          <select
            id="ticket-priority"
            className={`${styles.select}${fieldErrorsMap.priority ? ` ${styles.invalid}` : ''}`}
            value={priority}
            onChange={(e) => setPriority(e.target.value as TicketPriority)}
            aria-invalid={Boolean(fieldErrorsMap.priority)}
            aria-describedby={fieldErrorsMap.priority ? 'ticket-priority-error' : undefined}
          >
            <option value="" disabled>
              Priorität wählen
            </option>
            {PRIORITIES.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
          {fieldErrorsMap.priority && (
            <span id="ticket-priority-error" className={styles.fieldError}>
              {fieldErrorsMap.priority}
            </span>
          )}
        </div>

        <div className={styles.actions}>
          <button
            type="submit"
            className={styles.buttonPrimary}
            disabled={submitting}
          >
            {submitting ? 'Wird angelegt …' : 'Ticket anlegen'}
          </button>
          <button
            type="button"
            className={styles.buttonSecondary}
            onClick={handleCancel}
            disabled={submitting}
          >
            Abbrechen
          </button>
        </div>
      </form>
    </div>
  )
}
