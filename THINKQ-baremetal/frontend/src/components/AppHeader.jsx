import LogoutDock from './LogoutDock'

export default function AppHeader({ title, subtitle, queueCount }) {
  return (
    <header className="app-topbar">
      <div>
        <div className="app-brand">ThinkQ</div>
        {title ? <h1 className="app-page-title">{title}</h1> : null}
        {subtitle ? <p className="app-page-subtitle">{subtitle}</p> : null}
      </div>
      <div className="app-topbar-actions">
        <a className="queue-launch-button" href="/queue/live" title="Open live queue page">
          <span className="queue-launch-icon">🖥️</span>
          {typeof queueCount === 'number' ? <span className="queue-count-ball">{queueCount}</span> : null}
        </a>
        <LogoutDock />
      </div>
    </header>
  )
}
