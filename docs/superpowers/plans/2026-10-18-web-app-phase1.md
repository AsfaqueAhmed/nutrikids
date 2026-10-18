# NutriKids Parent Web App (Phase 1) Implementation Plan

> **For agentic workers (Antigravity):** REQUIRED SUB-SKILL: use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. You own only `apps/web`. Never edit `apps/api` or `packages/contracts`; if the contract is wrong or missing something, write the request in `docs/contract-requests.md` and carry on with the mock.

**Goal:** Build the responsive, installable (PWA) parent web app for NutriKids: accounts, child profiles, meal planning with allergy safety, grocery list, growth tracking, nutrition score, baby feeding guidance, vaccination, nearby hospitals, reminders, and offline use.

**Architecture:** Next.js App Router app that talks to the NestJS API through a typed client generated from `packages/contracts/openapi.json`. Server state lives in TanStack Query. Every write that the contract marks as syncable goes through one outbox (IndexedDB) so it works offline and replays safely. A service worker caches the app shell and read-only data.

**Tech Stack:** Next.js 15 (App Router, TypeScript strict), Tailwind CSS, TanStack Query v5, `openapi-typescript` + `openapi-fetch`, react-hook-form + zod, Recharts, `idb`, Serwist (service worker), Vitest + Testing Library, Playwright, Prism (mock server).

Spec: `docs/superpowers/specs/2026-10-18-nutrikids-platform-design.md`. Backend plan: `docs/superpowers/plans/2026-10-18-backend-phase0-1.md`.

## Global Constraints

- Mobile-first: design at 375 px wide first, then scale up; usable one-handed; touch targets at least 44 × 44 px.
- WCAG 2.1 AA: every control labelled, visible focus, colour is never the only signal (allergy and status badges also carry text/icon), contrast at least 4.5:1, full keyboard use, `prefers-reduced-motion` respected.
- The API base URL comes from `NEXT_PUBLIC_API_URL`; all paths already start with `/v1`.
- Every API response error has `{ code, message, details? }`; show `message` to the user and switch behaviour on `code`.
- Allergy rule in the UI: `ALLERGEN_BLOCKED` is a hard stop with no override control; `ALLERGEN_CONFIRM_REQUIRED` shows a confirmation dialog listing each match and, only on confirm, repeats the request with `confirmAllergen: true`.
- Syncable writes are the `PUT` endpoints that take `clientUpdatedAt` and a client-generated UUID in the path. They must go through the outbox. If a response has `sync.superseded === true`, show the notice "Your change was replaced by a newer one."
- Anything with `provisional: true` in a response (growth percentiles/status, nutrition score) shows a visible "Provisional" tag with the text "Guidance only, not medical advice."
- Show the medical disclaimer during onboarding and in Settings (copy in Task 13).
- Access tokens live in memory only. The refresh token is stored in `localStorage` under `nk.refresh` (documented trade-off: no cookie support in the current API; revisit if the backend moves to httpOnly cookies).
- No third-party analytics until the privacy settings screen exists and the user has opted in.
- One language (English) for Phase 1; put all UI text in `src/lib/copy.ts` so localisation is possible later.
- Commit after each task: `<type>(web): <summary>`.

## File Structure

```
apps/web/
  package.json, next.config.ts, tailwind.config.ts, tsconfig.json, .env.example
  src/app/
    layout.tsx, globals.css, manifest.ts, sw.ts
    (public)/{login,register,verify-email,forgot-password,reset-password}/page.tsx
    (app)/layout.tsx                       auth gate + shell + child switcher
    (app)/{page.tsx (today), onboarding/, children/new/, children/[id]/...}
    (app)/children/[id]/{profile,meals,grocery,growth,nutrition,feeding,vaccinations}/page.tsx
    (app)/{hospitals,settings}/page.tsx
  src/lib/
    api/{schema.d.ts (generated), client.ts, errors.ts, auth.ts}
    offline/{outbox.ts, sync.ts, useSyncedMutation.ts}
    copy.ts, dates.ts, allergy.ts, push.ts
  src/components/ (ui primitives, AllergyBadge, AllergyConfirmDialog, StatusBadge, ProvisionalTag, ...)
  src/features/<area>/ (hooks + screens)
  e2e/*.spec.ts, vitest setup
```

---

### Task 1: Scaffold, typed client, mock server

**Files:**
- Create: `apps/web/**` (via `create-next-app`), `apps/web/src/lib/api/client.ts`, `apps/web/src/lib/api/errors.ts`, `apps/web/.env.example`
- Modify: root `package.json` scripts
- Test: `apps/web/src/lib/api/errors.test.ts`

**Interfaces:**
- Produces: `api` (an `openapi-fetch` client with a bearer-token middleware and 401 refresh-once), `ApiProblem` (`{ code: string; message: string; details?: unknown; status: number }`), `toProblem(res: Response, body: unknown): ApiProblem`, `isNetworkError(e: unknown): boolean`.

- [x] **Step 1: Create the app and install dependencies**

```bash
cd apps && npx create-next-app@15 web --ts --tailwind --eslint --app --src-dir --import-alias "@/*" --use-pnpm --no-turbopack && cd ..
pnpm --filter web add @tanstack/react-query openapi-fetch react-hook-form zod @hookform/resolvers recharts idb serwist
pnpm --filter web add -D openapi-typescript vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event @playwright/test @stoplight/prism-cli @serwist/next
```
Add scripts to `apps/web/package.json`:
```json
"gen:api": "openapi-typescript ../../packages/contracts/openapi.json -o src/lib/api/schema.d.ts",
"mock": "prism mock ../../packages/contracts/openapi.json -p 4010 --dynamic",
"test": "vitest run",
"e2e": "playwright test"
```
Run `pnpm --filter web gen:api`. Expected: `src/lib/api/schema.d.ts` exists and exports `paths`.

- [x] **Step 2: Failing test for error mapping**

