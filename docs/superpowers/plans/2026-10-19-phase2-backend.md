# NutriKids Phase 2 Backend Implementation Plan

> **For agentic workers (Claude):** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. You own `apps/api`, `packages/contracts` and `data/seed`. Frontend lives in `apps/web` and `apps/admin-web` (Antigravity) — never edit those.

**Goal:** Add the Phase 2 API: nutrition logging (2A), content/articles (2B), and admin (2C: user management, stats, vaccine catalogue editing), and republish the OpenAPI contract after each task so the frontend can build against it.

**Architecture:** Three small NestJS modules (`nutrition-log`, `article`, `admin`) plus an admin controller added to the existing `vaccination` module. Child-scoped logs reuse `ChildAccessService` and `resolveLww`; admin routes reuse `@Roles('ADMIN')` (enforced by the global `RolesGuard`). One Prisma migration adds all new tables and `User.disabledAt`.

**Tech Stack:** NestJS 11, Prisma 6 / PostgreSQL, class-validator DTOs (declared in `*.controller.ts` files so the Swagger plugin picks them up), Jest + supertest (e2e against a real DB).

Spec: `docs/superpowers/specs/2026-10-19-phase2-engagement-design.md`. Frontend plan: `docs/superpowers/plans/2026-10-19-phase2-frontend.md`.

## Global Constraints

- REST under `/v1`; error shape `{ code, message, details }` via `ApiError` (`apps/api/src/common/api-error.ts`).
- DTO validation failures return 400; another user's child returns 404 (`ChildAccessService.assertOwned`).
- Syncable child-scoped writes are `PUT` with a client UUID in the path and `clientUpdatedAt` in the body; last-write-wins via `resolveLww`; response carries `sync: { superseded: boolean }`; reads accept `updatedSince`.
- Admin routes use `@Roles('ADMIN')`; a PARENT gets 403 `FORBIDDEN`.
- Admins never see per-child health data: admin stats are aggregate counts only.
- No payments, doctors, consultations, grants, `pro-web` or school lunch in this plan.
- After every endpoint change run `pnpm --filter api export:openapi` and commit `packages/contracts/openapi.json` in the same commit.
- Commit message format: `<type>(<module>): <summary>`; end with the co-author trailer used in this repo.
- E2E tests need `apps/api/.env.test` (see `apps/api/README.md`) and Postgres running (`pnpm db:up`). Run with `pnpm --filter api test:e2e -- <name>`; unit tests with `pnpm --filter api test -- <name>`.

## File Structure

```
apps/api/prisma/schema.prisma                     modify: 3 enums, NutritionLog, Article, User.disabledAt
apps/api/prisma/migrations/<ts>_phase2_engagement/  generated
apps/api/src/common/page-query.ts                 create: shared page/limit query DTO
apps/api/src/nutrition-log/
  nutrition-log.controller.ts                     DTOs + routes
  nutrition-log.service.ts                        upsert/list/remove/summary
  nutrition-log.summary.ts                        pure summarize()
  nutrition-log.summary.spec.ts
  nutrition-log.module.ts
apps/api/src/article/
  article.controller.ts                           public routes + admin routes + DTOs
  article.service.ts
  article.module.ts
apps/api/src/admin/
  admin.controller.ts                             stats + users routes + DTOs
  admin.service.ts
  admin.module.ts
apps/api/src/vaccination/admin-vaccine.controller.ts   create
apps/api/src/vaccination/admin-vaccine.service.ts      create
apps/api/src/auth/auth.service.ts, token.service.ts    modify: block disabled users
apps/api/src/app.module.ts                        modify: register 3 modules
apps/api/test/{nutrition-log,article,admin,admin-vaccine}.e2e-spec.ts
```

---

### Task B1: Schema migration for 2A, 2B, 2C

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Create: `apps/api/prisma/migrations/<timestamp>_phase2_engagement/migration.sql` (generated)

**Interfaces:**
- Produces: Prisma models `NutritionLog`, `Article`; enums `EatenStatus`, `ArticleKind`, `ArticleStatus`; field `User.disabledAt: DateTime | null`.

- [ ] **Step 1: Add enums and models**

Append to `apps/api/prisma/schema.prisma` after the `NotificationType` enum:

```prisma
enum EatenStatus {
  FULL
  PARTIAL
  SKIPPED
}
enum ArticleKind {
  ARTICLE
  TIP
  PAGE
}
enum ArticleStatus {
  DRAFT
  PUBLISHED
}
```

Append at the end of the file:

```prisma
model NutritionLog {
  id              String      @id // client UUID
  childId         String
  date            DateTime    @db.Date
  slot            MealSlot
  eatenStatus     EatenStatus
  percent         Int?
  notes           String?
  clientUpdatedAt DateTime
  createdAt       DateTime    @default(now())
  updatedAt       DateTime    @updatedAt
  child           Child       @relation(fields: [childId], references: [id], onDelete: Cascade)
  @@unique([childId, date, slot])
  @@index([childId, date])
}

model Article {
  id           String        @id @default(uuid())
  kind         ArticleKind   @default(ARTICLE)
  slug         String        @unique
  title        String
  summary      String
  body         String
  category     String
  ageMinMonths Int?
  ageMaxMonths Int?
  coverUrl     String?
  status       ArticleStatus @default(DRAFT)
  publishedAt  DateTime?
  authorId     String?
  createdAt    DateTime      @default(now())
  updatedAt    DateTime      @updatedAt
  author       User?         @relation(fields: [authorId], references: [id], onDelete: SetNull)
  @@index([status, kind, category])
}
```

In `model User` add two lines: `disabledAt DateTime?` (after `emailVerifiedAt`) and `articles Article[]` (after `notificationPreferences`). In `model Child` add `nutritionLogs NutritionLog[]` next to the other relation lists.

- [ ] **Step 2: Generate the migration and client**

Run: `pnpm --filter api exec prisma migrate dev --name phase2_engagement`
Expected: a new folder under `apps/api/prisma/migrations/` and "Your database is now in sync with your schema." If `prisma validate` complains about a missing opposite relation, add the missing field named in the error.

- [ ] **Step 3: Verify the build and existing tests**

Run: `pnpm --filter api build && pnpm --filter api test:e2e -- user`
Expected: build succeeds; the `user` e2e suite passes (nothing else changed).

- [ ] **Step 4: Commit**

```bash
git add apps/api/prisma
git commit -m "feat(contracts): schema for nutrition logs, articles and disabled users"
```

---

### Task B2: Nutrition logging (2A)

**Files:**
- Create: `apps/api/src/nutrition-log/nutrition-log.summary.ts`, `nutrition-log.summary.spec.ts`, `nutrition-log.service.ts`, `nutrition-log.controller.ts`, `nutrition-log.module.ts`
- Modify: `apps/api/src/app.module.ts`
- Test: `apps/api/test/nutrition-log.e2e-spec.ts`

**Interfaces:**
- Consumes: `ChildAccessService.assertOwned(userId, childId): Promise<Child>`, `resolveLww(existing, incoming): { apply, superseded }`, `ApiError`.
- Produces (HTTP):
  - `PUT /v1/children/:childId/nutrition-logs/:logId` body `{ date, slot, eatenStatus, percent?, notes?, clientUpdatedAt }` → 200 `{ data: NutritionLogView, sync: { superseded } }`.
  - `GET /v1/children/:childId/nutrition-logs?from&to&updatedSince` → `NutritionLogView[]` (`from`/`to` are `YYYY-MM-DD`, max span 92 days; omit both to use `updatedSince` only).
  - `DELETE /v1/children/:childId/nutrition-logs/:logId` → 204.
  - `GET /v1/children/:childId/nutrition-logs/summary?from&to` → `NutritionSummary`.
  - `NutritionLogView = { id, date: 'YYYY-MM-DD', slot, eatenStatus, percent: number|null, notes: string|null, clientUpdatedAt }`.
  - `NutritionSummary = { from, to, plannedCount, loggedCount, fullCount, partialCount, skippedCount, loggedPercent: number|null, eatenPercent: number|null, perSlot: { slot, logged, full, partial, skipped }[] }`.
- Error codes: 400 `INVALID_PERCENT`, 400 `DATE_BEFORE_BIRTH`, 400 `RANGE_TOO_LARGE`, 409 `ID_IN_USE`, 409 `LOG_EXISTS` (another log id already holds that child/date/slot; `details: { id }` is the existing id).

