# MedaOS — MeDa Partners Operating System

## What we are building

MeDa Partners Pvt Ltd is a parent company that runs several ventures: WayVeda (Ayurvedic e-commerce), Digital Chaabi (performance marketing agency), Nature Mania (organic wellness brand), My Fit Brain (tele-consultation / mental health), plus units like DCA and DC Brands.

Today each venture runs its sales, CRM, orders, operations and team work in separate tools. **MedaOS is the one internal system for all of them**: one login, one org structure, and every venture's CRM and internal-ops tools built inside it. An employee signs in, picks the venture they work in, and sees only the tools (sections) they have been given.

**Current stage: the foundation layer is done** (identity, org hierarchy, per-user access control, venture switching). Business features (leads CRM, orders, sales pipeline, NBD, operations, campaigns, etc.) are **not built yet**. Each one will be built as a *section module* (see below). New feature work goes inside a section and must respect the venture-scoped access model.

## Tech stack

| Part | Stack | Hosting |
|---|---|---|
| `client/` | Next.js 16 (App Router) + React 19 + Tailwind CSS 4 + lucide-react. React Compiler lint rules on. | Vercel |
| `server/` | Express 5 + TypeScript, Drizzle ORM + postgres.js, Zod validation, Argon2id passwords, HttpOnly session cookies (no JWT), helmet, express-rate-limit | Render |
| Database | Postgres on Supabase | Supabase |
| Tests | Vitest + supertest (`server/tests`, DB mocked); `server/scripts/e2e-access.ts` against the real DB | — |

Next 16 has breaking changes. Read `client/AGENTS.md` and check `client/node_modules/next/dist/docs/` before using any Next API you're unsure of.

## Org model

```
MeDa Partners
 └─ Venture                      (catalog record, created in /dev)
     └─ Department (head)        (catalog record, created in /dev; head appointed by an admin)
         ├─ Teams (head)         (created by the department head)
         └─ Sections             (catalog record, created in /dev; each is a coded module)
```

- `user_memberships`: one department per person per venture; team is optional.
- `user_sections`: section access is **per person, never per team**.
- Roles per venture: `admin` (global `users.is_admin`), `department_head`, `team_head`, `member`.
- `/dev` has a **separate developer login** (`DEV_ADMIN_*` env vars) and is the only place ventures, departments and sections are created.

## Access rules

All rules are small pure functions in `server/src/utils/access.ts` (tested in `server/tests/access.test.ts`). The full table is in `server/README.md`. In short:

- **Admin**: everything, including appointing department heads.
- **Department head** (own dept): creates employees, creates/edits/deletes teams, assigns teams, appoints team heads, grants/revokes any dept section to any dept member, edits accounts only of people entirely inside their dept. Opens all sections of their dept.
- **Team head** (own team): grants/revokes sections only for their team's members, and **only sections they hold themselves**. Cannot change teams or create employees.
- **Member**: opens only sections granted to them.

API responses carry `capabilities` flags (`canChangeTeam`, `canManageSections`, `grantableSectionIds`, `canRemove`, `canEditAccount`). **The client reads these flags and never re-derives permission rules.** A new rule goes in `access.ts`, not the UI.

## Routes

### Client pages (`client/app/`)

| Route | Purpose |
|---|---|
| `/login` | Employee login |
| `/` | Redirects to the active venture |
| `/[ventureSlug]` | Venture home |
| `/[ventureSlug]/[sectionSlug]` | Opens a section: server checks access, then `client/sections/registry.ts` picks the component |
| `/employees` | Employees table + slide-over drawer (placement, section checkboxes, account) |
| `/access` | Section access matrix |
| `/teams` | Teams + team drawer |
| `/departments` | Departments |
| `/dev` | Developer catalog console (ventures / departments / sections) |

The active venture comes from the URL on `/[ventureSlug]` pages (`client/lib/use-venture.ts`) and is remembered in localStorage by `client/context/auth-context.tsx`. All API calls go through `client/lib/api.ts` (`NEXT_PUBLIC_API_URL`, default `http://localhost:5000/api/v1`, `credentials: 'include'`).

### API (`server/src/app.ts`, prefix `/api/v1`)

`auth`, `users` (also mounted as `employees`), `departments`, `teams`, `ventures`, `sections`, `dev`. Endpoint list is in `server/README.md`. Responses are `{ success: true, data }` / `{ success: false, error: { message, details? } }` via `server/src/utils/response.ts`. Throw the typed errors from `server/src/utils/errors.ts`; the central error handler formats them.

### Server module pattern

Each feature is `server/src/modules/<name>/` with `<name>.routes.ts`, `.controller.ts`, `.service.ts`, `.validation.ts` (Zod), `.types.ts`. Routes use `authenticate`; business logic and access checks live in the service.

## Building a new section (e.g. a Leads CRM)

1. Create the section in `/dev` (venture → department → section). The slug becomes the URL `/{venture}/{section}` and must be unique within the venture.
2. **Client:** add `client/sections/<name>/index.tsx` taking `SectionModuleProps` (`venture`, `section`) and register it in `client/sections/registry.ts`. The key is `'<section-slug>'` (all ventures) or `'<venture-slug>/<section-slug>'` (one venture only, wins over the generic key). Sections with no module show "not built yet".
3. **Server:** add `server/src/modules/<name>/` and guard every route with `authenticate` + `requireSection('<slug>')` (`server/src/middleware/require-section.ts`). It resolves the venture from `:ventureId`, `?ventureId=` or the `X-Venture-Id` header and sets `req.ventureId`. Use `requireVentureAccess` for venture-level (not section-level) data.
4. **Data:** every business table carries a `venture_id`, and every query filters by `req.ventureId`. Ventures never see each other's data.

## Database / schema changes

- **No Drizzle migrations.** A fresh DB is built by `server/src/db/reset-and-migrate.ts` (`npm run db:reset`, destructive, needs `CONFIRM_DB_RESET=true`, blocked in production) and then `npm run db:seed`.
- An existing DB is updated by idempotent steps in `server/src/db/upgrade.ts` (`npm run db:upgrade`, which also runs at every server boot).
- **Any DDL change must go in BOTH `reset-and-migrate.ts` and `upgrade.ts`**, plus the Drizzle schema file in `server/src/db/schema/`.
- `server/.env` points at a shared Supabase dev/test database. Don't reset it without asking.

## Running and checking

```bash
# server/
npm run dev        # tsx watch, API on :5000
npm test           # unit tests, no DB
npm run test:e2e   # access checks against running API + real DB (creates/removes zz-e2e-* data)

# client/
npm run dev        # next dev on :3000
npm run lint
```

- The developer usually already has `next dev` (:3000) and the API (:5000) running. Don't start a second `next dev`, and don't run `next build` while dev is running (it breaks Turbopack HMR until dev restarts).
- The login rate limit is 10 per 15 min per IP, held in memory. Restarting the server resets it.

## Conventions

- **Client (React Compiler lint):** no `setState` inside effects, no ref writes during render, no manual memo the compiler can't keep. Use derived state, `key` remounts, and `useAsync` from `client/lib/use-async.ts`. Reuse the UI kit in `client/components/ui/`.
- **UI changes:** keep the current (first-version) UI. Several redesigns were rejected. For any UI change, propose one small concrete change and get a yes before building. Don't restructure pages or navigation unprompted.
- Keep permission logic on the server, scope all data by venture, and validate input with Zod.
