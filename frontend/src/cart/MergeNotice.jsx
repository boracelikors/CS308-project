import { useState } from 'react'
import { useCart } from './cartContext.js'
import { describeAdjustment } from './guestMerge.js'

// Shown after sign-in when the guest cart could not be merged yet, or was merged with changes (SCRUM-33)
export default function MergeNotice() {
  const { merge, retryMerge, adjustments, acknowledgeAdjustments } = useCart()
  const [retrying, setRetrying] = useState(false)

  async function handleRetry() {
    setRetrying(true)
    await retryMerge()
    setRetrying(false)
  }

  if (merge.status === 'failed') {
    const count = merge.guestItemCount
    return (
      <div className="cart-notice cart-notice--error" role="alert">
        <p>
          {count === 1 ? '1 item' : `${count} items`} from your guest cart could not be added to your account yet.
          They are still saved on this device.
        </p>
        <button type="button" className="cart-notice-action" onClick={handleRetry} disabled={retrying}>
          {retrying ? 'Trying again...' : 'Try again'}
        </button>
      </div>
    )
  }

  if (adjustments.length > 0) {
    return (
      <div className="cart-notice" role="status">
        <p>Your guest cart was added to your account with some changes. Please review them before checkout:</p>
        <ul>
          {adjustments.map((adjustment) => (
            <li key={adjustment.productId}>
              <strong>{adjustment.name ?? `Product ${adjustment.productId}`}</strong>: {describeAdjustment(adjustment)}
            </li>
          ))}
        </ul>
        <button type="button" className="cart-notice-action" onClick={acknowledgeAdjustments}>
          I have reviewed these changes
        </button>
      </div>
    )
  }

  return null
}
