# Frontdesk — Customer Support Ticket Management System

Frontdesk is a full-stack, enterprise customer support ticket management system built as an integrated single application for **iNav Technologies**.

---

## 🛠 Technology Stack

- **Frontend:** React 18, Vite, JavaScript
- **Styling:** Tailwind CSS, PostCSS, Autoprefixer
- **Backend:** Node.js, Express.js (REST API architecture)
- **Database:** PostgreSQL
- **ORM:** Prisma ORM
- **Authentication:** Stateless JWT (JSON Web Tokens) with bcrypt password hashing
- **Icons:** Lucide React

---

## 📁 Project Directory Structure

```text
frontdesk-support-system/
├── .gitignore                   # Excludes secrets, node_modules, build/dist, logs, OS/IDE artifacts
├── package.json                 # Root package orchestrating dev, test, build, db, and install scripts
├── README.md                    # System architecture, clean-clone setup, and API documentation
│
├── client/                      # Frontend Application (React + Vite + Tailwind CSS)
│   ├── .env.example             # Frontend environment variable template
│   ├── .env                     # Local frontend environment variables (git-ignored)
│   ├── index.html               # Main HTML entry point
│   ├── package.json             # Frontend dependencies & scripts
│   ├── postcss.config.js        # PostCSS configuration for Tailwind CSS
│   ├── tailwind.config.js       # Tailwind CSS theme & content configuration
│   ├── vite.config.js           # Vite development and build configuration
│   └── src/
│       ├── assets/              # Static frontend assets
│       ├── components/          # Reusable UI components
│       ├── context/             # Global React state contexts
│       ├── hooks/               # Custom React hooks
│       ├── pages/               # Application view pages
│       ├── services/            # Axios API client with JWT interceptors
│       │   └── api.js
│       ├── utils/               # Helper utilities and formatters
│       ├── App.jsx              # Application root component
│       ├── index.css            # Tailwind directives and custom CSS
│       └── main.jsx             # React DOM mounting entry point
│
└── server/                      # Backend Application (Node.js + Express + Prisma + PostgreSQL)
    ├── .env.example             # Backend environment variable template
    ├── .env                     # Local backend environment variables (git-ignored)
    ├── package.json             # Backend dependencies & Prisma scripts
    ├── test-sla.js              # SLA engine unit and boundary test suite
    ├── test-api.js              # Comprehensive automated API verification suite
    ├── test-integration-review.js # Full lifecycle and integration review test suite
    ├── test-user-provisioning.js # User provisioning and RBAC registration test suite
    ├── scripts/
    │   └── create-admin.js      # Production initial Administrator provisioning CLI script
    ├── prisma/
    │   ├── schema.prisma        # Prisma PostgreSQL schema definition & enums
    │   ├── migrations/          # Git-tracked SQL migration files
    │   └── seed.js              # Database seed script for roles, users, holidays, tickets (dev-only)
    └── src/
        ├── app.js               # Express app setup, CORS, JSON parsers, routes
        ├── server.js            # HTTP server startup & graceful shutdown handlers
        ├── config/
        │   ├── db.js            # PrismaClient singleton instance
        │   └── env.js           # Validated environment configuration
        ├── controllers/         # Express request handlers (auth, ticket)
        │   ├── auth.controller.js
        │   └── ticket.controller.js
        ├── middlewares/         # Security guards, request validators, error handlers
        │   ├── auth.js          # JWT verification & RBAC authorization
        │   ├── validator.js     # Request body validators
        │   └── errorHandler.js  # Global centralized error handler
        ├── routes/              # Express REST API routes
        │   ├── health.routes.js # Health check endpoint (/api/health)
        │   ├── auth.routes.js   # Authentication endpoints (/api/auth/*)
        │   └── ticket.routes.js # Ticket lifecycle endpoints (/api/tickets/*)
        ├── services/            # Core business logic layer
        └── utils/
            ├── date.js          # UTC to Asia/Kolkata date formatter & SLA calculators
            ├── jwt.js           # JWT sign & verify utility
            └── password.js      # Bcrypt password hashing & comparison
```

