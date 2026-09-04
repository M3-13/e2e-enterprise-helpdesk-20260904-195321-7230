import { useState, type FormEvent, type KeyboardEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { ApiError } from '../api/client'
import styles from './LoginPage.module.css'

type Mode = 'login' | 'register'

const TOGGLE_IDS: Record<Mode, string> = {
  login: 'auth-toggle-login',
  register: 'auth-toggle-register',
}

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

export default function LoginPage({ initialMode = 'login' }: { initialMode?: Mode }) {
  const { login, register } = useAuth()
  const navigate = useNavigate()

  const [mode, setMode] = useState<Mode>(initialMode)
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [usernameOrEmail, setUsernameOrEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [fieldErrorsMap, setFieldErrorsMap] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const switchMode = (next: Mode) => {
    setMode(next)
    setFormError(null)
    setSuccessMessage(null)
    setFieldErrorsMap({})
  }

  const handleToggleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const order: Mode[] = ['login', 'register']
    const index = order.indexOf(mode)
    let nextIndex = -1
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      nextIndex = (index + 1) % order.length
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      nextIndex = (index - 1 + order.length) % order.length
    }
    if (nextIndex >= 0) {
      event.preventDefault()
      const next = order[nextIndex]
      switchMode(next)
      document.getElementById(TOGGLE_IDS[next])?.focus()
    }
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setFormError(null)
    setSuccessMessage(null)

    if (mode === 'register') {
      const errors: Record<string, string> = {}
      if (!username.trim()) errors.username = 'Benutzername ist erforderlich.'
      if (!email.trim()) errors.email = 'E-Mail ist erforderlich.'
      if (!password) errors.password = 'Passwort ist erforderlich.'
      else if (password.length < 8) errors.password = 'Das Passwort muss mindestens 8 Zeichen lang sein.'
      setFieldErrorsMap(errors)
      if (Object.keys(errors).length > 0) return

      setSubmitting(true)
      try {
        await register(username.trim(), email.trim(), password)
        setUsername('')
        setEmail('')
        setPassword('')
        setMode('login')
        setUsernameOrEmail('')
        setSuccessMessage('Registrierung erfolgreich. Bitte melde dich an.')
      } catch (error) {
        if (error instanceof ApiError) {
          const serverErrors = fieldErrors(error.detail)
          if (Object.keys(serverErrors).length > 0) {
            setFieldErrorsMap(serverErrors)
          } else {
            setFormError(error.message)
          }
        } else {
          setFormError('Die Registrierung ist fehlgeschlagen. Bitte versuche es erneut.')
        }
      } finally {
        setSubmitting(false)
      }
      return
    }

    const errors: Record<string, string> = {}
    if (!usernameOrEmail.trim()) errors.username_or_email = 'Benutzername oder E-Mail ist erforderlich.'
    if (!password) errors.password = 'Passwort ist erforderlich.'
    setFieldErrorsMap(errors)
    if (Object.keys(errors).length > 0) return

    setSubmitting(true)
    try {
      await login(usernameOrEmail.trim(), password)
      navigate('/dashboard')
    } catch (error) {
      if (error instanceof ApiError) {
        setFormError(error.message)
      } else {
        setFormError('Die Anmeldung ist fehlgeschlagen. Bitte versuche es erneut.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.card}>
        <h1>{mode === 'login' ? 'Anmelden' : 'Registrieren'}</h1>

        <div className={styles.toggle}>
          <button
            type="button"
            id={TOGGLE_IDS.login}
            aria-pressed={mode === 'login'}
            className={`${styles.toggleButton}${mode === 'login' ? ` ${styles.toggleButtonActive}` : ''}`}
            onClick={() => switchMode('login')}
            onKeyDown={handleToggleKeyDown}
          >
            Anmelden
          </button>
          <button
            type="button"
            id={TOGGLE_IDS.register}
            aria-pressed={mode === 'register'}
            className={`${styles.toggleButton}${mode === 'register' ? ` ${styles.toggleButtonActive}` : ''}`}
            onClick={() => switchMode('register')}
            onKeyDown={handleToggleKeyDown}
          >
            Registrieren
          </button>
        </div>

        {successMessage && (
          <div className={styles.success} role="status">
            {successMessage}
          </div>
        )}

        {formError && (
          <div className={styles.formError} role="alert">
            {formError}
          </div>
        )}

        <form className={styles.form} onSubmit={handleSubmit} noValidate>
          {mode === 'login' ? (
            <div className={styles.field}>
              <label className={styles.label} htmlFor="login-username-or-email">
                Benutzername oder E-Mail <span className={styles.required}>*</span>
              </label>
              <input
                id="login-username-or-email"
                className={`${styles.input}${fieldErrorsMap.username_or_email ? ` ${styles.invalid}` : ''}`}
                type="text"
                value={usernameOrEmail}
                onChange={(e) => setUsernameOrEmail(e.target.value)}
                autoComplete="username"
                aria-invalid={Boolean(fieldErrorsMap.username_or_email)}
                aria-describedby={
                  fieldErrorsMap.username_or_email ? 'login-username-or-email-error' : undefined
                }
              />
              {fieldErrorsMap.username_or_email && (
                <span id="login-username-or-email-error" className={styles.fieldError}>
                  {fieldErrorsMap.username_or_email}
                </span>
              )}
            </div>
          ) : (
            <>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="register-username">
                  Benutzername <span className={styles.required}>*</span>
                </label>
                <input
                  id="register-username"
                  className={`${styles.input}${fieldErrorsMap.username ? ` ${styles.invalid}` : ''}`}
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  aria-invalid={Boolean(fieldErrorsMap.username)}
                  aria-describedby={fieldErrorsMap.username ? 'register-username-error' : undefined}
                />
                {fieldErrorsMap.username && (
                  <span id="register-username-error" className={styles.fieldError}>
                    {fieldErrorsMap.username}
                  </span>
                )}
              </div>

              <div className={styles.field}>
                <label className={styles.label} htmlFor="register-email">
                  E-Mail <span className={styles.required}>*</span>
                </label>
                <input
                  id="register-email"
                  className={`${styles.input}${fieldErrorsMap.email ? ` ${styles.invalid}` : ''}`}
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  aria-invalid={Boolean(fieldErrorsMap.email)}
                  aria-describedby={fieldErrorsMap.email ? 'register-email-error' : undefined}
                />
                {fieldErrorsMap.email && (
                  <span id="register-email-error" className={styles.fieldError}>
                    {fieldErrorsMap.email}
                  </span>
                )}
              </div>
            </>
          )}

          <div className={styles.field}>
            <label className={styles.label} htmlFor="login-password">
              Passwort <span className={styles.required}>*</span>
            </label>
            <input
              id="login-password"
              className={`${styles.input}${fieldErrorsMap.password ? ` ${styles.invalid}` : ''}`}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              aria-invalid={Boolean(fieldErrorsMap.password)}
              aria-describedby={fieldErrorsMap.password ? 'login-password-error' : undefined}
            />
            {fieldErrorsMap.password && (
              <span id="login-password-error" className={styles.fieldError}>
                {fieldErrorsMap.password}
              </span>
            )}
          </div>

          <div className={styles.actions}>
            <button type="submit" className={styles.buttonPrimary} disabled={submitting}>
              {submitting
                ? mode === 'login'
                  ? 'Anmeldung läuft …'
                  : 'Registrierung läuft …'
                : mode === 'login'
                  ? 'Anmelden'
                  : 'Registrieren'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
