"use client"

import { createContext, useContext, useEffect, useState, useCallback, useRef } from "react"

export interface AuthUser {
  email: string
  name: string
  picture: string
}

interface AuthState {
  user: AuthUser | null
  accessToken: string | null
  loading: boolean
  error: string | null
}

interface AuthContextType extends AuthState {
  signIn: () => void
  signOut: () => void
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  accessToken: null,
  loading: true,
  error: null,
  signIn: () => {},
  signOut: () => {},
})

export const useAuth = () => useContext(AuthContext)

// Google Identity Services types
declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (cfg: {
            client_id: string
            scope: string
            callback: (res: { access_token?: string; error?: string }) => void
          }) => { requestAccessToken: () => void }
        }
      }
    }
  }
}

const STORAGE_KEY = "severo_auth_v2"

function readStorage(): { user: AuthUser; accessToken: string } | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const data = JSON.parse(raw)
    if (Date.now() > data.expiresAt) {
      sessionStorage.removeItem(STORAGE_KEY)
      return null
    }
    return data
  } catch {
    return null
  }
}

function writeStorage(user: AuthUser, accessToken: string) {
  sessionStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ user, accessToken, expiresAt: Date.now() + 3590_000 })
  )
}

function isAllowed(email: string): boolean {
  const emails =
    process.env.NEXT_PUBLIC_ALLOWED_EMAILS?.split(",").map((e) => e.trim()).filter(Boolean) ?? []
  const domain = process.env.NEXT_PUBLIC_ALLOWED_DOMAIN ?? ""
  if (emails.length === 0 && !domain) return true
  if (emails.includes(email)) return true
  if (domain && email.endsWith(`@${domain}`)) return true
  return false
}

function loadGIS(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts) { resolve(); return }
    const existing = document.querySelector<HTMLScriptElement>(
      'script[src*="accounts.google.com/gsi"]'
    )
    if (existing) {
      existing.addEventListener("load", () => resolve())
      existing.addEventListener("error", () => reject(new Error("Error cargando Google Sign-In")))
      return
    }
    const s = document.createElement("script")
    s.src = "https://accounts.google.com/gsi/client"
    s.async = true
    s.defer = true
    s.onload = () => resolve()
    s.onerror = () => reject(new Error("No se pudo cargar Google Sign-In"))
    document.head.appendChild(s)
  })
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    accessToken: null,
    loading: true,
    error: null,
  })
  const tokenClientRef = useRef<{ requestAccessToken: () => void } | null>(null)

  // Restore session on mount
  useEffect(() => {
    const stored = readStorage()
    if (stored) {
      setState({ user: stored.user, accessToken: stored.accessToken, loading: false, error: null })
    } else {
      setState((s) => ({ ...s, loading: false }))
    }
  }, [])

  const handleToken = useCallback(async (token: string) => {
    try {
      const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error("Error al verificar identidad con Google")
      const info = await res.json()

      if (!isAllowed(info.email)) {
        setState((s) => ({ ...s, error: "AccessDenied" }))
        return
      }

      const user: AuthUser = {
        email: info.email,
        name: info.name ?? info.email,
        picture: info.picture ?? "",
      }
      writeStorage(user, token)
      setState({ user, accessToken: token, loading: false, error: null })
    } catch (err) {
      setState((s) => ({
        ...s,
        error: err instanceof Error ? err.message : "Error de autenticación",
      }))
    }
  }, [])

  const signIn = useCallback(() => {
    setState((s) => ({ ...s, error: null }))
    tokenClientRef.current = null
    loadGIS()
      .then(() => {
        if (!tokenClientRef.current) {
          tokenClientRef.current = window.google!.accounts.oauth2.initTokenClient({
            client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID!,
            scope:
              "openid email profile https://www.googleapis.com/auth/spreadsheets.readonly https://www.googleapis.com/auth/drive.readonly",
            callback: (res) => {
              if (res.error || !res.access_token) {
                setState((s) => ({
                  ...s,
                  error: res.error ?? "Error al iniciar sesión",
                }))
                return
              }
              handleToken(res.access_token)
            },
          })
        }
        tokenClientRef.current.requestAccessToken()
      })
      .catch((err) => {
        setState((s) => ({
          ...s,
          error: err instanceof Error ? err.message : "Error de conexión",
        }))
      })
  }, [handleToken])

  const signOut = useCallback(() => {
    sessionStorage.removeItem(STORAGE_KEY)
    tokenClientRef.current = null
    setState({ user: null, accessToken: null, loading: false, error: null })
  }, [])

  return (
    <AuthContext.Provider value={{ ...state, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}