---

## ⚙️ Environment Variables Configuration

### Backend (`server/.env`)
| Variable | Description | Default / Example |
| :--- | :--- | :--- |
| `PORT` | Port for Express API server | `5000` |
| `NODE_ENV` | Application environment (`development` / `production`) | `development` |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://postgres:1234@localhost:5432/frontdesk_db?schema=public` |
| `JWT_SECRET` | Secret key for signing and verifying JWT tokens (development-only default; production requires a strong, random secret) | `frontdesk_jwt_secret_token_inav_tech_placement_2026` |
| `CLIENT_URL` | Allowed origin for Cross-Origin Resource Sharing (CORS) | `http://localhost:5173` |

> ⚠️ **Production Security Notice:** The default `JWT_SECRET` above is provided solely for local development convenience. Production deployments must configure a unique, high-entropy random secret (e.g., generated with `openssl rand -hex 32`).

### Frontend (`client/.env`)
| Variable | Description | Default / Example |
| :--- | :--- | :--- |
| `VITE_API_URL` | Base URL for REST API requests | `http://localhost:5000/api` |

---

## 🔑 User Roles & Production Provisioning

Frontdesk implements role-based access control across three user roles: `ADMIN`, `AGENT`, and `CUSTOMER`.

### Development Evaluation
- In local development (`NODE_ENV=development`), the application provides 1-click demo persona quick-switcher buttons in the login page, sidebar, and header for rapid multi-role evaluation across Admin, Agent, and Customer accounts.
- Database demo seeding (`npm run db:seed --prefix server`) is available **strictly in development** to populate initial sample tickets and evaluation personas.

### Production Provisioning & Security
- **Production Seed Protection:** The database seed script (`server/prisma/seed.js`) is strictly **blocked** when `NODE_ENV=production`. Running the seed command in production halts immediately with an error to prevent inserting default accounts or overwriting data.
- **Initial Administrator Provisioning:** In a fresh production deployment where no users exist, the initial Administrator account is created using the dedicated server CLI script:
  ```bash
  ADMIN_EMAIL="admin@yourdomain.com" ADMIN_NAME="System Administrator" ADMIN_PASSWORD="<StrongSecurePassword>" npm run create-admin --prefix server
  ```
  *(or `node server/scripts/create-admin.js` with environment variables)*.
  - **Required Environment Variables:**
    - `ADMIN_EMAIL` — Valid administrator email address.
    - `ADMIN_NAME` — Administrator display name (minimum 2 characters).
    - `ADMIN_PASSWORD` — Administrator password (minimum 6 characters).
  - **Security Best Practice:** Passwords must be passed through environment variables rather than command-line arguments to prevent exposure in process listings (`ps`) or shell history.
  - **Duplicate Account Protection:** If an account with the specified email already exists, the script fails safely with a non-zero exit code without altering the existing user or password. Passwords are saved as standard bcrypt hashes.
- **Agent Account Creation:** Once the initial Administrator logs in, they can create `AGENT` (or additional `ADMIN`) accounts via the authenticated `POST /api/auth/register` API endpoint by passing their Bearer JWT. Anonymous attempts to create `AGENT` or `ADMIN` roles return `403 Forbidden`.
- **Customer Account Creation:** Customers can self-register at any time using the public `POST /api/auth/register` endpoint (which defaults to the `CUSTOMER` role), or support staff can create customer records during ticket submission.
- **Demo Switcher Exclusion:** Demo persona switching controls, demo account lists, and default passwords are completely stripped and dead-code eliminated from production frontend builds (`import.meta.env.DEV`).

---

## 📊 Database Entities, Constraints & Indexes

