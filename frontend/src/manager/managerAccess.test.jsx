// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from '../App.jsx'

const manager = { id: 10, name: 'Demo Manager', role: 'product_manager' }
const customer = { id: 11, name: 'Demo Customer', role: 'customer' }

function reply(status, body) {
  return status === 204 ? new Response(null, { status }) : Response.json(body, { status })
}

function mount({ user, path = '/manager', loginAs = manager } = {}) {
  window.history.replaceState(null, '', path)
  vi.stubGlobal('fetch', vi.fn(async (url) => {
    if (url.endsWith('/auth/me')) {
      return user ? reply(200, { user }) : reply(401, {})
    }
    if (url.endsWith('/auth/login')) return reply(200, { user: loginAs })
    if (url.endsWith('/auth/logout')) return reply(204)
    if (url.endsWith('/cart')) {
      return reply(200, { cart: { items: [], subtotal: '0.00', currency: 'TRY' } })
    }
    return reply(200, [])
  }))
  const visitor = userEvent.setup()
  render(<App />)
  return visitor
}

afterEach(() => {
  cleanup()
  window.history.replaceState(null, '', '/')
  vi.unstubAllGlobals()
})

test('a manager can open the protected route directly after session restore', async () => {
  mount({ user: manager })
  expect(await screen.findByRole('heading', { name: 'Product manager' })).toBeTruthy()
  expect(screen.getByRole('link', { name: 'Product manager' }).getAttribute('href')).toBe('/manager')
  expect(screen.getByText('Signed in as Demo Manager.')).toBeTruthy()
})

test('a guest is sent to login and a manager returns to the intended route', async () => {
  const visitor = mount({ path: '/manager?origin=demo' })
  await screen.findByRole('heading', { name: 'Welcome back' })
  expect(new URLSearchParams(window.location.search).get('returnTo')).toBe('/manager?origin=demo')
  await visitor.type(screen.getByLabelText('Email'), 'manager@example.test')
  await visitor.type(screen.getByLabelText('Password'), 'DemoOnly42')
  await visitor.click(screen.getByRole('button', { name: 'Sign in' }))
  expect(await screen.findByRole('heading', { name: 'Product manager' })).toBeTruthy()
  expect(window.location.pathname + window.location.search).toBe('/manager?origin=demo')
})

test.each(['customer', 'sales_manager', 'support_agent'])('%s cannot open the manager screen', async (role) => {
  mount({ user: { ...customer, role } })
  expect(await screen.findByRole('heading', { name: 'Access denied' })).toBeTruthy()
  expect(screen.getByRole('link', { name: 'Back to the collection' })).toBeTruthy()
  expect(screen.queryByRole('link', { name: 'Product manager' })).toBeNull()
  expect(screen.queryByText('Signed in as Demo Customer.')).toBeNull()
})

test('signing out removes manager access when a customer takes over the browser', async () => {
  const visitor = mount({ user: manager, loginAs: customer })
  await screen.findByRole('heading', { name: 'Product manager' })
  await visitor.click(screen.getByRole('button', { name: 'Sign out' }))
  await screen.findByRole('heading', { name: 'Welcome back' })
  expect(screen.queryByText('Signed in as Demo Manager.')).toBeNull()
  expect(screen.queryByRole('link', { name: 'Product manager' })).toBeNull()
  await visitor.type(screen.getByLabelText('Email'), 'customer@example.test')
  await visitor.type(screen.getByLabelText('Password'), 'DemoOnly42')
  await visitor.click(screen.getByRole('button', { name: 'Sign in' }))
  expect(await screen.findByRole('heading', { name: 'Access denied' })).toBeTruthy()
})