- [ ] **Step 1: Write the failing unit test for the summary maths**

Create `apps/api/src/nutrition-log/nutrition-log.summary.spec.ts`:

```ts
import { summarize } from './nutrition-log.summary';

describe('summarize', () => {
  it('returns nulls when nothing is logged', () => {
    const s = summarize([], 0);
    expect(s).toMatchObject({
      loggedCount: 0,
      loggedPercent: null,
      eatenPercent: null,
      perSlot: [],
    });
  });

  it('counts statuses and weights partial meals by percent', () => {
    const s = summarize(
      [
        { slot: 'BREAKFAST', eatenStatus: 'FULL', percent: null },
        { slot: 'LUNCH', eatenStatus: 'PARTIAL', percent: 50 },
        { slot: 'DINNER', eatenStatus: 'SKIPPED', percent: null },
      ],
      6,
    );
    expect(s.loggedCount).toBe(3);
    expect(s.fullCount).toBe(1);
    expect(s.partialCount).toBe(1);
    expect(s.skippedCount).toBe(1);
    expect(s.plannedCount).toBe(6);
    expect(s.loggedPercent).toBe(50); // 3 of 6 planned meals were logged
    expect(s.eatenPercent).toBe(50); // (1 + 0.5 + 0) / 3
    expect(s.perSlot).toEqual([
      { slot: 'BREAKFAST', logged: 1, full: 1, partial: 0, skipped: 0 },
      { slot: 'LUNCH', logged: 1, full: 0, partial: 1, skipped: 0 },
      { slot: 'DINNER', logged: 1, full: 0, partial: 0, skipped: 1 },
    ]);
  });

  it('leaves loggedPercent null when nothing was planned', () => {
    const s = summarize(
      [{ slot: 'LUNCH', eatenStatus: 'FULL', percent: null }],
      0,
    );
    expect(s.loggedPercent).toBeNull();
    expect(s.eatenPercent).toBe(100);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter api test -- nutrition-log.summary`
Expected: FAIL — "Cannot find module './nutrition-log.summary'".

- [ ] **Step 3: Implement `summarize`**

Create `apps/api/src/nutrition-log/nutrition-log.summary.ts`:

```ts
import { EatenStatus, MealSlot } from '@prisma/client';

export type LogLike = {
  slot: MealSlot;
  eatenStatus: EatenStatus;
  percent: number | null;
};

const SLOT_ORDER: MealSlot[] = [
  'BREAKFAST',
  'MORNING_SNACK',
  'LUNCH',
  'AFTERNOON_SNACK',
  'DINNER',
];

export function summarize(logs: LogLike[], plannedCount: number) {
  let full = 0;
  let partial = 0;
  let skipped = 0;
  let eaten = 0;
  const slots = new Map<
    MealSlot,
    { logged: number; full: number; partial: number; skipped: number }
  >();
  for (const l of logs) {
    const s = slots.get(l.slot) ?? { logged: 0, full: 0, partial: 0, skipped: 0 };
    s.logged++;
    if (l.eatenStatus === 'FULL') {
      full++;
      s.full++;
      eaten += 1;
    } else if (l.eatenStatus === 'PARTIAL') {
      partial++;
      s.partial++;
      eaten += (l.percent ?? 50) / 100;
    } else {
      skipped++;
      s.skipped++;
    }
    slots.set(l.slot, s);
  }
  const logged = logs.length;
  return {
    plannedCount,
    loggedCount: logged,
    fullCount: full,
    partialCount: partial,
    skippedCount: skipped,
    loggedPercent: plannedCount
      ? Math.min(100, Math.round((100 * logged) / plannedCount))
      : null,
    eatenPercent: logged ? Math.round((100 * eaten) / logged) : null,
    perSlot: SLOT_ORDER.filter((slot) => slots.has(slot)).map((slot) => ({
      slot,
      ...slots.get(slot)!,
    })),
  };
}
```

Note: the expected `perSlot` in the test lists BREAKFAST, LUNCH, DINNER — that matches `SLOT_ORDER` filtered to present slots.

- [ ] **Step 4: Run the unit test to verify it passes**

Run: `pnpm --filter api test -- nutrition-log.summary`
Expected: PASS (3 tests).

- [ ] **Step 5: Write the failing e2e test**

Create `apps/api/test/nutrition-log.e2e-spec.ts`:

```ts
import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'crypto';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp, registerAndLogin, resetDb } from './helpers';

describe('nutrition logs', () => {
  let app: INestApplication;
  const http = () => request(app.getHttpServer());
  beforeAll(async () => (app = await createTestApp()));
  beforeEach(() => resetDb(app.get(PrismaService)));
  afterAll(() => app.close());

  async function setup(email = 'parent@example.com') {
    const p = await registerAndLogin(app, email);
    const auth = { Authorization: `Bearer ${p.token}` };
    const child = (
      await http()
        .post('/v1/children')
        .set(auth)
        .send({ name: 'Rahim', dateOfBirth: '2024-03-01', gender: 'MALE' })
    ).body;
    const put = (id: string, body: object) =>
      http()
        .put(`/v1/children/${child.id}/nutrition-logs/${id}`)
        .set(auth)
        .send(body);
    return { auth, child, put };
  }

  const base = {
    date: '2025-06-10',
    slot: 'LUNCH',
    eatenStatus: 'FULL',
    clientUpdatedAt: '2025-06-10T10:00:00Z',
  };

  it('creates a log and is idempotent on retry', async () => {
    const { put, auth, child } = await setup();
    const id = randomUUID();
    const first = await put(id, base).expect(200);
    expect(first.body.data).toMatchObject({ id, slot: 'LUNCH', percent: null });
    expect(first.body.sync.superseded).toBe(false);
    await put(id, base).expect(200);
    const list = await http()
      .get(`/v1/children/${child.id}/nutrition-logs?from=2025-06-01&to=2025-06-30`)
      .set(auth)
      .expect(200);
    expect(list.body).toHaveLength(1);
  });

  it('requires percent exactly when the meal was partly eaten', async () => {
    const { put } = await setup();
    await put(randomUUID(), { ...base, eatenStatus: 'PARTIAL' }).expect(400);
    await put(randomUUID(), { ...base, eatenStatus: 'FULL', percent: 50 }).expect(
      400,
    );
    const ok = await put(randomUUID(), {
      ...base,
      eatenStatus: 'PARTIAL',
      percent: 40,
    }).expect(200);
    expect(ok.body.data.percent).toBe(40);
  });

  it('keeps the newer write and flags the stale one as superseded', async () => {
    const { put } = await setup();
    const id = randomUUID();
    await put(id, { ...base, clientUpdatedAt: '2025-06-10T12:00:00Z' }).expect(200);
    const stale = await put(id, {
      ...base,
      eatenStatus: 'SKIPPED',
      clientUpdatedAt: '2025-06-10T11:00:00Z',
    }).expect(200);
    expect(stale.body.sync.superseded).toBe(true);
    expect(stale.body.data.eatenStatus).toBe('FULL');
  });

  it('rejects a second log id for the same slot and a date before birth', async () => {
    const { put } = await setup();
    const first = randomUUID();
    await put(first, base).expect(200);
    const clash = await put(randomUUID(), base).expect(409);
    expect(clash.body.code).toBe('LOG_EXISTS');
    expect(clash.body.details.id).toBe(first);
    const early = await put(randomUUID(), { ...base, date: '2023-01-01' }).expect(
      400,
    );
    expect(early.body.code).toBe('DATE_BEFORE_BIRTH');
  });

  it("returns 404 for another parent's child and 204 on delete", async () => {
    const a = await setup('a@example.com');
    const b = await registerAndLogin(app, 'b@example.com');
    await http()
      .put(`/v1/children/${a.child.id}/nutrition-logs/${randomUUID()}`)
      .set({ Authorization: `Bearer ${b.token}` })
      .send(base)
      .expect(404);
    const id = randomUUID();
    await a.put(id, base).expect(200);
    await http()
      .delete(`/v1/children/${a.child.id}/nutrition-logs/${id}`)
      .set(a.auth)
      .expect(204);
  });

  it('summarises a range and rejects spans over 92 days', async () => {
    const { put, auth, child } = await setup();
    await put(randomUUID(), base).expect(200);
    await put(randomUUID(), {
      ...base,
      slot: 'DINNER',
      eatenStatus: 'PARTIAL',
      percent: 50,
    }).expect(200);
    const s = await http()
      .get(
        `/v1/children/${child.id}/nutrition-logs/summary?from=2025-06-01&to=2025-06-30`,
      )
      .set(auth)
      .expect(200);
    expect(s.body).toMatchObject({
      loggedCount: 2,
      fullCount: 1,
      partialCount: 1,
      eatenPercent: 75,
    });
    const big = await http()
      .get(
        `/v1/children/${child.id}/nutrition-logs/summary?from=2025-01-01&to=2025-12-31`,
      )
      .set(auth)
      .expect(400);
    expect(big.body.code).toBe('RANGE_TOO_LARGE');
  });
});
```