1. **User (`users`):**
   - Fields: `id` (UUID PK), `name`, `email` (UK), `passwordHash`, `role` (`ADMIN` | `AGENT` | `CUSTOMER`), `createdAt`.
   - Index: `[role]`.
2. **Customer (`customers`):**
   - Fields: `id` (UUID PK), `name`, `email` (UK), `phone`, `createdAt`, `userId` (FK to User, unique).
   - Indexes: `[email]`, `[name]`.
3. **Ticket (`tickets`):**
   - Fields: `id` (UUID PK), `ticketNumber` (Autoincrement UK), `subject`, `description`, `customerId` (FK to Customer), `assignedAgentId` (FK to User, nullable), `priority` (`LOW` | `MEDIUM` | `HIGH` | `URGENT`), `status` (`OPEN` | `IN_PROGRESS` | `PENDING_CUSTOMER` | `RESOLVED` | `CLOSED`), `createdAt`, `updatedAt`, `resolvedAt`, `closedAt`, `firstResponseAt`, `responseDueAt`, `resolutionDueAt`.
   - Indexes: `[ticketNumber]`, `[customerId]`, `[assignedAgentId]`, `[status]`, `[priority]`, `[createdAt]`, `[status, priority]`, `[assignedAgentId, status]`.
4. **Message (`messages`):**
   - Fields: `id` (UUID PK), `ticketId` (FK to Ticket), `senderId` (FK to User), `content`, `createdAt`.
   - Indexes: `[ticketId]`, `[senderId]`, `[createdAt]`.
5. **InternalNote (`internal_notes`):**
   - Fields: `id` (UUID PK), `ticketId` (FK to Ticket), `authorId` (FK to User), `content`, `createdAt`.
   - Indexes: `[ticketId]`, `[authorId]`, `[createdAt]`.
6. **TicketAssignment (`ticket_assignments`):**
   - Fields: `id` (UUID PK), `ticketId` (FK to Ticket), `agentId` (FK to User), `assignedAt`, `releasedAt`.
   - Indexes: `[ticketId]`, `[agentId]`, `[assignedAt]`.
7. **TicketEvent (`ticket_events`):**
   - Fields: `id` (UUID PK), `ticketId` (FK to Ticket), `actorId` (FK to User), `eventType`, `oldValue`, `newValue`, `metadata` (JSON), `createdAt`.
   - Indexes: `[ticketId]`, `[actorId]`, `[createdAt]`, `[eventType]`.
   - **Append-only:** No application API exists to update or delete events.
8. **Holiday (`holidays`):**
   - Fields: `id` (UUID PK), `date` (Date UK), `name`.
9. **SLAPause (`sla_pauses`):**
   - Fields: `id` (UUID PK), `ticketId` (FK to Ticket), `startedAt`, `endedAt`.
   - Index: `[ticketId]`.

---

## 🕒 Timezone Handling: UTC & Asia/Kolkata

- **Database Storage:** All dates and timestamps are strictly stored in standard **UTC** ISO-8601 (`DateTime`).
- **Display Representation:** The backend date utility automatically attaches **Asia/Kolkata** formatted display fields to all API responses (e.g., `createdAtIST`, `responseDueAtIST`, `resolutionDueAtIST` formatted as `21 Nov 2026, 08:15 PM IST`).

---

## 🕒 SLA Calculation Engine & Working Hours Rules

