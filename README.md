## Current Sprint 2 frontend branch

Account routes, cookie-session client and profile are implemented on this branch. See [run and verification steps](docs/sprint-2-release.md) and [API contract/handoff](docs/sprint-2-api.md). The historical Sprint 1 scope below is not a description of all current backend capabilities. Full checkout/order delivery still depends on other Sprint 2 tasks.

# CS308 Group 13 — DOBBY Audiophile House

A university group project to build an online store for high-end sound equipment.

This README is the starting point for anyone joining or reviewing the project. You do not need to know the project beforehand: it explains what we are building, who does what, how the parts connect, and how to begin contributing.

> **Documentation status:** This document describes the team's agreed basic Sprint 1 plan. The store name is DOBBY Audiophile House. The backend, product data, cards, products endpoint, and homepage integration are implemented.

## 1. What are we building?

We are building an online store focused mainly on high-end audio equipment. Its product range can include:

- Speakers and studio monitors.
- Soundbars.
- Subwoofers.
- Microphones.
- Headphones and earphones.
- DJ controllers and setups.
- Other related sound equipment and accessories.

The store name is **DOBBY Audiophile House**, chosen by Yunus on 5 November 2026.

This is a CS308 course project by Group 13. Course requirements and the teaching team's instructions remain the source of truth for assessed deliverables; this README explains our working plan.

## 2. What does Sprint 1 aim to achieve?

A **sprint** is a short, planned period in which a team works toward a specific result.

Our agreed basic Sprint 1 goal is:

**A teammate can run the project locally, open a simple homepage, and see six sample audio products loaded from the backend.**

“Locally” means running the application on your own computer rather than publishing it online.

### Included in this plan

- A backend that starts successfully.
- A health-check endpoint that confirms the backend is responding.
- A file containing six sample products.
- A products endpoint that returns those records.
- A frontend homepage with a store name and heading.
- Six product cards, each showing an image, name, and price.
- A simple layout that also works on narrow screens.
- Loading and failure messages when requesting products.
- Instructions that another teammate can follow to run the application.

### Outside this basic Sprint 1 plan

Database implementation, account registration, login, shopping carts, checkout, real payments, and individual product-detail pages are not included in these six tasks. They may be considered in later planning according to the course requirements.

This scope is a team implementation plan, not a claim that it covers every official course requirement.

## 3. Who is responsible for what?

