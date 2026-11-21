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
    ├── test-api.js              # Comprehensive automated API verification suite
    ├── prisma/
    │   ├── schema.prisma        # Prisma PostgreSQL schema definition & enums
    │   ├── migrations/          # Git-tracked SQL migration files
    │   └── seed.js              # Database seed script for roles, users, holidays, tickets
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
| `JWT_SECRET` | Secret key for signing and verifying JWT tokens | `frontdesk_jwt_secret_token_inav_tech_placement_2026` |
| `CLIENT_URL` | Allowed origin for Cross-Origin Resource Sharing (CORS) | `http://localhost:5173` |

### Frontend (`client/.env`)
| Variable | Description | Default / Example |
| :--- | :--- | :--- |
| `VITE_API_URL` | Base URL for REST API requests | `http://localhost:5000/api` |

---

## 🔑 Demo Credentials

All test accounts use the default password: **`password123`**

| Role | Name | Email | Description |
| :--- | :--- | :--- | :--- |
| **ADMIN** | System Administrator | `admin@frontdesk.com` | Full administrative privileges, user management, and reassignment |
| **AGENT** | Sarah Connor | `agent.sarah@frontdesk.com` | Support agent handling tickets, internal notes, and status updates |
| **AGENT** | Alex Murphy | `agent.alex@frontdesk.com` | Support agent handling tickets, internal notes, and status updates |
| **CUSTOMER** | John Doe | `john.doe@example.com` | Customer managing authored tickets (#6, #8) |
| **CUSTOMER** | Jane Smith | `jane.smith@example.com` | Customer managing authored tickets (#7) |

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
5. **Append-Only Ticket Events:**
   - Ticket events are strictly append-only (`AGENT_ASSIGNED`, `AGENT_REASSIGNED`, `AGENT_RELEASED`, `PRIORITY_CHANGED`, `SLA_PAUSED`, `SLA_RESUMED`). No PUT, PATCH, or DELETE endpoints exist for ticket events.
6. **Ticket Resolution Validation:**
   - Changing status to `RESOLVED` or `CLOSED` requires a mandatory `resolutionSummary`.

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
- `POST /api/tickets/:id/messages` — Post public message (customer reply automatically resumes paused SLA clock)
- `POST /api/tickets/:id/internal-notes` — Post staff-only internal note (`ADMIN`, `AGENT` only)
- `POST /api/tickets/:id/assign` — Agent takes unassigned ticket (with row locking & 409 conflict handling)
- `POST /api/tickets/:id/reassign` — Reassign ticket to another agent (`ADMIN` or currently assigned agent only)
- `POST /api/tickets/:id/release` — Release ticket back to unassigned pool (`ADMIN` or currently assigned agent only)
- `PATCH /api/tickets/:id/priority` — Update priority and recalculate SLA deadlines (`ADMIN`, `AGENT` only)
- `PATCH /api/tickets/:id/status` — Update ticket status (`OPEN`, `IN_PROGRESS`, `WAITING_FOR_CUSTOMER`, `RESOLVED`, `CLOSED`)

---

## 🚀 Running Verification & Tests

To execute the automated SLA calculation tests and full API verification suite:
```bash
npm test
```
*Runs 96 automated tests: 30 SLA engine unit & edge case tests + 66 full API integration & concurrency tests.*

To run tests individually:
- `npm run test:sla --prefix server` — Runs the 30 pure SLA calculation tests.
- `npm run test:api --prefix server` — Runs the 66 API integration and concurrency tests.