- [ ] **Step 6: Run it to verify it fails**

Run: `pnpm --filter api test:e2e -- nutrition-log`
Expected: FAIL — 404 on every route (module not registered yet).

- [ ] **Step 7: Implement the service**

Create `apps/api/src/nutrition-log/nutrition-log.service.ts`:

```ts
import { Injectable } from '@nestjs/common';
import { EatenStatus, MealSlot, NutritionLog } from '@prisma/client';
import { ApiError, conflict } from '../common/api-error';
import { resolveLww } from '../common/lww';
import { ChildAccessService } from '../child/child-access.service';
import { PrismaService } from '../prisma/prisma.service';
import { summarize } from './nutrition-log.summary';

const iso = (d: Date) => d.toISOString().slice(0, 10);
const day = (s: string) => new Date(`${s}T00:00:00Z`);
const MAX_SPAN_DAYS = 92;

export type UpsertLogInput = {
  date: string;
  slot: MealSlot;
  eatenStatus: EatenStatus;
  percent?: number;
  notes?: string;
  clientUpdatedAt: string;
};

@Injectable()
export class NutritionLogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: ChildAccessService,
  ) {}

  private view(l: NutritionLog) {
    return {
      id: l.id,
      date: iso(l.date),
      slot: l.slot,
      eatenStatus: l.eatenStatus,
      percent: l.percent,
      notes: l.notes,
      clientUpdatedAt: l.clientUpdatedAt,
    };
  }

  private checkRange(from: string, to: string) {
    const span = (day(to).getTime() - day(from).getTime()) / 86_400_000;
    if (span < 0 || span > MAX_SPAN_DAYS)
      throw new ApiError(
        400,
        'RANGE_TOO_LARGE',
        `Choose a range of at most ${MAX_SPAN_DAYS} days`,
      );
  }

  async upsert(
    userId: string,
    childId: string,
    logId: string,
    dto: UpsertLogInput,
  ) {
    const child = await this.access.assertOwned(userId, childId);
    const needsPercent = dto.eatenStatus === 'PARTIAL';
    if (needsPercent !== (dto.percent !== undefined))
      throw new ApiError(
        400,
        'INVALID_PERCENT',
        'Give a percent (1-99) only when the meal was partly eaten',
      );
    if (day(dto.date) < child.dateOfBirth)
      throw new ApiError(
        400,
        'DATE_BEFORE_BIRTH',
        'Log date is before the date of birth',
      );
    const existing = await this.prisma.nutritionLog.findUnique({
      where: { id: logId },
    });
    if (existing && existing.childId !== childId)
      throw new ApiError(409, 'ID_IN_USE', 'This id belongs to another log');
    const holder = await this.prisma.nutritionLog.findUnique({
      where: {
        childId_date_slot: {
          childId,
          date: day(dto.date),
          slot: dto.slot,
        },
      },
    });
    if (holder && holder.id !== logId)
      throw conflict(
        'LOG_EXISTS',
        'This meal slot already has a log',
        { id: holder.id },
      );
    const { apply, superseded } = resolveLww(
      existing,
      new Date(dto.clientUpdatedAt),
    );
    const data = {
      date: day(dto.date),
      slot: dto.slot,
      eatenStatus: dto.eatenStatus,
      percent: dto.percent ?? null,
      notes: dto.notes ?? null,
      clientUpdatedAt: new Date(dto.clientUpdatedAt),
    };
    const row = apply
      ? await this.prisma.nutritionLog.upsert({
          where: { id: logId },
          create: { id: logId, childId, ...data },
          update: data,
        })
      : existing!;
    return { data: this.view(row), sync: { superseded } };
  }

  async list(
    userId: string,
    childId: string,
    q: { from?: string; to?: string; updatedSince?: string },
  ) {
    await this.access.assertOwned(userId, childId);
    if (q.from && q.to) this.checkRange(q.from, q.to);
    const rows = await this.prisma.nutritionLog.findMany({
      where: {
        childId,
        ...(q.from ? { date: { gte: day(q.from), ...(q.to ? { lte: day(q.to) } : {}) } } : {}),
        ...(q.updatedSince ? { updatedAt: { gt: new Date(q.updatedSince) } } : {}),
      },
      orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
    });
    return rows.map((r) => this.view(r));
  }

  async remove(userId: string, childId: string, logId: string) {
    await this.access.assertOwned(userId, childId);
    await this.prisma.nutritionLog.deleteMany({ where: { id: logId, childId } });
  }

  async summary(userId: string, childId: string, from: string, to: string) {
    await this.access.assertOwned(userId, childId);
    this.checkRange(from, to);
    const range = { gte: day(from), lte: day(to) };
    const [logs, plannedCount] = await Promise.all([
      this.prisma.nutritionLog.findMany({ where: { childId, date: range } }),
      this.prisma.mealPlanEntry.count({ where: { childId, date: range } }),
    ]);
    return { from, to, ...summarize(logs, plannedCount) };
  }
}
```

- [ ] **Step 8: Implement controller and module, register in `AppModule`**

Create `apps/api/src/nutrition-log/nutrition-log.controller.ts`:

```ts
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Put,
  Query,
} from '@nestjs/common';
import { EatenStatus, MealSlot } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { type AuthUser, CurrentUser } from '../common/current-user';
import { NutritionLogService } from './nutrition-log.service';

class NutritionLogDto {
  @IsDateString() date!: string;
  @IsEnum(MealSlot) slot!: MealSlot;
  @IsEnum(EatenStatus) eatenStatus!: EatenStatus;
  @IsOptional() @IsInt() @Min(1) @Max(99) percent?: number;
  @IsOptional() @IsString() @MaxLength(500) notes?: string;
  @IsDateString() clientUpdatedAt!: string;
}
class LogRangeQuery {
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) from?: string;
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) to?: string;
  @IsOptional() @IsDateString() updatedSince?: string;
}
class SummaryQuery {
  @Matches(/^\d{4}-\d{2}-\d{2}$/) from!: string;
  @Matches(/^\d{4}-\d{2}-\d{2}$/) to!: string;
}

@Controller('children/:childId/nutrition-logs')
export class NutritionLogController {
  constructor(private readonly logs: NutritionLogService) {}

  @Get('summary') summary(
    @CurrentUser() u: AuthUser,
    @Param('childId', ParseUUIDPipe) c: string,
    @Query() q: SummaryQuery,
  ) {
    return this.logs.summary(u.id, c, q.from, q.to);
  }

  @Put(':logId') put(
    @CurrentUser() u: AuthUser,
    @Param('childId', ParseUUIDPipe) c: string,
    @Param('logId', ParseUUIDPipe) l: string,
    @Body() b: NutritionLogDto,
  ) {
    return this.logs.upsert(u.id, c, l, b);
  }

  @Get() list(
    @CurrentUser() u: AuthUser,
    @Param('childId', ParseUUIDPipe) c: string,
    @Query() q: LogRangeQuery,
  ) {
    return this.logs.list(u.id, c, q);
  }

  @Delete(':logId') @HttpCode(204) del(
    @CurrentUser() u: AuthUser,
    @Param('childId', ParseUUIDPipe) c: string,
    @Param('logId', ParseUUIDPipe) l: string,
  ) {
    return this.logs.remove(u.id, c, l);
  }
}
```

Create `apps/api/src/nutrition-log/nutrition-log.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { ChildModule } from '../child/child.module';
import { NutritionLogController } from './nutrition-log.controller';
import { NutritionLogService } from './nutrition-log.service';

@Module({
  imports: [ChildModule],
  controllers: [NutritionLogController],
  providers: [NutritionLogService],
})
export class NutritionLogModule {}
```