`apps/web/src/lib/api/errors.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { isNetworkError, toProblem } from './errors';

describe('toProblem', () => {
  it('reads the API error shape', () => {
    const p = toProblem({ status: 409 } as Response, { code: 'ALLERGEN_BLOCKED', message: 'blocked', details: [1] });
    expect(p).toEqual({ status: 409, code: 'ALLERGEN_BLOCKED', message: 'blocked', details: [1] });
  });
  it('falls back for unknown bodies', () => {
    expect(toProblem({ status: 500 } as Response, 'oops')).toMatchObject({ status: 500, code: 'UNKNOWN' });
  });
});

describe('isNetworkError', () => {
  it('treats fetch TypeErrors as network errors', () => {
    expect(isNetworkError(new TypeError('Failed to fetch'))).toBe(true);
    expect(isNetworkError(new Error('x'))).toBe(false);
  });
});
```
Run: `pnpm --filter web test` → FAIL.

- [x] **Step 3: Implement errors and client**

`apps/web/src/lib/api/errors.ts`:
```ts
export type ApiProblem = { status: number; code: string; message: string; details?: unknown };

export function toProblem(res: Pick<Response, 'status'>, body: unknown): ApiProblem {
  if (body && typeof body === 'object' && 'code' in body && 'message' in body) {
    const b = body as { code: string; message: string; details?: unknown };
    return { status: res.status, code: b.code, message: b.message, details: b.details };
  }
  return { status: res.status, code: 'UNKNOWN', message: 'Something went wrong. Please try again.' };
}

export const isNetworkError = (e: unknown): boolean => e instanceof TypeError;

export class ApiException extends Error {
  constructor(public readonly problem: ApiProblem) {
    super(problem.message);
  }
}
```
`apps/web/src/lib/api/auth.ts`:
```ts
const REFRESH_KEY = 'nk.refresh';
let accessToken: string | null = null;
let refreshing: Promise<boolean> | null = null;

export const tokens = {
  getAccess: () => accessToken,
  setAccess: (t: string | null) => { accessToken = t; },
  getRefresh: () => (typeof window === 'undefined' ? null : localStorage.getItem(REFRESH_KEY)),
  setRefresh: (t: string | null) => { if (t) localStorage.setItem(REFRESH_KEY, t); else localStorage.removeItem(REFRESH_KEY); },
  clear() { accessToken = null; localStorage.removeItem(REFRESH_KEY); },
};

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

/** Exchanges the refresh token once; concurrent callers share the same attempt. */
export function refreshSession(): Promise<boolean> {
  if (refreshing) return refreshing;
  refreshing = (async () => {
    const refreshToken = tokens.getRefresh();
    if (!refreshToken) return false;
    try {
      const res = await fetch(`${API_URL}/v1/auth/refresh`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refreshToken }),
      });
      if (!res.ok) { tokens.clear(); return false; }
      const body = await res.json();
      tokens.setAccess(body.accessToken);
      tokens.setRefresh(body.refreshToken);
      return true;
    } catch {
      return false; // offline: keep the refresh token, try again later
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}
```
`apps/web/src/lib/api/client.ts`:
```ts
import createClient, { Middleware } from 'openapi-fetch';
import type { paths } from './schema';
import { API_URL, refreshSession, tokens } from './auth';

const auth: Middleware = {
  onRequest({ request }) {
    const t = tokens.getAccess();
    if (t) request.headers.set('Authorization', `Bearer ${t}`);
    return request;
  },
  async onResponse({ request, response }) {
    if (response.status !== 401 || request.headers.get('x-retried')) return response;
    if (new URL(request.url).pathname.includes('/auth/')) return response;
    if (!(await refreshSession())) return response;
    const retry = new Request(request, { headers: new Headers(request.headers) });
    retry.headers.set('Authorization', `Bearer ${tokens.getAccess()}`);
    retry.headers.set('x-retried', '1');
    return fetch(retry);
  },
};

export const api = createClient<paths>({ baseUrl: API_URL });
api.use(auth);
```
`apps/web/.env.example`: `NEXT_PUBLIC_API_URL=http://localhost:3000` (use `http://localhost:4010` to run against the Prism mock).
Run: `pnpm --filter web test` → PASS.

- [x] **Step 4: Query provider and a smoke page**

Create `src/app/providers.tsx` with a `QueryClientProvider` (default `staleTime: 30_000`, `retry: 1`), wrap `layout.tsx` with it. Home page renders "NutriKids". Verify `pnpm --filter web build`.

