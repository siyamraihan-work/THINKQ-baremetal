import { useNavigate } from 'react-router-dom'
import HeroPanel from '../components/HeroPanel'
import AuthPageLayout from '../layouts/AuthPageLayout'
import { devLogin, startLogin } from '../lib/api'

const devAuthEnabled = import.meta.env.VITE_DEV_AUTH_ENABLED === 'true'

export default function LoginPage() {
  const navigate = useNavigate()

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
      <section className="auth-card">
        <HeroPanel />

        <section className="login-panel">
          <div className="login-card-glow" />

          <div className="login-header">
            <span className="chip">Secure access</span>
            <h2>Welcome back</h2>
            <p>Sign in to continue to your ThinkQ dashboard.</p>
          </div>

          <button className="primary-button" onClick={startLogin} type="button">
            Continue with WebAuth
          </button>

          {devAuthEnabled ? (
            <div className="dev-box">
              <div className="divider">
                <span>Development access</span>
              </div>

              <div className="dev-login-grid">
                <button
                  className="secondary-button"
                  type="button"
                  onClick={() =>
                    handleDevLogin({
                      name: 'ThinkQ Admin',
                      email: 'admin@test.local',
                      oid: 'dev-admin-oid',
                      role: 'ADMIN'
                    })
                  }
                >
                  Admin
                </button>

                <button
                  className="secondary-button"
                  type="button"
                  onClick={() =>
                    handleDevLogin({
                      name: 'ThinkQ Teacher',
                      email: 'teacher@test.local',
                      oid: 'dev-teacher-oid',
                      role: 'TEACHER'
                    })
                  }
                >
                  Teacher
                </button>

                <button
                  className="secondary-button"
                  type="button"
                  onClick={() =>
                    handleDevLogin({
                      name: 'ThinkQ Student',
                      email: 'student@test.local',
                      oid: 'dev-student-oid',
                      role: 'STUDENT'
                    })
                  }
                >
                  Student
                </button>
              </div>
            </div>
          ) : null}
        </section>
      </section>
    </AuthPageLayout>
  )
}