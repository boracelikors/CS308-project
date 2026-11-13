import { useEffect, useRef, useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { api } from '../api.js'
import { Context, useSession } from './context.js'
export function SessionProvider({ children }) {
  const [state, setState] = useState({status: 'loading', user: null})
  const generation = useRef(0)
  function clear() { generation.current++; setState({status:'anonymous', user:null}); window.dispatchEvent(new Event('auth:cleared')) }
  async function loadSession() {
    const current = ++generation.current
    try { const {user} = await api('/auth/me'); if (current === generation.current) setState({status:'authenticated', user}) }
    catch (e) { if (current === generation.current) setState({status:e.status === 401 ? 'anonymous' : 'error', user:null}) }
  }
  function refresh() { setState({status:'loading', user:null}); return loadSession() }
  useEffect(() => {
    // Initial loading is already set; only the asynchronous result changes state.
    const current = ++generation.current
    api('/auth/me').then(
      ({user}) => { if (current === generation.current) setState({status:'authenticated', user}) },
      (error) => { if (current === generation.current) setState({status:error.status === 401 ? 'anonymous' : 'error', user:null}) },
    )
    const invalidate = () => { generation.current++ }
    window.addEventListener('auth:expired', clear)
    return () => { invalidate(); window.removeEventListener('auth:expired', clear) }
  }, [])
  async function login(body) { const current = ++generation.current; const {user} = await api('/auth/login', {method:'POST', body}); if(current === generation.current) { window.dispatchEvent(new Event('auth:cleared')); setState({status:'authenticated', user}); window.dispatchEvent(new CustomEvent('auth:login', {detail:{user}})) } }
  async function logout() { await api('/auth/logout', {method:'POST'}); clear() }
  return <Context.Provider value={{...state, refresh, login, logout}}>{children}</Context.Provider>
}
export function Protected({children}) {
  const {status, refresh} = useSession(); const location = useLocation()
  if(status === 'loading') return <p role="status">Checking your session…</p>
  if(status === 'error') return <div role="alert">Could not check your session. <button onClick={refresh}>Retry</button></div>
  if(status !== 'authenticated') return <Navigate replace to={'/login?returnTo='+encodeURIComponent(location.pathname+location.search)} />
  return children
}
