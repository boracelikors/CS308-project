# Frontend

React + Vite, JavaScript, and plain CSS. See the root README for verified setup instructions and the team task breakdown.

```sh
npm ci
npm run dev
```

Open http://localhost:5173. Products come from the backend's `GET /products` (SCRUM-24).

## Components and Architecture

- `src/router/router.js`: lightweight SPA client router supporting `/`, `/products/:id`, and `/cart`.
- `src/components/Header.jsx`: DOBBY Audiophile House branding, collection navigation, and live cart item count badge.
- `src/components/CatalogControls.jsx`: accessible labelled search input, category selector, sorting options, and filter reset.
- `src/components/ProductCatalog.jsx`: requests products with debounced search, category filters, sorting, URL query parameter persistence, and pagination.
- `src/components/ProductCard.jsx`: product card showing exact formatted prices, fallback placeholders, out-of-stock badges, and direct link to product detail.
- `src/pages/ProductDetailPage.jsx`: full R9 product specifications (model, serial number, warranty, distributor, stock), stock-aware quantity stepper, and add to cart.
- `src/pages/CartPage.jsx`: shopping cart with quantity controls, removal, subtotal calculation, problem line alerts, and checkout path.
- `src/cart/`: shared cart state (`useCart()`, `CartProvider.jsx`). Guests use `localStorage` cart; authenticated customers use backend `/cart`.
- `src/utils/formatPrice.js`: exact decimal currency formatter preserving fractional kuruş without floating-point rounding errors.

## Testing and Verification (SCRUM-40)

### 1. Repeatable Commands

```sh
# Run unit & component test suite (Node test runner)
npm test

# Run code linter
npm run lint

# Build production bundle
npm run build

# Preview production build on http://localhost:4173
npm run preview
```

### 2. Automated Test Suites (77 Passing Cases)

- `src/cart/cart.test.js`: cart lines addition, normalization, view derivation, guest localStorage persistence, stock enforcement, retry.
- `src/catalog/catalogQuery.test.js`: query parameter parsing, serialization round-trip, description-only searches ("beryllium"), combined filters, all sorting directions (`price_asc`, `price_desc`, `popularity`), pagination header parsing, stale response cancellation.
- `src/utils/formatPrice.test.js`: integer formatting, exact decimal preservation (`18749.90` -> `18.749,90`), trailing zero cleanup (`89900.00` -> `89.900`).
- `src/router/router.test.js`: route matching for `/`, `/products/:id`, `/cart`, and invalid route handling.
- `src/pages/productDetailLogic.test.js`: quantity bounds validation (min 1, max stock), stock status helper, remaining allowed calculation, mandatory R9 field checks.
- `src/pages/ProductDetailPage.test.js`: R9 field rendering, fractional price formatting, zero-stock purchase disabling, simulated direct-link refresh.
- `src/pages/cartPageLogic.test.js`: checkout gating (empty cart, loading state, problem items), problem descriptions, guest return path vs customer direct path.
- `src/pages/CartPage.test.js`: empty cart scenario, quantity edit/remove, rejected update handling, guest vs customer redirect.

### 3. Repeatable Browser Smoke Checklist

Run this manual checklist before submitting a release:

1. **Guest Basket Flow:**
   - [ ] Open http://localhost:5173. Verify 6 categories in selector and catalogue products displayed.
   - [ ] Type a keyword in the search box (e.g. `beryllium` or `headphones`). Verify results update and URL reflects `?search=...`.
   - [ ] Filter by a category (e.g. `Headphones`). Verify URL updates and only headphones are displayed.
   - [ ] Click a product card (e.g. `/products/14`). Verify URL updates to `/products/14` and all R9 fields appear (Model, Serial Number, Stock, Warranty, Distributor).
   - [ ] Choose quantity `2` and click "Add to cart". Verify header cart badge updates to `2`.
   - [ ] Refresh the page (`F5`). Verify the product details remain visible and cart count remains `2`.
   - [ ] Navigate to `/cart`. Verify the item, unit price, quantity, line total, and subtotal agree.
2. **Stock & Problem Gating Flow:**
   - [ ] Visit an out-of-stock product (e.g. `/products/7`). Verify "Out of stock" badge is visible and "Add to cart" is disabled.
   - [ ] In `/cart`, increase quantity beyond available stock or test an out-of-stock line. Verify an alert banner appears and checkout is blocked with an explicit warning.
3. **Login & Session Transition Flow:**
   - [ ] On `/cart` as a guest, click "Sign in to Checkout".
   - [ ] Verify browser navigates to `/login?returnUrl=%2Fcart`.
   - [ ] Sign in with valid customer credentials. Verify redirection back to `/cart` with items preserved.
4. **Checkout & Order Flow:**
   - [ ] As a logged-in customer with a valid nonempty cart, click "Proceed to Checkout".
   - [ ] Verify transition to `/checkout`. Complete order and verify cart is cleared and order appears in history.

### 4. Responsive Regression Checkpoints

Verified layouts at standard viewports:
- **Mobile (375px):** Single-column grid, stacked catalogue controls, touch-friendly 44px buttons, sticky cart totals, no horizontal overflow.
- **Tablet (768px):** Two-column product grid, wrapped catalogue filter bar, accessible touch targets.
- **Desktop (1440px):** Three-column product grid, side-by-side product detail media & specifications, sticky order summary on `/cart`.
