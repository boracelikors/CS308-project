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
      <p className="review-summary">{rating.count
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

function FeedbackMessage({ feedback }) {
  if (!feedback) return null
  return (
    <p role={feedback.type === 'error' ? 'alert' : 'status'}>
      {feedback.message}
    </p>
  )
}

function CustomerReview({ userId, productId, refreshPublic }) {
  const path = `/products/${productId}/reviews`
  const load = useCallback((signal) => apiRequest(`${path}/me`, { signal }), [path])
  const own = useAccountResource(`${userId}:${path}`, load)
  const [ratingDraft, setRatingDraft] = useState(null)
  const [commentDraft, setCommentDraft] = useState(null)
  const [busy, setBusy] = useState('')
  const [ratingFeedback, setRatingFeedback] = useState(null)
  const [commentFeedback, setCommentFeedback] = useState(null)
  const inFlight = useRef(false)

  const selectedScore = ratingDraft ?? own.data?.rating ?? null
  const commentValue = commentDraft ?? own.data?.comment?.body ?? ''

  async function submitRating(event) {
    event.preventDefault()
    if (inFlight.current) return
    const score = Number(selectedScore)
    if (!Number.isInteger(score) || score < 1 || score > 5) {
      setRatingFeedback({ type: 'error', message: 'Please select a rating from 1 to 5 stars.' })
      return
    }
    inFlight.current = true
    setBusy('rating')
    setRatingFeedback(null)
    try {
      await apiRequest(`${path}/rating`, { method: 'PUT', body: { score } })
      setRatingFeedback({ type: 'status', message: 'Your rating is public.' })
      setRatingDraft(null)
      own.reload()
      refreshPublic()
    } catch (err) {
      setRatingFeedback({ type: 'error', message: err.message || 'Your rating could not be saved. Please try again.' })
    } finally {
      inFlight.current = false
      setBusy('')
    }
  }

  async function submitComment(event) {
    event.preventDefault()
    if (inFlight.current) return
    const trimmed = commentValue.trim()
    if (!trimmed) {
      setCommentFeedback({ type: 'error', message: 'Please enter a comment before submitting.' })
      return
    }
    if (trimmed.length > 1000) {
      setCommentFeedback({ type: 'error', message: 'Comments must be 1000 characters or fewer.' })
      return
    }
    inFlight.current = true
    setBusy('comment')
    setCommentFeedback(null)
    try {
      const saved = await apiRequest(`${path}/comment`, { method: 'PUT', body: { body: trimmed } })
      setCommentFeedback({
        type: 'status',
        message: saved.status === 'pending' ? 'Comment submitted for approval.' : 'Comment unchanged.',
      })
      setCommentDraft(null)
      own.reload()
      refreshPublic()
    } catch (err) {
      setCommentFeedback({ type: 'error', message: err.message || 'Your comment could not be saved. Please try again.' })
    } finally {
      inFlight.current = false
      setBusy('')
    }
  }

  return (
    <div className="review-editor">
      <h3>Your review</h3>
      {own.status === 'loading' && <p role="status">Checking review eligibility…</p>}
      {own.status === 'error' && <p role="alert">Your review could not be loaded. <button onClick={own.reload}>Retry</button></p>}
      {own.status === 'notFound' && <p>This product is unavailable.</p>}
      {own.status === 'ready' && (own.data.eligible ? (
        <>
          <form onSubmit={submitRating} noValidate>
            <fieldset className="star-selector" disabled={Boolean(busy)}>
              <legend>Rating</legend>
              <div className="star-options">
                {[1, 2, 3, 4, 5].map((score) => {
                  const active = selectedScore !== null && score <= Number(selectedScore)
                  return (
                    <label key={score} className={`star-option${active ? ' star-option--active' : ''}`}>
                      <input
                        type="radio"
                        name="score"
                        value={score}
                        checked={Number(selectedScore) === score}
                        onChange={() => {
                          setRatingDraft(score)
                          setRatingFeedback(null)
                        }}
                        aria-label={`${score} ${score === 1 ? 'star' : 'stars'}`}
                      />
                      <span aria-hidden="true">{active ? '★' : '☆'}</span>
                    </label>
                  )
                })}
              </div>
              {selectedScore && (
                <span className="star-selection-text" aria-live="polite">
                  {selectedScore} out of 5 {Number(selectedScore) === 1 ? 'star' : 'stars'} selected
                </span>
              )}
            </fieldset>
            <FeedbackMessage feedback={ratingFeedback} />
            <button type="submit" disabled={Boolean(busy)}>{busy === 'rating' ? 'Saving rating…' : 'Save rating'}</button>
          </form>
          {own.data.comment && <p>{commentState[own.data.comment.status]}</p>}
          <form onSubmit={submitComment} noValidate>
            <label htmlFor="review-comment">Comment</label>
            <textarea id="review-comment" name="comment" rows={4} value={commentValue}
              onChange={(event) => {
                setCommentDraft(event.target.value)
                setCommentFeedback(null)
              }}
              maxLength={1000} disabled={Boolean(busy)} />
            <FeedbackMessage feedback={commentFeedback} />
            <button type="submit" disabled={Boolean(busy)}>{busy === 'comment' ? 'Submitting comment…' : 'Submit comment'}</button>
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