In `apps/api/src/app.module.ts` add `import { NutritionLogModule } from './nutrition-log/nutrition-log.module';` and add `NutritionLogModule` to `imports` after `NutritionModule`.

- [ ] **Step 9: Run tests to verify they pass**

Run: `pnpm --filter api test -- nutrition-log && pnpm --filter api test:e2e -- nutrition-log`
Expected: PASS (3 unit, 6 e2e). If the 40% partial test fails with 400, check that `percent` is validated as an integer.

- [ ] **Step 10: Regenerate the contract and commit**

```bash
pnpm --filter api export:openapi
git add apps/api packages/contracts
git commit -m "feat(nutrition-log): meal intake logging with sync, summary and adherence"
```

---

### Task B3: Content / articles (2B)

**Files:**
- Create: `apps/api/src/common/page-query.ts`, `apps/api/src/article/article.service.ts`, `article.controller.ts`, `article.module.ts`
- Modify: `apps/api/src/app.module.ts`
- Test: `apps/api/test/article.e2e-spec.ts`

**Interfaces:**
- Consumes: `@Roles('ADMIN')`, `CurrentUser`, `ApiError`, `notFound`.
- Produces:
  - `PageQuery` (`page` default 1, `limit` default 20, max 100) in `apps/api/src/common/page-query.ts` — reused by Task B4.
  - `GET /v1/articles?kind&category&ageMonths&q&page&limit` → `{ items: ArticleSummary[], total, page, limit }` (PUBLISHED only).
  - `GET /v1/articles/:slug` → `ArticleDetail` (PUBLISHED only, else 404).
  - Admin (ADMIN only): `GET /v1/admin/articles?status&kind&page&limit`, `GET /v1/admin/articles/:id`, `POST /v1/admin/articles`, `PATCH /v1/admin/articles/:id`, `DELETE /v1/admin/articles/:id` (204).
  - `ArticleSummary = { id, kind, slug, title, summary, category, ageMinMonths, ageMaxMonths, coverUrl, status, publishedAt }`; `ArticleDetail = ArticleSummary & { body }`.
  - Error codes: 409 `SLUG_TAKEN`, 400 `INVALID_AGE_RANGE`.

- [ ] **Step 1: Write the failing e2e test**

Create `apps/api/test/article.e2e-spec.ts`:

```ts
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp, makeAdmin, registerAndLogin, resetDb } from './helpers';

describe('articles', () => {
  let app: INestApplication;
  const http = () => request(app.getHttpServer());
  beforeAll(async () => (app = await createTestApp()));
  beforeEach(() => resetDb(app.get(PrismaService)));
  afterAll(() => app.close());

  const draft = {
    kind: 'ARTICLE',
    slug: 'starting-solids',
    title: 'Starting solids',
    summary: 'When and how to begin',
    body: '# Starting solids\n\nAround 6 months.',
    category: 'feeding',
    ageMinMonths: 6,
    ageMaxMonths: 12,
  };

  async function setup() {
    const admin = await makeAdmin(app);
    const parent = await registerAndLogin(app);
    return {
      a: { Authorization: `Bearer ${admin.token}` },
      p: { Authorization: `Bearer ${parent.token}` },
    };
  }

  it('hides drafts from parents until published', async () => {
    const { a, p } = await setup();
    const created = await http().post('/v1/admin/articles').set(a).send(draft).expect(201);
    expect(created.body.status).toBe('DRAFT');
    expect(created.body.publishedAt).toBeNull();

    let list = await http().get('/v1/articles').set(p).expect(200);
    expect(list.body.total).toBe(0);
    await http().get('/v1/articles/starting-solids').set(p).expect(404);

    const pub = await http()
      .patch(`/v1/admin/articles/${created.body.id}`)
      .set(a)
      .send({ status: 'PUBLISHED' })
      .expect(200);
    expect(pub.body.publishedAt).not.toBeNull();

    list = await http().get('/v1/articles').set(p).expect(200);
    expect(list.body.total).toBe(1);
    expect(list.body.items[0]).not.toHaveProperty('body');
    const one = await http().get('/v1/articles/starting-solids').set(p).expect(200);
    expect(one.body.body).toContain('Around 6 months');
  });

  it('filters by age, category, kind and text', async () => {
    const { a, p } = await setup();
    const make = (o: object) =>
      http()
        .post('/v1/admin/articles')
        .set(a)
        .send({ ...draft, status: 'PUBLISHED', ...o })
        .expect(201);
    await make({});
    await make({ slug: 'toddler-snacks', title: 'Toddler snacks', category: 'snacks', ageMinMonths: 12, ageMaxMonths: 36 });
    await make({ slug: 'terms', kind: 'PAGE', title: 'Terms', category: 'legal', ageMinMonths: null, ageMaxMonths: null });
    const ids = async (qs: string) =>
      (await http().get(`/v1/articles?${qs}`).set(p).expect(200)).body.items.map(
        (i: { slug: string }) => i.slug,
      );
    expect((await ids('ageMonths=8')).sort()).toEqual(['starting-solids', 'terms']);
    expect(await ids('ageMonths=24&kind=ARTICLE')).toEqual(['toddler-snacks']);
    expect(await ids('category=snacks')).toEqual(['toddler-snacks']);
    expect(await ids('q=solids')).toEqual(['starting-solids']);
    expect(await ids('kind=PAGE')).toEqual(['terms']);
  });

  it('validates slug, age range and uniqueness', async () => {
    const { a } = await setup();
    await http().post('/v1/admin/articles').set(a).send({ ...draft, slug: 'Bad Slug' }).expect(400);
    const bad = await http()
      .post('/v1/admin/articles')
      .set(a)
      .send({ ...draft, ageMinMonths: 24, ageMaxMonths: 12 })
      .expect(400);
    expect(bad.body.code).toBe('INVALID_AGE_RANGE');
    await http().post('/v1/admin/articles').set(a).send(draft).expect(201);
    const dup = await http().post('/v1/admin/articles').set(a).send(draft).expect(409);
    expect(dup.body.code).toBe('SLUG_TAKEN');
  });

  it('forbids parents from admin routes and supports delete', async () => {
    const { a, p } = await setup();
    await http().post('/v1/admin/articles').set(p).send(draft).expect(403);
    await http().get('/v1/admin/articles').set(p).expect(403);
    const c = await http().post('/v1/admin/articles').set(a).send(draft).expect(201);
    await http().delete(`/v1/admin/articles/${c.body.id}`).set(a).expect(204);
    await http().get(`/v1/admin/articles/${c.body.id}`).set(a).expect(404);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter api test:e2e -- article`
Expected: FAIL — 404 on `/v1/admin/articles`.

- [ ] **Step 3: Shared paging DTO**

Create `apps/api/src/common/page-query.ts`:

```ts
import { Type } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';

export class PageQuery {
  @Type(() => Number) @IsInt() @Min(1) page: number = 1;
  @Type(() => Number) @IsInt() @Min(1) @Max(100) limit: number = 20;
}
```

(`class-transformer` is already used by `hospital.controller.ts`; `configureApp` enables `transform`.)

- [ ] **Step 4: Implement the service**

Create `apps/api/src/article/article.service.ts`:

