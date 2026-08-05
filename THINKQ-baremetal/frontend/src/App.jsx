import { Navigate, Route, Routes } from 'react-router-dom'
import { AuthBootstrap, ProtectedRoute, PublicOnlyRoute } from './components/RouteGuards'
import { useAuth } from './context/AuthContext'
import { roleHomePath } from './lib/roles'
import LoginPage from './pages/LoginPage'
import SessionHeartbeat from './components/SessionHeartbeat'
import UnauthorizedPage from './pages/UnauthorizedPage'
import StudentDashboardPage from './pages/StudentDashboardPage'
import TutorDashboardPage from './pages/TutorDashboardPage'
import AdminDashboardPage from './pages/AdminDashboardPage'

function HomeRedirect() {
  const { user, isAuthenticated } = useAuth()

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />
  }

  return <Navigate to={roleHomePath(user.role)} replace />
}

export default function App() {
  const { user } = useAuth()

  return (
    <AuthBootstrap>
      <SessionHeartbeat />
      <Routes>
        <Route path="/" element={<HomeRedirect />} />
        <Route
          path="/login"
          element={
            <PublicOnlyRoute>
              <LoginPage />
            </PublicOnlyRoute>
          }
        />
        <Route path="/unauthorized" element={<UnauthorizedPage />} />
        <Route
          path="/student/dashboard"
          element={
            <ProtectedRoute roles={['STUDENT']}>
              <StudentDashboardPage user={user} />
            </ProtectedRoute>
          }
        />
        <Route
          path="/tutor/dashboard"
          element={
            <ProtectedRoute roles={['TEACHER']}>
              <TutorDashboardPage user={user} />
            </ProtectedRoute>
          }
        />
        <Route path="/teacher/dashboard" element={<Navigate to="/tutor/dashboard" replace />} />
        <Route
          path="/admin/dashboard"
          element={
            <ProtectedRoute roles={['ADMIN']}>
              <AdminDashboardPage user={user} />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/unauthorized" replace />} />
      </Routes>
    </AuthBootstrap>
  )
}
