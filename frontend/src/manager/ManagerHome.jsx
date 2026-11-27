import { Link } from 'react-router-dom'
import { useSession } from '../auth/context.js'

export default function ManagerHome() {
  const { user } = useSession()

  return (
    <main className="account-panel">
      <h1>Product manager</h1>
      <p>Signed in as {user.name}.</p>
      <Link to="/profile">View your profile</Link>
    </main>
  )
}
