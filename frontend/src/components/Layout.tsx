import { Link, NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import type { User } from '../types'

function initials(user: User | null): string {
  if (!user) return '?'
  const name = user.username || user.email || '?'
  return name.slice(0, 1).toUpperCase()
}

export default function Layout() {
  const { user, isAuthenticated, logout } = useAuth()

  return (
    <div className="app-shell">
      <a href="#main-content" className="skip-link">
        Zum Inhalt springen
      </a>
      <header className="topnav">
        <div className="topnav__inner">
          <Link to="/" className="topnav__brand">
            Enterprise Helpdesk
          </Link>
          <nav className="topnav__links" aria-label="Hauptnavigation">
            <NavLink
              to="/dashboard"
              className={({ isActive }) =>
                `topnav__link${isActive ? ' topnav__link--active' : ''}`
              }
            >
              Dashboard
            </NavLink>
            <NavLink
              to="/tickets"
              className={({ isActive }) =>
                `topnav__link${isActive ? ' topnav__link--active' : ''}`
              }
            >
              Tickets
            </NavLink>
            <NavLink
              to="/tickets/new"
              className={({ isActive }) =>
                `topnav__link${isActive ? ' topnav__link--active' : ''}`
              }
            >
              Neues Ticket
            </NavLink>
            <NavLink
              to="/admin/users"
              className={({ isActive }) =>
                `topnav__link${isActive ? ' topnav__link--active' : ''}`
              }
            >
              Benutzer
            </NavLink>
          </nav>
          <div className="topnav__user">
            {isAuthenticated ? (
              <>
                <span className="topnav__avatar" aria-hidden="true">
                  {initials(user)}
                </span>
                <button type="button" className="topnav__logout" onClick={logout}>
                  Abmelden
                </button>
              </>
            ) : (
              <NavLink
                to="/login"
                className={({ isActive }) =>
                  `topnav__link${isActive ? ' topnav__link--active' : ''}`
                }
              >
                Anmelden
              </NavLink>
            )}
          </div>
        </div>
      </header>

      <main id="main-content" className="content">
        <Outlet />
      </main>

      <footer className="footer">
        <div className="footer__inner">
          <Link to="/datenschutz">Datenschutz</Link>
          <Link to="/impressum">Impressum</Link>
        </div>
      </footer>
    </div>
  )
}
