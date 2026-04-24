import TTlogo from '../assets/TTlogo.png'

export default function HeroPanel() {
  return (
    <section className="hero-panel">
      <span className="eyebrow">ThinkQ</span>

      <div className="brand-lockup">
        <div className="logo-card">
          <img src={TTlogo} alt="Think Tank Logo" className="TTlogo" />

          <div>
            <p>Smarter tutoring queues for students and staff.</p>
          </div>
        </div>
      </div>

      <div className="hero-footer">
        <div className="stat-card">
          <strong>Live</strong>
          <span>Queue visibility</span>
        </div>

        <div className="stat-card">
          <strong>Fast</strong>
          <span>Role-based routing</span>
        </div>
      </div>
    </section>
  )
}