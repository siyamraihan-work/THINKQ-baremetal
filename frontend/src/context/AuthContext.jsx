import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { getCurrentUser } from '../lib/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [status, setStatus] = useState('loading')

  const refreshUser = useCallback(async function refreshUser() {
    setStatus('loading')
    try {
      const currentUser = await getCurrentUser()
      setUser(currentUser)
      setStatus('authenticated')
      return currentUser
    } catch (error) {
      if (error.status === 401 || error.status === 403) {
        setUser(null)
        setStatus('unauthenticated')
        return null
      }
      setUser(null)
      setStatus('error')
      throw error
    }
  }, [])

  useEffect(() => {
    refreshUser().catch(() => {})
  }, [refreshUser])

  const value = useMemo(() => ({
    user,
    status,
    isAuthenticated: status === 'authenticated',
    refreshUser
  }), [user, status, refreshUser])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) {
    throw new Error('useAuth must be used inside AuthProvider')
  }
  return value
}
