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

  fireEvent.click(await screen.findByRole('radio', { name: '5 stars' }))
  fireEvent.click(screen.getByRole('button', { name: 'Save rating' }))

  await waitFor(() => {
    expect(screen.getByText('5.0 out of 5 · 1 rating')).toBeTruthy()
  })
  expect(within(screen.getByRole('list')).queryByText('Waiting for moderation')).toBeNull()
})

test('shows clear eligibility messages for signed-out and undelivered customers', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn((url) => {
      if (url.endsWith('/products/10/reviews/me')) {
        return Promise.resolve(jsonReply({ eligible: false, rating: null, comment: null }))
      }
      return Promise.resolve(jsonReply({ rating: { count: 0, average: null }, comments: [] }))
    }),
  )

  const signedOutView = renderReviews({ user: null, status: 'anonymous' })
  expect(await screen.findByRole('link', { name: 'Sign in' })).toBeTruthy()
  expect(screen.getByText(/to review a delivered purchase\./)).toBeTruthy()
  signedOutView.unmount()

  renderReviews({ user: { id: 8, role: 'customer' }, status: 'authenticated' })
  expect(await screen.findByText('You can review this product after your order is delivered.')).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'Save rating' })).toBeNull()
})

test('validates rating and comment, preserves unsaved comment draft, and shows separate feedback', async () => {
  const fetchMock = vi.fn((url, options = {}) => {
    if (url.endsWith('/products/10/reviews/me')) {
      return Promise.resolve(jsonReply({ eligible: true, rating: null, comment: null }))
    }
    if (url.endsWith('/products/10/reviews/rating') && options.method === 'PUT') {
      return Promise.resolve(jsonReply({ score: 4 }))
    }
    if (url.endsWith('/products/10/reviews/comment') && options.method === 'PUT') {
      return Promise.resolve(jsonReply({ body: 'Solid build quality', status: 'pending' }))
    }
    return Promise.resolve(jsonReply({ rating: { count: 1, average: 4 }, comments: [] }))
  })
  vi.stubGlobal('fetch', fetchMock)

  renderReviews({ user: { id: 9, role: 'customer' }, status: 'authenticated' })

  await screen.findByRole('button', { name: 'Save rating' })

  fireEvent.click(screen.getByRole('button', { name: 'Save rating' }))
  expect(screen.getByText('Please select a rating from 1 to 5 stars.')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Submit comment' }))
  expect(screen.getByText('Please enter a comment before submitting.')).toBeTruthy()
  expect(fetchMock.mock.calls.some(([, opts]) => opts?.method === 'PUT')).toBe(false)

  const commentBox = screen.getByLabelText('Comment')
  fireEvent.change(commentBox, { target: { value: 'Solid build quality' } })
  fireEvent.click(screen.getByRole('radio', { name: '4 stars' }))
  fireEvent.click(screen.getByRole('button', { name: 'Save rating' }))

  expect(await screen.findByText('Your rating is public.')).toBeTruthy()
  expect(commentBox.value).toBe('Solid build quality')

  fireEvent.click(screen.getByRole('button', { name: 'Submit comment' }))
  expect(await screen.findByText('Comment submitted for approval.')).toBeTruthy()
  expect(screen.getByText('Your rating is public.')).toBeTruthy()
})

test('handles server rejection and allows retry without duplicate concurrent requests', async () => {
  let resolveSlowRating
  let ratingAttempts = 0
  const fetchMock = vi.fn((url, options = {}) => {
    if (url.endsWith('/products/10/reviews/me')) {
      return Promise.resolve(jsonReply({ eligible: true, rating: null, comment: null }))
    }
    if (url.endsWith('/products/10/reviews/rating') && options.method === 'PUT') {
      ratingAttempts += 1
      if (ratingAttempts === 1) {
        return new Promise((resolve) => {
          resolveSlowRating = resolve
        })
      }
      return Promise.resolve(jsonReply({ score: 5 }))
    }
    return Promise.resolve(jsonReply({ rating: { count: 1, average: 5 }, comments: [] }))
  })
  vi.stubGlobal('fetch', fetchMock)

  renderReviews({ user: { id: 10, role: 'customer' }, status: 'authenticated' })

  fireEvent.click(await screen.findByRole('radio', { name: '5 stars' }))
  const saveBtn = screen.getByRole('button', { name: 'Save rating' })
  fireEvent.click(saveBtn)
  fireEvent.click(saveBtn)

  expect(ratingAttempts).toBe(1)

  resolveSlowRating(jsonReply({ error: { message: 'Temporary failure' } }, 500))
  expect(await screen.findByText('Temporary failure')).toBeTruthy()

  fireEvent.click(screen.getByRole('button', { name: 'Save rating' }))
  expect(await screen.findByText('Your rating is public.')).toBeTruthy()
  expect(ratingAttempts).toBe(2)
})