```ts
import { Injectable } from '@nestjs/common';
import {
  Article,
  ArticleKind,
  ArticleStatus,
  Prisma,
} from '@prisma/client';
import { ApiError, conflict, notFound } from '../common/api-error';
import { PrismaService } from '../prisma/prisma.service';

export type ArticleInput = {
  kind?: ArticleKind;
  slug?: string;
  title?: string;
  summary?: string;
  body?: string;
  category?: string;
  ageMinMonths?: number | null;
  ageMaxMonths?: number | null;
  coverUrl?: string | null;
  status?: ArticleStatus;
};

const summary = (a: Article) => ({
  id: a.id,
  kind: a.kind,
  slug: a.slug,
  title: a.title,
  summary: a.summary,
  category: a.category,
  ageMinMonths: a.ageMinMonths,
  ageMaxMonths: a.ageMaxMonths,
  coverUrl: a.coverUrl,
  status: a.status,
  publishedAt: a.publishedAt,
});
const detail = (a: Article) => ({ ...summary(a), body: a.body });

function assertAgeRange(min?: number | null, max?: number | null) {
  if (min != null && max != null && min > max)
    throw new ApiError(
      400,
      'INVALID_AGE_RANGE',
      'The minimum age must not exceed the maximum age',
    );
}

@Injectable()
export class ArticleService {
  constructor(private readonly prisma: PrismaService) {}

  async listPublic(q: {
    kind?: ArticleKind;
    category?: string;
    ageMonths?: number;
    q?: string;
    page: number;
    limit: number;
  }) {
    const and: Prisma.ArticleWhereInput[] = [];
    if (q.ageMonths !== undefined)
      and.push(
        { OR: [{ ageMinMonths: null }, { ageMinMonths: { lte: q.ageMonths } }] },
        { OR: [{ ageMaxMonths: null }, { ageMaxMonths: { gte: q.ageMonths } }] },
      );
    if (q.q)
      and.push({
        OR: [
          { title: { contains: q.q, mode: 'insensitive' } },
          { summary: { contains: q.q, mode: 'insensitive' } },
        ],
      });
    const where: Prisma.ArticleWhereInput = {
      status: 'PUBLISHED',
      ...(q.kind ? { kind: q.kind } : {}),
      ...(q.category ? { category: q.category } : {}),
      AND: and,
    };
    const [items, total] = await Promise.all([
      this.prisma.article.findMany({
        where,
        orderBy: { publishedAt: 'desc' },
        skip: (q.page - 1) * q.limit,
        take: q.limit,
      }),
      this.prisma.article.count({ where }),
    ]);
    return { items: items.map(summary), total, page: q.page, limit: q.limit };
  }

  async getPublished(slug: string) {
    const a = await this.prisma.article.findFirst({
      where: { slug, status: 'PUBLISHED' },
    });
    if (!a) throw notFound('Article');
    return detail(a);
  }

  async listAdmin(q: {
    status?: ArticleStatus;
    kind?: ArticleKind;
    page: number;
    limit: number;
  }) {
    const where: Prisma.ArticleWhereInput = {
      ...(q.status ? { status: q.status } : {}),
      ...(q.kind ? { kind: q.kind } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.article.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip: (q.page - 1) * q.limit,
        take: q.limit,
      }),
      this.prisma.article.count({ where }),
    ]);
    return { items: items.map(summary), total, page: q.page, limit: q.limit };
  }

  async getAdmin(id: string) {
    const a = await this.prisma.article.findUnique({ where: { id } });
    if (!a) throw notFound('Article');
    return detail(a);
  }

  async create(
    authorId: string,
    dto: Required<Pick<ArticleInput, 'slug' | 'title' | 'summary' | 'body' | 'category'>> &
      ArticleInput,
  ) {
    assertAgeRange(dto.ageMinMonths, dto.ageMaxMonths);
    if (await this.prisma.article.findUnique({ where: { slug: dto.slug } }))
      throw conflict('SLUG_TAKEN', 'An article with this slug already exists');
    const status = dto.status ?? 'DRAFT';
    const a = await this.prisma.article.create({
      data: {
        kind: dto.kind ?? 'ARTICLE',
        slug: dto.slug,
        title: dto.title,
        summary: dto.summary,
        body: dto.body,
        category: dto.category,
        ageMinMonths: dto.ageMinMonths ?? null,
        ageMaxMonths: dto.ageMaxMonths ?? null,
        coverUrl: dto.coverUrl ?? null,
        status,
        publishedAt: status === 'PUBLISHED' ? new Date() : null,
        authorId,
      },
    });
    return detail(a);
  }

  async update(id: string, dto: ArticleInput) {
    const existing = await this.prisma.article.findUnique({ where: { id } });
    if (!existing) throw notFound('Article');
    assertAgeRange(
      dto.ageMinMonths === undefined ? existing.ageMinMonths : dto.ageMinMonths,
      dto.ageMaxMonths === undefined ? existing.ageMaxMonths : dto.ageMaxMonths,
    );
    if (dto.slug && dto.slug !== existing.slug) {
      if (await this.prisma.article.findUnique({ where: { slug: dto.slug } }))
        throw conflict('SLUG_TAKEN', 'An article with this slug already exists');
    }
    let publishedAt: Date | null | undefined;
    if (dto.status === 'PUBLISHED' && !existing.publishedAt)
      publishedAt = new Date();
    if (dto.status === 'DRAFT') publishedAt = null;
    const a = await this.prisma.article.update({
      where: { id },
      data: { ...dto, ...(publishedAt !== undefined ? { publishedAt } : {}) },
    });
    return detail(a);
  }

  async remove(id: string) {
    await this.prisma.article.deleteMany({ where: { id } });
  }
}
```

- [ ] **Step 5: Implement controller and module, register in `AppModule`**

Create `apps/api/src/article/article.controller.ts`:

```ts
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { PartialType } from '@nestjs/swagger';
import { ArticleKind, ArticleStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { type AuthUser, CurrentUser } from '../common/current-user';
import { PageQuery } from '../common/page-query';
import { Roles } from '../common/roles.decorator';
import { ArticleService } from './article.service';

class ListArticlesQuery extends PageQuery {
  @IsOptional() @IsEnum(ArticleKind) kind?: ArticleKind;
  @IsOptional() @IsString() @MaxLength(60) category?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(240) ageMonths?: number;
  @IsOptional() @IsString() @MaxLength(100) q?: string;
}
class AdminListQuery extends PageQuery {
  @IsOptional() @IsEnum(ArticleStatus) status?: ArticleStatus;
  @IsOptional() @IsEnum(ArticleKind) kind?: ArticleKind;
}
class CreateArticleDto {
  @IsOptional() @IsEnum(ArticleKind) kind?: ArticleKind;
  @Matches(/^[a-z0-9]+(-[a-z0-9]+)*$/) @MaxLength(100) slug!: string;
  @IsString() @MinLength(1) @MaxLength(200) title!: string;
  @IsString() @MinLength(1) @MaxLength(500) summary!: string;
  @IsString() @MinLength(1) @MaxLength(50_000) body!: string;
  @IsString() @MinLength(1) @MaxLength(60) category!: string;
  @IsOptional() @IsInt() @Min(0) @Max(240) ageMinMonths?: number | null;
  @IsOptional() @IsInt() @Min(0) @Max(240) ageMaxMonths?: number | null;
  @IsOptional() @IsUrl({ protocols: ['https'], require_protocol: true }) coverUrl?: string | null;
  @IsOptional() @IsEnum(ArticleStatus) status?: ArticleStatus;
}
class UpdateArticleDto extends PartialType(CreateArticleDto) {}

@Controller('articles')
export class ArticleController {
  constructor(private readonly articles: ArticleService) {}
  @Get() list(@Query() q: ListArticlesQuery) {
    return this.articles.listPublic(q);
  }
  @Get(':slug') one(@Param('slug') slug: string) {
    return this.articles.getPublished(slug);
  }
}

@Roles('ADMIN')
@Controller('admin/articles')
export class AdminArticleController {
  constructor(private readonly articles: ArticleService) {}
  @Get() list(@Query() q: AdminListQuery) {
    return this.articles.listAdmin(q);
  }
  @Get(':id') one(@Param('id', ParseUUIDPipe) id: string) {
    return this.articles.getAdmin(id);
  }
  @Post() create(@CurrentUser() u: AuthUser, @Body() b: CreateArticleDto) {
    return this.articles.create(u.id, b);
  }
  @Patch(':id') update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() b: UpdateArticleDto,
  ) {
    return this.articles.update(id, b);
  }
  @Delete(':id') @HttpCode(204) remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.articles.remove(id);
  }
}
```

Create `apps/api/src/article/article.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { AdminArticleController, ArticleController } from './article.controller';
import { ArticleService } from './article.service';

@Module({
  controllers: [ArticleController, AdminArticleController],
  providers: [ArticleService],
})
export class ArticleModule {}
```

Register `ArticleModule` in `apps/api/src/app.module.ts` (import + add to `imports`).

- [ ] **Step 6: Run the tests**

Run: `pnpm --filter api test:e2e -- article`
Expected: PASS (4 tests). Common failure: sending `ageMinMonths: null` in the "filters" test trips `@IsInt()` — `@IsOptional()` already accepts `null`, so this should pass; if not, check the decorator order.

