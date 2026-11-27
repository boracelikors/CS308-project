// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { Context as SessionContext } from '../auth/context.js'
import ProductReviews from './ProductReviews.jsx'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const jsonReply = (data, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => data,
})

function renderReviews(session = { user: null, status: 'anonymous' }, productId = 10) {
  return render(
    <MemoryRouter>
      <SessionContext.Provider value={session}>
        <ProductReviews productId={productId} />
      </SessionContext.Provider>
    </MemoryRouter>,
  )
}

test('renders empty state when there are no ratings or approved comments', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(jsonReply({ rating: { count: 0, average: null }, comments: [] })),
  )

  renderReviews()

  expect(await screen.findByText('No ratings yet.')).toBeTruthy()
  expect(screen.getByText('No published comments yet.')).toBeTruthy()
})

test('renders accessible average score, count, and approved comments', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(
      jsonReply({
        rating: { count: 2, average: 4.5 },
        comments: [
          {
            id: 1,
            body: 'Clear studio vocals with zero distortion at high volume.',
            submittedAt: '2026-11-20T12:00:00.000Z',
          },
        ],
      }),
    ),
  )

  renderReviews()

  expect(await screen.findByText('4.5 out of 5 · 2 ratings')).toBeTruthy()
  expect(screen.getByText('Recent comments')).toBeTruthy()
  expect(screen.getByText('Clear studio vocals with zero distortion at high volume.')).toBeTruthy()
})

test('refreshes public ratings after posting while keeping pending/rejected comments private', async () => {
  const fetchMock = vi.fn((url, options = {}) => {
    if (url.endsWith('/products/10/reviews/me')) {
      return Promise.resolve(
        jsonReply({
          eligible: true,
          rating: null,
          comment: { body: 'Waiting for moderation', status: 'pending' },
        }),
      )
    }
    if (url.endsWith('/products/10/reviews/rating') && options.method === 'PUT') {
      return Promise.resolve(jsonReply({ score: 5 }))
    }
    if (url.endsWith('/products/10/reviews')) {
      const ratingCalls = fetchMock.mock.calls.filter(
        ([callUrl, callOpts]) => callUrl.endsWith('/rating') && callOpts?.method === 'PUT',
      ).length
      if (ratingCalls > 0) {
        return Promise.resolve(
          jsonReply({
            rating: { count: 1, average: 5 },
            comments: [{ id: 99, body: 'Approved public comment', submittedAt: '2026-11-20T12:00:00.000Z' }],
          }),
        )
      }
      return Promise.resolve(
        jsonReply({
          rating: { count: 0, average: null },
          comments: [{ id: 99, body: 'Approved public comment', submittedAt: '2026-11-20T12:00:00.000Z' }],
        }),
      )
    }
    return Promise.reject(new Error(`Unexpected URL: ${url}`))
  })
  vi.stubGlobal('fetch', fetchMock)

  renderReviews({ user: { id: 7, role: 'customer' }, status: 'authenticated' })

  expect(await screen.findByText('No ratings yet.')).toBeTruthy()
  const publicList = screen.getByRole('list')
  expect(within(publicList).getByText('Approved public comment')).toBeTruthy()
  expect(within(publicList).queryByText('Waiting for moderation')).toBeNull()

  const scoreSelect = await screen.findByLabelText('Rating')
  fireEvent.change(scoreSelect, { target: { value: '5' } })
  fireEvent.click(screen.getByRole('button', { name: 'Save rating' }))

  await waitFor(() => {
    expect(screen.getByText('5.0 out of 5 · 1 rating')).toBeTruthy()
  })
  expect(within(screen.getByRole('list')).queryByText('Waiting for moderation')).toBeNull()
})
