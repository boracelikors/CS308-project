import { useCallback, useEffect, useState } from 'react'
import { classifyLoadError } from './orderLogic.js'

const LOADING = { status: 'loading', data: null, error: null }

// Loads data that belongs to one account (SCRUM-39).
// - key includes the account, so after sign-out or an account switch the previous
//   account's data is never shown, not even for one render.
// - Re-loads when the tab regains focus, so a delivery status changed by a product
//   manager appears without a manual refresh; a failed background re-load keeps the data.
// key: null means "nothing to load" (not signed in). load(signal) must be stable (useCallback).
// Returns { status: 'loading' | 'ready' | 'error' | 'notFound' | 'signedOut', data, error, reload }
export function useAccountResource(key, load) {
  const [state, setState] = useState({ key: null, ...LOADING })
  const [version, setVersion] = useState(0)

  useEffect(() => {
    if (key === null) return undefined
    const controller = new AbortController()
    load(controller.signal).then(
      (data) => setState({ key, status: 'ready', data, error: null }),
      (error) => {
        if (error?.name === 'AbortError') return
        setState((current) =>
          current.key === key && current.status === 'ready'
            ? current
            : { key, status: classifyLoadError(error), data: null, error },
        )
      },
    )
    return () => controller.abort()
  }, [key, load, version])

  useEffect(() => {
    if (key === null) return undefined
    const refresh = () => {
      if (document.visibilityState === 'visible') setVersion((v) => v + 1)
    }
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', refresh)
    return () => {
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [key])

  const reload = useCallback(() => {
    setState((current) => ({ ...current, ...LOADING }))
    setVersion((v) => v + 1)
  }, [])

  const current = state.key === key ? state : LOADING
  return { ...current, reload }
}
