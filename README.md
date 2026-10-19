# NutriKids

Child nutrition platform for Bangladesh: meal plans with allergy safety, growth tracking (WHO percentiles), vaccination schedule, nearby hospitals, and reminders. This repo holds the REST API (`apps/api`), shared reference data (`data/`) and the generated OpenAPI contract (`packages/contracts/openapi.json`).

## Quick start

```bash
pnpm install
pnpm db:up                                        # Postgres 16 on port 5433 (needs Docker)
cp apps/api/.env.example apps/api/.env
pnpm --filter api exec prisma migrate dev
pnpm --filter api exec prisma db seed             # foods, recipes, vaccines
pnpm --filter api start:dev                       # http://localhost:3000/v1
```

## Tests

```bash
pnpm test                                         # unit tests
pnpm test:e2e                                     # integration tests (real DB, run in band)
```

Create `apps/api/.env.test` locally (never commit it); see `apps/api/README.md`.

## OpenAPI contract

```bash
pnpm --filter api export:openapi                  # rewrites packages/contracts/openapi.json
```

Regenerate and commit it whenever an endpoint changes; the web app builds against this file.

## Hospitals

`data/seed/hospitals.bd.csv` comes from OpenStreetMap contributors (ODbL). Import it as an admin with `POST /v1/admin/hospitals/import` (`Content-Type: text/csv`). Most rows have no district tag in OSM, so the district is often a placeholder.

## Provisional data

Medical and nutrition reference data is **provisional** until a medical advisor approves it: WHO LMS tables (`data/who`), RDA targets, portion sizes, the vaccine schedule (`data/seed/vaccines.bd.json`), foods and recipes. Each data file carries `verified: false` and a `source`, and endpoints that drive a health indicator return `provisional: true`.

## Docs

- Design spec: [docs/superpowers/specs/2026-10-18-nutrikids-platform-design.md](docs/superpowers/specs/2026-10-18-nutrikids-platform-design.md)
- Backend plan: [docs/superpowers/plans/2026-10-18-backend-phase0-1.md](docs/superpowers/plans/2026-10-18-backend-phase0-1.md)
- Web app plan: [docs/superpowers/plans/2026-10-18-web-app-phase1.md](docs/superpowers/plans/2026-10-18-web-app-phase1.md)
- WHO data sources: [data/who/README.md](data/who/README.md)

## Phase 2 endpoints

- **Nutrition logs:** `PUT|GET|DELETE /v1/children/:childId/nutrition-logs[/:logId]`, `GET .../nutrition-logs/summary` (what was actually eaten; the nutrition score stays plan-based).
- **Articles:** `GET /v1/articles`, `GET /v1/articles/:slug` (published only); admin CRUD under `/v1/admin/articles`.
- **Admin:** `GET /v1/admin/stats`, `GET /v1/admin/users`, `PATCH /v1/admin/users/:id` (disable/enable, role), `GET /v1/admin/vaccines`, `PATCH /v1/admin/vaccines/:id`, `PATCH /v1/admin/vaccine-schedule-items/:id`.

Create the first admin by registering normally, then:

```bash
echo "UPDATE \"User\" SET role='ADMIN' WHERE email='you@example.com';" | pnpm --filter api exec prisma db execute --stdin
```

A disabled user cannot log in or refresh; an access token already issued stays valid until it expires (default 15 minutes).