- [ ] **Step 7: Regenerate the contract and commit**

```bash
pnpm --filter api export:openapi
git add apps/api packages/contracts
git commit -m "feat(article): published articles, tips and pages with admin CRUD"
```

---

### Task B4: Admin users and stats (2C)

**Files:**
- Create: `apps/api/src/admin/admin.service.ts`, `admin.controller.ts`, `admin.module.ts`
- Modify: `apps/api/src/auth/auth.service.ts` (`login`, `social`), `apps/api/src/auth/token.service.ts` (`rotate`), `apps/api/src/app.module.ts`
- Test: `apps/api/test/admin.e2e-spec.ts`

**Interfaces:**
- Consumes: `PageQuery` (Task B3), `TokenService.revokeAllFor(userId)` (exported by `AuthModule`), `User.disabledAt` (Task B1).
- Produces (all ADMIN only):
  - `GET /v1/admin/stats` → `{ totalUsers, verifiedUsers, disabledUsers, totalChildren, mealEntriesGenerated, vaccinationsGiven, signupsByDay: { date: 'YYYY-MM-DD', count }[] }` (last 30 days, days with zero signups included).
  - `GET /v1/admin/users?q&role&disabled&page&limit` → `{ items: AdminUser[], total, page, limit }`; `AdminUser = { id, email, role, disabled, emailVerified, childCount, createdAt }`.
  - `PATCH /v1/admin/users/:id` body `{ disabled?: boolean, role?: 'PARENT'|'NUTRITIONIST'|'ADMIN' }` → `AdminUser`.
  - Error codes: 400 `CANNOT_MODIFY_SELF`, 403 `ACCOUNT_DISABLED` (login/social), 401 `ACCOUNT_DISABLED` (refresh), 404 `NOT_FOUND`.
  - Known limit: an already-issued access token stays valid until it expires (`JWT_ACCESS_TTL_SECONDS`, default 900 s); disabling revokes all refresh tokens so no new one can be issued.

- [ ] **Step 1: Write the failing e2e test**

Create `apps/api/test/admin.e2e-spec.ts`:

```ts
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp, makeAdmin, registerAndLogin, resetDb } from './helpers';

describe('admin', () => {
  let app: INestApplication;
  const http = () => request(app.getHttpServer());
  beforeAll(async () => (app = await createTestApp()));
  beforeEach(() => resetDb(app.get(PrismaService)));
  afterAll(() => app.close());

  const bearer = (t: string) => ({ Authorization: `Bearer ${t}` });

  it('forbids parents', async () => {
    const p = await registerAndLogin(app);
    await http().get('/v1/admin/stats').set(bearer(p.token)).expect(403);
    await http().get('/v1/admin/users').set(bearer(p.token)).expect(403);
  });

  it('reports aggregate stats with a zero-filled 30-day signup series', async () => {
    const admin = await makeAdmin(app);
    const p = await registerAndLogin(app, 'p@example.com');
    await http()
      .post('/v1/children')
      .set(bearer(p.token))
      .send({ name: 'Rahim', dateOfBirth: '2024-03-01', gender: 'MALE' })
      .expect(201);
    const res = await http().get('/v1/admin/stats').set(bearer(admin.token)).expect(200);
    expect(res.body).toMatchObject({ totalUsers: 2, totalChildren: 1, disabledUsers: 0 });
    expect(res.body.signupsByDay).toHaveLength(30);
    const today = res.body.signupsByDay.at(-1);
    expect(today.count).toBe(2);
    expect(JSON.stringify(res.body)).not.toContain('Rahim');
  });

  it('lists and filters users', async () => {
    const admin = await makeAdmin(app);
    await registerAndLogin(app, 'alice@example.com');
    await registerAndLogin(app, 'bob@example.com');
    const all = await http().get('/v1/admin/users').set(bearer(admin.token)).expect(200);
    expect(all.body.total).toBe(3);
    const q = await http().get('/v1/admin/users?q=ALI').set(bearer(admin.token)).expect(200);
    expect(q.body.items.map((u: { email: string }) => u.email)).toEqual(['alice@example.com']);
    const admins = await http().get('/v1/admin/users?role=ADMIN').set(bearer(admin.token)).expect(200);
    expect(admins.body.total).toBe(1);
  });

  it('disables a user: no login, no refresh, and can be re-enabled', async () => {
    const admin = await makeAdmin(app);
    const reg = await http()
      .post('/v1/auth/register')
      .send({ email: 'kid@example.com', password: 'password123' })
      .expect(201);
    const { refreshToken } = reg.body as { refreshToken: string };
    const list = await http().get('/v1/admin/users?q=kid').set(bearer(admin.token));
    const id = list.body.items[0].id as string;

    const off = await http()
      .patch(`/v1/admin/users/${id}`)
      .set(bearer(admin.token))
      .send({ disabled: true })
      .expect(200);
    expect(off.body.disabled).toBe(true);

    const login = await http()
      .post('/v1/auth/login')
      .send({ email: 'kid@example.com', password: 'password123' })
      .expect(403);
    expect(login.body.code).toBe('ACCOUNT_DISABLED');
    await http().post('/v1/auth/refresh').send({ refreshToken }).expect(401);

    await http()
      .patch(`/v1/admin/users/${id}`)
      .set(bearer(admin.token))
      .send({ disabled: false })
      .expect(200);
    await http()
      .post('/v1/auth/login')
      .send({ email: 'kid@example.com', password: 'password123' })
      .expect(201);
  });

  it('changes roles but never lets an admin modify themselves', async () => {
    const admin = await makeAdmin(app);
    const me = await http().get('/v1/me').set(bearer(admin.token));
    const self = await http()
      .patch(`/v1/admin/users/${me.body.id}`)
      .set(bearer(admin.token))
      .send({ disabled: true })
      .expect(400);
    expect(self.body.code).toBe('CANNOT_MODIFY_SELF');
    await registerAndLogin(app, 'p@example.com');
    const list = await http().get('/v1/admin/users?q=p@').set(bearer(admin.token));
    const up = await http()
      .patch(`/v1/admin/users/${list.body.items[0].id}`)
      .set(bearer(admin.token))
      .send({ role: 'ADMIN' })
      .expect(200);
    expect(up.body.role).toBe('ADMIN');
  });
});
```

Note: if the existing auth e2e shows login returns 200 rather than 201, change the final `.expect(201)` to match (see `apps/api/test/auth.e2e-spec.ts`); likewise check the refresh body field name there.

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter api test:e2e -- admin.e2e`
Expected: FAIL — 404 on `/v1/admin/stats`.

- [ ] **Step 3: Block disabled users in auth**

In `apps/api/src/auth/auth.service.ts` add `ApiError` is already imported. In `login`, after the password check succeeds and before `return this.tokens.issue(user)`:

```ts
    if (user.disabledAt)
      throw new ApiError(403, 'ACCOUNT_DISABLED', 'This account has been disabled');
```

In `social`, after `user` is resolved (before tokens are issued), add the same check on the resolved user (view the rest of the method and insert before its `this.tokens.issue(...)` call).

In `apps/api/src/auth/token.service.ts`, in `rotate`, after `const user = await this.prisma.user.findUniqueOrThrow(...)`:

```ts
    if (user.disabledAt) throw unauthorized('ACCOUNT_DISABLED');
```

- [ ] **Step 4: Implement the service**

Create `apps/api/src/admin/admin.service.ts`:

```ts
import { Injectable } from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { ApiError, notFound } from '../common/api-error';
import { TokenService } from '../auth/token.service';
import { PrismaService } from '../prisma/prisma.service';

const iso = (d: Date) => d.toISOString().slice(0, 10);