Frontdesk incorporates a reusable, backend-enforced SLA engine ([`server/src/services/sla.service.js`](file:///e:/frontdesk/frontdesk-support-system/server/src/services/sla.service.js)):

### Working Hours Definition
- **Working Days:** Monday to Friday.
- **Working Hours:** 9:30 AM to 6:30 PM (9 working hours / 540 working minutes per day).
- **Time Zone:** `Asia/Kolkata` (UTC +05:30).
- **Exclusions:**
  - Saturdays and Sundays are strictly excluded.
  - Configured festival/company holidays are strictly excluded (from `Holiday` table).

### SLA Targets
| Priority | First Response Target | Resolution Target |
| :--- | :--- | :--- |
| **Critical / Urgent** | 2 working hours (120 working minutes) | **Same working day** (6:30 PM IST of current applicable working day) |
| **High** | 3 working hours (180 working minutes) | 1 working day (540 working minutes) |
| **Medium** | 4 working hours (half a working day / 240 min) | 3 working days (1,620 working minutes) |
| **Small / Low** | 8 working hours (1 working day / 480 min) | 1 working week (5 working days / 2,700 working minutes) |

> 📌 **Documented Interpretation (Critical Resolution):**
> "Same working day" is interpreted as **6:30 PM IST (end of shift) of the current applicable working day**.
> If created during working hours, it is 6:30 PM IST of that same day.
> If created after hours, on a weekend, or on a holiday, the applicable working day is the next working day, so the resolution deadline is 6:30 PM IST of that next working day.

### Pause & Resume Lifecycle
1. When a ticket enters `WAITING_FOR_CUSTOMER` (or `PENDING_CUSTOMER`), an `SLAPause` record is created (`startedAt = now, endedAt = null`).
2. Multiple waiting periods are fully supported and accumulated.
3. When the customer replies (or status moves back to `IN_PROGRESS`), the open pause is closed (`endedAt = now`), the working minutes elapsed during the pause are calculated, and all unfulfilled deadlines (`responseDueAt`, `resolutionDueAt`) are extended by that exact duration.
4. An append-only audit event `SLA_RESUMED` logs the exact working minutes paused and updated deadlines.

### Priority Change Recalculation
- When priority changes (e.g. from Small to Critical), new SLA deadlines are recalculated starting from the priority-change time.
- The previous deadlines and priority are preserved in the event history (`PRIORITY_CHANGED`).

### Overdue Status Suppression
- Per Rule 8, **a ticket is never marked overdue during weekends, outside working hours, or on festival holidays**. The SLA overdue flag is active only during working hours.

---

## 🔄 Ticket Lifecycle & Status Transitions

Frontdesk enforces a strict backend state machine and automated lifecycle engine ([`server/src/services/ticketLifecycle.service.js`](file:///e:/frontdesk/frontdesk-support-system/server/src/services/ticketLifecycle.service.js)):

### Supported Statuses
- **`OPEN`**: Newly created ticket, awaiting assignment.
- **`IN_PROGRESS`**: Active ticket claimed and worked on by an agent.
- **`WAITING_FOR_CUSTOMER`**: Agent requested information; SLA timers paused.
- **`RESOLVED`**: Issue solved; 7-calendar-day reopening window active.
- **`CLOSED`**: Terminal state; permanently archived ticket.

### Valid State Transitions
| From Status | Allowed Target Statuses | Trigger / Conditions |
| :--- | :--- | :--- |
| `OPEN` | `IN_PROGRESS`, `CLOSED` | Agent assignment (`/assign`) or direct self-close |
| `IN_PROGRESS` | `WAITING_FOR_CUSTOMER`, `RESOLVED`, `CLOSED`, `OPEN` | Question asked (pauses SLA), resolved with summary, close, or release |
| `WAITING_FOR_CUSTOMER` | `IN_PROGRESS`, `RESOLVED`, `CLOSED` | Customer reply (resumes SLA), agent solves, or auto-closed |
| `RESOLVED` | `IN_PROGRESS`, `CLOSED` | Reopened within 7-day window, or finalized |
| `CLOSED` | *(None — Terminal)* | Transitions out of `CLOSED` return HTTP 400 |

### Reopening Rules (7-Calendar-Day Window)
- **Documented Interpretation**: Reopening is permitted within **7 calendar days** of `resolvedAt`.
- **Authorization**: Restricted to `AGENT` and `ADMIN` roles (`403 Forbidden` for customers).
- **Post-Expiry Enforcement**: Attempts to reopen after 7 days are rejected with `HTTP 400 Bad Request`. Users must create a new ticket.
- **History Preservation**: Previous resolution timestamps and status change events are preserved. A `TICKET_REOPENED` event logs the previous `resolvedAt` and reopening reason. SLA resolution deadlines are recalculated from the reopen timestamp.

### Automatic Scheduled Closure Job
- **Dormancy Threshold**: Tickets waiting in `WAITING_FOR_CUSTOMER` for **5 working days** (2,700 working minutes).
- **Working Hours Exclusions**: Weekends and configured company holidays are strictly excluded from the dormancy duration.
- **Customer Reply Defense**: The job verifies no subsequent customer messages exist before closing.
- **Idempotency**: Running the job repeatedly produces zero redundant closures or duplicate events.
- **Audit Logging**: Appends a `SYSTEM_AUTO_CLOSED` event with an explicit system actor (`System Automation`, `system@frontdesk.local`) documenting elapsed working minutes.

---

## 🔒 Security & Business Rules

1. **Password Security:**
   - Passwords hashed with bcrypt (cost factor 10).
   - Password hashes are **never** selected or returned in any API responses.
2. **Customer Data Isolation:**
   - Customers can **only** list and view their own tickets (`customerId` forced via authenticated session).
   - Customers receive `403 Forbidden` if attempting to access another customer's ticket.
3. **Internal Notes Confidentiality:**
   - Customer-facing APIs **never** expose internal notes, assignments, or internal audit events.
   - Any attempt by a Customer to add an internal note returns `403 Forbidden`.
4. **Ticket Assignment & Ownership Concurrency Rules:**
   - **Pessimistic Row Locking (`SELECT ... FOR UPDATE`):** When taking an unassigned ticket, PostgreSQL locks the ticket row.
   - **Atomic Check & 409 Conflict:** If another agent has taken the ticket, the backend immediately raises `HTTP 409 Conflict` with: `"Conflict: This ticket has already been assigned to another agent."`.
   - **Database-Level Constraint:** A partial unique index (`CREATE UNIQUE INDEX unique_active_ticket_assignment ON ticket_assignments ("ticketId") WHERE "releasedAt" IS NULL;`) physically prevents duplicate active assignments.
   - **Authorization Guards:** Only the currently assigned agent or an `ADMIN` can release or reassign tickets (`403 Forbidden` for unauthorized attempts).
   - **History Preservation:** Whenever a ticket is reassigned or released, previous assignments have `releasedAt` timestamped in UTC.
5. **Reliable Append-Only Audit History (Database Trigger Protected):**
   - **Comprehensive Coverage:** Events are transactionally recorded for `TICKET_CREATED`, `AGENT_ASSIGNED`, `AGENT_REASSIGNED`, `AGENT_RELEASED`, `PRIORITY_CHANGED`, `STATUS_CHANGED`, `CUSTOMER_REPLY`, `INTERNAL_NOTE_ADDED`, `SLA_PAUSED`, `SLA_RESUMED`, `TICKET_RESOLVED`, `TICKET_REOPENED`, and `SYSTEM_AUTO_CLOSED`.
   - **Authoritative Provenance:** Every event records what happened (`eventType`, `oldValue`, `newValue`), when it happened (server-generated UTC `createdAt`), and who performed it (`actorId` from authenticated session, or explicit `System Automation` actor).
   - **Database-Level Immutability Trigger:** A PostgreSQL BEFORE trigger (`trg_prevent_ticket_events_modification`) strictly rejects `UPDATE` and `DELETE` queries with exception code `P0001`. Audit records can never be mutated or erased.
   - **Zero Modification Endpoints:** The API provides strictly read-only access (`GET /api/tickets/:id/events`); no update or delete routes exist.
6. **Ticket Resolution Validation:**
   - Changing status to `RESOLVED` or `CLOSED` requires a mandatory `resolutionSummary`.

---

## 🖥 Frontend Architecture (React + Tailwind CSS)

Frontdesk features a professional enterprise SaaS dashboard built with **React 18**, **React Router v6**, **Tailwind CSS**, and **Lucide React** icons. The frontend communicates exclusively with the live Express REST API — there is no mock data.

### Design System
- **Surfaces:** Clean white/light-grey (`bg-slate-50`, `bg-white`).
- **Sidebar:** Dark navy (`bg-slate-900`) with blue primary actions (`bg-blue-600`).
- **Borders & Shadows:** Subtle (`border-slate-200`, `shadow-xs`).
- **Typography:** Clear, professional tables and forms with consistent spacing.
- **Layout:** Responsive sidebar + header + content layout, scrollable content regions.

### Application Pages & Components

| Path | Component | Description |
| :--- | :--- | :--- |
| `/login` | `LoginPage` | Email/password login form with JWT authentication, error validation, and 1-click demo persona quick-switcher buttons (development only; hidden and disabled in production). |
| `/dashboard` | `DashboardPage` | 6 KPI stat cards (Open, In Progress, Waiting for Customer, Overdue, Resolved, Assigned to Me), SLA policy banner, and recent activity feed. Each card is click-to-filter. |
| `/tickets` | `TicketListPage` | Professional data table with ticket number, subject, customer, priority badge, status badge, assigned agent, first response SLA indicator, resolution SLA indicator, and created date. Includes multi-parameter filtering (status, priority, assigned agent, overdue, waiting for customer), search with debounce, and pagination. |
| `/tickets/:id` | `TicketDetailPage` | Two-column layout: **Left** — tabbed Customer Conversation, Private Internal Notes (staff only, with warning banner), and Chronological Audit Trail (with database trigger protection badge). **Right** — SLA countdown/overdue status, customer profile, assignment controls (Take / Reassign / Release), status lifecycle transitions, priority change with SLA recalculation, and resolve/reopen actions. |

### Reusable Components

| Component | Purpose |
| :--- | :--- |
| `Sidebar` | Dark navy navigation sidebar with logo, nav links, demo persona switcher grid (development only), user badge, and logout. |
| `Header` | Page title, working hours indicator, and inline persona quick-switcher bar (development only). |
| `StatusBadge` | Color-coded status pill with icon for `OPEN`, `IN_PROGRESS`, `WAITING_FOR_CUSTOMER`, `RESOLVED`, `CLOSED`. |
| `PriorityBadge` | Color-coded priority pill with icon for `URGENT`, `HIGH`, `MEDIUM`, `LOW`. |
| `SLABadge` | Displays SLA status (Met ✅, Due, Overdue 🔴, Paused ⏸) for response and resolution targets. |
| `CreateTicketModal` | Form with customer selection (or inline new customer creation for staff), subject, priority with SLA targets, and description. |
| `ReassignModal` | Agent selection dropdown to reassign a ticket. |
| `ResolveModal` | Mandatory resolution summary form required to mark a ticket RESOLVED. |
| `ReopenModal` | Optional reason form to reopen a resolved ticket within the 7-day window. |
| `ExportModal` | JSON preview and download for ticket conversation export. |

### Authentication & State Management
- **AuthContext** (`context/AuthContext.jsx`): Manages JWT token, user session, `login()`, `logout()`, `switchPersona()` for rapid development evaluation (disabled in production), and role-based helpers (`isStaff`, `isAdmin`, `isCustomer`).
- **Protected Routes**: All routes except `/login` require an authenticated session. Unauthenticated users are redirected to the login page.
- **Axios Interceptor** (`services/api.js`): Automatically attaches the JWT `Authorization` header and clears the session on 401 responses.

### Production Deployment
In production, the Express server serves the built React client from `client/dist/` with SPA fallback, so both frontend and API run on a single port (`PORT`, default 5000):
```bash
npm run build      # Build the React client
npm start          # Serves API + frontend on port 5000
```

---

## 📡 REST API Reference

### Authentication
- `POST /api/auth/register` — Register a customer account (or create staff if Admin)
- `POST /api/auth/login` — Login with email/password; returns JWT
- `GET /api/auth/me` — Get current authenticated profile

### Tickets
- `GET /api/tickets` — List tickets with pagination (`page`, `limit`), search (`search`), filtering (`status`, `priority`, `assignedAgentId`, `customerId`)
- `POST /api/tickets` — Create ticket (calculates business-hours SLA due dates and appends event)
- `GET /api/tickets/:id` — Get ticket details (Customer view hides internal notes; Staff view includes all tabs)
- `GET /api/tickets/:id/sla` — Inspect SLA calculation breakdown, working hours config, pause metrics, and remaining minutes
- `GET /api/tickets/:id/events` — Retrieve chronological audit history with actor, action, previous/new values, and timestamps
- `GET /api/tickets/:id/export` — Export ticket history (securely strips internal notes for customers, includes for staff)
- `POST /api/tickets/:id/messages` — Post public message (customer reply automatically resumes paused SLA clock)
- `POST /api/tickets/:id/internal-notes` — Post staff-only internal note (`ADMIN`, `AGENT` only)
- `POST /api/tickets/:id/assign` — Agent takes unassigned ticket (with row locking & 409 conflict handling)
- `POST /api/tickets/:id/reassign` — Reassign ticket to another agent (`ADMIN` or currently assigned agent only)
- `POST /api/tickets/:id/release` — Release ticket back to unassigned pool (`ADMIN` or currently assigned agent only)
- `PATCH /api/tickets/:id/priority` — Update priority and recalculate SLA deadlines (`ADMIN`, `AGENT` only)
- `PATCH /api/tickets/:id/status` — Update ticket status (`OPEN`, `IN_PROGRESS`, `WAITING_FOR_CUSTOMER`, `RESOLVED`, `CLOSED`) with lifecycle validation
- `POST /api/tickets/:id/reopen` — Reopen a resolved ticket within 7-calendar-day window (`ADMIN`, `AGENT` only)
- `POST /api/tickets/admin/auto-close` — Trigger automated scheduled closure for inactive tickets (`ADMIN` only)

---

## 🚀 Running Verification & Tests

To execute the automated test suites across the application:
```bash
npm test
```
*Runs all **229 automated tests** across four specialized test suites:*
- **SLA Engine Unit & Boundary Tests (`test-sla.js`):** 30 passed — Working hours boundaries (09:30–18:30 IST), weekends, holiday exclusions, after-hours snapping, multi-day pauses, priority recalculation, and overdue suppression.
- **API & Concurrency Suite (`test-api.js`):** 137 passed — Full REST API endpoints, ticket assignment row locking (`SELECT FOR UPDATE`), 409 conflict handling, partial unique indexes, status transitions, 7-day reopening window, scheduled auto-close job, and database-level immutable audit trigger verification.
- **Integration Review Suite (`test-integration-review.js`):** 47 passed — Multi-actor workflow reviews, public message resumption, customer internal note privacy, and edge-case lifecycle validations.
- **User Provisioning & Security Suite (`test-user-provisioning.js`):** 15 passed — Anonymous customer registration, anonymous admin/agent rejection, authenticated admin role creation, agent/customer privilege escalation defense, invalid token rejection, CLI `create-admin` duplicate protection, and bcrypt hash storage verification.

To run suites individually:
- `npm run test:sla --prefix server` — Runs the 30 pure SLA calculation tests.
- `npm run test:api --prefix server` — Runs the 137 API integration and concurrency tests.
- `npm run test:review --prefix server` — Runs the 47 integration review tests.
- `npm run test:provisioning --prefix server` — Runs the 15 user provisioning security tests.