- [x] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(web): scaffold, typed API client, token refresh, mock script"
```

---

### Task 2: Auth screens and session gate

**Files:**
- Create: `src/app/(public)/{login,register,verify-email,forgot-password,reset-password}/page.tsx`, `src/features/auth/{useSession.ts, AuthForm.tsx, SocialButtons.tsx}`, `src/app/(app)/layout.tsx`
- Test: `src/features/auth/useSession.test.tsx`, `e2e/auth.spec.ts`

**Interfaces:**
- Consumes: `api`, `tokens`, `ApiException`, `toProblem`.
- Produces: `useSession(): { user: { id; email; role; emailVerified; timezone } | null; status: 'loading' | 'authed' | 'anon'; login(email, password): Promise<void>; register(email, password): Promise<void>; logout(): Promise<void> }`; the `(app)` layout redirects anonymous users to `/login?next=<path>`.

- [x] **Step 1: Failing test for the session hook**

`src/features/auth/useSession.test.tsx` (mock `api` with `vi.mock('@/lib/api/client')`): assert (a) with no refresh token the status becomes `anon`; (b) with a refresh token and a successful `/v1/auth/refresh` then `/v1/me`, the status becomes `authed` and `user.email` is set; (c) `logout()` calls `/v1/auth/logout`, clears tokens and sets `anon`. Run → FAIL.

- [x] **Step 2: Implement `useSession`**

On mount: if there is no refresh token → `anon`. Otherwise call `refreshSession()` then `GET /v1/me`; on failure → `anon`. `login`/`register` call the endpoints, store both tokens via `tokens`, then fetch `/v1/me`. Surface `ApiException` (code `INVALID_CREDENTIALS`, `EMAIL_TAKEN`, validation errors) to the form. `logout` posts the refresh token to `/v1/auth/logout` best-effort, then `tokens.clear()` and clears the query cache and the outbox only after confirming with the user if the outbox is non-empty ("You have unsynced changes. Log out anyway?").
Run tests → PASS.

- [x] **Step 3: Screens**

Build the five public screens with react-hook-form + zod (`email`, password at least 8 chars, confirm on register and reset). Behaviour:
- Register success → `/onboarding`; show "Check your email to verify your account" banner in the app shell until `emailVerified`. Do not block features on verification.
- `verify-email?token=` calls `POST /v1/auth/verify-email` on load; shows success/failure.
- `forgot-password` always shows "If that email exists, we sent a link" (the API never reveals).
- `reset-password?token=` posts the new password, then goes to `/login`.
- `SocialButtons` renders "Continue with Google" and "Continue with Apple" buttons that obtain an ID token from the provider's JS SDK and post `{ provider, idToken }` to `/v1/auth/social`. Hide a button when its client id env var (`NEXT_PUBLIC_GOOGLE_CLIENT_ID`, `NEXT_PUBLIC_APPLE_CLIENT_ID`) is unset.

- [x] **Step 4: E2E test (Playwright, runs against the real API)**

`e2e/auth.spec.ts`: register a unique email → lands on `/onboarding`; reload → still signed in (refresh path); log out → `/login`; wrong password shows the API message; visiting `/children/new` while signed out redirects to `/login?next=%2Fchildren%2Fnew`. Run `pnpm --filter web e2e -- auth` → PASS (start the API with `pnpm db:up` and `pnpm api start:dev` first; set `playwright.config.ts` `webServer` to start Next).

- [x] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(web): auth screens, session hook, route gate"
```

---

### Task 3: App shell, children, progressive onboarding

**Files:**
- Create: `src/app/(app)/onboarding/page.tsx`, `src/app/(app)/children/new/page.tsx`, `src/features/children/{useChildren.ts, ChildForm.tsx, ChildSwitcher.tsx, useActiveChild.ts}`, `src/components/{BottomNav.tsx, Disclaimer.tsx}`
- Modify: `src/app/(app)/layout.tsx`
- Test: `src/features/children/useActiveChild.test.tsx`, `e2e/onboarding.spec.ts`

**Interfaces:**
- Produces: `useChildren()` (`GET /v1/children`), `useCreateChild()`, `useUpdateChild()`, `useActiveChild(): { child: Child | undefined; setActive(id): void }` (persists the chosen id in `localStorage` key `nk.activeChild`, falls back to the first child), `<ChildSwitcher />` in the header, `<BottomNav />` with Today, Meals, Growth, Vaccines, More.

- [x] **Step 1: Failing test for `useActiveChild`**

Cases: returns the stored child when it still exists; falls back to the first child when the stored id is gone; returns undefined for an empty list. Run → FAIL, implement, run → PASS.

- [x] **Step 2: Onboarding flow (Step 1 of the BRD flow, required)**

Screen 1: medical disclaimer text (Task 13 copy) with "I understand" checkbox. Screen 2: child name, date of birth (date input, max today), gender, weight (kg, optional). Submit → `POST /v1/children`. Then go to Today. The app must be usable with only these fields.
- Steps 2–4 of the BRD flow are nudges, not gates: on Today, show dismissible cards "Add height" (until set), "Add allergies" (day 2+, until the child has any allergy or the user taps "No known allergies" which stores a local flag `nk.noAllergies.<childId>`), "Add food dislikes", "Add diet preference". Each card links to the profile editor.

- [x] **Step 3: Shell**

Header shows the active child's name and age (`ageMonths` formatted as "9 months" under 24 months, else "3 years 2 months") and the switcher; bottom navigation on phones, left rail at 768 px and above. Empty state when there is no child: single call to action "Add your child".

- [x] **Step 4: E2E, then commit**

`e2e/onboarding.spec.ts`: register → accept disclaimer → create child → Today shows the child's name and the "Add allergies" card is hidden on day 1 but "Add height" is visible. Run → PASS.
```bash
git add -A && git commit -m "feat(web): app shell, child switcher, progressive onboarding"
```

---

### Task 4: Child profile and health info

**Files:**
- Create: `src/app/(app)/children/[id]/profile/page.tsx`, `src/features/children/{AllergyEditor.tsx, ConditionsEditor.tsx, DislikesEditor.tsx, FoodPicker.tsx}`
- Test: `src/features/children/AllergyEditor.test.tsx`, `e2e/profile.spec.ts`

**Interfaces:**
- Consumes: `PATCH /v1/children/:id`, `PUT /v1/children/:id/allergies` (`{ items }`), `PUT .../conditions` (`{ names }`), `PUT .../dislikes` (`{ foodIds }`), `GET /v1/foods?search=`.
- Produces: `<AllergyEditor childId />` (the nine allergens as toggle chips; each active chip has a severity selector Mild / Moderate / Severe and explanatory text "Severe allergies can never be added to a plan"), `<FoodPicker onSelect />` (debounced search, 250 ms).

- [ ] **Step 1: Failing component test**

`AllergyEditor.test.tsx`: renders nine allergens; toggling Egg then choosing Severe and pressing Save calls the allergies endpoint once with `{ items: [{ allergen: 'EGG', severity: 'SEVERE' }] }`; with nothing selected, Save sends `{ items: [] }`; chips expose `aria-pressed`. Run → FAIL, implement, → PASS.

- [ ] **Step 2: Profile page**

Sections: Basics (name, date of birth, gender, height, weight, activity level, diet type, photo upload optional), Allergies, Medical conditions (free-text chips, max 30), Food dislikes (picker, chips). Each section saves independently with optimistic UI and an inline "Saved" status. Show age computed by the API (`ageMonths`). Deleting a child is behind a confirm dialog that requires typing the child's name.