type UserRow = Prisma.UserGetPayload<{ include: { _count: { select: { children: true } } } }>;
const view = (u: UserRow) => ({
  id: u.id,
  email: u.email,
  role: u.role,
  disabled: !!u.disabledAt,
  emailVerified: !!u.emailVerifiedAt,
  childCount: u._count.children,
  createdAt: u.createdAt,
});

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
  ) {}

  async stats() {
    const since = new Date();
    since.setUTCHours(0, 0, 0, 0);
    since.setUTCDate(since.getUTCDate() - 29);
    const [
      totalUsers,
      verifiedUsers,
      disabledUsers,
      totalChildren,
      mealEntriesGenerated,
      vaccinationsGiven,
      signups,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { emailVerifiedAt: { not: null } } }),
      this.prisma.user.count({ where: { disabledAt: { not: null } } }),
      this.prisma.child.count(),
      this.prisma.mealPlanEntry.count({ where: { createdBy: 'SYSTEM' } }),
      this.prisma.childVaccination.count({ where: { givenDate: { not: null } } }),
      this.prisma.$queryRaw<{ d: Date; c: bigint }[]>`
        SELECT date_trunc('day', "createdAt" AT TIME ZONE 'UTC')::date AS d, COUNT(*) AS c
        FROM "User" WHERE "createdAt" >= ${since} GROUP BY 1`,
    ]);
    const byDay = new Map(signups.map((r) => [iso(r.d), Number(r.c)]));
    const signupsByDay = Array.from({ length: 30 }, (_, i) => {
      const d = new Date(since);
      d.setUTCDate(since.getUTCDate() + i);
      return { date: iso(d), count: byDay.get(iso(d)) ?? 0 };
    });
    return {
      totalUsers,
      verifiedUsers,
      disabledUsers,
      totalChildren,
      mealEntriesGenerated,
      vaccinationsGiven,
      signupsByDay,
    };
  }

  async listUsers(q: {
    q?: string;
    role?: Role;
    disabled?: boolean;
    page: number;
    limit: number;
  }) {
    const where: Prisma.UserWhereInput = {
      ...(q.q ? { email: { contains: q.q, mode: 'insensitive' } } : {}),
      ...(q.role ? { role: q.role } : {}),
      ...(q.disabled === undefined
        ? {}
        : { disabledAt: q.disabled ? { not: null } : null }),
    };
    const [rows, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: 'asc' },
        skip: (q.page - 1) * q.limit,
        take: q.limit,
        include: { _count: { select: { children: true } } },
      }),
      this.prisma.user.count({ where }),
    ]);
    return { items: rows.map(view), total, page: q.page, limit: q.limit };
  }

  async updateUser(
    actorId: string,
    id: string,
    dto: { disabled?: boolean; role?: Role },
  ) {
    if (id === actorId)
      throw new ApiError(
        400,
        'CANNOT_MODIFY_SELF',
        'You cannot change your own role or status',
      );
    const existing = await this.prisma.user.findUnique({ where: { id } });
    if (!existing) throw notFound('User');
    const row = await this.prisma.user.update({
      where: { id },
      data: {
        ...(dto.role ? { role: dto.role } : {}),
        ...(dto.disabled === undefined
          ? {}
          : { disabledAt: dto.disabled ? new Date() : null }),
      },
      include: { _count: { select: { children: true } } },
    });
    if (dto.disabled) await this.tokens.revokeAllFor(id);
    return view(row);
  }
}
```

- [ ] **Step 5: Controller, module, registration**

Create `apps/api/src/admin/admin.controller.ts`:

```ts
import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { type AuthUser, CurrentUser } from '../common/current-user';
import { PageQuery } from '../common/page-query';
import { Roles } from '../common/roles.decorator';
import { AdminService } from './admin.service';

class UserListQuery extends PageQuery {
  @IsOptional() @IsString() @MaxLength(100) q?: string;
  @IsOptional() @IsEnum(Role) role?: Role;
  @IsOptional()
  @Transform(({ value }) => (value === 'true' ? true : value === 'false' ? false : value))
  @IsBoolean()
  disabled?: boolean;
}
class UpdateUserDto {
  @IsOptional() @IsBoolean() disabled?: boolean;
  @IsOptional() @IsEnum(Role) role?: Role;
}

@Roles('ADMIN')
@Controller('admin')
export class AdminController {
  constructor(private readonly admin: AdminService) {}
  @Get('stats') stats() {
    return this.admin.stats();
  }
  @Get('users') users(@Query() q: UserListQuery) {
    return this.admin.listUsers(q);
  }
  @Patch('users/:id') update(
    @CurrentUser() u: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() b: UpdateUserDto,
  ) {
    return this.admin.updateUser(u.id, id, b);
  }
}
```

Create `apps/api/src/admin/admin.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

