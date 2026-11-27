import { useCallback, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiRequest } from '../api/request.js'
import { useSession } from '../auth/context.js'
import { formatDate } from '../format.js'
import { useAccountResource } from '../orders/useAccountResource.js'

function PublicReviews({ resource }) {
  if (resource.status === 'loading') return <p role="status">Loading reviews…</p>
  if (resource.status !== 'ready') return <p role="alert">Reviews could not be loaded. <button onClick={resource.reload}>Retry</button></p>
  const { rating, comments } = resource.data

  return (
    <>
      <p>{rating.count
        ? `${rating.average.toFixed(1)} out of 5 · ${rating.count} ${rating.count === 1 ? 'rating' : 'ratings'}`
        : 'No ratings yet.'}</p>
      {comments.length === 0 ? <p>No published comments yet.</p> : (
        <>
          <h3>Recent comments</h3>
          <ul className="review-list">
            {comments.map((comment) => (
              <li key={comment.id}>
                <p className="review-meta">Verified buyer · {formatDate(comment.submittedAt)}</p>
                <p className="review-body">{comment.body}</p>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  )
}

const commentState = {
  pending: 'Your comment is awaiting approval.',
  approved: 'Your comment is public. Editing it sends it for approval again.',
  rejected: 'Your comment was not approved. You can revise and resubmit it.',
}

function CustomerReview({ userId, productId, refreshPublic }) {
  const path = `/products/${productId}/reviews`
  const load = useCallback((signal) => apiRequest(`${path}/me`, { signal }), [path])
  const own = useAccountResource(`${userId}:${path}`, load)
  const [ratingDraft, setRatingDraft] = useState(null)
  const [commentDraft, setCommentDraft] = useState(null)
  const [busy, setBusy] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const inFlight = useRef(false)

  async function submit(event, kind) {
    event.preventDefault()
    if (inFlight.current) return
    inFlight.current = true
    const fields = new FormData(event.currentTarget)
    const body = kind === 'rating' ? { score: Number(fields.get('score')) } : { body: fields.get('comment') }
    setBusy(kind)
    setError('')
    setMessage('')
    try {
      const saved = await apiRequest(`${path}/${kind}`, { method: 'PUT', body })
      setMessage(kind === 'rating' ? 'Your rating is public.' : saved.status === 'pending' ? 'Comment submitted for approval.' : 'Comment unchanged.')
      if (kind === 'rating') setRatingDraft(null)
      else setCommentDraft(null)
      own.reload()
      refreshPublic()
    } catch (err) {
      setError(err.message || 'Your review could not be saved. Please try again.')
    } finally {
      inFlight.current = false
      setBusy('')
    }
  }

  return (
    <div className="review-editor">
      <h3>Your review</h3>
      {error && <p role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}
      {own.status === 'loading' && <p role="status">Checking review eligibility…</p>}
      {own.status === 'error' && <p role="alert">Your review could not be loaded. <button onClick={own.reload}>Retry</button></p>}
      {own.status === 'notFound' && <p>This product is unavailable.</p>}
      {own.status === 'ready' && (own.data.eligible ? (
        <>
          <form onSubmit={(event) => submit(event, 'rating')}>
            <label htmlFor="review-score">Rating</label>
            <select id="review-score" name="score" value={ratingDraft ?? own.data.rating ?? ''} onChange={(event) => setRatingDraft(event.target.value)} required disabled={Boolean(busy)}>
              <option value="" disabled>Choose 1 to 5 stars</option>
              {[1, 2, 3, 4, 5].map((score) => <option key={score} value={score}>{score} {score === 1 ? 'star' : 'stars'}</option>)}
            </select>
            <button disabled={Boolean(busy)}>{busy === 'rating' ? 'Saving rating…' : 'Save rating'}</button>
          </form>
          {own.data.comment && <p>{commentState[own.data.comment.status]}</p>}
          <form onSubmit={(event) => submit(event, 'comment')}>
            <label htmlFor="review-comment">Comment</label>
            <textarea id="review-comment" name="comment" rows={4} value={commentDraft ?? own.data.comment?.body ?? ''}
              onChange={(event) => setCommentDraft(event.target.value)}
              required maxLength={1000} disabled={Boolean(busy)} />
            <button disabled={Boolean(busy)}>{busy === 'comment' ? 'Submitting comment…' : 'Submit comment'}</button>
          </form>
        </>
      ) : <p>You can review this product after your order is delivered.</p>)}
    </div>
  )
}

export default function ProductReviews({ productId }) {
  const { user, status } = useSession()
  const load = useCallback((signal) => apiRequest(`/products/${productId}/reviews`, { signal }), [productId])
  const resource = useAccountResource(`product:${productId}:reviews`, load)

  return (
    <section className="product-reviews" id="reviews" aria-labelledby="product-reviews-title">
      <h2 id="product-reviews-title">Customer reviews</h2>
      <PublicReviews resource={resource} />
      {user?.role === 'customer' && (
        <CustomerReview key={`${user.id}:${productId}`} userId={user.id} productId={productId} refreshPublic={resource.reload} />
      )}
      {status === 'anonymous' && <p><Link to={`/login?returnTo=${encodeURIComponent(`/products/${productId}#reviews`)}`}>Sign in</Link> to review a delivered purchase.</p>}
    </section>
  )
}
