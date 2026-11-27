// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { Context as SessionContext } from '../auth/context.js'
import { CartContext } from '../cart/cartContext.js'
import ProductDetailPage from './ProductDetailPage.jsx'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const jsonReply = (data, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => data,
})

test('renders all R9 specifications, reviews jump link, and disabled out-of-stock state', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn((url) => {
      if (url.endsWith('/products/10/reviews')) {
        return Promise.resolve(jsonReply({ rating: { count: 1, average: 5 }, comments: [] }))
      }
      return Promise.resolve(
        jsonReply({
          product: {
            id: 10,
            name: 'Reference Monitor Pro',
            category: 'Speakers',
            model: 'RM-10',
            serialNumber: 'SN-10001',
            description: 'Balanced studio monitor.',
            price: 12500,
            currency: 'TRY',
            warrantyStatus: '24 months',
            distributor: 'DOBBY Audio TR',
            quantityInStock: 0,
            inStock: false,
            image: '/images/speaker.jpg',
          },
        }),
      )
    }),
  )

  render(
    <MemoryRouter>
      <SessionContext.Provider value={{ user: null, status: 'anonymous' }}>
        <CartContext.Provider value={{ status: 'ready', items: [], itemCount: 0, add: vi.fn(), quantityOf: () => 0 }}>
          <ProductDetailPage productId="10" />
        </CartContext.Provider>
      </SessionContext.Provider>
    </MemoryRouter>,
  )

  expect(await screen.findByRole('heading', { name: 'Reference Monitor Pro' })).toBeTruthy()
  expect(screen.getByText('RM-10')).toBeTruthy()
  expect(screen.getByText('SN-10001')).toBeTruthy()
  expect(screen.getByText('24 months')).toBeTruthy()
  expect(screen.getByText('DOBBY Audio TR')).toBeTruthy()
  expect(screen.getByRole('link', { name: /Customer reviews/ })).toBeTruthy()

  const outBtn = screen.getByRole('button', { name: 'Out of stock' })
  expect(outBtn.disabled).toBe(true)
  expect(await screen.findByText('5.0 out of 5 · 1 rating')).toBeTruthy()
})
