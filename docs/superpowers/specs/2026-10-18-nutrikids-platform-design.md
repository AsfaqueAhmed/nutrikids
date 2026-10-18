# NutriKids Platform — Master Design (All Phases)

Date: 2026-10-18
Source: `NutriKids_BRD.docx` v1.0 (draft, 2026-03-31) plus decisions made in design discussion.
Status: Draft for review.

## 1. Purpose and scope

NutriKids is a mobile-first nutrition and child-health platform for children aged 0–12. This spec covers the whole product across four phases, then divides the work so it can be built in parallel by three agents (Claude, Codex, Antigravity) without conflicts.

Additions to the BRD agreed in discussion:
- **Vaccination** tracking (new, Phase 1).
- **Nearby hospitals** (new, Phase 1).
- **Per-meal-slot reminders** (extends BRD 5.10).
- **Out of scope for now:** "available support" (help centre / support contacts). Revisit later.

## 2. Decisions made

| Topic | Decision |
|---|---|
| Backend | NestJS (TypeScript), REST under `/v1` |
| Database / ORM | PostgreSQL, Prisma |
| Mobile | Flutter, GetX, Dio |
| Web panels | Next.js + Tailwind (admin, nutritionist) |
| Auth | JWT short-lived access + rotating refresh tokens with reuse detection |
| Allergy rule | Severe: hard block, no override. Mild/moderate: warning + explicit confirmation |
| Allergen model | Foods carry allergen tags; a child's allergy is tag + severity |
| Meal plans | Auto-generated server-side, then editable by the parent |
| Offline sync | Last-write-wins, client UUIDs, idempotent writes, notice when overwritten |
| First region | Bangladesh (vaccine schedule, hospital data) |
| Hospital data | Own table, filled by CSV import from researched open sources |
| Reminders | Includes a reminder time per meal slot, per child |

## 3. Architecture

Monorepo:

```
apps/api          NestJS backend
apps/mobile       Flutter parent app
apps/admin-web    Next.js admin panel          (Phase 2)
apps/pro-web      Next.js nutritionist panel   (Phase 2)
packages/contracts  Prisma schema + OpenAPI spec (shared contract, see section 8)
data/seed         CSV/JSON seed data (foods, vaccines, hospitals)
docs/             specs and plans
```

Backend modules (each exposes a service interface; other modules depend on interfaces, not internals):

| Module | Phase | Responsibility | Depends on |
|---|---|---|---|
| Auth | 1 | Email/password, Google/Apple, verification, reset, tokens | User |
| User | 1 | Parent account, preferences | — |
| Child | 1 | Child CRUD, diet, activity, allergies, feeding logs, food-introduction tracker | User, Food |
| Food | 1 | Foods, allergen tags, nutrition data, search | — |
| Meal | 1 | Recipes, plans, generation, allergy check, grocery list | Child, Food |
| Growth | 1 | Records, WHO percentiles, chart data, PDF export | Child |
| Nutrition | 1 | Daily nutrient totals and score | Meal, Child |
| Vaccination | 1 | Vaccine catalogue, schedule, per-child tracking | Child, Notification |
| Hospital | 1 | Nearby search, admin CSV import | — |
| Notification | 1 | Device tokens, preferences, scheduling, FCM | User |
| Doctor | 2 | Professional profiles, verification | User |
| Consultation | 2 | Booking, chat, video (Agora), payments | Doctor, Child |
| Content | 2 | Articles, tips, static pages | Doctor |
| Subscription | 2 | Plans, billing, feature gating | User |
| Admin | 2 | Dashboards, reports, user and food admin | all |
| AI | 3 | Recommendations, gap detection, corrections | Meal, Nutrition |
| Store / Shipping | 4 | Products, orders, sellers, boxes, logistics | Child, AI |

## 4. Cross-cutting rules

### 4.1 Allergy check
One function in the Meal module. Every path that adds a meal (manual add, swap, auto-generation, later nutritionist plans and store products) must call it.
- Severe match: reject with `409 ALLERGEN_BLOCKED`. No override.
- Mild or moderate match: `409 ALLERGEN_CONFIRM_REQUIRED`; the client retries with `confirmAllergen: true`.
- Matching is by allergen tag, so derived ingredients match automatically.

### 4.2 Sync
- Every client-created record carries a client-generated UUID and `updatedAt`.
- Writes are idempotent by UUID. Last write wins; the response includes `overwritten: true` when a newer server value was replaced.
- Reads support `?updatedSince=` for pulling changes after offline use.

