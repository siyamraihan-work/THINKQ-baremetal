import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { roleHomePath } from '../lib/roles'

export function AuthBootstrap({ children }) {
  const { status } = useAuth()

  if (status === 'loading') {
    return <div className="screen-loader">Loading ThinkQ...</div>
  }

  return children
}

export function PublicOnlyRoute({ children }) {
  const { user, isAuthenticated } = useAuth()

  if (isAuthenticated && user) {
    return <Navigate to={roleHomePath(user.role)} replace />
  }

  return children
}

export function ProtectedRoute({ roles, children }) {
  const { user, isAuthenticated } = useAuth()
  const location = useLocation()

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  if (roles && !roles.includes(user.role)) {
    return <Navigate to="/unauthorized" replace />
  }

  return children
}
