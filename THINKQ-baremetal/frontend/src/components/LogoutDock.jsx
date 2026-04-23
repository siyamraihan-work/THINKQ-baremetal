import { useNavigate } from 'react-router-dom'
import { logout } from '../lib/api'

export default function LogoutDock() {
  const navigate = useNavigate()

  async function handleLogout() {
    try {
      await logout()
    } catch (error) {
    }
    navigate('/login', { replace: true })
    window.location.reload()
  }

  return (
    <button className="logout-dock" type="button" onClick={handleLogout} title="Logout">
      <span className="logout-dock-icon">↩</span>
      <span>Logout</span>
    </button>
  )
}
