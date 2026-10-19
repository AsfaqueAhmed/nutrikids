# NutriKids Phase 2 (Engagement, reduced scope) — Design

Date: 2026-10-19
Parent spec: `2026-10-18-nutrikids-platform-design.md` (sections 3, 4, 8 still apply).
Status: Draft for review.

## 1. Scope

In: **2A Nutrition logging**, **2B Content**, **2C Admin** (backend + `apps/admin-web`).

Out for now: Doctor, Consultation (booking, chat, video), Grants, Reviews, `apps/pro-web`, Subscription and payments, school lunch. The `NUTRITIONIST` role stays in the `Role` enum, unused. All Phase 2 features are free.

## 2. Ownership and order

| Owner | Owns |
|---|---|
| Claude | `packages/contracts`, all of `apps/api`, `data/seed`, tests, PR review |
| Antigravity | `apps/web` additions (2A, 2B UI) and the new `apps/admin-web` (2C) |

Order:
1. Claude merges one contract PR: Prisma schema changes and the regenerated `packages/contracts/openapi.json` for 2A, 2B, 2C. Antigravity does not edit the contract; change requests go in `docs/contract-requests.md`.
2. In parallel: Claude implements the API; Antigravity builds against the OpenAPI mock (`apps/web`) and scaffolds `apps/admin-web`.
3. Integration pass (Claude): connect both apps to the live API and run end-to-end flows.

Prerequisite for Antigravity: the 2A UI hangs off the Today screen (Phase 1 web plan Task 5). Phase 1 web tasks 4 onward must land first or run alongside.

## 3. 2A. Nutrition logging

**Table `NutritionLog`**: `id` (client UUID), `childId`, `date`, `slot` (MealSlot), `eatenStatus` (`FULL | PARTIAL | SKIPPED`), `percent` (1–99, only when PARTIAL), `notes?`, `clientUpdatedAt`, `createdAt`, `updatedAt`. Unique on (`childId`, `date`, `slot`).

**Endpoints** (ownership check on every route; another user's child returns 404):
- `PUT /v1/children/:childId/nutrition-logs/:logId` — idempotent upsert; last-write-wins by `clientUpdatedAt`; a stale write returns the stored value with `sync.superseded: true`.
- `GET /v1/children/:childId/nutrition-logs?from&to&updatedSince`
- `DELETE /v1/children/:childId/nutrition-logs/:logId`
- `GET /v1/children/:childId/nutrition-logs/summary?from&to` — per-slot and overall adherence (counts of full/partial/skipped, percent eaten vs planned).

**Score:** unchanged and still computed from the meal plan. Logs feed history and adherence only (and Phase 3 later).

**Web (`apps/web`):** quick-log buttons on each meal card in the Today screen; adherence view on the nutrition page; writes go through the existing offline outbox.

## 4. 2B. Content

**Table `Article`**: `id`, `kind` (`ARTICLE | TIP | PAGE`), `slug` (unique), `title`, `summary`, `body` (markdown), `category`, `ageMinMonths?`, `ageMaxMonths?`, `coverUrl?`, `status` (`DRAFT | PUBLISHED`), `publishedAt?`, `authorId`.

**Endpoints:**
- `GET /v1/articles?kind&category&ageMonths&q` — PUBLISHED only, paginated.
- `GET /v1/articles/:slug` — PUBLISHED only.
- `GET|POST /v1/admin/articles`, `GET|PATCH|DELETE /v1/admin/articles/:id` — ADMIN only; includes drafts.

**Web:** parent reader for articles and tips; age-relevant suggestions on the Today screen; static pages (terms, privacy) use `kind: PAGE`. The client renders markdown with sanitisation (no raw HTML). Cover images are URLs only; there is no upload service.

## 5. 2C. Admin

**Backend:**
- `User.disabledAt?` — a disabled user cannot log in or refresh tokens.
- `GET /v1/admin/stats` — totals (users, children), signups per day, meal entries generated, vaccinations given.
- `GET /v1/admin/users?q&role&disabled` — paginated.
- `PATCH /v1/admin/users/:id` — disable/enable, change role. An admin cannot disable or demote themselves.
- Existing ADMIN endpoints (foods, recipes, hospital import) are reused. Vaccine catalogue edit is added if it does not exist, so the medical advisor can correct the schedule.

**`apps/admin-web`:** separate Next.js + Tailwind app (not a route group in `apps/web`), same stack and API client approach as `apps/web`. ADMIN role only; non-admins are signed out with a clear message. Screens: dashboard, users, foods, recipes, vaccines (if the endpoint exists), articles, hospital CSV import.

## 6. Cross-cutting rules (unchanged)

One error shape `{ code, message, details }`; DTO validation returns 400; ownership checks on child-scoped routes; rate limiting; child-scoped data is never exposed to admins beyond aggregate stats (no per-child health data in the admin UI).

## 7. Testing

- Unit: log validation (`percent` only with PARTIAL), LWW and superseded logic, article visibility by status, disable-self guard.
- Integration (real PostgreSQL): idempotent log upsert, ownership 404, summary maths, published-only article reads, disabled-user login block, admin-only access (a PARENT gets 403).
- Contract: regenerate the OpenAPI file on every endpoint change; both web apps' generated clients must compile against it.

## 8. Plans

- Backend (Claude): `docs/superpowers/plans/2026-10-19-phase2-backend.md`
- Frontend (Antigravity): `docs/superpowers/plans/2026-10-19-phase2-frontend.md`

## 9. Open items

1. Content authorship: with no doctors, articles are admin-written. Medical content should be reviewed by the medical advisor before publishing.
2. Deployment domain for `apps/admin-web` (the API currently allows any CORS origin; tighten before launch).
3. Parental consent flow (parent spec item 5) is still open.
