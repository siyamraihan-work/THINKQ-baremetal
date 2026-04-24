import { Link } from 'react-router-dom'
import AuthPageLayout from '../layouts/AuthPageLayout'

export default function UnauthorizedPage() {
  return (
    <AuthPageLayout compact>
      <section className="glass-card unauthorized-panel">
        <div className="panel-accent" />
        <div className="status-code">403</div>
        <h1>Unauthorized</h1>
        <p className="panel-copy">
          Your current role does not have permission to open this area.
        </p>
        <div className="unauthorized-actions">
          <Link className="primary-button link-button" to="/login">
            Return to login
          </Link>
          <Link className="secondary-button link-button" to="/">
            Go to my dashboard
          </Link>
        </div>
      </section>
    </AuthPageLayout>
  )
}