- [ ] **Step 3: E2E and commit**

`e2e/profile.spec.ts`: set Egg = Severe; reload; the chip is still selected with Severe; update height; the Today nudge disappears. Run → PASS.
```bash
git add -A && git commit -m "feat(web): child profile with structured allergies, conditions, dislikes"
```

---

### Task 5: Meal planning with allergy safety

**Files:**
- Create: `src/app/(app)/children/[id]/meals/page.tsx`, `src/features/meals/{useMealPlan.ts, PlanWeek.tsx, MealCard.tsx, RecipeSheet.tsx, SwapMealDialog.tsx}`, `src/components/{AllergyBadge.tsx, AllergyConfirmDialog.tsx}`, `src/lib/allergy.ts`
- Test: `src/lib/allergy.test.ts`, `src/components/AllergyConfirmDialog.test.tsx`, `e2e/meals.spec.ts`

**Interfaces:**
- Consumes: `POST /v1/children/:id/meal-plans/generate`, `GET /v1/children/:id/meal-plans?from&to`, `PUT /v1/children/:id/meal-entries/:entryId`, `DELETE .../meal-entries/:entryId`, `GET /v1/recipes?slot&maxAgeMonths`, `GET /v1/recipes/:id`.
- Produces:
```ts
// lib/allergy.ts — client-side mirror used while offline; the server stays the authority
export type Match = { allergen: string; severity: 'MILD' | 'MODERATE' | 'SEVERE'; foodName: string };
export type Verdict = { status: 'OK' | 'CONFIRM' | 'BLOCKED'; matches: Match[] };
export function checkRecipe(childAllergies: { allergen: string; severity: Match['severity'] }[], recipe: { foods: { name: string; allergens?: string[] }[]; allergens: string[] }): Verdict;
```
`<AllergyConfirmDialog matches onConfirm onCancel />` and `<AllergyBadge status />`.

- [ ] **Step 1: Failing tests for the pure mirror and the dialog**

`src/lib/allergy.test.ts`: no allergies → OK; mild/moderate match → CONFIRM with the matches; any severe match → BLOCKED even when others are mild; non-matching allergens ignored.
`AllergyConfirmDialog.test.tsx`: lists each allergen and severity, has "Add anyway" and "Cancel", and focus lands on Cancel by default (safer default). A `BLOCKED` verdict renders a message with no confirm control at all. Run → FAIL, implement, → PASS.

- [ ] **Step 2: Week view**

Seven-day horizontal pager on phones, grid on desktop; five slots per day (Breakfast, Lunch, Morning snack, Afternoon snack, Dinner). Each card shows recipe name, prep time, calories, and an `AllergyBadge` from `allergyStatus` (OK shows nothing; CONFIRM shows "Contains <allergen>" with icon; the API never returns BLOCKED in a plan). Tapping opens `RecipeSheet` (ingredients with grams, steps, nutrition per serving, allergen list).
"Generate this week" calls generate with `type: 'WEEKLY'` and the Monday–Sunday range; "Generate today" uses `DAILY`. Existing entries are kept (the API skips occupied slots); explain this in a one-line hint. Show a clear message when the API returns fewer entries than slots ("No suitable recipes for some meals").

- [ ] **Step 3: Swap or add a meal with the allergy flow**

`SwapMealDialog` lists recipes for the slot. On pick:
1. Run `checkRecipe` locally. `BLOCKED` → show the blocked message and do not send anything.
2. `CONFIRM` → show `AllergyConfirmDialog`; only on confirm send the PUT with `confirmAllergen: true`.
3. `OK` → send the PUT.
4. If the server answers `ALLERGEN_BLOCKED` or `ALLERGEN_CONFIRM_REQUIRED` anyway, handle it exactly like steps 1–2 using the server's `details` (the server is authoritative).
5. `SLOT_TAKEN` → tell the user the slot is already filled and reload the plan.
Entry ids are `crypto.randomUUID()`; `clientUpdatedAt` is `new Date().toISOString()`. The write goes through the outbox (Task 12 provides `useSyncedMutation`; until then call the API directly behind a thin `putEntry()` function that Task 12 swaps in).

- [ ] **Step 4: E2E and commit**

`e2e/meals.spec.ts` (needs seeded data: run `pnpm --filter api exec prisma db seed`): set Egg = Severe → generate a week → no card mentions egg; try to add an egg recipe via swap → blocked message, no network PUT (assert with `page.on('request')`); set Egg = Mild → add the same recipe → confirm dialog → entry appears with the badge. Run → PASS.
```bash
git add -A && git commit -m "feat(web): meal plan week view, generation, allergy-safe add and swap"
```

---

### Task 6: Grocery list

**Files:**
- Create: `src/app/(app)/children/[id]/grocery/page.tsx`, `src/features/grocery/{useGrocery.ts, GroceryList.tsx}`
- Test: `src/features/grocery/GroceryList.test.tsx`, `e2e/grocery.spec.ts`

**Interfaces:**
- Consumes: `GET /v1/children/:id/grocery-list?from&to` → `{ weekStart, lines: { foodId, foodName, totalG, checked }[] }`, `PUT /v1/children/:id/grocery-list/checks { weekStart, foodId, checked, clientUpdatedAt }`.

- [ ] **Step 1: Failing component test**

`GroceryList.test.tsx`: renders lines sorted as given; shows grams as "1.2 kg" at 1000 g or more, otherwise "350 g"; tapping a line toggles `checked` optimistically and calls the check mutation with the week start; checked lines move to a "Done" group; the empty state says "Plan some meals to see your shopping list". Run → FAIL, implement, → PASS.

- [ ] **Step 2: Page**

Range selector: "This week" / "Next week" (Monday–Sunday); the request uses `from` = the Monday as `weekStart`. Large check targets, strike-through plus a visible check icon for done lines (not colour alone). "Share list" uses the Web Share API with a plain-text list, falling back to copy.

