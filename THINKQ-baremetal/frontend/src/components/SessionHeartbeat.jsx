import { useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { pingSession } from '../lib/api'

export default function SessionHeartbeat() {
  const { isAuthenticated, refreshUser } = useAuth()

  useEffect(function() {
    if (!isAuthenticated) {
      return undefined
    }

    async function beat() {
      try {
        await pingSession()
      } catch (error) {
        refreshUser().catch(function() {})
      }
    }

    beat()
    const intervalId = window.setInterval(beat, 120000)

    return function() {
      window.clearInterval(intervalId)
    }
  }, [isAuthenticated, refreshUser])

  return null
}
