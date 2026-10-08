# MeDa Partners Operating System - Backend / Server

Secure, multi-venture backend foundation for the MeDa Partners Operating System.

Built with **Node.js**, **Express.js**, **TypeScript**, **Drizzle ORM**, and **Supabase PostgreSQL**.

---

## 1. Core Architecture

The backend provides a secure identity, team, venture, and section access boundary:

- **Teams**: Represent the *type of work* an employee performs (e.g. Sales, Admin, Operations, NBD, Management).
- **Ventures**: Represent the *companies/brands* belonging to MeDa Partners (e.g. Wayveda, Nature Mania, My Fit Brain).
- **System Sections**: Major functional zones of the OS (e.g. `/sales`, `/operations`, `/admin`, `/nbd`, `/management`).
- **Team Sections (`team_sections`)**: Database-configured mapping of which sections a team can enter.
- **User Ventures (`user_ventures`)**: User-specific access list defining which ventures an individual employee can work with.
- **Sessions (`sessions`)**: Server-side, revocable sessions with cryptographically secure random tokens (stored hashed as SHA-256 in the database, delivered to the browser in an `HttpOnly` cookie). No JWTs.

---

## 2. Database Schema & Tables

All schemas are located in [`src/db/schema/`](file:///d:/meda/MedaOS/server/src/db/schema/).

| Table | Purpose | Key Columns / Constraints |
|---|---|---|
| `teams` | Work functions / departments | `id` (UUID PK), `name`, `slug` (UNIQUE), `is_admin` (BOOLEAN), `status` |
| `users` | Employee accounts | `id` (UUID PK), `name`, `email` (UNIQUE, normalized), `password_hash` (Argon2id), `team_id` (FK -> teams.id, RESTRICT), `status` |
| `ventures` | Brands / companies | `id` (UUID PK), `name`, `slug` (UNIQUE), `status` |
| `system_sections`| Application sections | `id` (UUID PK), `name`, `slug` (UNIQUE), `route`, `status` |
| `team_sections` | Team-to-section permissions | `team_id` (FK -> teams.id, CASCADE), `section_id` (FK -> sections.id, CASCADE), UNIQUE(`team_id`, `section_id`) |
| `user_ventures` | Employee venture access | `user_id` (FK -> users.id, CASCADE), `venture_id` (FK -> ventures.id, CASCADE), UNIQUE(`user_id`, `venture_id`) |
| `sessions` | Server-side active sessions | `id` (UUID PK), `user_id` (FK -> users.id, CASCADE), `token_hash` (UNIQUE, SHA-256), `expires_at`, `last_used_at` |

---

## 3. Database Relationships

```
              +-------------------+
              |      teams        |
              +-------------------+
             /                     \
       (team_id)                (team_id)
           /                         \
          v                           v
  +---------------+           +---------------+
  |     users     |           | team_sections |
  +---------------+           +---------------+
   /             \                    |
(user_id)     (user_id)          (section_id)
  /                 \                 |
 v                   v                v
+----------+   +---------------+  +-----------------+
| sessions |   | user_ventures |  | system_sections |
+----------+   +---------------+  +-----------------+
                      |
                 (venture_id)
                      |
                      v
               +---------------+
               |   ventures    |
               +---------------+
```

---

## 4. Setup & Running

### Step 1: Environment Variables
Create your `.env` file based on `.env.example`:

```bash
cp .env.example .env
```

Set your Supabase PostgreSQL connection string in `.env`:
```env
DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres
PORT=5000
NODE_ENV=development
CORS_ORIGIN=http://localhost:3000
SESSION_COOKIE_NAME=meda_session
SESSION_TTL_HOURS=168
ADMIN_INITIAL_EMAIL=admin@meda.com
ADMIN_INITIAL_PASSWORD=Admin@MeDa2026!
ADMIN_INITIAL_NAME=System Administrator
```

> **Note on Supabase Pooler**: When connecting via Supabase PgBouncer / Transaction Pooler (port 6543), the database client in [`src/db/index.ts`](file:///d:/meda/MedaOS/server/src/db/index.ts) is already configured with `prepare: false` for complete compatibility.

### Step 2: Database Migration
Generate and execute migrations:

```bash
npm run db:generate   # Generates SQL migration files from Drizzle schema definitions
npm run db:migrate    # Runs pending SQL migrations against the PostgreSQL database
```

### Step 3: Seed Initial Data
Populate standard teams, sections, initial ventures, access mappings, and the initial Administrator account:

```bash
npm run db:seed
```

### Step 4: Run the Development Server
```bash
npm run dev
```

The server will listen at `http://localhost:5000`. Health check: `http://localhost:5000/health`.

### Step 5: Run Automated Tests
```bash
npm test
```

---

## 5. Security & Authentication Flow

1. **No Public Registration**: All employee accounts must be provisioned by an Administrator.
2. **Password Hashing**: Argon2id (`argon2`) with 64MB memory, 3 iterations, 4 parallelism.
3. **Session Generation**:
   - `crypto.randomBytes(32)` produces a 64-character hex raw token.
   - SHA-256 hash of the token is stored in the `sessions` table.
   - Raw token is sent to the client via an `HttpOnly`, `SameSite=Lax`, `Secure` (in production) cookie.
4. **Session Verification**:
   - Cookie retrieved on each request.
   - SHA-256 hashed and matched against `sessions` table.
   - Verifies expiration (`expires_at > now()`).
   - Verifies user status (`users.status === 'active'`). Inactive employees are denied (403) and their sessions purged immediately.
   - Verifies team status (`teams.status === 'active'`).
5. **Session Revocation**:
   - `POST /api/v1/auth/logout` deletes the session from the DB and clears the cookie.
   - Admin user deactivation deletes all active sessions for that user.
   - Password resets and changes invalidate other sessions.

---

## 6. Authorization Principles

### Generic Database-Driven Section Authorization
No hardcoding (`if (user.team === 'sales')`). Authorization is generic:
- If user's team has `is_admin: true`, broad access is granted across all sections.
- Otherwise, `requireSection(sectionSlug)` queries the `team_sections` database table for `(req.team.id, sectionSlug)`.

### User-Specific Venture Authorization
- One team can contain members with different venture access (e.g. Rahul -> Wayveda & Nature Mania, Priya -> Wayveda only).
- If user's team has `is_admin: true`, access is granted across all ventures.
- Otherwise, `requireVentureAccess(paramKey)` queries `user_ventures` database table for `(req.user.id, ventureIdentifier)`.

---

## 7. API Reference Overview

### Auth (`/api/v1/auth`)
- `POST /login`: Validates credentials, creates server session, sets `HttpOnly` cookie.
- `POST /logout`: Invalidate session from DB, clears cookie.
- `GET /me`: Returns identity, team, accessible ventures, accessible sections.
- `PATCH /change-password`: Changes password with Argon2id and invalidates other sessions.

### Users Admin Management (`/api/v1/users`) - Admin Only
- `GET /`: List users with team & assigned ventures.
- `GET /:id`: Get user details.
- `POST /`: Create employee (name, email, password, teamId, ventureIds, status).
- `PATCH /:id`: Update name/email.
- `PATCH /:id/status`: Update active/inactive status (revoking sessions if deactivated).
- `PATCH /:id/team`: Change assigned team.
- `PATCH /:id/ventures`: Atomically update assigned ventures.
- `POST /:id/reset-password`: Set new password and invalidate existing sessions.

### Teams (`/api/v1/teams`)
- `GET /`: List all teams.
- `GET /:id`: Get team details with assigned sections.
- `POST /`: Create team (Admin only).
- `PATCH /:id`: Update team (Admin only).
- `PUT /:id/sections`: Configure sections for a team (Admin only).

### Ventures (`/api/v1/ventures`)
- `GET /`: List all ventures.
- `GET /:id`: Get venture details.
- `POST /`: Create venture (Admin only).
- `PATCH /:id`: Update venture (Admin only).
- `GET /:ventureId/test-access`: Access check endpoint using `requireVentureAccess`.

### System Sections (`/api/v1/sections`)
- `GET /`: List all system sections.
- `POST /`: Create section (Admin only).
- `PATCH /:id`: Update section (Admin only).
- `GET /sales/access-check`: Generic check via `requireSection('sales')`.
- `GET /operations/access-check`: Generic check via `requireSection('operations')`.
- `GET /nbd/access-check`: Generic check via `requireSection('nbd')`.
- `GET /management/access-check`: Generic check via `requireSection('management')`.
- `GET /admin/access-check`: Generic check via `requireSection('admin')`.
