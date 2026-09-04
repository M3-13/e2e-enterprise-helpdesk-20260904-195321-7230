import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { apiPost, ApiError } from '../api/client'
import type { LoginResponse, User } from '../types'

interface AuthContextValue {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  login: (usernameOrEmail: string, password: string) => Promise<void>
  register: (username: string, email: string, password: string) => Promise<void>
  logout: () => void
}

const TOKEN_KEY = 'token'
const USER_KEY = 'user'

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

function readStoredUser(): User | null {
  const raw = localStorage.getItem(USER_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as User
  } catch {
    return null
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY))
  const [user, setUser] = useState<User | null>(() => readStoredUser())

  const logout = (): void => {
    apiPost<void>('/api/auth/logout').catch(() => {
      // Best effort: the session is cleared locally regardless of the server response.
    })
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
    setToken(null)
    setUser(null)
  }

  useEffect(() => {
    const handleLogout = (): void => {
      setToken(null)
      setUser(null)
    }
    window.addEventListener('auth:logout', handleLogout)
    return () => window.removeEventListener('auth:logout', handleLogout)
  }, [])

  const login = async (usernameOrEmail: string, password: string): Promise<void> => {
    try {
      const response = await apiPost<LoginResponse>('/api/auth/login', {
        username_or_email: usernameOrEmail,
        password,
      })
      localStorage.setItem(TOKEN_KEY, response.access_token)
      localStorage.setItem(USER_KEY, JSON.stringify(response.user))
      setToken(response.access_token)
      setUser(response.user)
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        throw new ApiError(401, 'Ungültiger Benutzername oder falsches Passwort.')
      }
      throw error
    }
  }

  const register = async (username: string, email: string, password: string): Promise<void> => {
    await apiPost<User>('/api/auth/register', {
      username,
      email,
      password,
    })
  }

  const value: AuthContextValue = {
    user,
    token,
    isAuthenticated: Boolean(token),
    login,
    register,
    logout,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth muss innerhalb eines AuthProvider verwendet werden.')
  }
  return ctx
}
