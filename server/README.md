# MeDa OS — Server

Express 5 + TypeScript + Drizzle ORM on Supabase Postgres. Session cookies (no JWTs), Argon2id passwords.

## Organisation model

```
MeDa Partners
 └─ Venture                      (catalog, created in /dev)
     └─ Department (head)        (catalog, created in /dev; head appointed by an admin)
         ├─ Teams (head)         (created by the department head)
         └─ Sections             (catalog, created in /dev; each backed by a coded module)
```

- `user_memberships`: one department per person per venture; the team is optional (`team_id` nullable).
- `user_sections`: section access, **per person** (never per team).

## Who can do what

| Action | Admin | Department head (own dept) | Team head (own team) |
|---|---|---|---|
| Create employees | any dept | in their department | – |
| Create / rename / delete teams, appoint team head | ✓ | ✓ | – |
| Change someone's team | ✓ | teams in their dept | – |
| Grant / revoke sections | ✓ | any section of the dept, any member | **only sections they hold**, only their team's members |
| Edit name/email, deactivate, reset password | ✓ | only people entirely inside their dept | – |
| Appoint department heads | ✓ | – | – |
| Open sections | all | all sections of their department | granted ones |

All rules live in [`src/utils/access.ts`](src/utils/access.ts) as small pure functions (tested in
`tests/access.test.ts`). Services call them; responses carry `capabilities` flags so the UI never
re-derives rules.

## API (prefix `/api/v1`)

- `auth`: `POST /login`, `POST /logout`, `GET /me` (ventures with role, department, team, openable sections), `PATCH /change-password`
- `users` (leaders only):
  - `GET /`, `POST /`, `GET|PATCH /:id`, `PATCH /:id/status`, `POST /:id/reset-password`
  - `PUT /:id/membership` `{departmentId, teamId|null}`, `DELETE /:id/membership/:ventureId`
  - `PUT /:id/sections` `{departmentId, sectionIds}`, `POST|DELETE /:id/sections/:sectionId`
- `teams`: `GET /`, `GET /:id` (with members), `POST /`, `PATCH /:id`, `PATCH /:id/head`, `DELETE /:id` (members keep their department)
- `departments`: `GET /`, `GET /:id`, `PATCH /:id/head` (admin)
- `sections`: `GET /`, `GET /:slug/access-check?ventureId=<id|slug>`
- `dev` (separate developer login): catalog CRUD for ventures, departments, sections, plus `GET /overview`

## Building a section

1. Create it in `/dev` (venture → department → section). Section slugs are unique per venture, because the URL is `/{venture}/{section}`.
2. Client: register a module in `client/sections/registry.ts`.
3. Server: add `src/modules/<name>/` and guard its routes with `requireSection('<slug>')` from `src/middleware/require-section.ts`.

## Database

- Fresh database: `npm run db:reset` (destructive; needs `CONFIRM_DB_RESET=true`; blocked in production), then `npm run db:seed`.
- Existing database: `npm run db:upgrade`. It runs idempotent steps from `src/db/upgrade.ts` and also runs on every server start.
  When you change the DDL in `reset-and-migrate.ts`, add the matching step to `upgrade.ts`.

## Scripts

```bash
npm run dev        # tsx watch
npm test           # unit tests (no database)
npm run test:e2e   # end-to-end access checks against a running API + real DB (creates and removes zz-e2e-* data)
```
