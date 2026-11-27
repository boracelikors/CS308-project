# DOBBY Audiophile House

We are CS308 Group 13. We are building an online store for audio equipment.

## What works now

- You can browse, search and sort products. You can open a product to see its details and stock.
- You can add items to a cart before signing in. The cart carries over when you sign in.
- You can place a test order, track delivery and download a PDF invoice. With a test inbox set up, you can also receive the invoice by email.
- You can rate and comment on a product after your order is delivered. The rating appears right away. A product manager must approve the comment before everyone can see it.
- A product manager can update stock, change delivery status and approve or reject comments.

Checkout uses test payments. The demo runs on your computer.

## Sprint 3 status

- Reviews and comment approval are on `main`. [PR #33](https://github.com/boracelikors/CS308-project/pull/33)
- Stock editing is also on `main`. The wishlist and discount emails have a [design document](docs/sprint-3-wishlist-design.md). They are still to be built. [PR #34](https://github.com/boracelikors/CS308-project/pull/34)
- We still need to check keyboard navigation and Turkish letters in the invoice during the demo flow. We also need to rehearse as a team, check our course evidence and confirm the demo time with the TA. [Demo checks](https://cs308group13.atlassian.net/browse/SCRUM-56) · [Team rehearsal](https://cs308group13.atlassian.net/browse/SCRUM-59)

## Run it on your computer

Use Node.js 24 and MySQL 8.4. The browser app uses React and Vite. The server uses Express.

1. Clone the repository and start MySQL.
2. Follow the [database setup guide](backend/DATABASE.md). It shows how to create the database and set up `backend/.env`.
3. Open a terminal in the project folder. Start the server:

   ```sh
   cd backend
   npm ci
   npm run migrate
   npm run seed
   npm start
   ```

   Run `npm run seed` on a local demo database to load test products and accounts. Check [database health](http://localhost:3001/health/db) after the server starts.

4. Open a second terminal in the project folder. Start the website:

   ```sh
   cd frontend
   npm ci
   npm run dev
   ```

5. Open [http://localhost:5173](http://localhost:5173). Keep both terminals open.

If a port is busy or you want to see invoice emails, see the [local setup guide](docs/sprint-2-release.md#run-locally-from-a-fresh-checkout).

## Demo and project links

- [Step-by-step demo with test accounts](docs/sprint-3-reviews.md)
- [Jira board](https://cs308group13.atlassian.net/jira/software/projects/SCRUM/boards/1)
- [API reference](docs/sprint-2-api.md)
- [Sprint 1 plan and earlier notes](https://github.com/boracelikors/CS308-project/blob/1385a5486384afba969008caaa9ac475bd8f87ca/README.md)
