# CS308 Group 13 — DOBBY Audophile House

A university group project to build an online store for high-end sound equipment.

This README is the starting point for anyone joining or reviewing the project. You do not need to know the project beforehand: it explains what we are building, who does what, how the parts connect, and how to begin contributing.

> **Documentation status:** This document describes the team's agreed basic Sprint 1 plan. It does not claim that the features are already implemented. The store name is DOBBY Audophile House. Backend setup and the SCRUM-8 React homepage foundation are implemented; product data, cards, and integration remain separate tasks.

## 1. What are we building?

We are building an online store focused mainly on high-end audio equipment. Its product range can include:

- Speakers and studio monitors.
- Soundbars.
- Subwoofers.
- Microphones.
- Headphones and earphones.
- DJ controllers and setups.
- Other related sound equipment and accessories.

The store name is **DOBBY Audophile House**, chosen by Yunus on 5 November 2026.

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
| Final store name | DOBBY Audophile House |
| GitHub repository address | https://github.com/boracelikors/CS308-project |
| Frontend framework and version | React 19.3.1 + Vite 8.3.5; JavaScript and plain CSS |
| Backend framework and version | Express 5.3.0 (Node.js) |
| Required runtime versions | Frontend tested with Node.js 24.8.0; backend previously tested with v26.13.0 |
| Dependency/package manager | npm; frontend tested with npm 11.6.0 |
| Backend development port | 3001 (implemented) |
| Frontend development port | 5173; http://localhost:5173 (strict port) |
| Database | Not required for the agreed basic Sprint 1 plan |
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

The backend and frontend foundation can be started independently. The complete six-product demonstration still depends on SCRUM-6, SCRUM-7, SCRUM-9, and SCRUM-10.

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
4. **Configuration:** None required. The port defaults to `3001`; it can optionally be overridden with the `PORT` environment variable (e.g. `PORT=4000 npm run dev`).
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
6. **Open:** http://localhost:5173. The homepage header and product section work without a backend; the collection currently shows a coming-soon state.
7. **Stop:** press `Ctrl + C` in that terminal.
8. **Check code and production build:** `npm run lint` and `npm run build`. To inspect the build, run `npm run preview` and open http://localhost:4173.

The development port is fixed at 5173. If it is occupied, stop the other server or coordinate a port change with the team; Vite will not silently switch ports.

**Integration handoff:** Bartu should allow `http://localhost:5173` as the frontend origin. The planned backend address is `http://localhost:3001`. `.env.example` documents `VITE_API_BASE_URL` for Bora's later integration; a different address can be set in `frontend/.env.local`. Only public configuration belongs in `VITE_` variables.

Demirhan can add his product list inside `ProductSection` in `frontend/src/App.jsx`. Bora can then pass backend data to that list and add loading/error states. See [frontend/README.md](frontend/README.md) for the component locations.

### Running both parts together

1. Start the backend using its verified instructions.
2. Open its health-check address and confirm the expected response.
3. Open a second terminal window.
4. Start the frontend using its verified instructions.
5. Open the frontend address in the browser.
6. Once SCRUM-6, SCRUM-7, SCRUM-9, and SCRUM-10 are integrated, confirm that all six product cards appear; the SCRUM-8 foundation alone shows a coming-soon state.

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

Hasan and Bora must agree where images live and how filenames map to frontend image paths. Use permitted images or placeholders.

The frontend and backend may have different local addresses. Bartu must allow the agreed frontend origin to request the backend data; the browser mechanism controlling this is called **CORS**.

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