- [ ] **Step 3: E2E, commit**

`e2e/grocery.spec.ts`: with a generated week, list is non-empty; check an item, reload, it stays checked. Run → PASS.
```bash
git add -A && git commit -m "feat(web): grocery list with check-off"
```

---

### Task 7: Growth tracking

**Files:**
- Create: `src/app/(app)/children/[id]/growth/page.tsx`, `src/features/growth/{useGrowth.ts, GrowthForm.tsx, GrowthChart.tsx, StatusBadge.tsx}`, `src/components/ProvisionalTag.tsx`
- Test: `src/features/growth/chartData.test.ts`, `e2e/growth.spec.ts`

**Interfaces:**
- Consumes: `PUT /v1/children/:id/growth-records/:recId`, `GET /v1/children/:id/growth/chart`, `DELETE .../growth-records/:recId`, `GET /v1/children/:id/growth/export.pdf` (needs the bearer token, so fetch as a blob and open it).
- Produces:
```ts
// features/growth/chartData.ts
export type Series = 'WFA' | 'HFA' | 'BFA' | 'HCFA';
export function buildChartData(chart: { points: { ageMonths: number; weightKg: number | null; heightCm: number | null; headCircumferenceCm: number | null; measures: { bmi?: { value: number } } }[]; reference: Record<Series, Record<'p3' | 'p15' | 'p50' | 'p85' | 'p97', { ageMonths: number; value: number }[]>> }, series: Series): { ageMonths: number; p3: number; p15: number; p50: number; p85: number; p97: number; child?: number }[];
```

- [ ] **Step 1: Failing test for `buildChartData`**

Cases: merges the five reference lines by `ageMonths`; adds `child` only on ages that have a measurement for the chosen series (weight for WFA, height for HFA, BMI for BFA, head for HCFA); ignores null measurements; sorted by age. Run → FAIL, implement, → PASS.

- [ ] **Step 2: Entry form**

Fields: date (default today, not before birth), height (cm), weight (kg), head circumference (cm, only shown when `ageMonths <= 60`). At least one measurement is required. On save, show the returned `measures` as a result card: "Weight: 57th percentile", status badge for BMI (Underweight / Normal / Overweight, with icon and text), and `ProvisionalTag`. The write is syncable (outbox, Task 12).

- [ ] **Step 3: Chart**

Recharts line chart per series with tabs Weight, Height, BMI, Head. Five reference curves in light neutral tones with labels (3rd, 15th, 50th, 85th, 97th), the child's points as a bold line with dots. Table view toggle for screen readers and for users who prefer numbers (same data). Show the last-updated date. Below: "Download PDF for your doctor" button (blob fetch, then `URL.createObjectURL` and open).

- [ ] **Step 4: E2E, commit**

`e2e/growth.spec.ts`: add a record with weight and height → result card shows a percentile and the Provisional tag; chart tab shows the point (table view contains the value); PDF button triggers a request whose response `content-type` is `application/pdf`. Run → PASS.
```bash
git add -A && git commit -m "feat(web): growth records, WHO chart overlay, PDF export"
```

---

### Task 8: Nutrition score

**Files:**
- Create: `src/features/nutrition/{useNutrition.ts, ScoreRing.tsx, NutrientBars.tsx}`, `src/app/(app)/children/[id]/nutrition/page.tsx`
- Modify: `src/app/(app)/page.tsx` (Today shows the score card)
- Test: `src/features/nutrition/NutrientBars.test.tsx`, `e2e/nutrition.spec.ts`

**Interfaces:**
- Consumes: `GET /v1/children/:id/nutrition/daily?date`, `GET .../nutrition/weekly?weekStart` → `{ applicable, provisional, scorePercent | null, mealsPlanned, nutrients: { nutrient, intake, target, ratio, rating: 'GOOD'|'MEDIUM'|'LOW' }[] }`.

- [ ] **Step 1: Failing test**

`NutrientBars.test.tsx`: each nutrient row shows its name, "intake / target" with units (protein g, iron mg, calcium mg, vitamin A µg, vitamin C mg, vitamin D µg, zinc mg, fibre g), and a rating label (Good / Medium / Low) as text plus a shape/icon, not colour alone; the bar width is `min(ratio, 1)`. Run → FAIL, implement, → PASS.

- [ ] **Step 2: Screens**

Today: score ring with the percentage and `ProvisionalTag`. `applicable: false` (under 12 months) shows "Nutrition score starts at 12 months. For now, see feeding guidance." linking to Task 9. No meals planned shows "Plan today's meals to see a score". Detail page: date switcher, the eight nutrient bars, and a 7-day strip from the weekly endpoint with the average.

- [ ] **Step 3: E2E, commit**

Seed a plan, open Today and the detail page, assert the ring text and eight nutrient rows. Run → PASS.
```bash
git add -A && git commit -m "feat(web): daily and weekly nutrition score"
```

---

### Task 9: Baby feeding guidance (0–12 months)

**Files:**
- Create: `src/app/(app)/children/[id]/feeding/page.tsx`, `src/features/feeding/{useFeedingLogs.ts, FeedingLogForm.tsx, FeedingTimeline.tsx, FoodIntroTracker.tsx, guidance.ts}`
- Test: `src/features/feeding/guidance.test.ts`, `e2e/feeding.spec.ts`

**Interfaces:**
- Consumes: `PUT/GET/DELETE /v1/children/:id/feeding-logs[/:logId]`, `PUT/GET /v1/children/:id/food-introductions[/:introId]`.
- Produces: `guidanceFor(ageMonths: number): { stage: 'BREASTFEEDING' | 'SOLIDS_START' | 'SOLIDS'; headline: string; points: string[]; source: string }`.

- [ ] **Step 1: Failing test**

