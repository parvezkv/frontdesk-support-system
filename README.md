# Frontdesk — Customer Support Ticket Management System

A full-stack customer support ticket management system developed for the **iNav Technologies Full Stack Developer Machine Test**.

Frontdesk provides a centralized platform for customers to raise support tickets and for support agents and administrators to manage ticket assignments, conversations, priorities, SLAs, and ticket lifecycles.

## 🌐 Live Deployment

| Component | URL |
|---|---|
| Frontend Application | https://frontdesk-support-system.vercel.app |
| Backend API | https://frontdesk-support-api.onrender.com |
| API Health Check | https://frontdesk-support-api.onrender.com/api/health |
| GitHub Repository | https://github.com/parvezkv/frontdesk-support-system |

**Deployment architecture:**
- Frontend hosted on Vercel.
- Backend REST API hosted on Render.
- PostgreSQL database hosted on Supabase.
- Prisma ORM manages database access and migrations.

## 🔑 Evaluation Login Accounts

The following production accounts have been created and login has been tested successfully.

| Role | Name | Login Email |
|---|---|---|
| Administrator | Frontdesk Admin | `frontdesk.admin@example.com` |
| Agent | test1 | `agent.test1@example.com` |
| Customer | Test Customer | `customer.test@example.com` |

**Password information:"123456" is the password for every user"**

**How to evaluate:**
1. Open the live application.
2. Log in using one of the accounts above.
3. Use the Admin account to access administrative functionality.
4. Use the Agent account to manage and respond to assigned tickets.
5. Use the Customer account to create tickets and participate in conversations.

Note: The deployed frontend currently provides a login page, but does not include a separate customer signup page. Customer registration is supported through the backend registration API.

## 🛠 Technology Stack

| Layer | Technologies |
|---|---|
| Frontend | React, Vite, JavaScript |
| Styling | Tailwind CSS, PostCSS, Autoprefixer |
| Backend | Node.js, Express.js |
| API | REST API |
| Database | PostgreSQL |
| ORM | Prisma ORM |
| Authentication | JWT, bcrypt |
| Icons | Lucide React |
| Deployment | Vercel, Render, Supabase |

## 📁 Project Structure

```text
frontdesk-support-system/
│
├── README.md
├── .gitignore
├── package.json
│
├── client/
│   ├── .env.example
│   ├── package.json
│   ├── index.html
│   ├── vite.config.js
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   │
│   └── src/
│       ├── assets/
│       ├── components/
│       ├── context/
│       ├── hooks/
│       ├── pages/
│       ├── services/
│       │   └── api.js
│       ├── utils/
│       ├── App.jsx
│       ├── index.css
│       └── main.jsx
│
└── server/
    ├── .env.example
    ├── package.json
    ├── test-sla.js
    ├── test-api.js
    ├── test-integration-review.js
    ├── test-user-provisioning.js
    │
    ├── scripts/
    │   └── create-admin.js
    │
    ├── prisma/
    │   ├── schema.prisma
    │   ├── migrations/
    │   └── seed.js
    │
    └── src/
        ├── config/
        │   ├── db.js
        │   └── env.js
        ├── controllers/
        │   ├── auth.controller.js
        │   └── ticket.controller.js
        ├── middlewares/
        │   ├── auth.js
        │   ├── validator.js
        │   └── errorHandler.js
        ├── routes/
        │   ├── health.routes.js
        │   ├── auth.routes.js
        │   └── ticket.routes.js
        ├── services/
        ├── utils/
        │   ├── date.js
        │   ├── jwt.js
        │   └── password.js
        ├── app.js
        └── server.js
```

## ⚙️ Local Installation and Setup

### Prerequisites

- Node.js and npm
- PostgreSQL
- Git

### 1. Clone the repository

```bash
git clone https://github.com/parvezkv/frontdesk-support-system.git
cd frontdesk-support-system
```

### 2. Install dependencies

```bash
npm install
cd server
npm install
cd ../client
npm install
cd ..
```

### 3. Configure environment variables

Create `server/.env`:

```env
PORT=5000
NODE_ENV=development
DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@localhost:5432/frontdesk_db?schema=public"
JWT_SECRET="YOUR_LOCAL_DEVELOPMENT_SECRET"
CLIENT_URL="http://localhost:5174"
```

Create `client/.env`:

```env
VITE_API_URL="http://localhost:5000/api"
```

Replace the database credentials and JWT secret with your own local values.

Never commit `.env` files or production credentials.

### 4. Generate Prisma Client and run migrations

```bash
cd server
npx prisma generate
npx prisma migrate deploy
```

### 5. Optional development seed

```bash
npm run db:seed
```

The seed script is intended only for development. It is blocked in production.

### 6. Start the backend

From the `server` directory:

```bash
npm run dev
```

Backend:

`http://localhost:5000`

### 7. Start the frontend

Open another terminal:

```bash
cd client
npm run dev
```

Frontend:

`http://localhost:5174`

## 👥 User Roles and Access Control

Frontdesk supports three roles:

