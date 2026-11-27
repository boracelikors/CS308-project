# Sprint 3 review and delivery demo

R5 requires a delivered purchase before a customer can rate or comment. A rating is public immediately. Product managers approve or reject comments. Public responses omit the customer and moderation records.

## Run and rehearse

1. Set up the development database and both apps using [the existing local guide](sprint-2-release.md). Run backend `npm run migrate` to apply the review migration. Run `npm run seed` on the demo database to load the catalogue and product manager.
2. With the backend running, run `npm run demo:reviews` from `backend`. For a custom API port use `DEMO_API_URL=http://localhost:33029 npm run demo:reviews`. The script creates fictional buyers and uses the normal test checkout and delivery APIs. Running it twice before the rehearsal returns the same orders. Use a clean demo database or a new `DEMO_ROUND` label for another rehearsal if the former buyer's order is already delivered.
3. Sign in as `reviews-buyer@dobby.test` with `DemoReview2026`. The product #10 review form is locked until delivery. Open their order history and invoice. An order links back to its product.
4. With `pm@dobby.test` and `DemoManager2026`, open **Product manager → Deliveries**, locate the printed order ID, and advance it through **In transit** to **Delivered**. Reopen the product as the buyer. Submit a rating and comment. The rating appears immediately; the buyer sees the comment as pending.
5. In another account or a signed-out window confirm the pending comment is absent. In the manager **Comments** tab, approve it and refresh the public product page. The second buyer `reviews-observer@dobby.test` (same password) has a delivered purchase of product #11. Submit a separate comment there to rehearse rejection without hiding the approved example.
6. Demo payment and invoice delivery use fake card data and the configured local test mailbox. Check [SCRUM-59](https://cs308group13.atlassian.net/browse/SCRUM-59) for speaker handoffs and the progress demo checklist.

The fixture script uses two reserved `.test` addresses. A round label changes both addresses, for example `DEMO_ROUND=second npm run demo:reviews` creates `reviews-buyer-second@dobby.test`. Seed only the demo database and use a disposable database for `npm run test:db`.

## Frontend and backend contract

| Endpoint | Role | Request / response |
| --- | --- | --- |
| `GET /products/:id/reviews` | Public | `{rating: {count, average}, comments: [{id, body, submittedAt}]}`. Latest 20 approved comments. No author identifiers or pending text. Empty average is `null`. |
| `GET /products/:id/reviews/me` | Customer | `{eligible, rating, comment}` for the signed-in customer. Rating is an integer or `null`. Comment is `{body,status}` or `null`. |
| `PUT /products/:id/reviews/rating` | Customer, delivered purchase | `{score: 5}` → `{score: 5}`. A customer gets one score per product; a subsequent score replaces it. |
| `PUT /products/:id/reviews/comment` | Customer, delivered purchase | `{body: "Clear vocals."}` → `{body,status}`. One comment per customer and product. A new or edited comment is pending. Identical text preserves its current status. |
| `GET /manager/comments` | Product manager | `{comments: [{id, body, revision, submittedAt, productId, productName, authorName}]}`. Up to 50 oldest pending comments. |
| `PATCH /manager/comments/:id` | Product manager | `{status: "approved", revision: 1}` → `{id,status}`. Rejection uses `"rejected"`. An edited or resolved revision returns `409 COMMENT_CHANGED`. |
| `GET /deliveries` / `PATCH /orders/:id/status` | Product manager | Existing order APIs reused by the manager Deliveries page. |

Requests use signed session cookies. Guests receive `401` for private operations and incorrect roles receive `403`. An ineligible customer receives `403 REVIEW_NOT_ELIGIBLE`. An active product is required. Ratings accept integers 1–5. Comments are trimmed plain text of 1–1000 characters, escaped by React. A modification to a previously approved comment temporarily removes it from public view until approved again. A manager decision compares both pending state and revision in one update.

## Checks

Run `npm test` and `npm run test:db` in backend and `npm test`, `npm run lint`, `npm run build` in frontend. The review suite covers two accounts, two product outcomes, duplicate ratings, stale moderation edits and concurrent decisions.

## Optional manager stock screen

In the product manager area open **Stock**, select an active product, and enter its new nonnegative whole quantity. Saving sends `PATCH /manager/products/:id/stock` with `{quantity, expectedQuantity}`. The server updates the row only if its current quantity still matches the value the manager edited. A stale edit reports `409 STOCK_CHANGED` and refreshes the displayed quantity. Setting stock to zero keeps the item visible in the catalogue and prevents adding it to the cart. Use a demo database and restore the original quantity after showing the example.
