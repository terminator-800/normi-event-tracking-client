# Normi Event Tracking Client

Web application for **Northern Mindanao Colleges, Inc. (NMCI)** — **Event Attendance Monitoring**.

This is the frontend for the NMCI / Central Student Government (CSG) event tracking system. It lets students check in to campus events and gives staff a desk interface to manage events, monitor attendance, handle fines and payments, and maintain student records.

Works together with **[normi-event-tracking-api](../normi-event-tracking-api)** (Node.js + Express + MySQL).

---

## What this project is for

NMCI runs school-wide and college-level events that require reliable attendance records. This client supports:

1. **Public student attendance** — Students tap or scan their **Student ID / RFID** at the event kiosk to record time-in and time-out.
2. **CSG / staff operations** — Logged-in users manage the full event lifecycle: create events, track who attended, review student participation, collect fines, and export reports.

The goal is a single, organized system for **event attendance monitoring** instead of manual sheets or disconnected tools.

---

## Main features

### Public (no login)

- **Home** — View the current or ongoing event and upcoming events
- **RFID / Student ID check-in** — Submit attendance for whole-day, AM-only, or PM-only sessions
- **Event password** — Protected events can require a password before students can tap in

### Desk (after login)

| Module | Description |
|--------|-------------|
| **Events** | Browse event attendance records and session details |
| **Students** | Student roster, filters by college/year level, participation and attendance history |
| **Payments** | Record student fine payments, print CSG-branded receipts, export summaries |
| **Manage Event** | Create, edit, and delete events; set audience (department/program), fines, and schedules |
| **Import** *(Admin)* | Bulk import students from CSV |
| **Users** *(Admin)* | Create and manage system users (governors, CSG president, admin) |

### Role-based access

- **Admin** — Full access including Import and Users
- **CSG President** — Create and manage institution-wide events
- **Department governors** — Scoped to their college (IT, CBA, CEAS, CCJE, CHM)

---

## Tech stack

- **React 19** + **Vite**
- **React Router** — routing
- **TanStack Query** — server state / API caching
- **Axios** — HTTP client (cookie-based auth)
- **Tailwind CSS** — styling
- **Chart.js** — student participation charts
- **jsPDF** — PDF exports

---

## Prerequisites

- **Node.js** 18+ (recommended: latest LTS)
- **normi-event-tracking-api** running locally or deployed
- MySQL database configured on the API side

---

## Getting started

### 1. Install dependencies

```bash
npm install
```

### 2. Environment variables

Create a `.env` file in the project root (optional if using defaults):

```env
VITE_API_BASE_URL=http://localhost:5000/
```

Point `VITE_API_BASE_URL` to your API server URL in production.

### 3. Run the development server

```bash
npm run dev
```

Open the URL shown in the terminal (typically `http://localhost:5173`).

### 4. Production build

```bash
npm run build
npm run preview
```

---

## Project structure (overview)

```
src/
├── api/              # Axios instance & API base URL
├── components/       # Pages and UI (Home, Attendance, Payments, Events, etc.)
├── hooks/            # React Query hooks for API calls
├── utils/            # Helpers (roles, CSV import, department filters, exports)
└── App.jsx           # Routes and auth shell
```

---

## Related repository

| Repo | Role |
|------|------|
| **normi-event-tracking-client** (this repo) | React frontend |
| **normi-event-tracking-api** | REST API, database models, business logic |

Start the API first, then run this client.

---

## Institution

**Northern Mindanao Colleges, Inc.**  
Event Attendance Monitoring System  
Central Student Government (CSG)

---

## License

Private / institutional use for Northern Mindanao Colleges, Inc.
