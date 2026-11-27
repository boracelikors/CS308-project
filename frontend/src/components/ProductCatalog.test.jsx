// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { CartContext } from '../cart/cartContext.js'
import ProductCatalog from './ProductCatalog.jsx'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  window.history.replaceState(null, '', '/')
})

const sampleProducts = [
  {
    id: 1,
    name: 'Monitor One',
    category: 'Speakers',
    price: 4500,
    currency: 'TRY',
    description: 'Studio reference monitor.',
    quantityInStock: 5,
    inStock: true,
    image: '/images/speaker.jpg',
  },
  {
    id: 2,
    name: 'Sub Bass X',
    category: 'Subwoofers',
    price: 8900,
    currency: 'TRY',
    description: 'Deep studio subwoofer.',
    quantityInStock: 0,
    inStock: false,
    image: '/images/subwoofer.jpg',
  },
]

function makeProductsResponse(items, total = items.length) {
  return {
    ok: true,
    status: 200,
    headers: new Headers({
      'X-Total-Count': String(total),
      'X-Page': '1',
      'X-Page-Size': '12',
      'X-Total-Pages': '1',
    }),
    json: async () => items,
  }
}

function renderCatalog(cartOverrides = {}) {
  const cartValue = {
    status: 'ready',
    items: [],
    itemCount: 0,
    add: vi.fn().mockResolvedValue({ ok: true }),
    quantityOf: () => 0,
    ...cartOverrides,
  }

  return {
    cartValue,
    ...render(
      <MemoryRouter>
        <CartContext.Provider value={cartValue}>
          <ProductCatalog />
        </CartContext.Provider>
      </MemoryRouter>,
    ),
  }
}

test('renders category entry points, price, stock, and keeps out-of-stock products visible and disabled', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeProductsResponse(sampleProducts)))

  const { cartValue } = renderCatalog()

  expect(await screen.findByText('Monitor One')).toBeTruthy()
  expect(screen.getByText('Sub Bass X')).toBeTruthy()
  expect(screen.getByText('2 products found')).toBeTruthy()

  // Category entry points rendered
  expect(screen.getByRole('button', { name: 'All Categories' })).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Speakers' })).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Headphones' })).toBeTruthy()

  // Out-of-stock item is visible with disabled action
  const addButtons = screen.getAllByRole('button', { name: /Monitor One|Sub Bass X/ })
  expect(addButtons[0].disabled).toBe(false)
  expect(addButtons[1].disabled).toBe(true)

  fireEvent.click(addButtons[0])
  await waitFor(() => {
    expect(cartValue.add).toHaveBeenCalledWith(1)
  })
})

test('filters by category entry point and displays clear empty state with reset', async () => {
  const fetchMock = vi.fn((url) => {
    if (url.includes('categoryId=5')) {
      return Promise.resolve(makeProductsResponse([], 0))
    }
    return Promise.resolve(makeProductsResponse(sampleProducts))
  })
  vi.stubGlobal('fetch', fetchMock)

  renderCatalog()

  expect(await screen.findByText('Monitor One')).toBeTruthy()

  fireEvent.click(screen.getByRole('button', { name: 'Headphones' }))

  expect(await screen.findByText('No products found')).toBeTruthy()
  expect(screen.getByText('0 products found')).toBeTruthy()

  // Reset restores full catalogue
  const resetButtons = screen.getAllByRole('button', { name: /Reset/ })
  fireEvent.click(resetButtons[0])
  expect(await screen.findByText('Monitor One')).toBeTruthy()
})