`guidance.test.ts`: under 6 months → `BREASTFEEDING`; 6–8 → `SOLIDS_START`; 9–11 → `SOLIDS`; 12 or more → the page shows "Feeding guidance is for babies under 12 months" and links to meals. Every stage has at least three points and a non-empty `source`. Run → FAIL, implement, → PASS.

- [ ] **Step 2: Guidance content**

Write the guidance text in `guidance.ts`. It must come from WHO/UNICEF infant-feeding guidance (exclusive breastfeeding to 6 months, complementary foods from 6 months, allergen introduction advice, no honey under 12 months, no added salt or sugar, responsive feeding) and each stage carries the source name and URL in `source`. Mark the file header "Content requires nutritionist review before launch."

- [ ] **Step 3: Logging and tracker**

Feeding log form: type (breast / formula / solid), time (default now), duration minutes, notes; timeline grouped by day with a daily count. Food introduction tracker: pick a food (reuse `FoodPicker`), date, reaction note; list shows first-introduction date per food; a food can be recorded once (the API enforces one per food, show a friendly message on conflict). All writes go through the outbox (Task 12).

- [ ] **Step 4: E2E, commit**

Create a 7-month-old child; log a breast feed and a solid; add a food introduction; reload and verify both lists. Run → PASS.
```bash
git add -A && git commit -m "feat(web): infant feeding guidance, logs, food introduction tracker"
```

---

### Task 10: Vaccination

**Files:**
- Create: `src/app/(app)/children/[id]/vaccinations/page.tsx`, `src/features/vaccination/{useVaccinations.ts, VaccineRow.tsx, MarkGivenSheet.tsx, PriceTag.tsx, vaccineText.ts}`
- Test: `src/features/vaccination/vaccineText.test.ts`, `src/features/vaccination/PriceTag.test.tsx`, `e2e/vaccination.spec.ts`

**Interfaces:**
- Consumes: `GET /v1/children/:id/vaccinations?status`, `GET .../vaccinations/summary`, `PUT .../vaccinations/:id`.
- Produces:
```ts
// vaccineText.ts
export function suggestedAgeText(suggestedAgeDays: number): string;                       // 0 -> "At birth", 42 -> "6 weeks", 270 -> "9 months", 730 -> "2 years"
export function windowText(minAgeDays: number, maxAgeDays: number | null): string;         // "Best between 6 and 12 weeks" / "From 9 months"
export function statusLabel(s: 'UPCOMING'|'DUE'|'OVERDUE'|'GIVEN'|'GIVEN_LATE'): { text: string; icon: string };
```

- [ ] **Step 1: Failing tests**

`vaccineText.test.ts`: the three example conversions above plus 7 days → "1 week", 14 → "2 weeks", 365 → "12 months", 1095 → "3 years"; `windowText(42, 84)` → "Best between 6 and 12 weeks"; `windowText(270, null)` → "From 9 months". `PriceTag.test.tsx`: `GOVERNMENT_FREE` → "Free (government)"; `PRIVATE_PAID` with both prices → "About ৳1,000–2,500 (private)" and, when `priceNote` exists, the note; `PRIVATE_PAID` with null prices → "Price not available"; `BOTH` → "Free at government centres; about ৳X–Y privately"; if `priceUpdatedAt` is set, show "Price checked <date>". Run → FAIL, implement, → PASS.

- [ ] **Step 2: Page**

Header summary chips from the summary endpoint: Given, Due now, Upcoming, Overdue. Three tabs: **Due and upcoming** (default; overdue first), **Given**, **Not given** (overdue ones). Each row: vaccine name, disease, dose "Dose 2 of 3" computed from the child's rows for that vaccine, suggested age, window text, status label with icon, `PriceTag`, mandatory/optional label. A banner reads "Schedule and prices are being reviewed by a medical advisor" whenever `vaccine.verified` is false.

- [ ] **Step 3: Mark given**

`MarkGivenSheet`: date given (default today, within birth..today), facility name, paid type (Government / Private), amount paid (BDT, only when Private), batch number, notes, card photo (optional upload; skip upload in Phase 1 and hide the field until the API has an upload endpoint). Save sends `givenDate`. "Undo" sends `givenDate: null`. Syncable (outbox). Late doses display "Given late".

- [ ] **Step 4: E2E, commit**

Seed vaccines (needs `data/seed/vaccines.bd.json`), create a child, open the page, mark the first due dose as given, see it move to Given and the summary update, undo it. Run → PASS.
```bash
git add -A && git commit -m "feat(web): vaccination schedule, free/paid info, given tracking"
```

---

### Task 11: Nearby hospitals

**Files:**
- Create: `src/app/(app)/hospitals/page.tsx`, `src/features/hospitals/{useNearby.ts, HospitalCard.tsx, useGeolocation.ts}`
- Test: `src/features/hospitals/HospitalCard.test.tsx`, `e2e/hospitals.spec.ts`

**Interfaces:**
- Consumes: `GET /v1/hospitals/nearby?lat&lng&radiusKm&service&limit`.
- Produces: `useGeolocation(): { state: 'idle' | 'asking' | 'granted' | 'denied' | 'unavailable'; coords?: { lat: number; lng: number }; request(): void }`.

- [ ] **Step 1: Failing test**

`HospitalCard.test.tsx`: shows name, type, district, distance ("850 m" below 1 km, otherwise "3.2 km"), services as chips, a `tel:` link only when a phone exists, and a "Directions" link `https://www.google.com/maps/dir/?api=1&destination=<lat>,<lng>` that opens in a new tab with `rel="noopener noreferrer"`. Run → FAIL, implement, → PASS.

- [ ] **Step 2: Page**

