# Wishlist and discount notification handoff

This is the planned interface for SCRUM-55. It designs the next shopping feature without adding wishlist or outbound mail behavior to the review demo.

## Wishlist contract

Store `wishlist_items(customer_id, product_id, created_at)` with a unique key on the customer and product. Use the customer ID from the signed session and foreign keys to users and products. The wishlist points to the current catalogue, so it never changes order or invoice snapshots.

| Operation | Behavior |
| --- | --- |
| `GET /wishlist` | List the current customer's saved products with availability and current price. Hide an inactive product from purchasing and keep a removable saved entry. |
| `PUT /wishlist/items/:productId` | Add an active product, including zero-stock items. Repeating the request does not add another row. |
| `DELETE /wishlist/items/:productId` | Remove the current customer's entry. Repeating the request is safe. |

Use 401 for guests, 403 for other roles, and 404 when an add targets an unavailable product. Check ownership using the session. Do not return another customer's wishlist or expose recipients through the catalogue.

## When discounts are implemented

The sales manager applies a validated discount in a transaction. Record the effective price and a discount campaign ID. Resolve wishlist recipients when the discount takes effect and write one notification per campaign, customer and product to an outbox in the same transaction. A worker sends approved local or configured mail after commit, records sent attempts and retries independently. A repeat campaign request must reuse the same campaign and must not enqueue another message. SMTP acceptance after a process crash can still duplicate delivery; record and handle that operationally.

Respect the purchase-time price in invoices and refunds. Cancelling a discount restores the current catalogue price without rewriting either snapshot.

## Proposed tests

Use two customer accounts, one manager, an inactive product, and a zero-stock product. Verify repeated add/remove, owner isolation, discount notification eligibility, concurrent campaign retries, and the difference between current prices and historic order totals.
