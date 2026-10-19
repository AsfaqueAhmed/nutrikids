# NutriKids Phase 2 Frontend Implementation Plan

> **For agentic workers (Antigravity):** REQUIRED SUB-SKILL: use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. You own only `apps/web` and `apps/admin-web`. Never edit `apps/api` or `packages/contracts`; if the contract is wrong or missing something, write the request in `docs/contract-requests.md` and carry on with the mock.

**Goal:** Ship the Phase 2 web UI: meal-intake logging and adherence in the parent app (2A), an articles/tips reader and static pages in the parent app (2B), and a new admin panel `apps/admin-web` (2C).

**Architecture:** Same patterns as `apps/web` Phase 1: Next.js App Router, typed `openapi-fetch` client generated from `packages/contracts/openapi.json`, TanStack Query for server state, `unwrap<T>()` plus hand-written response models (the contract types request bodies only). Parent-app logging writes go through the Phase 1 outbox (`useSyncedMutation`). The admin panel is a separate Next.js app with its own session, restricted to the ADMIN role, with no offline support.

**Tech Stack:** Next.js 15, TypeScript strict, Tailwind CSS 4 (flat design tokens already in `apps/web/src/app/globals.css`), TanStack Query v5, `openapi-fetch`/`openapi-typescript`, react-hook-form + zod, `react-markdown` + `rehype-sanitize`, Recharts, Vitest + Testing Library, Prism mock.

Spec: `docs/superpowers/specs/2026-10-19-phase2-engagement-design.md`. Backend plan (Claude): `docs/superpowers/plans/2026-10-19-phase2-backend.md`. Phase 1 web plan: `docs/superpowers/plans/2026-10-18-web-app-phase1.md`.

## Prerequisites

- Tasks F1-F4 depend on the Phase 1 web work: meal cards and the Today screen (Phase 1 plan Task 5, Today in the progress doc), the nutrition page (Task 8) and the outbox/`useSyncedMutation` (Task 12). If those are not merged yet, build F4 first (it needs none of them) and F5-F8 (separate app), then return to F1-F3.
- Backend tasks land in this order, each republishing `packages/contracts/openapi.json`: B2 nutrition logs, B3 articles, B4 admin users/stats, B5 admin vaccines. Pull `main` and run `pnpm --filter web gen:api` (or the admin-web equivalent) before starting a task that needs new endpoints. Until an endpoint is on `main`, use the Prism mock against the drafted contract.

## Global Constraints

