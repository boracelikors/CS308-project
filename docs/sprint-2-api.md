# Sprint 2 interface contract — SCRUM-18

Status: implementation-aligned draft for backend/Bora review, 13 November 2026. React/Vite + Express + MySQL/Knex remain unchanged. No team approval is implied.

## Implemented endpoints
All requests use the configured VITE_API_BASE_URL (default http://localhost:3001). JSON request bodies use Content-Type: application/json. Fetch always includes credentials. Login uses an HttpOnly session cookie; no tokens/passwords are stored in browser storage. Use the same hostname (localhost) for frontend and backend.

| Method/path | Request | Response | Errors |
| --- | --- | --- | --- |
| GET /health | none | {"status":"ok"} | connection failure |
| GET /health/db | none | {"status":"ok","database":"up"} | 503 |
| GET /products | none | existing six-product array | 500 |
| POST /auth/register | name, taxId, email, homeAddress, password | 201 {user:{id,name,email,role}}; does not log in | 400 field validation; 409 EMAIL_TAKEN |
| POST /auth/login | email,password | {user:{id,name,email,role,homeAddress}} and session cookie | 400,401,429 |
| GET /auth/me | session cookie | {user:{id,name,email,role,homeAddress}} | 401 |
| POST /auth/logout | none | 204, destroys session | 500 |
| GET /cart | customer session | {cart} | 401,403,500 |
| POST /cart/items | {productId:1,quantity:2} | {cart} | 400 invalid input, stock/product errors |
| PUT /cart/items/:productId | {quantity:2} | {cart} | validation/stock/item errors |
| DELETE /cart/items/:productId | none | {cart} | authentication/store errors |

Canonical error: {"error":{"code":"VALIDATION_ERROR","message":"Some fields are invalid.","fields":{"email":"Enter a valid email address."}}}. Field errors are optional. Network errors display retryable feedback; they are not treated as logged-out sessions. Existing backend cart error mappings remain authoritative in cart/cartStore.js.

Example signup fixture (fictional): {"name":"Demo Customer","taxId":"12345678901","email":"customer@example.test","homeAddress":"Demo Street 10","password":"Example123"}. No seeded account is assumed. Registration requires password confirmation in the UI only. The backend enforces its own validation.

## Proposed interfaces awaiting owners
These endpoints are NOT implemented in current main and are not called by the new account pages.

| Method/path | Proposed input | Proposed success |
| --- | --- | --- |
| GET /products?q=&category=&sort=price_asc&page=1 | optional query | {items:[product],page,pageSize,total} |
| GET /products/:id | numeric ID | {product} |
| POST /cart/merge | {requestKey,items:[{productId,quantity}]} | {cart,adjustments:[]} |
| POST /checkout | {requestKey,deliveryAddress,quote,mockCard} | {order,invoice,emailStatus} |
| GET /orders | session | {orders:[]} |
| GET /orders/:id | session + owner check | {order} |
| GET /orders/:id/invoice | session + owner/role check | {invoice} |
| GET /orders/:id/invoice.pdf | same authorization | application/pdf |

Use positive integer IDs and quantities. Money uses exact decimal strings (e.g. "1299.90") and TRY, matching database/cart implementation; do arithmetic in minor units. Product stock naming and the final catalogue envelope require Bartu/Hasan review before changing the existing array response. Proposed sorting: price_asc, price_desc, popularity_desc; popularity is paid units with product ID tie-breaker. Out-of-stock items remain searchable.

Merge proposal: combine quantities by product, cap by current stock, report each adjustment, persist a unique request key per account so retries cannot double quantities. Keep guest data until server acknowledgement. Checkout proposal: authenticate, revalidate prices/stock, use a unique per-account request key; return 409 on changed quote/stock or conflicting key reuse, and a distinct payment-declined error. Orders use processing, in-transit, delivered. Exact envelopes/error codes await backend review.

## Frontend integration handoff
SessionProvider owns session loading, failure, authenticated and anonymous states. Protected routes are /profile, /checkout, /orders and /orders/:id. Public routes are /, /login, /register, /cart, /products/:id. Unimplemented feature pages are explicit placeholders, not completed features.

Bora: use useSession() and the shared api() client. The window auth:login event carries {user}; auth:cleared means clear account-specific cart/order caches; auth:expired clears the session. Guest storage is never erased by authentication. Implement the asynchronous merge/retry UI in your cart provider and gate checkout on merge acknowledgement. Do not rely only on the event for refresh: derive the active account from useSession().user.id. Unmount/key private views by user ID and ignore stale requests.

Safe returnTo accepts only same-site paths and excludes login/register loops. Signup redirects to login with a success message, then login returns to the retained target. A backend 401 from a non-auth endpoint triggers session expiry. Registration errors never log out an existing session.

Profile support adds homeAddress to the backend's safe login/session projection; tax ID/password hash stay private. Existing sessions created before the change need logout/login to acquire that field.
