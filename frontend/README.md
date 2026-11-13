# Frontend

React + Vite, JavaScript, and plain CSS. See the root README for verified setup instructions and the team task breakdown.

```sh
npm ci
npm run dev
```

Open http://localhost:5173. Products come from the backend's `GET /products`.

## Components and handoff

- `src/components/Header.jsx`: DOBBY Audiophile House branding and collection navigation.
- `src/App.jsx`: homepage layout.
- `src/components/ProductCatalog.jsx`: requests the products and shows the list, loading or error state.
- `src/components/ProductSection.jsx`: accessible product section and an honest empty state. The `children` slot is for Demirhan's product list (SCRUM-9).
- `src/App.css`: starter styling; Bora can extend it in SCRUM-10.
- `src/cart/`: the shared cart. Components call `useCart()` (from `cartContext.js`, interface documented there) and never touch storage or the API directly. Guests use a versioned `localStorage` cart holding only product IDs and quantities; logged-in customers use the backend `/cart`. Totals shown in the browser are for display only; the server's totals are the ones used for purchase.
- `src/api/request.js`: shared fetch helper. Sends the login cookie, turns `{ error: { code, message } }` into an `ApiError`, and marks network failures and 5xx responses as `uncertain`. Requests with an uncertain outcome are retried with the same request key.
- `src/cart/guestMerge.js`, `src/cart/MergeNotice.jsx`: guest-to-account cart merge after sign-in (SCRUM-33). The guest cart is kept until the server confirms the merge.
- `src/checkout/`: checkout page, mock card validation and one-request-key-per-attempt submission (SCRUM-38).
- `src/orders/`: order history and order detail pages, with loading scoped to the signed-in account (SCRUM-39).
- `.env.example`: public API address, read with `import.meta.env.VITE_API_BASE_URL`.


## Waiting on other tasks

Pages are not routed yet: `CheckoutPage`, `OrderHistoryPage` and `OrderDetailPage` are mounted once SCRUM-18 adds routes, and receive the signed-in `user` from SCRUM-26/27. The invoice PDF download and the email status come with SCRUM-36.

The backend endpoints use the shapes first proposed here; the code next to each call documents them:

| Endpoint | Code | Backend task |
| --- | --- | --- |
| `POST /cart/merge` | `src/cart/cartAdapters.js` | SCRUM-32 (PR #25) |
| `POST /checkout` | `src/checkout/checkoutApi.js` | SCRUM-34 (PR #22) |
| `GET /orders`, `GET /orders/:id` | `src/orders/ordersApi.js` | SCRUM-35 (PR #23) |

## Checks

```sh
npm test
npm run lint
npm run build
npm run preview
```

Preview runs at http://localhost:4173. The normal development address shared with the backend team is http://localhost:5173. Both use strict ports to avoid silently changing the agreed origin.
