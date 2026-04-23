export default function AuthPageLayout({ children, compact = false }) {
  return (
    <div className="page-shell">
      <div className="bg-orb orb-one" />
      <div className="bg-orb orb-two" />
      <div className="bg-grid" />
      <header className="brand-bar">ThinkQ</header>
      <main className={`content-wrap ${compact ? 'unauthorized-layout' : ''}`}>{children}</main>
    </div>
  )
}
