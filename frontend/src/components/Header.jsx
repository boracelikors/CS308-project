import { Link } from 'react-router-dom'
import { useState } from 'react'
import { useSession } from '../auth/context.js'
export default function Header() {
  const {status,user,logout,refresh} = useSession(); const [error,setError] = useState(''); const [busy,setBusy] = useState(false)
  async function signOut() {setBusy(true);setError('');try {await logout()} catch(e){setError(e.message)} finally{setBusy(false)}}
  return <header className="site-header" id="top"><Link className="brand" to="/" aria-label="DOBBY Audophile House home"><span>DOBBY<span className="brand-subtitle">Audophile House</span></span></Link><nav aria-label="Main navigation"><Link to="/">Collection</Link><Link to="/cart">Cart</Link>{status==='authenticated'?<><Link to="/profile">{user.name}</Link><button onClick={signOut} disabled={busy}>Sign out</button></>:status==='loading'?<span role="status">Checking session…</span>:status==='error'?<button onClick={refresh}>Retry connection</button>:<><Link to="/login">Sign in</Link><Link to="/register">Register</Link></>}{error&&<p role="alert">{error}</p>}</nav></header>
}