Ask for location only when the user taps "Find hospitals near me" (never on page load), with a short explanation that the location is sent only to search and is not saved. States: asking, denied (offer to type a district/area — Phase 1 uses a fixed list of Bangladesh districts that centre the search on that district's coordinates in `src/lib/districts.ts`), unavailable, no results ("No hospitals within 10 km. Try a larger radius."). Filters: radius (5 / 10 / 25 / 50 km), service chips taken from the returned results (for example Vaccination, Pediatrics).

- [ ] **Step 3: E2E, commit**

Playwright grants geolocation (`context.grantPermissions(['geolocation'])`, `setGeolocation`) and uses seeded hospitals; asserts cards sorted by distance and that denying permission shows the district fallback. Run → PASS.
```bash
git add -A && git commit -m "feat(web): nearby hospitals with location and district fallback"
```

---

### Task 12: Offline, outbox and PWA

**Files:**
- Create: `src/lib/offline/{outbox.ts, sync.ts, useSyncedMutation.ts, useOnline.ts}`, `src/app/sw.ts`, `src/app/manifest.ts`, `public/icons/*`, `src/components/{OfflineBanner.tsx, SyncNotice.tsx}`
- Modify: `next.config.ts` (Serwist), the Task 5/7/9/10 mutation call sites to use `useSyncedMutation`
- Test: `src/lib/offline/outbox.test.ts`, `src/lib/offline/sync.test.ts`, `e2e/offline.spec.ts`

**Interfaces:**
- Produces:
```ts
// outbox.ts
export type OutboxItem = { key: string; url: string; body: unknown; createdAt: number; attempts: number };
export async function enqueue(item: Omit<OutboxItem, 'createdAt' | 'attempts'>): Promise<void>; // same key replaces the pending item
export async function list(): Promise<OutboxItem[]>;                                          // oldest first
export async function remove(key: string): Promise<void>;
export async function bump(key: string): Promise<void>;                                        // attempts + 1
// sync.ts
export type FlushResult = { sent: number; superseded: number; dropped: { key: string; code: string; message: string }[]; remaining: number };
export async function flush(send: (item: OutboxItem) => Promise<Response>): Promise<FlushResult>;
// useSyncedMutation.ts
export function useSyncedMutation<TBody>(opts: { url: (b: TBody) => string; key: (b: TBody) => string; onOptimistic?: (b: TBody) => void; invalidate: unknown[][] }): { mutate(b: TBody): Promise<{ queued: boolean; superseded: boolean }>; };
```
Rules: `key` is the request path (one pending write per record); `body` always includes `clientUpdatedAt`; a network error (`isNetworkError`) → `enqueue` and report `queued: true`; any 4xx other than 401 on flush → the item is dropped, reported in `dropped` (for example `ALLERGEN_BLOCKED`, `SLOT_TAKEN`, `DATE_BEFORE_BIRTH`) and the user is told in a notice; 5xx and network errors keep the item and call `bump`; after 10 attempts the item is dropped with code `TOO_MANY_ATTEMPTS`.

- [ ] **Step 1: Failing outbox and flush tests (fake-indexeddb)**

`pnpm --filter web add -D fake-indexeddb`. `outbox.test.ts`: enqueue then list returns it; enqueueing the same key replaces body and `createdAt` but keeps one item; list is oldest first; remove deletes. `sync.test.ts` with a fake `send`: 200 → removed, counted `sent`; a 200 whose JSON has `sync.superseded: true` → also counted `superseded`; 409 with `{code:'ALLERGEN_BLOCKED'}` → dropped with that code; 500 → kept with `attempts` 1; network error → kept, flush stops (do not hammer when offline); items are sent in order. Run → FAIL.

- [ ] **Step 2: Implement outbox and flush**

`outbox.ts` with `idb` (`openDB('nk-outbox', 1)`, object store `items` keyed by `key`). `sync.ts` implements the rules above; `send` is injected so tests do not need `fetch`. The production `send` does `fetch(API_URL + item.url, { method: 'PUT', headers: { Authorization, 'Content-Type': 'application/json' }, body: JSON.stringify(item.body) })`.
Run tests → PASS.

- [ ] **Step 3: `useSyncedMutation`, online detection and notices**

`useOnline` listens to `online`/`offline`. When the app comes online, on app start, and every 60 s while online, run `flush`. `SyncNotice` shows a toast summarising a flush: "3 changes synced", "1 change was replaced by a newer one", and for each dropped item the human message (map the codes: `ALLERGEN_BLOCKED` → "A meal you added offline contains a severe allergen and was not saved."). `OfflineBanner` shows "You're offline. Changes will sync when you reconnect." with the pending count. After a flush, invalidate the affected queries.
Switch every syncable write (meal entries, grocery checks, growth records, feeding logs, food introductions, vaccinations) to `useSyncedMutation`.

- [ ] **Step 4: Service worker and manifest**

`src/app/sw.ts` (Serwist): precache the app shell; runtime cache with `StaleWhileRevalidate` for `GET` API responses of `/v1/children`, `/v1/children/*/meal-plans`, `/v1/children/*/grocery-list`, `/v1/children/*/growth-records`, `/v1/children/*/growth/chart`, `/v1/children/*/vaccinations`, `/v1/foods`, `/v1/recipes` (cache name `nk-api-v1`, max 200 entries, 30 days); never cache `/v1/auth/*`, `/v1/me/export`, PDFs or hospital searches. On logout, delete the `nk-api-v1` cache and clear the outbox (after the confirmation from Task 2). `manifest.ts`: name "NutriKids", `display: standalone`, theme colour, 192/512 and maskable icons, `start_url: '/'`.

- [ ] **Step 5: Offline E2E**

`e2e/offline.spec.ts`: load meals while online; `context.setOffline(true)`; reload — the plan still renders from cache; add a growth record offline — the banner shows 1 pending; go online — the record appears on the server (assert via API) and the banner clears. Also: add a severe-allergen recipe offline (allowed locally only if the client mirror says OK — verify the mirror blocks it first, so the test confirms no item is queued). Run → PASS.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat(web): offline outbox, sync notices, service worker, installable PWA"
```

---

### Task 13: Notifications, settings and privacy

**Files:**
- Create: `src/app/(app)/settings/page.tsx`, `src/features/settings/{NotificationSettings.tsx, MealRemindersEditor.tsx, PrivacySettings.tsx}`, `src/lib/push.ts`
- Test: `src/lib/push.test.ts`, `src/features/settings/MealRemindersEditor.test.tsx`, `e2e/settings.spec.ts`

**Interfaces:**
- Consumes: `GET /v1/notifications/vapid-public-key`, `POST/DELETE /v1/notifications/subscriptions`, `GET/PUT /v1/notifications/preferences[/:type]`, `GET/PUT /v1/children/:id/meal-reminders[/:slot]`, `GET /v1/me`, `PATCH /v1/me`, `GET /v1/me/export`, `DELETE /v1/me`.
- Produces: `urlBase64ToUint8Array(b64: string): Uint8Array`; `subscribeToPush(): Promise<'subscribed' | 'denied' | 'unsupported' | 'no-key'>`.

- [ ] **Step 1: Failing tests**

`push.test.ts`: `urlBase64ToUint8Array('AQAB')` decodes to `[1, 0, 1]`; handles URL-safe `-`/`_` and missing padding. `MealRemindersEditor.test.tsx`: five slots each with an on/off switch and a time input (HH:mm); turning a slot on defaults 08:00 / 12:30 / 10:30 / 16:00 / 19:00; saving sends `PUT .../meal-reminders/<SLOT>` with `{ timeOfDay, enabled }`; invalid times are rejected before sending. Run → FAIL, implement, → PASS.

- [ ] **Step 2: Notification settings**

A "Turn on notifications" button calls `subscribeToPush()` (permission asked only on tap), then posts the subscription. Explain iOS: web push requires installing the app to the Home Screen first; detect `standalone` mode and show the install hint when needed. Preference switches for Daily plan, Water, Weekly score, Growth reminder, Vaccine reminder (with a time for the vaccine reminder). Meal reminders editor per child. Show current permission state and a way to disable.

- [ ] **Step 3: Privacy and account**

Medical disclaimer text (shown in onboarding and here): "NutriKids provides nutritional guidance, not medical diagnosis or treatment. It does not replace advice from your child's doctor or a registered dietitian. If your child is unwell or you suspect an allergic reaction, contact a healthcare professional or emergency services immediately." Timezone selector (`PATCH /v1/me`). "Download my data" fetches `/v1/me/export` and saves JSON. "Delete my account" requires typing the email, calls `DELETE /v1/me`, clears tokens, cache and outbox, and goes to `/register`.

- [ ] **Step 4: E2E, commit**

`e2e/settings.spec.ts`: set a lunch reminder, reload and see it; toggle a preference; export downloads a JSON file with the user's email; delete account returns to the register page and login with the old credentials fails. Run → PASS.
```bash
git add -A && git commit -m "feat(web): notification settings, meal reminders, privacy, account deletion"
```

---

### Task 14: Accessibility, quality gate and release check

**Files:**
- Create: `e2e/a11y.spec.ts`, `docs/web-release-checklist.md`
- Modify: CI workflow (add a `web` job)

- [ ] **Step 1: Automated accessibility checks**

`pnpm --filter web add -D @axe-core/playwright`. `e2e/a11y.spec.ts` signs in, visits Today, Meals, Grocery, Growth, Nutrition, Feeding, Vaccinations, Hospitals, Settings, and asserts `new AxeBuilder({ page }).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()` has zero violations on each. Fix every violation in the component, not in the test. Run → PASS.

- [ ] **Step 2: Keyboard and motion pass**

Manually tab through the allergy confirm dialog (focus trapped, Escape cancels, focus returns to the trigger) and the swap dialog; confirm the chart has the table alternative; confirm animations stop with `prefers-reduced-motion`.

- [ ] **Step 3: Performance and size**

Run a production build (`pnpm --filter web build`) and Lighthouse (mobile) on Today and Meals. Targets from the spec: cold start under 3 s on a mid-range phone profile, initial JS for the first route under 200 KB gzip (the spec's 30 MB app-size limit applies to native apps and does not apply here). Lazy-load Recharts and the PDF/blob code. Record results in `docs/web-release-checklist.md`.

- [ ] **Step 4: CI job**

Add a `web` job: install, `gen:api` and fail if `schema.d.ts` changes (`git diff --exit-code`), `pnpm --filter web test`, build, then Playwright against the API service container with the seed applied.

- [ ] **Step 5: Release checklist and commit**

`docs/web-release-checklist.md` lists: every provisional data file and its reviewer (growth thresholds, nutrition targets, vaccine schedule and prices, infant guidance text, portion sizes), the disclaimer shown in onboarding, privacy/consent review done, VAPID keys set, HTTPS-only, Lighthouse and axe results.
```bash
git add -A && git commit -m "test(web): accessibility suite, performance pass, CI job, release checklist"
git push origin HEAD
```

---

## Spec coverage check

| Spec / BRD requirement | Task |
|---|---|
| Account system, progressive onboarding, value after Step 1 | 2, 3 |
| Child profile: structured allergies, conditions, diet, dislikes | 4 |
| Smart meal planning, allergy safety (hard block, confirm), no free-text allergens | 5 |
| Grocery list with check-off, offline | 6, 12 |
| Growth tracking, WHO overlay, status indicators, pediatrician PDF | 7 |
| Nutrition score (8 nutrients, Good/Medium/Low, percentage, provisional) | 8 |
| Baby feeding guidance, feeding intervals, food introduction tracker | 9 |
| Vaccination: free/paid, price range, given/not given, suggested ages | 10 |
| Nearby hospitals | 11 |
| Offline: cached plans/lists/growth, queued writes, last-write-wins notice | 12 |
| Notifications incl. per-meal reminders, vaccine reminders, configurable | 13 |
| Medical disclaimer, data export and deletion, consent | 3, 13 |
| WCAG 2.1 AA, performance targets | 14 |

**Not in this plan:** admin and nutritionist panels (Phase 2), subscription gating, consultations, AI features, store, and "available support".