@Module({
  imports: [AuthModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
```

Register `AdminModule` in `apps/api/src/app.module.ts`.

- [ ] **Step 6: Run the tests, including the auth suite for regressions**

Run: `pnpm --filter api test:e2e -- admin.e2e && pnpm --filter api test:e2e -- auth`
Expected: PASS. If the two `/v1/admin/*` routes under `@Controller('admin')` conflict with `admin/hospitals/import` or `admin/articles`, they don't — different path segments.

- [ ] **Step 7: Regenerate the contract and commit**

```bash
pnpm --filter api export:openapi
git add apps/api packages/contracts
git commit -m "feat(admin): user management, stats, and disabled-account enforcement"
```

---

### Task B5: Admin vaccine catalogue editing (2C)

**Files:**
- Create: `apps/api/src/vaccination/admin-vaccine.service.ts`, `apps/api/src/vaccination/admin-vaccine.controller.ts`
- Modify: `apps/api/src/vaccination/vaccination.module.ts` (add the controller to `controllers`, the service to `providers`)
- Test: `apps/api/test/admin-vaccine.e2e-spec.ts`

**Interfaces:**
- Produces (ADMIN only):
  - `GET /v1/admin/vaccines` → `AdminVaccine[]`: every `Vaccine` column (`id, code, name, disease, description, availability, isMandatory, priceMinBdt, priceMaxBdt, priceNote, priceUpdatedAt, sourceNote, verified`) plus `schedule: { id, doseNumber, suggestedAgeDays, minAgeDays, maxAgeDays, intervalFromPreviousDays, notes }[]` ordered by dose.
  - `PATCH /v1/admin/vaccines/:id` body (all optional): `name, disease, description, availability, isMandatory, priceMinBdt, priceMaxBdt, priceNote, sourceNote, verified` → `AdminVaccine`. Touching either price field sets `priceUpdatedAt = now`.
  - `PATCH /v1/admin/vaccine-schedule-items/:id` body (all optional): `suggestedAgeDays, minAgeDays, maxAgeDays (nullable), intervalFromPreviousDays (nullable), notes (nullable)` → the updated item.
  - Error codes: 400 `INVALID_PRICE_RANGE`, 400 `INVALID_AGE_WINDOW`, 404 `NOT_FOUND`.
  - Behaviour note: editing the schedule does **not** regenerate due dates of existing children; due dates are generated when a child is created or the date of birth changes.

- [ ] **Step 1: Write the failing e2e test**

Create `apps/api/test/admin-vaccine.e2e-spec.ts`:

```ts
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp, makeAdmin, registerAndLogin, resetDb } from './helpers';

describe('admin vaccines', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const http = () => request(app.getHttpServer());
  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });
  beforeEach(() => resetDb(prisma));
  afterAll(() => app.close());

  async function seed() {
    const v = await prisma.vaccine.create({
      data: {
        code: 'BCG',
        name: 'BCG',
        disease: 'Tuberculosis',
        description: 'At birth',
        availability: 'GOVERNMENT_FREE',
        sourceNote: 'EPI schedule',
        schedule: {
          create: [{ doseNumber: 1, suggestedAgeDays: 0, minAgeDays: 0, maxAgeDays: 365 }],
        },
      },
      include: { schedule: true },
    });
    const admin = await makeAdmin(app);
    return { v, a: { Authorization: `Bearer ${admin.token}` } };
  }

  it('lists vaccines with their schedule and forbids parents', async () => {
    const { a } = await seed();
    const list = await http().get('/v1/admin/vaccines').set(a).expect(200);
    expect(list.body[0]).toMatchObject({ code: 'BCG', verified: false });
    expect(list.body[0].schedule).toHaveLength(1);
    const p = await registerAndLogin(app, 'p@example.com');
    await http()
      .get('/v1/admin/vaccines')
      .set({ Authorization: `Bearer ${p.token}` })
      .expect(403);
  });

  it('updates fields, stamps the price date and validates the price range', async () => {
    const { v, a } = await seed();
    const ok = await http()
      .patch(`/v1/admin/vaccines/${v.id}`)
      .set(a)
      .send({ verified: true, priceMinBdt: 300, priceMaxBdt: 500 })
      .expect(200);
    expect(ok.body.verified).toBe(true);
    expect(ok.body.priceUpdatedAt).not.toBeNull();
    const bad = await http()
      .patch(`/v1/admin/vaccines/${v.id}`)
      .set(a)
      .send({ priceMinBdt: 900 })
      .expect(400);
    expect(bad.body.code).toBe('INVALID_PRICE_RANGE');
    await http().patch('/v1/admin/vaccines/00000000-0000-4000-8000-000000000000').set(a).send({}).expect(404);
  });

  it('updates a schedule item and validates the age window', async () => {
    const { v, a } = await seed();
    const item = v.schedule[0];
    const ok = await http()
      .patch(`/v1/admin/vaccine-schedule-items/${item.id}`)
      .set(a)
      .send({ suggestedAgeDays: 14, maxAgeDays: null, notes: 'Within 2 weeks' })
      .expect(200);
    expect(ok.body).toMatchObject({ suggestedAgeDays: 14, maxAgeDays: null });
    const bad = await http()
      .patch(`/v1/admin/vaccine-schedule-items/${item.id}`)
      .set(a)
      .send({ minAgeDays: 30 })
      .expect(400);
    expect(bad.body.code).toBe('INVALID_AGE_WINDOW');
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter api test:e2e -- admin-vaccine`
Expected: FAIL — 404 on `/v1/admin/vaccines`.

- [ ] **Step 3: Implement the service**

Create `apps/api/src/vaccination/admin-vaccine.service.ts`:

```ts
import { Injectable } from '@nestjs/common';
import { Prisma, VaccineAvailability } from '@prisma/client';
import { ApiError, notFound } from '../common/api-error';
import { PrismaService } from '../prisma/prisma.service';

export type VaccinePatch = {
  name?: string;
  disease?: string;
  description?: string;
  availability?: VaccineAvailability;
  isMandatory?: boolean;
  priceMinBdt?: number | null;
  priceMaxBdt?: number | null;
  priceNote?: string | null;
  sourceNote?: string;
  verified?: boolean;
};
export type ItemPatch = {
  suggestedAgeDays?: number;
  minAgeDays?: number;
  maxAgeDays?: number | null;
  intervalFromPreviousDays?: number | null;
  notes?: string | null;
};

const include = {
  schedule: { orderBy: { doseNumber: 'asc' } },
} satisfies Prisma.VaccineInclude;

@Injectable()
export class AdminVaccineService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.vaccine.findMany({ orderBy: { code: 'asc' }, include });
  }

  async updateVaccine(id: string, dto: VaccinePatch) {
    const v = await this.prisma.vaccine.findUnique({ where: { id } });
    if (!v) throw notFound('Vaccine');
    const min = dto.priceMinBdt === undefined ? v.priceMinBdt : dto.priceMinBdt;
    const max = dto.priceMaxBdt === undefined ? v.priceMaxBdt : dto.priceMaxBdt;
    if (min != null && max != null && min > max)
      throw new ApiError(
        400,
        'INVALID_PRICE_RANGE',
        'The minimum price must not exceed the maximum price',
      );
    const touchedPrice =
      dto.priceMinBdt !== undefined || dto.priceMaxBdt !== undefined;
    return this.prisma.vaccine.update({
      where: { id },
      data: { ...dto, ...(touchedPrice ? { priceUpdatedAt: new Date() } : {}) },
      include,
    });
  }

  async updateItem(id: string, dto: ItemPatch) {
    const item = await this.prisma.vaccineScheduleItem.findUnique({
      where: { id },
    });
    if (!item) throw notFound('Schedule item');
    const suggested = dto.suggestedAgeDays ?? item.suggestedAgeDays;
    const min = dto.minAgeDays ?? item.minAgeDays;
    const max = dto.maxAgeDays === undefined ? item.maxAgeDays : dto.maxAgeDays;
    if (min > suggested || (max != null && max < suggested))
      throw new ApiError(
        400,
        'INVALID_AGE_WINDOW',
        'Ages must satisfy min <= suggested <= max',
      );
    return this.prisma.vaccineScheduleItem.update({ where: { id }, data: dto });
  }
}
```

- [ ] **Step 4: Controller and module wiring**

Create `apps/api/src/vaccination/admin-vaccine.controller.ts`:

```ts
import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
} from '@nestjs/common';
import { VaccineAvailability } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { Roles } from '../common/roles.decorator';
import { AdminVaccineService } from './admin-vaccine.service';

class UpdateVaccineDto {
  @IsOptional() @IsString() @MaxLength(120) name?: string;
  @IsOptional() @IsString() @MaxLength(120) disease?: string;
  @IsOptional() @IsString() @MaxLength(2000) description?: string;
  @IsOptional() @IsEnum(VaccineAvailability) availability?: VaccineAvailability;
  @IsOptional() @IsBoolean() isMandatory?: boolean;
  @IsOptional() @IsInt() @Min(0) priceMinBdt?: number | null;
  @IsOptional() @IsInt() @Min(0) priceMaxBdt?: number | null;
  @IsOptional() @IsString() @MaxLength(500) priceNote?: string | null;
  @IsOptional() @IsString() @MaxLength(500) sourceNote?: string;
  @IsOptional() @IsBoolean() verified?: boolean;
}
class UpdateScheduleItemDto {
  @IsOptional() @IsInt() @Min(0) suggestedAgeDays?: number;
  @IsOptional() @IsInt() @Min(0) minAgeDays?: number;
  @IsOptional() @IsInt() @Min(0) maxAgeDays?: number | null;
  @IsOptional() @IsInt() @Min(0) intervalFromPreviousDays?: number | null;
  @IsOptional() @IsString() @MaxLength(500) notes?: string | null;
}

@Roles('ADMIN')
@Controller('admin')
export class AdminVaccineController {
  constructor(private readonly vaccines: AdminVaccineService) {}
  @Get('vaccines') list() {
    return this.vaccines.list();
  }
  @Patch('vaccines/:id') update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() b: UpdateVaccineDto,
  ) {
    return this.vaccines.updateVaccine(id, b);
  }
  @Patch('vaccine-schedule-items/:id') updateItem(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() b: UpdateScheduleItemDto,
  ) {
    return this.vaccines.updateItem(id, b);
  }
}
```

In `apps/api/src/vaccination/vaccination.module.ts` import both new classes and append `AdminVaccineController` to `controllers` and `AdminVaccineService` to `providers`.

- [ ] **Step 5: Run the tests**

Run: `pnpm --filter api test:e2e -- admin-vaccine && pnpm --filter api test:e2e -- vaccination`
Expected: PASS (3 new tests, existing vaccination suite unchanged).

- [ ] **Step 6: Regenerate the contract and commit**

```bash
pnpm --filter api export:openapi
git add apps/api packages/contracts
git commit -m "feat(vaccination): admin editing of the vaccine catalogue and schedule"
```

---

### Task B6: Integration pass and docs

**Files:**
- Modify: `README.md`, `docs/contract-requests.md`
- Test: full suites

**Interfaces:**
- Consumes: everything above.

- [ ] **Step 1: Run the full suites and lint**

Run: `pnpm --filter api lint && pnpm test && pnpm test:e2e`
Expected: all green. Fix anything the new modules broke (for example a seed or truncation helper that lists tables explicitly — `resetDb` truncates all public tables, so none expected).

- [ ] **Step 2: Confirm the contract is complete**

Run: `pnpm --filter api export:openapi && git diff --stat packages/contracts`
Expected: no diff (already regenerated in each task). Then check the new paths exist:
`grep -c '"/v1/admin/' packages/contracts/openapi.json` → at least 7 matching path keys; also `/v1/articles`, `/v1/articles/{slug}`, `/v1/children/{childId}/nutrition-logs`, `/v1/children/{childId}/nutrition-logs/summary`.

- [ ] **Step 3: Update docs**

In `README.md` add a "Phase 2" section listing the new endpoint groups (nutrition logs, articles, admin) and the admin bootstrap command: an admin is created by registering normally, then `pnpm --filter api exec prisma db execute --stdin <<< "UPDATE \"User\" SET role='ADMIN' WHERE email='you@example.com';"`. In `docs/contract-requests.md` mark the Phase 1 export request "Done" and add a "Phase 2 contract published" entry listing the merged commits.

- [ ] **Step 4: Commit**

```bash
git add README.md docs
git commit -m "docs: Phase 2 endpoints and admin bootstrap"
```
