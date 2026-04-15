import { useLocation, useNavigate } from 'react-router-dom'
import HeroPanel from '../components/HeroPanel'
import AuthPageLayout from '../layouts/AuthPageLayout'
import { devLogin, startLogin } from '../lib/api'

const devAuthEnabled = import.meta.env.VITE_DEV_AUTH_ENABLED === 'true'

export default function LoginPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const fromPath = location.state?.from

  async function handleDevLogin(user) {
    try {
      await devLogin(user)

      if (user.role === 'ADMIN') {
        navigate('/admin/dashboard', { replace: true })
        return
      }

      if (user.role === 'TEACHER') {
        navigate('/teacher/dashboard', { replace: true })
        return
      }

      navigate('/student/dashboard', { replace: true })
    } catch (error) {
      console.error(error)
      alert(error.message || 'Dev login failed')
    }
  }

  return (
    <AuthPageLayout>
      <HeroPanel />
      <section className="glass-card login-panel">
        <div className="panel-accent" />
        <span className="chip">Secure Login</span>
        <h2>Access ThinkQ</h2>
        <p className="panel-copy">
          Continue through your institutional identity provider. After successful authentication,
          ThinkQ will read your session from the backend and place you into the correct dashboard.
        </p>

        {fromPath ? (
          <div className="notice-box">
            You tried to open <strong>{fromPath}</strong>. Sign in first and ThinkQ will route you correctly.
          </div>
        ) : null}

        <button className="primary-button" onClick={startLogin} type="button">
          Login using WebAuth
        </button>

        {devAuthEnabled ? (
          <div style={{ marginTop: '1rem', display: 'grid', gap: '0.75rem' }}>
            <button
              className="secondary-button"
              type="button"
              onClick={() => handleDevLogin({
                name: 'ThinkQ Admin',
                email: 'admin@test.local',
                oid: 'dev-admin-oid',
                role: 'ADMIN'
              })}
            >
              Dev Login as Admin
            </button>

            <button
              className="secondary-button"
              type="button"
              onClick={() => handleDevLogin({
                name: 'ThinkQ Teacher',
                email: 'teacher@test.local',
                oid: 'dev-teacher-oid',
                role: 'TEACHER'
              })}
            >
              Dev Login as Teacher
            </button>

            <button
              className="secondary-button"
              type="button"
              onClick={() => handleDevLogin({
                name: 'ThinkQ Student',
                email: 'student@test.local',
                oid: 'dev-student-oid',
                role: 'STUDENT'
              })}
            >
              Dev Login as Student
            </button>
          </div>
        ) : null}

        <p className="subtle-text">
          This frontend is wired to your backend gateway paths: <code>/auth</code>, <code>/users</code>, <code>/tickets</code>, <code>/admin</code>, and <code>/analytics</code>.
        </p>
      </section>
    </AuthPageLayout>
  )
}