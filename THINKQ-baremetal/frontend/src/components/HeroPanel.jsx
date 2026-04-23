import TTlogo from '../assets/TTlogo.png';

export default function HeroPanel() {
  return (
    <section className="glass-card hero-panel">
      <span className="eyebrow">Queue Intelligence Platform</span>
      <img src={TTlogo} alt="Think Tank Logo" className="TTlogo" />
      <p>
        ThinkQ is wired to your backend session flow, SAML login handoff, role-based routing,
        and direct host Nginx routing to the backend services. This screen is intentionally minimal so you can restyle it later.
      </p>
      <div className="feature-row">
        <article className="feature-box">
          <span className="feature-label">Auth</span>
          <strong>SAML + session cookie</strong>
          <p className="mini-copy">Uses the backend auth service and preserves the sid cookie flow through Nginx.</p>
        </article>
        <article className="feature-box">
          <span className="feature-label">Routing</span>
          <strong>Role-aware entry</strong>
          <p className="mini-copy">Authenticated users are redirected to student, teacher, or admin space automatically.</p>
        </article>
        <article className="feature-box">
          <span className="feature-label">Deploy</span>
          <strong>Single-PC ready</strong>
          <p className="mini-copy">Host Nginx serves the SPA and routes requests to the local services on the same machine.</p>
        </article>
      </div>
    </section>
  )
}
