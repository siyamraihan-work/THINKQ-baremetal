export default function DashboardPage({ title, user, role, paths }) {
  return (
    <div className="dashboard-shell">
      <header className="dashboard-header">
        <div>
          <div className="dashboard-brand">ThinkQ</div>
          <h1>{title}</h1>
          <p className="dashboard-copy">
            Backend session wiring is active. This page is protected by role guard and rendered only after
            <code> /users/me </code> succeeds.
          </p>
        </div>
        <div className="dashboard-user-card">
          <span className="dashboard-user-label">Signed in as</span>
          <strong>{user.name}</strong>
          <span>{user.email}</span>
          <span className="dashboard-role-badge">{role}</span>
        </div>
      </header>

      <section className="dashboard-grid">
        <article className="dashboard-panel">
          <span className="dashboard-panel-label">Connected Backend Paths</span>
          <ul className="endpoint-list">
            {paths.map(function(path) {
              return <li key={path}>{path}</li>
            })}
          </ul>
        </article>
        <article className="dashboard-panel">
          <span className="dashboard-panel-label">Status</span>
          <h2>Frontend and backend are wired</h2>
          <p>
            The login page hands off to <code>/auth/login</code>. The app bootstrap reads <code>/users/me</code> with
            the session cookie. Unauthorized role access redirects to <code>/unauthorized</code>.
          </p>
        </article>
      </section>
    </div>
  )
}
