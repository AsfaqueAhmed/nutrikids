# NutriKids Parent Web App (Phase 1) - Execution Progress

**Branch:** `web/phase1`  
**Current Milestone Completed:** Tasks 1, 2, and 3  
**Design Direction:** Flat Design (clean solid surfaces, crisp 1px borders, solid emerald `#059669` accents, high-contrast readable typography, accessible 44×44px touch targets, zero heavy gradients/skeuomorphic shadows).

---

## Progress Summary

### Completed:
- [x] **Task 1: Scaffold, typed client, mock server & flat design system** (`commit a4688aa`)
  - Next.js 15 (App Router, TypeScript strict) initialized in `apps/web`.
  - Tailwind CSS configured with custom flat design tokens & utilities (`flat-card`, `flat-button-primary`, `flat-badge`, etc.).
  - `@tanstack/react-query`, `openapi-fetch`, `react-hook-form`, `zod`, `idb`, `recharts` installed and verified.
  - Complete OpenAPI typed contract defined in `src/lib/api/schema.d.ts`.
  - API client (`api`), session tokens (`tokens`), token refresh (`refreshSession`), error mapping (`toProblem`, `ApiException`) implemented and unit tested.
  - Smoke landing page with responsive flat design cards and buttons.

- [x] **Task 2: Auth screens and session gate** (`commit 34514a2`)
  - Session hook `useSession` implemented with token rotation and React Query integration (100% unit test coverage).
  - Public authentication screens created with React Hook Form + Zod validation:
    - `/login`: Email + password, API error code surfaces, Google & Apple social auth buttons.
    - `/register`: Email + password + confirmation with match validation.
    - `/verify-email`: Verification token processor with friendly flat status feedback.
    - `/forgot-password`: Security-conscious password reset link requester.
    - `/reset-password`: Token-based new password setter.
  - App gate layout `(app)/layout.tsx` with redirect to `/login?next=...` for anonymous users and unverified email warning banner.

- [x] **Task 3: App shell, children, progressive onboarding** (`commit cb49d4d`)
  - Shared UI components:
    - `Disclaimer.tsx`: Medical and nutritional notice with explicit parent consent check.
    - `AllergyBadge.tsx`: WCAG 2.1 AA compliant badges (color + text + icon) for mild, moderate, severe sensitivities.
    - `StatusBadge.tsx`: Status badges for given/due/overdue vaccinations and tasks.
    - `ProvisionalTag.tsx`: Tag for non-clinical guidance.
    - `BottomNav.tsx`: Mobile-first bottom bar with 5 navigation destinations and 44x44px touch targets.
  - Children management:
    - `useChildren.ts`: TanStack Query hooks for child CRUD (`['children']`).
    - `useActiveChild.ts`: Active child state synced with `localStorage['nk.activeChild']`.
    - `ChildSwitcher.tsx`: Fast header switcher between children with "+ Add Child" shortcut.
    - `ChildForm.tsx`: Comprehensive form for child demographics, calculated age, allergy tag additions with severity, and food dislikes.
  - Screens:
    - `/onboarding`: 2-step onboarding flow (disclaimer acceptance -> first child profile).
    - `/children/new`: Add additional children.
    - `/children/[id]/profile`: View, edit, and delete child profiles.

---

## Remaining Tasks to Execute on Next Device

- [ ] **Task 4: Offline outbox and sync engine**
  - Implement `src/lib/offline/outbox.ts` with `idb`.
  - Implement `src/lib/offline/sync.ts` & `useSyncedMutation.ts`.
  - Verify offline queueing and last-write-wins (LWW) resolution.

- [ ] **Task 5: Today screen & quick actions**
  - Build `src/app/(app)/page.tsx` with flat cards: daily meal timeline, upcoming vaccines, growth reminders, quick logging.

- [ ] **Task 6: Meal planning, swaps, allergy checks**
  - Weekly/daily plan view, meal card, swap modal, allergen hard block / confirmation modal.

- [ ] **Task 7: Grocery list**
  - Grouped checklist, strike-through, offline item check sync.

- [ ] **Task 8: Growth tracker & WHO percentiles**
  - WHO growth charts (height, weight, head circumference) using Recharts with flat aesthetic, measurement forms.

- [ ] **Task 9: Nutrition score & breakdown**
  - Daily score breakdown, flat nutrient progress bars, deficit tips.

- [ ] **Task 10: Infant feeding log & food introductions**
  - Quick logger for breast/formula/solid feeding, 3-day wait rule introduction tracker.

- [ ] **Task 11: Vaccination schedule & status**
  - Bangladesh EPI + private schedule, mark given modal with photo upload / details.

- [ ] **Task 12: Nearby hospitals directory**
  - Geolocation-based emergency hospital directory with direct call and distance tags.

- [ ] **Task 13: Notifications, meal reminders & settings**
  - Per-slot meal reminder time settings, push notifications toggle, privacy opt-ins.

- [ ] **Task 14: PWA, Service Worker & offline shell**
  - App manifest, Serwist service worker, offline cache fallback.

- [ ] **Task 15: Verification & walkthrough**
  - Full end-to-end user journey check and final audit.

---

## How to Resume on New Device

```bash
git fetch origin
git checkout web/phase1
git pull origin web/phase1
pnpm install
pnpm --filter web test   # Verify clean baseline (7 tests passing)
pnpm --filter web dev    # Start dev server at http://localhost:3000
```
Resume with **Task 4** in `docs/superpowers/plans/2026-10-18-web-app-phase1.md`.