### Administrator (ADMIN)
- Access to the administrative dashboard.
- View and manage support tickets.
- Assign, reassign, and release tickets.
- Manage ticket priorities and statuses.
- Access internal notes and audit history.
- Perform administrative actions.

### Agent (AGENT)
- View and manage support tickets.
- Take ownership of unassigned tickets.
- Respond to customers.
- Add private internal notes.
- Update priority and ticket status.
- Resolve and reopen eligible tickets.

### Customer (CUSTOMER)
- Create support tickets.
- View their own tickets.
- Participate in ticket conversations.
- Reply when additional information is requested.
- View ticket status and updates.

Role permissions are enforced on the backend, not merely hidden in the frontend.

## 🔐 Authentication and Production Provisioning

Authentication uses JWT tokens and bcrypt password hashing.

### Production security

- Public registration defaults to the CUSTOMER role.
- Only authenticated ADMIN users can create AGENT or additional ADMIN accounts through the registration API.
- Non-admin users cannot escalate their own privileges.
- Invalid or unauthorized tokens are rejected.
- Password hashes are never returned in API responses.
- Demo persona switching is disabled in production.
- Development seed data is blocked in production.

### Initial Administrator provisioning

For a fresh production database, an administrator can be created using:

```bash
ADMIN_EMAIL="admin@example.com" \
ADMIN_NAME="System Administrator" \
ADMIN_PASSWORD="YOUR_STRONG_PASSWORD" \
npm run create-admin --prefix server
```

The script:
- Reads credentials from environment variables.
- Hashes passwords using bcrypt.
- Prevents duplicate account creation.
- Does not print plaintext passwords.

For Windows PowerShell, configure the environment variables before running:

```powershell
$env:ADMIN_EMAIL = "admin@example.com"
$env:ADMIN_NAME = "System Administrator"
$env:ADMIN_PASSWORD = "YOUR_STRONG_PASSWORD"

npm run create-admin --prefix server
```

Clear the environment variables after provisioning.

## 📊 Database Design

The application uses PostgreSQL with Prisma ORM.

Core entities include:

| Entity | Purpose |
|---|---|
| User | Authentication and role information |
| Customer | Customer profile information |
| Ticket | Ticket details, status, priority, and SLA deadlines |
| Message | Public customer-agent conversations |
| InternalNote | Private staff-only notes |
| TicketAssignment | Assignment and ownership history |
| TicketEvent | Append-only ticket audit history |
| Holiday | Configured company/festival holidays |
| SLAPause | Records periods when SLA timers are paused |

Important database protections include:
- Unique user email addresses.
- Foreign key relationships.
- Database-level prevention of duplicate active ticket assignments.
- An append-only audit history protected by a PostgreSQL trigger.

## 🕒 SLA Management

The SLA engine calculates deadlines using business hours and working days.

### Working hours

| Setting | Configuration |
|---|---|
| Working days | Monday–Friday |
| Start time | 9:30 AM |
| End time | 6:30 PM |
| Time zone | Asia/Kolkata |
| Weekends | Excluded |
| Configured holidays | Excluded |

### SLA targets

| Priority | First Response | Resolution |
|---|---|---|
| Critical / Urgent | 2 working hours | Same working day |
| High | 3 working hours | 1 working day |
| Medium | 4 working hours | 3 working days |
| Low / Small | 8 working hours | 1 working week |

The High priority target is an additional policy implemented by the application.

### SLA pause and resume

- SLA timers pause when a ticket is waiting for the customer.
- Multiple waiting periods are supported.
- Customer replies resume the SLA timer.
- Deadlines are extended by the applicable paused working time.
- SLA pause and resume actions are recorded in the audit history.
- Overdue calculations respect business hours, weekends, and configured holidays.

All timestamps are stored in UTC and displayed using the Asia/Kolkata time zone.

## 🔄 Ticket Lifecycle

Supported statuses:

| Status | Description |
|---|---|
| OPEN | Newly created ticket |
| IN_PROGRESS | Ticket being handled by an agent |
| WAITING_FOR_CUSTOMER | Waiting for customer information |
| RESOLVED | Issue has been resolved |
| CLOSED | Ticket permanently closed |

### Reopening

- Resolved tickets can be reopened within 7 calendar days.
- Reopening is restricted to ADMIN and AGENT roles.
- After the reopening window expires, a new ticket is required.
- Previous ticket history is preserved.

### Automatic closure

Tickets waiting for customer responses are automatically closed after 5 working days of inactivity, excluding weekends and configured holidays.

The scheduled closure process checks for subsequent customer replies and records a system-generated audit event.

## 🔒 Security and Reliability

### Customer data isolation
Customers can only access tickets associated with their authenticated customer account.

### Internal note confidentiality
Internal notes are stored separately from public messages. Customer-facing APIs and exports exclude internal notes.

### Concurrent ticket assignment
Ticket assignment uses PostgreSQL row locking and a partial unique database index to prevent two agents from claiming the same active ticket.

A conflicting assignment returns HTTP `409 Conflict`.