| Team member | Area | Sprint 1 responsibility | Jira task |
| --- | --- | --- | --- |
| Onur Tekin | Backend | Create the backend and health check; document how to run it | [SCRUM-5](https://cs308group13.atlassian.net/browse/SCRUM-5) |
| Hasan Demirhan Durmaz | Backend | Prepare six consistent sample product records | [SCRUM-6](https://cs308group13.atlassian.net/browse/SCRUM-6) |
| Burak Bartu Yılmaz | Backend | Return the sample products through an endpoint | [SCRUM-7](https://cs308group13.atlassian.net/browse/SCRUM-7) |
| Yunus Emre Yolal | Frontend | Create the frontend, homepage header, and product section | [SCRUM-8](https://cs308group13.atlassian.net/browse/SCRUM-8) |
| Demirhan Işık | Frontend | Build reusable product cards and the product list | [SCRUM-9](https://cs308group13.atlassian.net/browse/SCRUM-9) |
| Bora Çelikörs | Frontend | Style the homepage and connect it to backend data | [SCRUM-10](https://cs308group13.atlassian.net/browse/SCRUM-10) |

Each Jira task contains an ordered checklist and a description of when it is complete. Check Jira for current progress; responsibility in this table does not mean the work has been completed.

[Jira board](https://cs308group13.atlassian.net/jira/software/projects/SCRUM/boards/1) · [Jira backlog](https://cs308group13.atlassian.net/jira/software/projects/SCRUM/boards/1/backlog)

## 4. How do the parts work together?

The **frontend** is the part a visitor sees and interacts with in a browser. The **backend** is a separate program that receives requests and returns data.

For Sprint 1, the data comes from a sample JSON file. A database is not needed for this planned demonstration.

```text
Visitor opens the homepage
           |
           v
Frontend requests the product list from the backend
           |
           v
Backend reads the sample product file
           |
           v
Backend sends product data back to the frontend
           |
           v
Frontend displays six product cards
```

An **API** is an agreed way for programs to communicate. An **endpoint** is a particular address in that API, such as `/products`; **GET** means the request is asking to read data.

The frontend and backend can run at the same time in separate terminal windows. A terminal is an application where you type commands to start programs and manage project files.

## 5. Planned repository structure

A **repository**, or **repo**, is the project folder together with its recorded change history. We plan to keep both parts of the application in one shared GitHub repository.

The following is a target structure, not a statement that these files already exist:

```text
project-root/
├── README.md                 # This introduction and setup guide
├── frontend/                 # Browser interface and styling
└── backend/                  # Server and API code
    └── sample-products.json  # Six demonstration products
```

The **project root** is the top-level folder containing this README. Framework-specific files and image locations should be documented here after the team chooses them.

## 6. Technology and configuration decisions

| Item | Current documentation |
| --- | --- |
| Final store name | DOBBY Audiophile House |
| GitHub repository address | https://github.com/boracelikors/CS308-project |
| Frontend framework and version | React 19.3.1 + Vite 8.3.5; JavaScript and plain CSS |
| Backend framework and version | Express 5.3.0 (Node.js) |
| Required runtime versions | Frontend tested with Node.js 24.8.0; backend previously tested with v26.13.0 |
| Dependency/package manager | npm; frontend tested with npm 11.6.0 |
| Backend development port | 3001 (implemented) |
| Frontend development port | 5173; http://localhost:5173 (strict port) |
| Database | MySQL (tested with 26.10.0) with Knex migrations; setup in [backend/DATABASE.md](backend/DATABASE.md) |
| Hosting/deployment | Not specified in this plan |

A **framework** provides common building blocks for an application. A **dependency** is a library the project needs, and a **runtime** is software that executes the application.

Do not guess installation commands from another project. Use the commands verified for this repository once the owners add them below.

## 7. Getting the project onto your computer

### Before you begin

1. Have a GitHub account.
2. Ask for access to the team's repository if it is private.
3. Accept the repository invitation.
4. Install Git, or use GitHub Desktop to manage the repository visually.
5. Install a code editor of your choice.
6. Install the runtimes and package manager listed in Section 6 once those choices are confirmed.

**Git** records changes to project files. **GitHub** hosts the shared repository online. **Cloning** creates your own working copy of the repository on your computer.

### Download a working copy

1. Open the team's GitHub repository.
2. Click **Code** and copy its HTTPS clone URL.
3. Open a terminal in the folder where you want to keep your project.
4. Run the command below after replacing `YOUR_REPOSITORY_URL` with the copied URL.

```sh
git clone YOUR_REPOSITORY_URL
```

5. Open the downloaded folder in your editor.
6. Read the frontend and backend setup instructions below before starting either application.

`YOUR_REPOSITORY_URL` is a placeholder; do not run it literally. Alternatively, use GitHub Desktop's clone feature to create the working copy.

## 8. Installing and running the application

The backend and frontend start independently. The homepage needs both running to show the six products.

### Backend

1. **Runtime:** Node.js (tested with v26.13.0) and npm (tested with 11.20.0). Check with `node -v` and `npm -v`.
2. **Move into the backend folder** (from the project root):
   ```sh
   cd backend
   ```
3. **Install dependencies:**
   ```sh
   npm install
   ```
4. **Configuration and database (Sprint 2):** MySQL is required. Follow [backend/DATABASE.md](backend/DATABASE.md) once to create the databases, the `dobby_app` user and `backend/.env`, then run `npm run migrate`.
5. **Start the development server** (auto-restarts on file changes):
   ```sh
   npm run dev
   ```
   Or without auto-restart: `npm start`
6. **Expected terminal message:**
   ```text
   Backend running on http://localhost:3001
   ```
7. **Local address:** `http://localhost:3001`. Health check: `http://localhost:3001/health` → `{"status":"ok"}`
8. **Stop the server:** press `Ctrl + C` in the terminal where it is running.

**localhost** means your own computer. The number after the colon is the **port**, which identifies the running service.

### Frontend — React + Vite

1. **Runtime:** use Node.js 24.8.0 or a compatible supported version; this setup was tested with Node.js 24.8.0 and npm 11.6.0. Check with `node -v` and `npm -v`.
2. **Move into the frontend folder** from the project root: `cd frontend`.
3. **Install locked dependencies:** `npm ci`.
4. **Start the development server:** `npm run dev`.
5. **Expected output:** Vite prints `Local: http://localhost:5173/`.
6. **Open:** http://localhost:5173. The homepage requests `GET /products`: it shows `Loading products...` while waiting, the product cards on success, and `Products could not be loaded` if the request fails.
7. **Stop:** press `Ctrl + C` in that terminal.
8. **Check code and production build:** `npm run lint` and `npm run build`. To inspect the build, run `npm run preview` and open http://localhost:4173.

The development port is fixed at 5173. If it is occupied, stop the other server or coordinate a port change with the team; Vite will not silently switch ports.

`.env.example` documents `VITE_API_BASE_URL`; a different backend address can be set in `frontend/.env.local`. Only public configuration belongs in `VITE_` variables.

See [frontend/README.md](frontend/README.md) for the component locations.

### Running both parts together

1. Start the backend using its verified instructions.
2. Open its health-check address and confirm the expected response.
3. Open a second terminal window.
4. Start the frontend using its verified instructions.
5. Open the frontend address in the browser.
6. Confirm that all six product cards appear. Without a working GET /products the homepage shows `Products could not be loaded`.

Never commit passwords, access tokens, or other private credentials. If configuration uses a private local file, document the needed variable names using a safe example file and exclude the real secrets from Git.

## 9. Planned API and product data

These are the planned interfaces for Sprint 1. Check their implementation before treating them as available.

### GET /health

Purpose: confirm that the backend is running and responding.

Expected response:

```json
{"status": "ok"}
```

### GET /products

Purpose: return the six sample products as a JSON array.

**Status:** Implemented (SCRUM-7). Address: `http://localhost:3001/products`

The backend reads `backend/sample-products.json` once at startup. Restart the backend after editing that file.

**CORS:** Only browser requests from the frontend origin `http://localhost:5173` are allowed. To use a different origin, set `FRONTEND_ORIGIN`, for example: `FRONTEND_ORIGIN=http://localhost:5174 npm run dev`


**JSON** is a text format for structured data. An array is a list of records; each product record contains named fields.

Example response shape, showing only one of the six records:

```json
[
  {
    "id": 1,
    "name": "Studio Monitor",
    "category": "Speakers",
    "price": 15000,
    "currency": "TRY",
    "description": "Sample studio speaker for our demonstration.",
    "image": "speaker.jpg"
  }
]
```

| Field | Meaning |
| --- | --- |
| `id` | Unique identifier for the product |
| `name` | Product name shown to the visitor |
| `category` | Product group, such as Speakers |
| `price` | Numeric demonstration price |
| `currency` | Currency code; TRY is used in this example |
| `description` | Short explanation of the product |
| `image` | Image filename agreed with the frontend team |

Prices and product details are demonstration data, not verified retail offers. Use one currency consistently; the example does not finalize the team's currency decision.

Product images live in `frontend/public/images/`. The `image` field holds the filename, and the card loads it from `/images/<filename>`.

The frontend and backend may have different local addresses. Bartu must allow the agreed frontend origin to request the backend data; the browser mechanism controlling this is called **CORS**.

### POST /cart/merge

Purpose: after login, add the guest cart (kept in the browser) to the customer's account cart. Retrying the same request can never add the quantities twice.

**Status:** Implemented (SCRUM-32), using the shape proposed by the frontend in SCRUM-33 (`frontend/src/cart/cartAdapters.js`). Customers only: guests get `401`, staff accounts `403`. The cart owner always comes from the login session.

```json
{
  "requestKey": "3f1c2a9e-8b7d-4c6e-9f00-1a2b3c4d5e6f",
  "items": [{ "productId": 1, "quantity": 5 }, { "productId": 11, "quantity": 1 }]
}
```

- `requestKey`: one `crypto.randomUUID()` per guest cart (8-64 letters, digits, `-` or `_`). Resend the same key and items when the outcome is unknown.
- `items`: 1-50 lines, `productId` a positive whole number, `quantity` 1-999. A product listed twice is added up. Any prices or totals in the body are ignored.

Merge rules, per product (`requested` = account quantity + guest quantity):

| Situation | Result | `reason` |
| --- | --- | --- |
| In stock, enough left | Quantities added up | (no adjustment) |
| `requested` is more than the stock | Capped at the stock | `INSUFFICIENT_STOCK` |
| Stock is 0 | Not added | `OUT_OF_STOCK` |
| Unknown product or taken off sale | Not added | `PRODUCT_UNAVAILABLE` |

The merge never lowers a quantity that was already in the account cart; if the stock dropped later, `GET /cart` flags that line with its `problem`. Prices and the subtotal are always read from the database.

Response `200` (the account cart already had 2 of product 1, which has 4 in stock):

```json
{
  "cart": { "items": [...], "subtotal": "369590.00", "currency": "TRY" },
  "adjustments": [
    { "productId": 1, "name": "Reference Bookshelf Monitors (Pair)", "requested": 7, "applied": 4, "reason": "INSUFFICIENT_STOCK" }
  ],
  "replayed": false
}
```

`cart` has the `GET /cart` shape. `applied` is the quantity of that product in the cart after the merge.

| Status | `error.code` | When |
| --- | --- | --- |
| 200 | | Merged; or `replayed: true` when this key was already applied: nothing is added again, `adjustments` are the ones from the first merge and `cart` is the cart as it is now |
| 400 | `VALIDATION_ERROR` | `error.fields` names `requestKey` and/or `items` (with the index of the bad line) |
| 401 / 403 | | Not logged in / not a customer |
| 422 | `REQUEST_KEY_REUSED` | The key was already used with different items; start again with a new key |

The merge and the record of the key are written in one transaction that locks the customer's cart, so simultaneous retries with one key are applied exactly once.

### POST /checkout

Purpose: turn the logged-in customer's server cart into one paid order using a **test payment**. No real bank is contacted and no money moves.

**Status:** Implemented (SCRUM-34), using the request/response shape proposed by the frontend in SCRUM-38 (`frontend/src/checkout/checkoutApi.js`). Customers only: guests get `401`, staff accounts `403`. The buyer and the cart always come from the login session.

```json
{
  "requestKey": "3f1c2a9e-8b7d-4c6e-9f00-1a2b3c4d5e6f",
  "expectedTotal": "37499.80",
  "deliveryAddress": "Orta Mah. Universite Cad. No:27, Tuzla",
  "payment": { "cardholderName": "Ayse Yilmaz", "cardNumber": "4242424242424242", "expiryMonth": 12, "expiryYear": 2030, "cvc": "123" }
}
```

- `requestKey`: one `crypto.randomUUID()` per checkout attempt; resend the same key and body when the outcome is unknown.
- `expectedTotal`: the cart `subtotal` the customer saw and confirmed. The server recalculates the total from current prices and never charges based on this value.
- `deliveryAddress` is optional; without it the customer's home address is used. The order keeps a copy, so later profile changes do not affect it.
- Test cards: `4000 0000 0000 0002` is always declined; any other card number that passes the standard checksum is approved (e.g. `4242 4242 4242 4242`). The full card number and CVC are never stored or logged; the order keeps only a mock payment reference and the last four digits.

Success: `201 { "order": { id, status: "processing", createdAt, inTransitAt, deliveredAt, deliveryAddress, total, currency, paymentMode: "test", paymentReference, cardLast4, items: [{ productId, productName, productModel, unitPrice, quantity, lineTotal }] } }`. Stock is decreased and the purchased items are removed from the cart in the same database transaction.

| Status | `error.code` | Meaning / what the frontend should do |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | Invalid fields; `error.fields` uses the form names (`requestKey`, `expectedTotal`, `deliveryAddress`, `cardholderName`, `cardNumber`, `expiry`, `cvc`) |
| 400 | `EMPTY_CART` | Nothing to buy |
| 409 | `CART_CHANGED` | Prices, stock or availability changed since the customer saw the cart; `error.cart` has the current cart (`problem` per item). Ask them to confirm again |
| 402 | `PAYMENT_DECLINED` | The test bank declined the card; nothing was charged, cart and stock unchanged |
| 409 | `OUT_OF_STOCK` | Another customer bought the last unit at the same moment; the payment was cancelled |
| 422 | `REQUEST_KEY_REUSED` | The key was already used with a different body; start a new attempt |
| 503 | `CHECKOUT_IN_PROGRESS` | The same key is still being processed; retry with the same key and body |

**Retries:** repeating a request with the same key never charges or orders twice. After the bank has been called, the same key always returns the first answer (with header `Idempotent-Replayed: true`). After a server error (5xx) nothing was kept, so the same key and body can be sent again.

Code: `backend/checkout/` (validation, service, route) and `backend/payment/mockBank.js`. Tests: `npm test` and `npm run test:db` (`db-tests/checkoutFlow.spec.js`).

### Orders and deliveries

**Status:** Implemented (SCRUM-35), using the shapes proposed by the frontend in SCRUM-39 (`frontend/src/orders/ordersApi.js`). All rules are enforced on the server; the customer ID always comes from the login session.

| Endpoint | Who | Response |
| --- | --- | --- |
| `GET /orders` | Customer | `200 { orders: [{ id, createdAt, total, currency, status }] }`, newest first; `{ orders: [] }` when there are none |
| `GET /orders/:id` | Customer | `200 { order }` in the same shape as the checkout response (`inTransitAt`, `deliveredAt`, `items[].productName`, `productModel`, purchase-time `unitPrice`). `404 ORDER_NOT_FOUND` for a missing order **and** for another customer's order |
| `GET /deliveries` | Product manager | `200 { deliveries: [{ deliveryId, orderId, customerId, productId, productName, quantity, totalPrice, currency, deliveryAddress, status, completed, orderedAt }] }`, one row per order item (R12). Optional `?status=processing|in_transit|delivered` |
| `PATCH /orders/:id/status` | Product manager | Body `{ "status": "in_transit" }` or `{ "status": "delivered" }`. Returns `200 { order }` and records `inTransitAt` / `deliveredAt` |

- Status moves only one step forward: `processing → in_transit → delivered`. Skipping, going back or repeating a step returns `409 INVALID_STATUS_TRANSITION` with `error.currentStatus`.
- Guests get `401`; logged-in users with another role get `403`. A customer cannot change any status, including their own order.
- The delivery list shows only the fields R12 needs: no customer name, email or tax ID.

**Trying it before the manager dashboard exists:** `npm run seed` creates a development-only product manager (`pm@dobby.test` / `DemoManager2026`, see `backend/DATABASE.md`). Example with curl:

```sh
curl -c pm.txt -H "Content-Type: application/json" -d '{"email":"pm@dobby.test","password":"DemoManager2026"}' http://localhost:3001/auth/login
curl -b pm.txt http://localhost:3001/deliveries
curl -b pm.txt -X PATCH -H "Content-Type: application/json" -d '{"status":"in_transit"}' http://localhost:3001/orders/1/status
```

Code: `backend/orders/`. Tests: `npm test` (`test/orderRoutes.test.js`) and `npm run test:db` (`db-tests/ordersFlow.spec.js`).

## 10. In what order should we work?

1. **Onur** creates the backend foundation.
2. **Yunus** creates the frontend foundation; this can happen alongside the backend work.
3. **Hasan** prepares sample data while coordinating its location and fields with the team.
4. **Bartu** builds the products endpoint once the backend and sample data are ready.
5. **Demirhan** builds the product cards once the frontend and sample data are ready.
6. **Bora** can start styling after the frontend exists, then connect everything once the cards and endpoint are ready.
7. **All six members** run the final checks and prepare the demonstration.

If a required input is missing, describe the blocker in the relevant Jira task and identify which teammate's work is needed.

## 11. How to contribute without overwriting teammates' work

The following is a proposed simple team workflow. Agree on the repository's default branch and review rules before using it.

1. Read your Jira task and its checklist.
2. Get the latest shared changes before starting work.
3. Create a separate branch for your task.
4. Make a small, focused change.
5. Run the relevant checks locally.
6. Commit the change with a clear message.
7. Push your branch to GitHub.
8. Open a pull request and link your Jira task.
9. Ask a teammate to review it.
10. Address review feedback.
11. Merge according to the team's agreed review process.
12. Update Jira to reflect the actual result.

A **branch** is a separate line of work. A **commit** is a saved change in Git, and **push** uploads your commits to GitHub. A **pull request** lets teammates review changes before **merging** them into the shared branch.

Suggested branch name: `SCRUM-5-backend-setup`. Suggested commit message: `Add backend health endpoint`.

If Git reports a **merge conflict**, two changes overlap and need a human decision. Coordinate with the affected teammate before choosing which version to keep.

## 12. When is Sprint 1 ready to demonstrate?

Use actual behavior, not just the presence of code or a Jira status, to check completion.

- [ ] A teammate can set up the application from this README without unwritten instructions.
- [ ] The backend starts successfully.
- [ ] GET /health returns the expected response.
- [ ] GET /products returns six product records.
- [ ] The frontend starts successfully.
- [ ] The homepage displays the store name and heading.
- [ ] Six cards display data received from the backend.
- [ ] Each card has a working image or placeholder.
- [ ] Each card shows the correct sample name and price.
- [ ] The layout remains usable at a narrow screen width.
- [ ] A loading message appears while the product request is pending.
- [ ] A useful error message appears when the request fails.
- [ ] Refreshing the page loads the products again.
- [ ] All changes needed for the demonstration are integrated into the shared version.
- [ ] Each member can explain their contribution.
- [ ] Jira reflects actual progress and any remaining problems.

Bora's Jira task also contains the shared final demonstration checklist.

## 13. Common problems

| Problem | First things to check |
| --- | --- |
| Frontend address does not open | Is the frontend running, and are you using the exact address it prints? |
| Health-check address does not open | Is the backend running, and is its actual port 3001 or something else? |
| Homepage opens but no products appear | Does GET /products return data, and does the frontend use the correct backend address? |
| Browser reports a CORS error | Does the backend allow the frontend's actual development origin? |
| Product images are missing | Do filenames, capitalization, and image paths match the agreed setup? |
| Installation fails | Are you using the documented runtime version and package manager? |
| Port is already in use | Check whether the application is already running in another terminal; coordinate any port change and update the documentation. |
| GitHub repository cannot be opened | Check your signed-in account and whether you accepted the access invitation. |

When asking a teammate for help, share the command or action you tried, the error message, and the result you expected. Remove credentials or other private values before sharing logs.

## 14. Keeping this README accurate

The person who changes setup, configuration, endpoints, or folder structure should update the relevant section in the same pull request.

Before a new teammate uses this document, confirm that:

- The repository URL and final project name are filled in.
- Technology choices and required versions are recorded.
- Installation and startup commands are verified.
- Local addresses and any required configuration are documented.
- Planned behavior is clearly distinguished from implemented behavior.
- Course-specific submission and demonstration instructions are linked once confirmed.

A useful README should let a new teammate understand the project and reproduce its working state without relying on information hidden in group chats.