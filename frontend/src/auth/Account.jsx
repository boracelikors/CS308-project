import { useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { api, safeReturnTo } from '../api.js'
import { useSession } from './context.js'
export function AccountForm({register = false}) {
  const {login} = useSession(); const navigate = useNavigate(); const [params] = useSearchParams()
  const target = safeReturnTo(params.get('returnTo')); const busy = useRef(false)
  const [pending,setPending] = useState(false); const [error,setError] = useState(''); const [fields,setFields] = useState({})
  async function submit(event) {
    event.preventDefault(); if(busy.current) return
    const form = event.currentTarget; const values = Object.fromEntries(new FormData(form))
    setError(''); setFields({})
    if(register && values.password !== values.confirm) {setFields({confirm:'Passwords must match.'}); return}
    busy.current = true; setPending(true)
    try {
      if(register) { const {confirm: _confirm, ...body} = values; await api('/auth/register',{method:'POST',body}); navigate('/login?registered=1&returnTo='+encodeURIComponent(target),{replace:true}) }
      else { await login(values); navigate(target,{replace:true}) }
      form.reset()
    } catch(e) {setError(e.message); setFields(e.fields || {})}
    finally {busy.current=false; setPending(false)}
  }
  const inputs = [...(register ? [['name','Full name','text','name'],['taxId','Tax ID','text','off'],['homeAddress','Home address','text','street-address']] : []), ['email','Email','email','email'],['password','Password','password',register?'new-password':'current-password'],...(register?[['confirm','Confirm password','password','new-password']]:[])]
  return <section className="account-panel"><h1>{register?'Create an account':'Welcome back'}</h1>
    {params.get('registered') && <p role="status">Account created. Sign in to continue.</p>}
    {error && <p role="alert">{error}</p>}
    <form onSubmit={submit}>
      {inputs.map(([name,label,type,autoComplete])=><label key={name} htmlFor={name}>{label}<input id={name} name={name} type={type} autoComplete={autoComplete} required disabled={pending} aria-invalid={!!fields[name]} aria-describedby={fields[name]?name+'-error':undefined} {...(register&&name==='password'?{minLength:8}: {})}/>{fields[name]&&<span id={name+'-error'} role="alert">{fields[name]}</span>}</label>)}
      {register&&<p>Use a 10–11 digit tax ID, an address of at least 10 characters, and a password with a letter and a digit (8 characters minimum, 72 UTF-8 bytes maximum).</p>}
      <button disabled={pending} type="submit">{pending?'Please wait…':register?'Create account':'Sign in'}</button>
    </form><Link to={(register?'/login':'/register')+'?returnTo='+encodeURIComponent(target)}>{register?'Already have an account? Sign in':'Create an account'}</Link>
  </section>
}
export function Profile() { const {user} = useSession(); return <section className="account-panel"><h1>Your profile</h1><dl><dt>Name</dt><dd>{user.name}</dd><dt>Email</dt><dd>{user.email}</dd><dt>Home address</dt><dd>{user.homeAddress || 'No address provided'}</dd></dl><Link to="/orders">Order history</Link></section> }
