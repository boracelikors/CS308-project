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
- `.env.example`: public API address, read with `import.meta.env.VITE_API_BASE_URL`.


## Checks

```sh
npm run lint
npm run build
npm run preview
```

Preview runs at http://localhost:4173. The normal development address shared with the backend team is http://localhost:5173. Both use strict ports to avoid silently changing the agreed origin.