### 4.3 Errors and security
- One error shape: `{ code, message, details }`.
- DTO validation (400); access to another user's child returns 404.
- HTTPS only, hashed passwords, refresh-token rotation, rate limiting, ownership check on every child-scoped route, child health fields encrypted at rest.
- Child-scoped data is never readable by a professional without an explicit parent grant (Phase 2).

## 5. Data model

Conventions: `id` UUID, `createdAt`, `updatedAt` on every table. Age is never stored; it is derived from `dateOfBirth`. Nutrition data is JSONB.

### 5.1 Phase 1

- **User**(email, passwordHash, role, emailVerifiedAt)
- **Child**(userId, name, dateOfBirth, gender, heightCm, weightKg, activityLevel, dietType, photoUrl)
- **ChildAllergy**(childId, allergenTag, severity: mild|moderate|severe)
- **ChildCondition**(childId, name) — stored, but meal rules for conditions are not defined in Phase 1
- **FoodDislike**(childId, foodId)
- **Food**(name, category, allergenTags[], nutrition JSONB, ageMinMonths, ageMaxMonths)
- **Recipe**(name, instructions, prepMinutes, ageMinMonths, ageMaxMonths) and **RecipeFood**(recipeId, foodId, quantity, unit)
- **MealPlan**(childId, startDate, endDate, type) and **MealPlanEntry**(planId, date, slot, recipeId, createdBy, portion)
- **GroceryItem**(planId, foodId, quantity, unit, checked)
- **GrowthRecord**(childId, date, heightCm, weightKg, headCircumferenceCm, percentiles JSONB)
- **FeedingLog**(childId, type: breast|formula|solid, at, durationMinutes, notes)
- **FoodIntroduction**(childId, foodId, introducedOn, reaction, notes)
- **Vaccine**(code, name, disease, description, availability: GOVERNMENT_FREE|PRIVATE_PAID|BOTH, isMandatory, priceMinBdt?, priceMaxBdt?, priceNote?, priceUpdatedAt?, sourceNote)
- **VaccineScheduleItem**(vaccineId, doseNumber, suggestedAgeDays, minAgeDays, maxAgeDays, intervalFromPreviousDays?, notes)
- **ChildVaccination**(childId, scheduleItemId, dueDate, givenDate?, facilityName?, paidType?, amountPaidBdt?, batchNo?, notes?, cardPhotoUrl?)
  - Status (upcoming, due, overdue, given, given late) is computed from dates and not stored.
  - Due dates are generated when a child is created or `dateOfBirth` changes.
- **Hospital**(name, type, address, district, lat, lng, phone?, services[], source, verifiedAt?)
  - Nearby search: PostGIS if available, otherwise bounding box plus Haversine.
- **NotificationPreference**(userId, type, enabled, time?) and **MealReminder**(childId, slot, timeOfDay, enabled)
- **DeviceToken**(userId, platform, token)

### 5.2 Phase 2
Doctor, Consultation, NutritionLog (`eatenStatus: full|partial|skipped`, optional `percent`), Article, Subscription, Grant (parent-to-professional access per child), Review.

### 5.3 Phase 3
AIRecommendation, NutritionistCorrection, NutritionGapAlert.

### 5.4 Phase 4
Product, Seller, ProductReview, Cart and CartItem, Order and OrderItem, SubscriptionBox and SubscriptionBoxOrder, ProductRecommendation.

Corrections to the BRD model: a separate CartItem table, a Grant table for professional access, and NutritionLog status instead of a bare percentage.

## 6. API surface (Phase 1)

`/v1`, JSON, JWT on everything except auth.

| Area | Endpoints |
|---|---|
| Auth | register, login, refresh, logout, verify email, reset password, Google/Apple |
| Children | CRUD, allergies, conditions, dislikes, feeding logs, food introductions |
| Foods | search/filter, categories |
| Meals | generate plan, get plans by range, add/swap entry, grocery list |
| Growth | records CRUD, percentile/chart data, PDF export |
| Nutrition | daily score and nutrient breakdown |
| Vaccination | catalogue, a child's schedule with status, mark given/undo, edit details |
| Hospitals | `GET /hospitals/nearby?lat&lng&radiusKm&service`; admin CSV import |
| Notifications | device token, preferences, meal reminders |

Phase 1 is fully free. Subscription gating arrives in Phase 2; existing Phase 1 features are not removed from users who had them.

## 7. Phases and breakdown

