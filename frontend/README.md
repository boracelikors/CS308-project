# Frontend

React + Vite, JavaScript, and plain CSS. See the root README for verified setup instructions and the team task breakdown.

```sh
npm ci
npm run dev
```

Open http://localhost:5173. This SCRUM-8 foundation renders without the backend.

## Components and handoff

- `src/components/Header.jsx`: DOBBY Audophile House branding and collection navigation.
- `src/App.jsx`: homepage layout. Replace `<ProductSection />` with `<ProductSection><ProductList products={products} /></ProductSection>` when the list and data are ready.
- `src/components/ProductSection.jsx`: accessible product section and an honest empty state. The `children` slot is for Demirhan's product list (SCRUM-9).
- `src/App.css`: starter styling; Bora can extend it in SCRUM-10.
- `.env.example`: public API address convention for the later `fetch` integration. Use `import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001'`. No request is made in this foundation.

SCRUM-9 supplies the product cards. SCRUM-7 supplies GET /products. SCRUM-10 connects them and implements loading/error states. This branch does not claim those features are complete.

## Checks

```sh
npm run lint
npm run build
npm run preview
```

Preview runs at http://localhost:4173. The normal development address shared with the backend team is http://localhost:5173. Both use strict ports to avoid silently changing the agreed origin.
