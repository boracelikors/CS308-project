# Backend database setup (SCRUM-19)

## Decisions

| Item | Choice | Reason |
| --- | --- | --- |
| Database | MySQL | Agreed by the team; relational constraints fit customers, carts and orders; familiar from the Database Systems course. |
| Driver | `mysql2` | Standard MySQL driver for Node.js. |
| Migrations / queries | Knex | Stays close to SQL, keeps schema changes as versioned files in Git, easy to review. |
| Tested with | MySQL 26.10.0 (Homebrew), Node.js 26 | |

## One-time local setup

1. **Install and start MySQL.** macOS: `brew install mysql` then `brew services start mysql`. Windows/Linux: install MySQL Community Server and start the service.
2. **Create the databases and the app user** (run once as root: `mysql -u root -p`). Choose your own password:
   ```sql
   CREATE DATABASE IF NOT EXISTS dobby_dev  CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
   CREATE DATABASE IF NOT EXISTS dobby_test CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
   CREATE USER IF NOT EXISTS 'dobby_app'@'localhost' IDENTIFIED BY 'your_password';
   GRANT ALL PRIVILEGES ON dobby_dev.*  TO 'dobby_app'@'localhost';
   GRANT ALL PRIVILEGES ON dobby_test.* TO 'dobby_app'@'localhost';
   ```
   The app never uses `root`; `dobby_app` can only see these two databases.
3. **Create your local config** in `backend/`:
   ```sh
   cp .env.example .env
   ```
   Set `DB_PASSWORD` to the password above. Generate `SESSION_SECRET` with `openssl rand -hex 32`. `.env` is git-ignored; never commit it.
4. **Install and migrate:**
   ```sh
   npm install
   npm run migrate        # dobby_dev
   npm run migrate:test   # dobby_test
   ```
5. **Start:** `npm run dev`. Expected output:
   ```text
   Backend running on http://localhost:3001
   Database ready (dobby_dev)
   ```

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the backend with auto-restart |
| `npm run migrate` | Apply pending migrations to `dobby_dev` |
| `npm run migrate:test` | Apply pending migrations to `dobby_test` |
| `npm run migrate:status` | List applied and pending migrations |
| `npm run migrate:rollback` | Undo the last migration batch (development only) |
| `npx knex migrate:make <name>` | Create a new migration file in `db/migrations/` |

Starting the server never runs migrations and never drops data.

## Health checks

| Endpoint | Healthy | Database down |
| --- | --- | --- |
| `GET /health` | `200 {"status":"ok"}` | `200 {"status":"ok"}` (unchanged from Sprint 1) |
| `GET /health/db` | `200 {"status":"ok","database":"up"}` | `503 {"status":"error","database":"down"}` |

Neither endpoint returns credentials or error details.

## Shutdown

- Backend: `Ctrl + C` (closes the HTTP server and the database pool).
- MySQL (optional): `brew services stop mysql`. Data is kept on disk and is still there after a restart.

## Troubleshooting

| Message | Fix |
| --- | --- |
| `Configuration error: Missing required environment variables: ...` | Copy `.env.example` to `.env` and fill in the listed keys. |
| `Database NOT reachable (ECONNREFUSED)` | MySQL is not running: `brew services start mysql`. |
| `Database NOT reachable (ER_ACCESS_DENIED_ERROR)` | Wrong `DB_USER` / `DB_PASSWORD` in `.env`, or step 2 was skipped. |
| MySQL log shows `Library not loaded: ...libabsl...` | Homebrew updated a dependency: `brew upgrade mysql`. |

## Code layout

- `config.js`: loads and validates `.env`.
- `knexfile.js`: Knex settings (development and test).
- `db/knex.js`: shared connection pool and `checkDatabase()`.
- `db/migrations/`, `db/seeds/`: schema changes and seed data (SCRUM-20 / SCRUM-21).
- Business queries live in route/service modules, not in server startup.
