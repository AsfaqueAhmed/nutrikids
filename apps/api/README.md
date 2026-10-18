# NutriKids API

NestJS 11 backend for the NutriKids platform (Prisma + PostgreSQL).

## Run

```bash
pnpm install
pnpm db:up                 # Postgres on port 5433 (from repo root)
cp apps/api/.env.example apps/api/.env
pnpm api start:dev
```

## Tests

```bash
pnpm test        # unit
pnpm test:e2e    # e2e (needs db up)
```

Create `apps/api/.env.test` locally (never commit it):

```
DATABASE_URL=postgresql://nutrikids:nutrikids@localhost:5433/nutrikids_test
JWT_ACCESS_SECRET=test-secret-test-secret-test-secret-123
```
