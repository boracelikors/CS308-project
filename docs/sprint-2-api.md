# Sprint 2 interface contract — SCRUM-18

Status: implementation-aligned integration contract, 13 November 2026. Verified against the combined open-PR candidate; teammate acceptance remains required. React/Vite + Express + MySQL/Knex remain unchanged. No team approval is implied.

## Implemented endpoints
All requests use the configured VITE_API_BASE_URL (default http://localhost:3001). JSON request bodies use Content-Type: application/json. Fetch always includes credentials. Login uses an HttpOnly session cookie; no tokens/passwords are stored in browser storage. Use the same hostname (localhost) for frontend and backend.

| Method/path | Request | Response | Errors |
| --- | --- | --- | --- |
| GET /health | none | {"status":"ok"} | connection failure |
| GET /health/db | none | {"status":"ok","database":"up"} | 503 |
| GET /products | search, categoryId, sort, page, pageSize query | product array; X-Total-Count, X-Page, X-Page-Size, X-Total-Pages headers | 400,500 |
| GET /products/:id | numeric ID | {product} | 404 PRODUCT_NOT_FOUND |
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

## Commerce endpoints in the integration candidate

These are implemented by the open PRs below; merge them in the order recorded in sprint-2-release.md. They are not all on main yet.

| Method/path | Request | Success | Owner PR |
| --- | --- | --- | --- |
| POST /cart/merge | {requestKey,items:[{productId,quantity}]} | {cart,adjustments,replayed} | #25 (already merged) |
| POST /checkout | {requestKey,expectedTotal,deliveryAddress,payment:{cardholderName,cardNumber,expiryMonth,expiryYear,cvc}} | 201 {order} | #22 |
| POST /checkout/attempts/:key/resolve | none; customer session | {phase:"pending"}, {phase:"succeeded",order}, or {phase:"failed",error} | #22 recovery fix |
| GET /orders | customer session | {orders:[{id,createdAt,total,currency,status}]} | #23 |
| GET /orders/:id | owning customer session | {order} | #23 |
| PATCH /orders/:id/status | product-manager session; {status:"in_transit"} or {status:"delivered"} | {order} | #23 |
| GET /deliveries | product-manager session; optional status query | {deliveries} | #23 |

Product fields: id, name, model, serialNumber, description, category, categoryId, price, currency, quantityInStock, inStock, warrantyStatus, distributor, image. Price is an exact decimal string. Sort values are price_asc, price_desc, popularity; popularity is paid units sold with product ID as a stable tie-breaker. Zero-stock products remain searchable.

Cart example: `{items:[{productId:1,name:"Demo",unitPrice:"10.00",quantity:2,lineTotal:"20.00",stock:3,problem:null,currency:"TRY"}],subtotal:"20.00",currency:"TRY"}`. The server derives all prices and the owner from its database/session.

Merge adds guest quantities to the account cart, caps new additions at available stock and reports requested/applied quantities. Existing account quantities are not silently reduced; GET /cart flags later stock changes. Guest storage is removed only after server acknowledgement; failed merges and adjustments block checkout pending retry/review. Reusing a key with different items returns 422 REQUEST_KEY_REUSED.

Checkout example (fictional): `{requestKey:"demo-attempt-123",expectedTotal:"20.00",deliveryAddress:"Demo Street 10",payment:{cardholderName:"Demo Customer",cardNumber:"4242424242424242",expiryMonth:12,expiryYear:2030,cvc:"123"}}`. Test card 4000000000000002 is declined. No real payment occurs. Errors include 400 VALIDATION_ERROR/EMPTY_CART, 402 PAYMENT_DECLINED, 409 CART_CHANGED/OUT_OF_STOCK, 422 REQUEST_KEY_REUSED, and 503 CHECKOUT_IN_PROGRESS. The same key/body replays the original outcome. Stock/order/cart updates are atomic.

Reload recovery stores only an account-scoped request key, never card details. The resolve endpoint returns the outcome or pending. If the original request never arrived, it atomically records a cancelled key, preventing a delayed original request from creating an order after the customer starts again. A pending result blocks a new checkout. An interrupted backend process can leave a pending key; this requires operational reconciliation and must not be automatically treated as a failed payment.

Order fields: id, status, createdAt, inTransitAt, deliveredAt, deliveryAddress, total, currency, paymentMode, paymentReference, cardLast4, items[{productId,productName,productModel,unitPrice,quantity,lineTotal}]. Order snapshots do not change when current products or addresses change. Missing/other-customer orders both return 404 ORDER_NOT_FOUND. Delivery transitions are processing -> in_transit -> delivered; invalid transitions return 409 INVALID_STATUS_TRANSITION. Guests receive 401 and wrong roles 403.

## Invoice dependency (SCRUM-36)

Protected invoice/PDF endpoints and test-mailbox delivery are not implemented by these PRs. No endpoint or delivery success is assumed. Checkout displays an order summary and explicitly states that invoice PDF/email is unavailable. The owner must agree the final invoice contract before SCRUM-18 is fully accepted.

## Frontend integration handoff
SessionProvider owns session loading, failure, authenticated and anonymous states. Protected routes are /profile, /checkout, /orders and /orders/:id. Public routes are /, /login, /register, /cart, /products/:id. The integration candidate mounts the product, cart, checkout and order pages. Main remains dependent on their PR merges.

Bora: use useSession() and the shared apiRequest() client (api() is a compatibility alias). The window auth:login event carries {user}; auth:cleared means clear account-specific cart/order caches; auth:expired clears the session. Guest storage is never erased by authentication. Implement the asynchronous merge/retry UI in your cart provider and gate checkout on merge acknowledgement. Do not rely only on the event for refresh: derive the active account from useSession().user.id. Unmount/key private views by user ID and ignore stale requests.

Safe returnTo accepts only same-site paths and excludes login/register loops. Signup redirects to login with a success message, then login returns to the retained target. A backend 401 from a non-auth endpoint triggers session expiry. Registration errors never log out an existing session.

Profile support adds homeAddress to the backend's safe login/session projection; tax ID/password hash stay private. Existing sessions created before the change need logout/login to acquire that field.
