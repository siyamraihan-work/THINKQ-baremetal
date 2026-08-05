import TTlogo from '../assets/TTlogo.png'

export default function HeroPanel() {
  return (
    <section className="hero-panel">
      <div className="hero-logo-stage">
        <img src={TTlogo} alt="Think Tank Logo" className="TTlogo" />
        <p className="hero-tagline">Smarter tutoring queues for students and staff.</p>
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