### Immutable audit history
Ticket actions are recorded with:
- Actor information.
- Event type.
- Previous and new values.
- Server-generated timestamp.
- Relevant metadata.

A PostgreSQL trigger prevents updates and deletions of audit events.

### Ticket resolution
A resolution summary is required before a ticket can be marked as resolved or closed.

## 🖥 Frontend Features

The frontend provides role-based dashboards and ticket management interfaces.

### Dashboard
- Ticket statistics.
- Open and in-progress tickets.
- Waiting-for-customer tickets.
- Overdue tickets.
- Resolved tickets.
- Assigned-to-me statistics.
- Recent activity.

### Ticket listing
- Search and pagination.
- Status filtering.
- Priority filtering.
- Agent filtering.
- Overdue filtering.
- Waiting-for-customer filtering.

### Ticket details
- Customer conversation.
- Private internal notes for staff.
- Chronological audit history.
- SLA countdown and status.
- Assignment and reassignment controls.
- Priority management.
- Status transitions.
- Resolve and reopen actions.

### Additional interface features
- Responsive dashboard layout.
- Reusable status and priority badges.
- Ticket creation modal.
- Assignment and reassignment modal.
- Resolution and reopening forms.
- Ticket history export.

## 📡 REST API Reference

Base URL:

```text
/api
```

### Authentication

| Method | Endpoint | Description |
|---|---|---|
| POST | `/auth/register` | Register a customer or create staff as Admin |
| POST | `/auth/login` | Authenticate and receive JWT |
| GET | `/auth/me` | Retrieve authenticated user profile |

### Tickets

| Method | Endpoint | Description |
|---|---|---|
| GET | `/tickets` | List tickets with filtering and pagination |
| POST | `/tickets` | Create a ticket |
| GET | `/tickets/:id` | Retrieve ticket details |
| GET | `/tickets/:id/sla` | Retrieve SLA information |
| GET | `/tickets/:id/events` | Retrieve audit history |
| GET | `/tickets/:id/export` | Export ticket history |
| POST | `/tickets/:id/messages` | Add a public message |
| POST | `/tickets/:id/internal-notes` | Add a private internal note |
| POST | `/tickets/:id/assign` | Assign an unassigned ticket |
| POST | `/tickets/:id/reassign` | Reassign a ticket |
| POST | `/tickets/:id/release` | Release a ticket |
| PATCH | `/tickets/:id/priority` | Update ticket priority |
| PATCH | `/tickets/:id/status` | Update ticket status |
| POST | `/tickets/:id/reopen` | Reopen an eligible resolved ticket |
| POST | `/tickets/admin/auto-close` | Trigger automatic closure as Admin |

### Health check

```http
GET /api/health
```

Returns the API status and database connectivity information.

## 🧪 Automated Testing

Run the automated test suites from the project root:

```bash
npm test
```

The project includes four specialized test suites:

| Test Suite | Coverage |
|---|---|
| `test-sla.js` | SLA calculations, working-hour boundaries, weekends, holidays, and pause/resume |
| `test-api.js` | API functionality, authorization, ticket assignment, concurrency, and lifecycle |
| `test-integration-review.js` | Multi-user workflows, customer replies, privacy, and lifecycle edge cases |
| `test-user-provisioning.js` | Registration, role-based access control, and administrator provisioning |

The previously reported test run contained **229 passing tests** across these suites. Run the latest test command to verify the current result.

Individual test commands:

```bash
npm run test:sla --prefix server
npm run test:api --prefix server
npm run test:review --prefix server
npm run test:provisioning --prefix server
```

## 🚀 Production Deployment

Frontdesk uses separate hosting services for its frontend, backend, and database.

### Frontend — Vercel
- Connected to the GitHub repository.
- Root directory: `client`.
- Framework: Vite.
- Build command: `npm run build`.
- Output directory: `dist`.
- Environment variable: `VITE_API_URL`.

### Backend — Render
- Connected to the GitHub repository.
- Root directory: `server`.
- Build command:

```bash
npm install && npx prisma generate && npx prisma migrate deploy
```

- Start command:

```bash
npm start
```

- Production environment variables include `DATABASE_URL`, `JWT_SECRET`, `NODE_ENV`, `PORT`, and `CLIENT_URL`.

### Database — Supabase
- PostgreSQL database.
- Prisma-managed schema and migrations.
- Production database credentials are stored in hosting environment variables.

Production credentials and environment files are not committed to GitHub.

## 📌 Important Notes

- The application uses separate production hosting for the frontend and backend.
- Production demo accounts are not created through the development seed script.
- Customers can register through the backend API, although a public signup page is not currently included in the frontend.
- Staff account creation is protected by administrator authorization.
- The production evaluation accounts listed above are provided for testing the deployed application.
- Render's free service may take some time to respond after a period of inactivity.

## 👨‍💻 Developer

**Parvez Najeeb KV**

B.Tech — Information Technology

GitHub: https://github.com/parvezkv

---

**Project:** Frontdesk — Customer Support Ticket Management System

**Organization:** iNav Technologies Pvt. Ltd.
  
**Purpose:** Full Stack Developer Machine Test