| Phase | Ships | Depends on |
|---|---|---|
| 0. Foundation | Monorepo, API skeleton, Prisma schema (Phase 1), OpenAPI contract, CI, seed pipeline | — |
| 1a. Backend core | Auth, User, Child, Food, Meal (allergy check, generation, grocery), Growth, Nutrition | 0 |
| 1b. Health extras | Vaccination, Hospital, Notification (incl. meal reminders) | 0, 1a for Child |
| 1c. Mobile app | Onboarding, child profiles, meals, growth, score, vaccination, hospitals, notifications, offline | contract from 0; live API from 1a/1b |
| 1d. Seed data | 200–300 meals, allergen tags, Bangladesh vaccine schedule, hospital list | 0 (schema) |
| 2. Engagement | Doctor, Consultation, Content, Subscription, Admin; admin and pro web; school lunch; nutrition logging | 1 |
| 3. AI | Rule-based recommendations, gap detection, correction loop, growth prediction | 2 (logging data) |
| 4. Store | Products, orders, sellers, boxes, shipping | 3 (for recommendations) |

Each phase gets its own implementation plan written from this spec. Nothing from Phase N+1 is built in Phase N.

## 8. Division of work between agents

Principle: contract first, then parallel work inside separate directories, with one owner per directory.

### 8.1 The shared contract (Phase 0, owned by Claude)
`packages/contracts` holds the Prisma schema and the OpenAPI spec. It is written and merged first. Other agents read it and never edit it; a change request goes to Claude.

### 8.2 Ownership

| Agent | Owns | Why |
|---|---|---|
| Claude | `packages/contracts`, `apps/api` modules Auth, Child, Meal (allergy check, generation), Growth, Nutrition; integration and review of all merges | Safety-critical and cross-module logic; owns the contract |
| Codex | `apps/api` modules Food, Vaccination, Hospital, Notification; unit and integration tests; the CSV/seed import scripts | Bounded modules with clear inputs and outputs, easy to verify |
| Antigravity | `apps/mobile` (Flutter); later `apps/admin-web` and `apps/pro-web`; browser-based UI checks | UI-heavy work and visual testing |
| Whoever is free | `data/seed` research: hospitals (open sources only), vaccine schedule (official sources), foods | Data files only, reviewed before import |

### 8.3 Rules to avoid conflicts
1. One agent per directory. No two agents edit the same file.
2. Each agent works on its own branch (or worktree) and merges through a pull request.
3. Claude reviews every pull request against this spec before merge.
4. Cross-module calls go through service interfaces defined in the contract; a module owner never reaches into another module's tables.
5. The mobile app builds against the OpenAPI mock until the real endpoint exists, so it is not blocked on the backend.
6. Seed data is reviewed by a human (medical advisor for vaccines and nutrition) before it is treated as correct.
7. Commit messages state the module and task id from the plan.

### 8.4 Order of work
1. Phase 0 (Claude): contract, skeleton, CI. Everyone waits for this to merge.
2. In parallel: Claude on 1a, Codex on Food then Vaccination, Hospital, Notification, Antigravity on the mobile app skeleton against the mock, and seed research.
3. Integration pass (Claude): connect the app to the live API, run the end-to-end flow.
4. Repeat the pattern for Phases 2, 3 and 4.

## 9. Testing

- Unit: allergy check (every severity, derived tags), WHO percentiles, nutrition score, vaccine due-date generation, reminder scheduling.
- Integration (real PostgreSQL): sync and idempotency, ownership checks, nearby-hospital queries, plan generation.
- End-to-end: register, add child, add allergy, generate plan, confirm no severe-allergen meal, mark a vaccine as given.
- Contract: the API is validated against the OpenAPI spec; the mobile app's generated client must compile against it.

## 10. Open items

These need a decision or outside input before or during the relevant phase. They are not placeholders in the design.

1. **Nutrition score formula and thresholds** — needs the medical advisor. Until then the score is labelled provisional.
2. **Vaccine schedule, free/paid status and price ranges** — must be checked against current official sources and approved by a medical advisor; prices carry a last-checked date.
3. **WHO data coverage** — WHO standards cover 0–5 years; ages 5–12 use the WHO growth reference. Head circumference is defined only up to about 5 years.
4. **Medical conditions** — stored in Phase 1; meal rules for them are not defined.
5. **Parental consent flow** (COPPA/GDPR-K) — design with legal input before launch.
6. **Payments** — Stripe availability and Apple/Google in-app purchase rules for the premium tier; decide before Phase 2.
7. **Hospital data licensing** — only sources whose terms allow reuse (for example OpenStreetMap); record the source per row.
8. **"Available support" feature** — deferred.