- Mobile-first for `apps/web` (375 px first, touch targets at least 44 x 44 px); `apps/admin-web` is desktop-first but must remain usable at 768 px.
- WCAG 2.1 AA: labelled controls, visible focus, colour never the only signal (status carries text or icon too), contrast at least 4.5:1, keyboard operable, `prefers-reduced-motion` respected.
- API base URL from `NEXT_PUBLIC_API_URL`; all paths already start with `/v1`. Errors are `{ code, message, details? }`: show `message`, switch behaviour on `code`.
- Flat design: solid surfaces, 1 px borders, emerald `#059669` accents, no gradients or heavy shadows (reuse the `flat-card`, `flat-button-primary`, `flat-badge` utilities).
- All UI text goes through `src/lib/copy.ts` of the respective app.
- Syncable writes (`PUT` with a client UUID and `clientUpdatedAt`) in `apps/web` go through the outbox; if a response has `sync.superseded === true` show "Your change was replaced by a newer one."
- Markdown from the API is untrusted: always render through the sanitizing `Markdown` component (Task F3); never use `dangerouslySetInnerHTML`.
- Admin panel: access tokens in memory only; refresh token in `localStorage` under `nk.admin.refresh` (distinct from the parent app's `nk.refresh`). A non-ADMIN user who signs in is signed out immediately with the message "This account does not have admin access."
- Admin panel never displays per-child health data (growth, allergies, intake). Only aggregate stats and account-level fields.
- Commit after each task: `<type>(web): ...` or `<type>(admin-web): ...`.

## Response models (hand-written, mirror the backend views)

Add to `apps/web/src/lib/api/models.ts` (Task F1) and copy the admin ones into `apps/admin-web/src/lib/api/models.ts` (Task F5):

```ts
export type EatenStatus = 'FULL' | 'PARTIAL' | 'SKIPPED';
export type MealSlot = 'BREAKFAST' | 'MORNING_SNACK' | 'LUNCH' | 'AFTERNOON_SNACK' | 'DINNER';
export type NutritionLog = {
  id: string; date: string; slot: MealSlot; eatenStatus: EatenStatus;
  percent: number | null; notes: string | null; clientUpdatedAt: string;
};
export type NutritionSummary = {
  from: string; to: string; plannedCount: number; loggedCount: number;
  fullCount: number; partialCount: number; skippedCount: number;
  loggedPercent: number | null; eatenPercent: number | null;
  perSlot: { slot: MealSlot; logged: number; full: number; partial: number; skipped: number }[];
};
export type ArticleKind = 'ARTICLE' | 'TIP' | 'PAGE';
export type ArticleStatus = 'DRAFT' | 'PUBLISHED';
export type ArticleSummary = {
  id: string; kind: ArticleKind; slug: string; title: string; summary: string; category: string;
  ageMinMonths: number | null; ageMaxMonths: number | null; coverUrl: string | null;
  status: ArticleStatus; publishedAt: string | null;
};
export type ArticleDetail = ArticleSummary & { body: string };
export type Page<T> = { items: T[]; total: number; page: number; limit: number };
export type AdminUser = {
  id: string; email: string; role: 'PARENT' | 'NUTRITIONIST' | 'ADMIN';
  disabled: boolean; emailVerified: boolean; childCount: number; createdAt: string;
};
export type AdminStats = {
  totalUsers: number; verifiedUsers: number; disabledUsers: number; totalChildren: number;
  mealEntriesGenerated: number; vaccinationsGiven: number;
  signupsByDay: { date: string; count: number }[];
};
export type AdminVaccine = {
  id: string; code: string; name: string; disease: string; description: string;
  availability: 'GOVERNMENT_FREE' | 'PRIVATE_PAID' | 'BOTH'; isMandatory: boolean;
  priceMinBdt: number | null; priceMaxBdt: number | null; priceNote: string | null;
  priceUpdatedAt: string | null; sourceNote: string; verified: boolean;
  schedule: { id: string; doseNumber: number; suggestedAgeDays: number; minAgeDays: number;
    maxAgeDays: number | null; intervalFromPreviousDays: number | null; notes: string | null }[];
};
```

Error codes to handle: logs — `INVALID_PERCENT`, `DATE_BEFORE_BIRTH`, `RANGE_TOO_LARGE`, `ID_IN_USE`, `LOG_EXISTS` (`details.id` = the existing log id; retry the same write using that id); articles — `SLUG_TAKEN`, `INVALID_AGE_RANGE`; admin — `CANNOT_MODIFY_SELF`, `ACCOUNT_DISABLED` (login 403, refresh 401); vaccines — `INVALID_PRICE_RANGE`, `INVALID_AGE_WINDOW`.

## File Structure

```
apps/web/src/
  lib/api/models.ts                         modify (add types above)
  features/nutrition-log/
    useNutritionLogs.ts                     range query + log mutation
    QuickLog.tsx                            Full / Part / Skipped control on a meal
    PartialPercentDialog.tsx
    AdherenceCard.tsx                       summary view for the nutrition page
    *.test.tsx
  features/learn/
    useArticles.ts
    Markdown.tsx                            sanitizing renderer
    ArticleCard.tsx
    ArticleSuggestions.tsx                  "For your child's age" strip on Today
    *.test.tsx
  app/(app)/learn/page.tsx                  list + filters
  app/(app)/learn/[slug]/page.tsx           reader
  app/(app)/pages/[slug]/page.tsx           static pages (terms, privacy)
apps/admin-web/                             new app (Task F5)
  src/app/(public)/login/page.tsx
  src/app/(admin)/{layout.tsx, page.tsx (dashboard), users/, foods/, recipes/, vaccines/, articles/, hospitals/}
  src/lib/{api/*, copy.ts}
  src/features/<area>/
```

---

### Task F1: Regenerate the client and add the 2A/2B models

**Files:**
- Modify: `apps/web/src/lib/api/schema.d.ts` (generated), `apps/web/src/lib/api/models.ts`
- Test: `apps/web/src/lib/api/models.test-d.ts` (type-only)

**Interfaces:**
- Produces: the model types in "Response models" above, exported from `@/lib/api/models`.

- [ ] **Step 1: Generate the client**

Run: `pnpm --filter web gen:api`
Expected: `schema.d.ts` now contains `/v1/children/{childId}/nutrition-logs/{logId}`, `/v1/articles`, `/v1/articles/{slug}`.

- [ ] **Step 2: Add the types**

Append the `EatenStatus`, `MealSlot`, `NutritionLog`, `NutritionSummary`, `ArticleKind`, `ArticleStatus`, `ArticleSummary`, `ArticleDetail` and `Page` types from the "Response models" section to `apps/web/src/lib/api/models.ts`. If `MealSlot` already exists in `domain.ts`, import it instead of redefining.

- [ ] **Step 3: Type-check and commit**

Run: `pnpm --filter web exec tsc --noEmit`
Expected: no errors.
```bash
git add apps/web && git commit -m "feat(web): regenerate client and add Phase 2 response models"
```

---

### Task F2: Meal intake logging in the parent app (2A)

**Files:**
- Create: `apps/web/src/features/nutrition-log/{useNutritionLogs.ts, QuickLog.tsx, PartialPercentDialog.tsx}`
- Modify: the meal card component and Today screen from Phase 1 (add `<QuickLog>` to each meal that has an entry); `src/lib/copy.ts`
- Test: `apps/web/src/features/nutrition-log/{useNutritionLogs.test.tsx, QuickLog.test.tsx}`

**Interfaces:**
- Consumes: `api`, `unwrap`, `useSyncedMutation` (Phase 1 Task 12: `useSyncedMutation<TBody>({ url, key, invalidate }).mutate(body) -> { queued, superseded }`), `useActiveChild()`.
- Produces:
```ts
// useNutritionLogs.ts
export function useNutritionLogs(childId: string, from: string, to: string): UseQueryResult<NutritionLog[]>; // key ['nutrition-logs', childId, from, to]
export function useLogMeal(childId: string): {
  log(input: { id?: string; date: string; slot: MealSlot; eatenStatus: EatenStatus; percent?: number; notes?: string }): Promise<{ queued: boolean; superseded: boolean }>;
  clear(logId: string): Promise<void>; // DELETE; online only
};
// QuickLog.tsx
export function QuickLog(props: { childId: string; date: string; slot: MealSlot; existing?: NutritionLog }): JSX.Element;
```
- Rules: `useLogMeal.log` reuses `existing.id` when a log already exists for that slot, otherwise `crypto.randomUUID()`; body is `{ date, slot, eatenStatus, percent?, notes?, clientUpdatedAt: new Date().toISOString() }` sent to `PUT /v1/children/{childId}/nutrition-logs/{id}`; outbox `key` is that path. On `LOG_EXISTS` retry once with `details.id`.

- [ ] **Step 1: Write the failing hook test**

`useNutritionLogs.test.tsx` (mock `api` as in `useChildren.test.tsx`): (a) `useNutritionLogs('c1','2025-06-01','2025-06-30')` calls `GET /v1/children/{childId}/nutrition-logs` with query `{from,to}` and returns the list; (b) `log({date, slot:'LUNCH', eatenStatus:'FULL'})` with no existing log PUTs to a path whose last segment is a UUID and whose body has `clientUpdatedAt`; (c) with `eatenStatus:'PARTIAL'` and no `percent` it throws before any request (client-side guard mirroring `INVALID_PERCENT`); (d) a `409 LOG_EXISTS` response with `details.id='x'` triggers exactly one retry to `.../x`.
Run: `pnpm --filter web test -- useNutritionLogs`
Expected: FAIL (module missing).

- [ ] **Step 2: Implement the hooks**

```ts
'use client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { unwrap } from '@/lib/api/unwrap';
import { ApiException } from '@/lib/api/errors';
import { useSyncedMutation } from '@/lib/offline/useSyncedMutation';
import type { EatenStatus, MealSlot, NutritionLog } from '@/lib/api/models';

export function useNutritionLogs(childId: string, from: string, to: string) {
  return useQuery({
    queryKey: ['nutrition-logs', childId, from, to],
    queryFn: async () =>
      unwrap<NutritionLog[]>(
        await api.GET('/v1/children/{childId}/nutrition-logs', {
          params: { path: { childId }, query: { from, to } },
        }),
      ),
  });
}

type LogInput = { id?: string; date: string; slot: MealSlot; eatenStatus: EatenStatus; percent?: number; notes?: string };

export function useLogMeal(childId: string) {
  const qc = useQueryClient();
  const sync = useSyncedMutation<{ id: string } & LogInput & { clientUpdatedAt: string }>({
    url: (b) => `/v1/children/${childId}/nutrition-logs/${b.id}`,
    key: (b) => `/v1/children/${childId}/nutrition-logs/${b.id}`,
    invalidate: [['nutrition-logs', childId]],
  });

  async function log(input: LogInput) {
    if ((input.eatenStatus === 'PARTIAL') !== (input.percent !== undefined))
      throw new Error('INVALID_PERCENT');
    const body = { ...input, id: input.id ?? crypto.randomUUID(), clientUpdatedAt: new Date().toISOString() };
    try {
      return await sync.mutate(body);
    } catch (e) {
      if (e instanceof ApiException && e.problem.code === 'LOG_EXISTS') {
        const id = (e.problem.details as { id: string }).id;
        return sync.mutate({ ...body, id });
      }
      throw e;
    }
  }

  async function clear(logId: string) {
    const res = await api.DELETE('/v1/children/{childId}/nutrition-logs/{logId}', {
      params: { path: { childId, logId } },
    });
    if (!res.response.ok) unwrap(res);
    await qc.invalidateQueries({ queryKey: ['nutrition-logs', childId] });
  }
  return { log, clear };
}
```

Adjust import names to match the real `ApiException` shape in `src/lib/api/errors.ts`. The `sync.mutate` body is sent without the `id` field if the backend rejects unknown keys (`forbidNonWhitelisted` is on): strip `id` before sending, i.e. the outbox body must be `{ date, slot, eatenStatus, percent?, notes?, clientUpdatedAt }`. Do this in the `useSyncedMutation` call by passing a `toBody` mapper or by destructuring `id` out in the mutation function.
Run: `pnpm --filter web test -- useNutritionLogs`
Expected: PASS.

- [ ] **Step 3: Write the failing component test**

`QuickLog.test.tsx` (render with a mocked `useLogMeal`): shows three buttons "Ate all", "Ate some", "Skipped" each at least 44 px tall (assert class `min-h-11`); no log yet → none pressed (`aria-pressed="false"`); with `existing.eatenStatus='FULL'` the "Ate all" button has `aria-pressed="true"` and also shows a check icon plus text (not colour only); clicking "Ate all" calls `log({date, slot, eatenStatus:'FULL'})`; clicking "Ate some" opens `PartialPercentDialog` and confirming 25/50/75 calls `log` with `eatenStatus:'PARTIAL', percent:<n>`; clicking the pressed button again offers "Clear" which calls `clear(existing.id)`; when the result has `superseded: true` the text "Your change was replaced by a newer one." appears in a `role="status"` region; when `queued: true` a "Saved offline" hint shows.
Run: `pnpm --filter web test -- QuickLog`
Expected: FAIL.

- [ ] **Step 4: Implement `QuickLog` and `PartialPercentDialog`**

`PartialPercentDialog`: native `<dialog>` (focus-trapped, Escape closes) with radio choices 25 / 50 / 75 % and Save/Cancel; returns the chosen percent via `onConfirm(percent)`. `QuickLog`: a `role="group"` labelled "How much did they eat?" with the three buttons; uses `lucide-react` icons (`Check`, `CircleDashed`, `X`) beside the text; status messages in an `aria-live="polite"` `role="status"` element. Texts live in `copy.ts` under `copy.log`.
Run: `pnpm --filter web test -- QuickLog`
Expected: PASS.

- [ ] **Step 5: Wire it into the meal cards and Today screen**

For each meal entry on Today and in the plan view, fetch the day's logs with `useNutritionLogs(childId, date, date)` (one query per visible date, not per meal), find the log whose `slot` matches, and render `<QuickLog>`. Only show it for today and past dates (never future dates).

- [ ] **Step 6: Commit**

```bash
git add apps/web && git commit -m "feat(web): log how much of each meal was eaten, with offline sync"
```

---

### Task F3: Adherence summary on the nutrition page (2A)

**Files:**
- Create: `apps/web/src/features/nutrition-log/AdherenceCard.tsx`, `AdherenceCard.test.tsx`
- Modify: the nutrition page `apps/web/src/app/(app)/children/[id]/nutrition/page.tsx`; `useNutritionLogs.ts` (add `useNutritionSummary`)
- Test: as listed

**Interfaces:**
- Consumes: `NutritionSummary` model.
- Produces: `useNutritionSummary(childId: string, from: string, to: string): UseQueryResult<NutritionSummary>` (key `['nutrition-summary', childId, from, to]`, endpoint `GET /v1/children/{childId}/nutrition-logs/summary`); `<AdherenceCard childId days={7|30} />`.

- [ ] **Step 1: Failing test**

`AdherenceCard.test.tsx` with a mocked summary `{ loggedCount: 3, plannedCount: 6, fullCount: 1, partialCount: 1, skippedCount: 1, loggedPercent: 50, eatenPercent: 50, perSlot: [...] }`: renders "Logged 3 of 6 planned meals", "Ate about 50% of what was logged", a 7 / 30 day toggle (`role="tablist"`; switching refetches with a `from` that is 6 or 29 days before `to`), one row per `perSlot` with Full / Part / Skipped counts as text, and a stacked bar whose segments carry `aria-label`s ("1 full", "1 partly", "1 skipped") so it is not colour-only. With `loggedCount: 0` it shows "No meals logged yet. Tap a meal on Today to start." and no bar.
Run: `pnpm --filter web test -- AdherenceCard`
Expected: FAIL.

- [ ] **Step 2: Implement and mount**

Build the card with flat styling; compute the range with a small helper `rangeEndingToday(days)` (local-date `YYYY-MM-DD`, using the child's date from `src/lib/dates.ts`). Mount the card on the nutrition page below the (plan-based) score card. Do not change the score card: the score stays plan-based. Add a one-line explainer under the card heading: "The score is based on the meal plan. This card shows what was actually eaten."
Run: `pnpm --filter web test -- AdherenceCard`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/web && git commit -m "feat(web): adherence summary on the nutrition page"
```

---

### Task F4: Articles, tips and static pages (2B)

**Files:**
- Create: `apps/web/src/features/learn/{useArticles.ts, Markdown.tsx, ArticleCard.tsx, ArticleSuggestions.tsx}`, `apps/web/src/app/(app)/learn/page.tsx`, `apps/web/src/app/(app)/learn/[slug]/page.tsx`, `apps/web/src/app/(app)/pages/[slug]/page.tsx`
- Modify: `apps/web/package.json` (add `react-markdown`, `rehype-sanitize`), `BottomNav.tsx` or the header menu (link "Learn"), Today screen (mount `ArticleSuggestions`), Settings page (links to `/pages/terms` and `/pages/privacy`)
- Test: `Markdown.test.tsx`, `ArticleCard.test.tsx`, `useArticles.test.tsx`

**Interfaces:**
- Produces:
```ts
// useArticles.ts
export type ArticleFilters = { kind?: ArticleKind; category?: string; ageMonths?: number; q?: string; page?: number; limit?: number };
export function useArticles(f: ArticleFilters): UseQueryResult<Page<ArticleSummary>>; // key ['articles', f]
export function useArticle(slug: string): UseQueryResult<ArticleDetail>;              // key ['article', slug]
// Markdown.tsx
export function Markdown(props: { source: string }): JSX.Element;
```

- [ ] **Step 1: Failing tests**

`Markdown.test.tsx`: `# Hi` renders an `<h1>`; a link `[a](https://x.test)` renders an anchor with `rel="noopener noreferrer"` and `target="_blank"`; `<script>alert(1)</script>` and `<img src=x onerror=alert(1)>` produce no `script` element and no `onerror` attribute in the DOM; a `javascript:` link has no `href`. `ArticleCard.test.tsx`: shows title, summary, category chip, an age label ("6-12 months", "From 12 months", or none when both bounds are null), and links to `/learn/<slug>`; cover image has `alt=""` (decorative) and `loading="lazy"`. `useArticles.test.tsx`: passes filters as query params; `useArticle('missing')` surfaces the 404 `ApiException`.
Run: `pnpm --filter web test -- learn`
Expected: FAIL.

- [ ] **Step 2: Implement**

`pnpm --filter web add react-markdown rehype-sanitize`. `Markdown.tsx`:
```tsx
import ReactMarkdown from 'react-markdown';
import rehypeSanitize from 'rehype-sanitize';

export function Markdown({ source }: { source: string }) {
  return (
    <div className="prose-flat">
      <ReactMarkdown
        rehypePlugins={[rehypeSanitize]}
        components={{ a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer">{children}</a> }}
      >
        {source}
      </ReactMarkdown>
    </div>
  );
}
```
Add `.prose-flat` styles to `globals.css` (headings, lists, links, 65 ch max width). `useArticles`/`useArticle` use `GET /v1/articles` and `GET /v1/articles/{slug}`.
Run: `pnpm --filter web test -- learn`
Expected: PASS.

- [ ] **Step 3: Screens**

`/learn`: search box (debounced 300 ms into `q`), kind tabs (All, Articles, Tips), category chips taken from the loaded results, "For {child name}'s age" toggle that sets `ageMonths` from the active child, paginated "Load more", empty state "Nothing here yet." and error state with Retry. `/learn/[slug]`: title, category, age label, published date, `<Markdown source={body}>`, back link; 404 → "This article is not available." `/pages/[slug]`: same renderer for `kind: PAGE`, no cover. Link `/pages/terms` and `/pages/privacy` from Settings and the register screen footer.

- [ ] **Step 4: Today suggestions**

`ArticleSuggestions`: for the active child, `useArticles({ ageMonths: child.ageMonths, limit: 3 })`, rendered as a horizontal list of `ArticleCard`s under "Reading for {name}". Hidden when empty or loading failed (never block Today).

- [ ] **Step 5: Offline behaviour**

Add `/v1/articles` and `/v1/articles/*` GET to the service worker's `StaleWhileRevalidate` list (Phase 1 Task 12 cache `nk-api-v1`). Recently read articles open offline.

- [ ] **Step 6: Commit**

```bash
git add apps/web && git commit -m "feat(web): articles, tips and static pages with safe markdown"
```

---

### Task F5: Scaffold `apps/admin-web` with an admin-only session

**Files:**
- Create: `apps/admin-web/**` (Next.js 15 App Router, TypeScript strict), `.env.example` (`NEXT_PUBLIC_API_URL=http://localhost:3000`), `src/lib/api/{client.ts, auth.ts, errors.ts, unwrap.ts, models.ts, schema.d.ts}`, `src/lib/copy.ts`, `src/features/auth/useAdminSession.ts`, `src/app/(public)/login/page.tsx`, `src/app/(admin)/layout.tsx`, `src/components/{AdminNav.tsx, DataTable.tsx, ConfirmDialog.tsx}`
- Modify: root `package.json` (add `"admin": "pnpm --filter admin-web"` and `"test:admin": "pnpm --filter admin-web test"`)
- Test: `src/features/auth/useAdminSession.test.tsx`, `src/components/DataTable.test.tsx`

**Interfaces:**
- Produces:
```ts
// useAdminSession.ts
export type AdminSession = { status: 'loading' | 'authed' | 'anon'; user: User | null;
  login(email: string, password: string): Promise<void>; logout(): Promise<void> };
export function useAdminSession(): AdminSession;
// DataTable.tsx
export function DataTable<T>(props: { columns: { key: string; header: string; render: (row: T) => ReactNode }[];
  rows: T[]; loading?: boolean; empty?: string; page: number; limit: number; total: number; onPage(p: number): void }): JSX.Element;
```
- Rules: copy the client, token and error modules from `apps/web/src/lib/api/` and change the storage key to `nk.admin.refresh` and the dev port to 3001 (`next dev -p 3001`). After `login`, call `GET /v1/me`; if `role !== 'ADMIN'`, clear tokens and throw `ApiException`-like error with message `copy.login.notAdmin`. The `(admin)` layout redirects anonymous users to `/login` and renders `AdminNav` (Dashboard, Users, Foods, Recipes, Vaccines, Articles, Hospitals) for admins. `ACCOUNT_DISABLED` on login shows "This account has been disabled."

- [ ] **Step 1: Scaffold and generate the client**

Run: `pnpm dlx create-next-app@15 apps/admin-web --ts --tailwind --app --src-dir --eslint --use-pnpm --import-alias "@/*"` then add the same dependencies as `apps/web` (`@tanstack/react-query`, `openapi-fetch`, `react-hook-form`, `@hookform/resolvers`, `zod`, `lucide-react`, `clsx`, `tailwind-merge`, `recharts`, dev: `openapi-typescript`, `vitest`, `jsdom`, Testing Library, `@vitejs/plugin-react`). Add script `"gen:api": "openapi-typescript ../../packages/contracts/openapi.json -o src/lib/api/schema.d.ts"` and run it. Copy the flat design tokens and utility classes from `apps/web/src/app/globals.css`.
Expected: `pnpm --filter admin-web dev` serves on port 3001.

- [ ] **Step 2: Failing tests**

`useAdminSession.test.tsx`: login with a PARENT account (mocked `/v1/me` returning `role: 'PARENT'`) rejects with the not-admin message and leaves `status: 'anon'` and storage empty; login with an ADMIN account resolves and sets `status: 'authed'`; a `403 ACCOUNT_DISABLED` login error surfaces its message. `DataTable.test.tsx`: renders headers and rows, shows `empty` text when `rows` is empty and not loading, shows a `role="status"` loading row, disables "Previous" on page 1 and "Next" on the last page, and calls `onPage(2)` on Next.
Run: `pnpm --filter admin-web test`
Expected: FAIL.

- [ ] **Step 3: Implement**

Implement the files per the Interfaces/Rules above. The login form uses react-hook-form + zod (valid email, password at least 8 characters), shows API `message` on error, and has no social sign-in and no "register" link.
Run: `pnpm --filter admin-web test`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/admin-web package.json pnpm-lock.yaml && git commit -m "feat(admin-web): scaffold admin app with admin-only session"
```

---

### Task F6: Admin dashboard (2C)

**Files:**
- Create: `apps/admin-web/src/features/dashboard/{useAdminStats.ts, StatTile.tsx, SignupsChart.tsx}`, `apps/admin-web/src/app/(admin)/page.tsx`
- Test: `StatTile.test.tsx`, `SignupsChart.test.tsx`, `useAdminStats.test.tsx`

**Interfaces:**
- Consumes: `AdminStats` model; `GET /v1/admin/stats`.
- Produces: `useAdminStats(): UseQueryResult<AdminStats>` (key `['admin-stats']`, `staleTime` 60 s); `<StatTile label value hint? />`; `<SignupsChart data={AdminStats['signupsByDay']} />`.

- [ ] **Step 1: Failing tests**

`StatTile`: renders label and the value formatted with thousands separators (`1,234`); `hint` is rendered as secondary text. `SignupsChart`: with 30 points renders a Recharts bar chart inside a container with `role="img"` and an `aria-label` summarising "New sign-ups in the last 30 days: <sum> total", plus a visually hidden table of date/count for screen readers; with all-zero data it shows "No sign-ups in the last 30 days." instead of an empty chart. `useAdminStats`: calls `GET /v1/admin/stats`.
Run: `pnpm --filter admin-web test -- dashboard`
Expected: FAIL.

- [ ] **Step 2: Implement and compose the page**

Tiles: Users, Verified, Disabled, Children, Meal entries generated, Vaccinations given. Chart colour emerald `#059669`, flat. Page shows loading skeleton tiles, an error state with Retry, and a note "Aggregate numbers only. Individual children's data is not shown here."
Run: `pnpm --filter admin-web test -- dashboard`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/admin-web && git commit -m "feat(admin-web): dashboard with stats and sign-up chart"
```

---

### Task F7: Admin user management (2C)

**Files:**
- Create: `apps/admin-web/src/features/users/{useAdminUsers.ts, UserFilters.tsx, UserActions.tsx}`, `apps/admin-web/src/app/(admin)/users/page.tsx`
- Test: `useAdminUsers.test.tsx`, `UserActions.test.tsx`, `users.page.test.tsx`

**Interfaces:**
- Consumes: `GET /v1/admin/users?q&role&disabled&page&limit`, `PATCH /v1/admin/users/{id}`, `DataTable`, `ConfirmDialog`, `useAdminSession().user`.
- Produces: `useAdminUsers(filters): UseQueryResult<Page<AdminUser>>` (key `['admin-users', filters]`); `useUpdateUser(): { mutateAsync({ id, disabled?, role? }): Promise<AdminUser> }` that invalidates `['admin-users']` and `['admin-stats']`; `<UserActions user currentUserId />`.

- [ ] **Step 1: Failing tests**

`UserActions.test.tsx`: for the current admin's own row both controls are disabled with the tooltip text "You can't change your own account."; for another user, "Disable" opens a `ConfirmDialog` ("Disable {email}? They will be signed out and cannot sign in until re-enabled."), confirming calls `mutateAsync({ id, disabled: true })`; a disabled user shows "Enable" (no confirm needed); the role select offers PARENT / NUTRITIONIST / ADMIN, and choosing ADMIN opens a confirm dialog naming the email ("Make {email} an admin?") before calling `mutateAsync({ id, role: 'ADMIN' })`; a `CANNOT_MODIFY_SELF` error shows its message in a `role="alert"`. `useAdminUsers.test.tsx`: filters become query params (`disabled=true`). `users.page.test.tsx`: search input debounced 300 ms; role and status filters; table columns Email, Role, Status (text badge "Active"/"Disabled" with icon), Verified, Children (count), Joined (date), Actions; pagination wired to `DataTable`.
Run: `pnpm --filter admin-web test -- users`
Expected: FAIL.

- [ ] **Step 2: Implement**

Build per the tests. Keep filter state in the URL search params so refresh and back/forward work. Show the note: "Child counts only. No health data is shown here."
Run: `pnpm --filter admin-web test -- users`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/admin-web && git commit -m "feat(admin-web): user list with disable, enable and role change"
```

---

### Task F8: Admin foods, recipes, vaccines and hospital import (2C)

**Files:**
- Create: `apps/admin-web/src/features/{foods,recipes,vaccines,hospitals}/*`, `apps/admin-web/src/app/(admin)/{foods,recipes,vaccines,hospitals}/page.tsx` (with `[id]/page.tsx` for edit where noted)
- Test: one `*.test.tsx` per hook and per form

**Interfaces:**
- Consumes (already on `main` from Phase 1): `GET/POST /v1/foods`, `PATCH/DELETE /v1/foods/{id}`, `GET/POST /v1/recipes`, `PATCH/DELETE /v1/recipes/{id}`, `POST /v1/admin/hospitals/import` (CSV body, `Content-Type: text/csv`). New: `GET /v1/admin/vaccines`, `PATCH /v1/admin/vaccines/{id}`, `PATCH /v1/admin/vaccine-schedule-items/{id}`. Request body shapes: read the `CreateFoodDto` and `RecipeDto` schemas in the generated `schema.d.ts` (source of truth: `apps/api/src/food/food.controller.ts`, `apps/api/src/meal/recipe.controller.ts`); response shapes: read the `view` functions in the matching `*.service.ts` and add types to `models.ts`.
- Produces: `useFoods/useFoodMutations`, `useRecipes/useRecipeMutations`, `useAdminVaccines/useUpdateVaccine/useUpdateScheduleItem`, `useImportHospitals`.

- [ ] **Step 1: Foods**

Failing tests then implementation: list with search (`GET /v1/foods?q=`), category filter, DataTable; create/edit form with name, category, allergen tags (multi-select of the `Allergen` enum from `domain.ts`), age range months, and nutrition per 100 g (numeric fields, all required, non-negative; show the backend's `message` on `400`); delete behind `ConfirmDialog` ("Deleting a food used by recipes may be blocked."); show the backend `code` message on `409`. Test: submitting an out-of-range value never sends a request; a `400` response renders per-field or form-level `message`.
Run: `pnpm --filter admin-web test -- foods` → FAIL then PASS. Commit: `feat(admin-web): food management`.

- [ ] **Step 2: Recipes**

List, create and edit: name, instructions (plain textarea), prep minutes, age range, ingredient rows (food picker using `GET /v1/foods?q=` autocomplete, grams per ingredient, add/remove row). Show computed allergen tags of the chosen ingredients as read-only chips so the admin sees what the recipe will trigger. Tests: add/remove ingredient rows; cannot submit without at least one ingredient; chips update when ingredients change.
Run: `pnpm --filter admin-web test -- recipes` → FAIL then PASS. Commit: `feat(admin-web): recipe management`.

- [ ] **Step 3: Vaccines**

`/vaccines`: table of `AdminVaccine` (code, name, availability, mandatory, price range, "Verified" badge with text, price last updated). Row opens `/vaccines/[id]` with a form for the vaccine fields and, below it, one inline form per schedule item (suggested/min/max age in days, interval, notes). Tests: min price above max price → the backend `INVALID_PRICE_RANGE` message shows and the form stays editable; client validation prevents `minAgeDays > suggestedAgeDays` before sending; toggling "Verified" asks for confirmation ("Mark as verified by the medical advisor?"); a banner explains "Changing the schedule does not change due dates already generated for existing children."
Run: `pnpm --filter admin-web test -- vaccines` → FAIL then PASS. Commit: `feat(admin-web): vaccine catalogue and schedule editing`.

- [ ] **Step 4: Hospital CSV import**

`/hospitals`: file input (`.csv`, 5 MB max checked client-side) with a preview of the first 5 rows and the expected header (link to `data/seed/hospitals.bd.csv` column names in the help text), an "Import" button that POSTs the file text with `Content-Type: text/csv`, then shows `{ imported, updated, errors[] }` from the response (errors listed with row numbers). Use `fetch` through the same auth middleware, not `openapi-fetch` body serialisation (it would JSON-encode a string). Tests: oversize file rejected before any request; the request carries `Content-Type: text/csv` and the raw text; the result summary and error rows render.
Run: `pnpm --filter admin-web test -- hospitals` → FAIL then PASS. Commit: `feat(admin-web): hospital CSV import`.

---

### Task F9: Admin articles (2C + 2B authoring)

**Files:**
- Create: `apps/admin-web/src/features/articles/{useAdminArticles.ts, ArticleForm.tsx, MarkdownPreview.tsx}`, `apps/admin-web/src/app/(admin)/articles/{page.tsx, new/page.tsx, [id]/page.tsx}`
- Modify: `apps/admin-web/package.json` (add `react-markdown`, `rehype-sanitize`)
- Test: `useAdminArticles.test.tsx`, `ArticleForm.test.tsx`, `MarkdownPreview.test.tsx`

**Interfaces:**
- Consumes: `GET /v1/admin/articles?status&kind&page&limit`, `GET /v1/admin/articles/{id}`, `POST /v1/admin/articles`, `PATCH /v1/admin/articles/{id}`, `DELETE /v1/admin/articles/{id}`.
- Produces: `useAdminArticles(filters)`, `useAdminArticle(id)`, `useArticleMutations(): { create, update, remove }` invalidating `['admin-articles']`; `<ArticleForm initial? onSubmit />`; `<MarkdownPreview source />` (same sanitizing implementation as `apps/web`'s `Markdown`).

- [ ] **Step 1: Failing tests**

`ArticleForm.test.tsx`: the slug auto-fills from the title (lower-case, hyphenated) until the user edits it manually; invalid slugs (`Bad Slug`) show "Use lower-case letters, numbers and hyphens." and block submit; min age greater than max age blocks submit with a message; cover URL must be `https://`; a `409 SLUG_TAKEN` response puts the error on the slug field; two submit buttons "Save draft" and "Publish" send `status: 'DRAFT'` / `'PUBLISHED'`; editing a published article shows "Unpublish" which sends `status: 'DRAFT'` after confirmation. `MarkdownPreview.test.tsx`: same sanitisation cases as the parent app (`<script>` and `onerror` stripped).
Run: `pnpm --filter admin-web test -- articles`
Expected: FAIL.

- [ ] **Step 2: Implement**

List page: status tabs (All, Draft, Published), kind filter, columns Title, Kind, Category, Status (badge with text), Updated, Actions (Edit, Delete behind confirm). Editor: two-column layout (form left, live `MarkdownPreview` right; stacked under 1024 px), Kind selector (Article / Tip / Page), category, age range, cover URL, body textarea. Add a banner on the editor: "Medical content must be reviewed by the medical advisor before publishing."
Run: `pnpm --filter admin-web test -- articles`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/admin-web && git commit -m "feat(admin-web): article authoring with live preview"
```

---

### Task F10: Quality gate and live integration

**Files:**
- Modify: `docs/contract-requests.md` (record any gaps found)
- Test: `apps/web/src/lib/api/live-integration.test.ts` (extend), `apps/admin-web/src/lib/api/live-integration.test.ts` (create, same pattern)

- [ ] **Step 1: Accessibility and responsive pass**

For `apps/web` new screens at 375 px and `apps/admin-web` at 768 px and 1280 px: keyboard-only walk-through, visible focus, labels on every input, status never colour-only, `prefers-reduced-motion`. Run `pnpm --filter web lint && pnpm --filter admin-web lint` and fix findings.

- [ ] **Step 2: Live integration against the real API**

Start Postgres and the API (`pnpm db:up`, `pnpm --filter api start:dev`), promote a test account to admin (see README Phase 2 section from the backend plan), then extend the existing `live-integration.test.ts` pattern: (web) register, create a child, `PUT` a nutrition log, read it back, read the summary, list `GET /v1/articles`; (admin-web) log in as admin, `GET /v1/admin/stats`, create and publish an article, confirm it appears in the parent list, disable a user and confirm login returns `ACCOUNT_DISABLED`.
Run: `pnpm --filter web test -- live-integration && pnpm --filter admin-web test -- live-integration`
Expected: PASS. Any mismatch between the mock and the live API goes into `docs/contract-requests.md` for Claude, not into a local workaround.

- [ ] **Step 3: Full test run and commit**

Run: `pnpm --filter web test && pnpm --filter admin-web test && pnpm --filter web build && pnpm --filter admin-web build`
Expected: all pass.
```bash
git add -A && git commit -m "test(web,admin-web): Phase 2 quality gate and live integration"
```
