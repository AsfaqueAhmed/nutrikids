# NutriKids Backend (Phase 0 + Phase 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the NutriKids REST API (Phase 0 foundation plus all Phase 1 modules) and publish a stable OpenAPI contract the web front end can build against.

**Architecture:** NestJS modular monolith under `apps/api`, PostgreSQL via Prisma, JWT access tokens plus rotating refresh tokens. Safety and calculation logic (allergy check, WHO percentiles, nutrition score, vaccine status, plan generation, reminder timing) lives in small pure functions with unit tests; Nest services only wire them to the database. The OpenAPI spec is generated from the code into `packages/contracts/openapi.json`.

**Tech Stack:** Node 24, pnpm 10, NestJS 11, TypeScript (strict), Prisma, PostgreSQL 16 (docker), Jest + Supertest, zod, argon2, web-push, pdfkit, csv-parse, @nestjs/swagger.

Spec: `docs/superpowers/specs/2026-10-18-nutrikids-platform-design.md`.

## Global Constraints

- API prefix `/v1`; JSON only; every error is `{ "code": string, "message": string, "details"?: unknown }`.
- Age is never stored. Use `ageInMonths(dateOfBirth, now)`.
- Allergy rule: severe allergen match is a hard block (`409 ALLERGEN_BLOCKED`, no override); mild/moderate returns `409 ALLERGEN_CONFIRM_REQUIRED` unless the request has `confirmAllergen: true`.
- Allergens are the enum `Allergen`: MILK, EGG, PEANUT, TREE_NUT, WHEAT, SOY, FISH, SHELLFISH, SESAME. Foods carry `allergens Allergen[]`; a child's allergy is `(allergen, severity)`.
- Access to another user's child returns `404 NOT_FOUND` (never 403).
- Sync tables carry a client-supplied UUID `id` and `clientUpdatedAt`; writes are idempotent; last write wins by `clientUpdatedAt`; an older write is not applied and the response sets `sync.superseded = true`.
- Phase 1 has no subscription gating; everything is free.
- Region: Bangladesh. Currency BDT. Default user timezone `Asia/Dhaka`.
- Medical and nutrition reference data (WHO tables, RDA values, vaccine schedule, prices) is **provisional** until approved by a medical advisor. Every such data file carries a `verified: false` marker and a `source` field, and the API exposes `provisional: true` where the value drives a health indicator.
- Test DB: `postgresql://nutrikids:nutrikids@localhost:5433/nutrikids_test`. Integration tests run against a real database, never mocks, and with `--runInBand`.
- Commit after every task using `<type>(<module>): <summary>`.

## File Structure

```
package.json, pnpm-workspace.yaml, docker-compose.yml, .github/workflows/ci.yml
packages/contracts/openapi.json            generated, committed
apps/api/
  prisma/schema.prisma, prisma/migrations/, prisma/seed.ts
  src/main.ts, src/app.module.ts, src/configure-app.ts
  src/config/env.ts
  src/common/{api-error.ts, api-exception.filter.ts, public.decorator.ts, roles.decorator.ts, current-user.ts, age.ts, lww.ts}
  src/prisma/{prisma.module.ts, prisma.service.ts}
  src/health/health.controller.ts
  src/auth/{auth.module.ts, auth.controller.ts, auth.service.ts, token.service.ts, password.service.ts, jwt-auth.guard.ts, roles.guard.ts, mail.service.ts, identity-verifier.ts, dto.ts}
  src/user/{user.module.ts, user.controller.ts, user.service.ts}
  src/food/{food.module.ts, food.controller.ts, food.service.ts, nutrition.ts}
  src/child/{child.module.ts, child.controller.ts, child.service.ts, child-access.service.ts, child.events.ts, dto.ts}
  src/meal/{meal.module.ts, allergy.ts, recipe-nutrition.ts, plan-generator.ts, grocery.ts, recipe.controller.ts, plan.controller.ts, plan.service.ts}
  src/growth/{growth.module.ts, who-lms.ts, growth.service.ts, growth.controller.ts, growth-pdf.ts}
  src/nutrition/{nutrition.module.ts, rda.ts, score.ts, nutrition.controller.ts}
  src/vaccination/{vaccination.module.ts, status.ts, vaccination.service.ts, vaccination.controller.ts}
  src/hospital/{hospital.module.ts, hospital.service.ts, hospital.controller.ts, hospital-csv.ts}
  src/notification/{notification.module.ts, due.ts, push-sender.ts, notification.service.ts, notification.controller.ts, reminder.job.ts}
  scripts/export-openapi.ts
  test/{helpers.ts, jest-e2e.json, *.e2e-spec.ts}
data/who/*.json                            WHO LMS tables
data/seed/{foods.json, recipes.json, vaccines.bd.json, hospitals.bd.csv}
```

---

# PHASE 0 — Foundation

### Task 1: Monorepo, API skeleton, database, CI

**Files:**
- Create: `package.json`, `pnpm-workspace.yaml`, `.gitignore`, `docker-compose.yml`, `.github/workflows/ci.yml`
- Create: `apps/api/**` (via Nest CLI), `apps/api/src/config/env.ts`, `apps/api/src/configure-app.ts`, `apps/api/src/health/health.controller.ts`
- Test: `apps/api/src/config/env.spec.ts`, `apps/api/test/health.e2e-spec.ts`

**Interfaces:**
- Produces: `loadEnv(raw?: NodeJS.ProcessEnv): Env`; `configureApp(app: INestApplication): void` (prefix `v1`, validation pipe, exception filter added in Task 3).

- [ ] **Step 1: Create workspace files**

`package.json`:
```json
{
  "name": "nutrikids",
  "private": true,
  "packageManager": "pnpm@10.33.0",
  "scripts": {
    "db:up": "docker compose up -d --wait",
    "api": "pnpm --filter api",
    "test": "pnpm --filter api test",
    "test:e2e": "pnpm --filter api test:e2e"
  }
}
```
`pnpm-workspace.yaml`:
```yaml
packages:
  - "apps/*"
  - "packages/*"
```
`.gitignore`:
```
node_modules
dist
.env
.env.test
coverage
*.log
.DS_Store
```
`docker-compose.yml`:
```yaml
services:
  db:
    image: postgres:16
    ports: ["5433:5432"]
    environment:
      POSTGRES_USER: nutrikids
      POSTGRES_PASSWORD: nutrikids
      POSTGRES_DB: nutrikids
    volumes:
      - ./docker/initdb:/docker-entrypoint-initdb.d
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U nutrikids"]
      interval: 2s
      retries: 20
```
`docker/initdb/01-test-db.sql`:
```sql
CREATE DATABASE nutrikids_test OWNER nutrikids;
```

- [ ] **Step 2: Generate the Nest app and add dependencies**

Run:
```bash
mkdir -p apps && cd apps && npx @nestjs/cli@11 new api --package-manager pnpm --skip-git --strict && cd ..
pnpm --filter api add @nestjs/config @nestjs/jwt @nestjs/swagger @nestjs/schedule @nestjs/event-emitter @prisma/client class-validator class-transformer zod argon2 web-push pdfkit csv-parse google-auth-library apple-signin-auth
pnpm --filter api add -D prisma @types/web-push @types/pdfkit supertest @types/supertest
```
Expected: `apps/api/package.json` lists the packages; `pnpm --filter api build` succeeds.

- [ ] **Step 3: Write the failing env test**

`apps/api/src/config/env.spec.ts`:
```ts
import { loadEnv } from './env';

describe('loadEnv', () => {
  const base = {
    DATABASE_URL: 'postgresql://u:p@localhost:5433/db',
    JWT_ACCESS_SECRET: 'x'.repeat(32),
  };

  it('applies defaults', () => {
    const env = loadEnv(base);
    expect(env.PORT).toBe(3000);
    expect(env.JWT_ACCESS_TTL_SECONDS).toBe(900);
    expect(env.REFRESH_TTL_DAYS).toBe(30);
  });

  it('rejects a short JWT secret', () => {
    expect(() => loadEnv({ ...base, JWT_ACCESS_SECRET: 'short' })).toThrow();
  });

  it('rejects a missing DATABASE_URL', () => {
    expect(() => loadEnv({ JWT_ACCESS_SECRET: base.JWT_ACCESS_SECRET })).toThrow();
  });
});
```

- [ ] **Step 4: Run it to see it fail**

Run: `pnpm --filter api test -- env.spec`
Expected: FAIL, "Cannot find module './env'".

- [ ] **Step 5: Implement env, configureApp and health**

`apps/api/src/config/env.ts`:
```ts
import { z } from 'zod';

const schema = z.object({
  DATABASE_URL: z.string().url(),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_ACCESS_TTL_SECONDS: z.coerce.number().default(900),
  REFRESH_TTL_DAYS: z.coerce.number().default(30),
  PORT: z.coerce.number().default(3000),
  VAPID_PUBLIC_KEY: z.string().optional(),
  VAPID_PRIVATE_KEY: z.string().optional(),
  VAPID_SUBJECT: z.string().default('mailto:admin@nutrikids.local'),
  GOOGLE_CLIENT_ID: z.string().optional(),
  APPLE_CLIENT_ID: z.string().optional(),
});

export type Env = z.infer<typeof schema>;
export const loadEnv = (raw: NodeJS.ProcessEnv = process.env): Env => schema.parse(raw);
```
`apps/api/src/configure-app.ts`:
```ts
import { INestApplication, ValidationPipe } from '@nestjs/common';

export function configureApp(app: INestApplication): void {
  app.setGlobalPrefix('v1');
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
}
```
`apps/api/src/health/health.controller.ts`:
```ts
import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get()
  get() {
    return { status: 'ok' };
  }
}
```
`apps/api/src/app.module.ts`:
```ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { loadEnv } from './config/env';
import { HealthController } from './health/health.controller';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true, validate: (raw) => loadEnv(raw as NodeJS.ProcessEnv) })],
  controllers: [HealthController],
})
export class AppModule {}
```
`apps/api/src/main.ts`:
```ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureApp } from './configure-app';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  configureApp(app);
  app.enableCors({ origin: true, credentials: true });
  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
```
`apps/api/.env.example`:
```
DATABASE_URL=postgresql://nutrikids:nutrikids@localhost:5433/nutrikids
JWT_ACCESS_SECRET=change-me-change-me-change-me-change-me
```
`apps/api/.env.test`:
```
DATABASE_URL=postgresql://nutrikids:nutrikids@localhost:5433/nutrikids_test
JWT_ACCESS_SECRET=test-secret-test-secret-test-secret-123
```

- [ ] **Step 6: Health e2e test with the shared helper**

`apps/api/test/jest-e2e.json`:
```json
{
  "moduleFileExtensions": ["js", "json", "ts"],
  "rootDir": ".",
  "testEnvironment": "node",
  "testRegex": ".e2e-spec.ts$",
  "transform": { "^.+\\.(t|j)s$": "ts-jest" },
  "setupFiles": ["<rootDir>/setup-env.ts"],
  "testTimeout": 30000
}
```
`apps/api/test/setup-env.ts`:
```ts
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(__dirname, '../.env.test'), override: true });
```
Run `pnpm --filter api add -D dotenv`. `apps/api/test/health.e2e-spec.ts`:
```ts
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/configure-app';

describe('health', () => {
  let app: INestApplication;
  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    configureApp(app);
    await app.init();
  });
  afterAll(() => app.close());

  it('GET /v1/health', async () => {
    await request(app.getHttpServer()).get('/v1/health').expect(200, { status: 'ok' });
  });
});
```
In `apps/api/package.json` set scripts `"test:e2e": "jest --config ./test/jest-e2e.json --runInBand"` (replace the generated one).

- [ ] **Step 7: Run unit and e2e tests**

Run: `pnpm db:up && pnpm test && pnpm test:e2e`
Expected: env spec 3 passed; health e2e 1 passed.

- [ ] **Step 8: CI workflow**

`.github/workflows/ci.yml`:
```yaml
name: ci
on: [push, pull_request]
jobs:
  api:
    runs-on: ubuntu-latest
    services:
      db:
        image: postgres:16
        env: { POSTGRES_USER: nutrikids, POSTGRES_PASSWORD: nutrikids, POSTGRES_DB: nutrikids_test }
        ports: ["5433:5432"]
        options: >-
          --health-cmd "pg_isready -U nutrikids" --health-interval 2s --health-retries 20
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version: 24, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm --filter api build
      - run: pnpm test
      - run: pnpm --filter api exec prisma migrate deploy
        env: { DATABASE_URL: "postgresql://nutrikids:nutrikids@localhost:5433/nutrikids_test" }
      - run: pnpm test:e2e
      - run: pnpm --filter api export:openapi && git diff --exit-code packages/contracts/openapi.json
```
(The last two lines start working after Tasks 2 and 4.)

- [ ] **Step 9: Commit**

```bash
git add -A && git commit -m "chore(api): monorepo, Nest skeleton, env, health, CI"
```

---

### Task 2: Prisma schema and migration

**Files:**
- Create: `apps/api/prisma/schema.prisma`, `apps/api/src/prisma/prisma.service.ts`, `apps/api/src/prisma/prisma.module.ts`, `apps/api/test/helpers.ts`
- Modify: `apps/api/src/app.module.ts` (import `PrismaModule`), `apps/api/package.json`
- Test: `apps/api/test/prisma.e2e-spec.ts`

**Interfaces:**
- Produces: `PrismaService extends PrismaClient` (global module); test helpers `createTestApp(overrides?): Promise<INestApplication>`, `resetDb(prisma: PrismaService): Promise<void>`.

- [ ] **Step 1: Write the schema**

`apps/api/prisma/schema.prisma`:
```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum Role { PARENT NUTRITIONIST ADMIN }
enum Gender { MALE FEMALE }
enum ActivityLevel { SEDENTARY MODERATE ACTIVE }
enum DietType { NON_VEGETARIAN VEGETARIAN VEGAN PESCATARIAN }
enum Severity { MILD MODERATE SEVERE }
enum Allergen { MILK EGG PEANUT TREE_NUT WHEAT SOY FISH SHELLFISH SESAME }
enum MealSlot { BREAKFAST LUNCH MORNING_SNACK AFTERNOON_SNACK DINNER }
enum FeedingType { BREAST FORMULA SOLID }
enum PlanType { DAILY WEEKLY CUSTOM }
enum PlanCreator { PARENT SYSTEM NUTRITIONIST }
enum VaccineAvailability { GOVERNMENT_FREE PRIVATE_PAID BOTH }
enum PaidType { GOVERNMENT PRIVATE }
enum AuthTokenType { VERIFY_EMAIL RESET_PASSWORD }
enum NotificationType { DAILY_PLAN WATER WEEKLY_SCORE GROWTH_REMINDER VACCINE_REMINDER }

model User {
  id              String   @id @default(uuid())
  email           String   @unique
  passwordHash    String?
  role            Role     @default(PARENT)
  emailVerifiedAt DateTime?
  timezone        String   @default("Asia/Dhaka")
  googleSub       String?  @unique
  appleSub        String?  @unique
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  children        Child[]
  refreshTokens   RefreshToken[]
  authTokens      AuthToken[]
  pushSubscriptions PushSubscription[]
  notificationPreferences NotificationPreference[]
}

model RefreshToken {
  id        String    @id @default(uuid())
  userId    String
  familyId  String
  tokenHash String    @unique
  expiresAt DateTime
  usedAt    DateTime?
  revokedAt DateTime?
  createdAt DateTime  @default(now())
  user      User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@index([familyId])
}

model AuthToken {
  id        String        @id @default(uuid())
  userId    String
  type      AuthTokenType
  tokenHash String        @unique
  expiresAt DateTime
  usedAt    DateTime?
  user      User          @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model Child {
  id           String        @id @default(uuid())
  userId       String
  name         String
  dateOfBirth  DateTime      @db.Date
  gender       Gender
  heightCm     Decimal?      @db.Decimal(5, 1)
  weightKg     Decimal?      @db.Decimal(5, 2)
  activityLevel ActivityLevel @default(MODERATE)
  dietType     DietType      @default(NON_VEGETARIAN)
  photoUrl     String?
  createdAt    DateTime      @default(now())
  updatedAt    DateTime      @updatedAt
  user         User          @relation(fields: [userId], references: [id], onDelete: Cascade)
  allergies    ChildAllergy[]
  conditions   ChildCondition[]
  dislikes     FoodDislike[]
  feedingLogs  FeedingLog[]
  introductions FoodIntroduction[]
  growthRecords GrowthRecord[]
  mealPlanEntries MealPlanEntry[]
  groceryChecks GroceryCheck[]
  vaccinations ChildVaccination[]
  mealReminders MealReminder[]
  @@index([userId])
}

model ChildAllergy {
  childId  String
  allergen Allergen
  severity Severity
  child    Child    @relation(fields: [childId], references: [id], onDelete: Cascade)
  @@id([childId, allergen])
}

model ChildCondition {
  id      String @id @default(uuid())
  childId String
  name    String
  child   Child  @relation(fields: [childId], references: [id], onDelete: Cascade)
  @@unique([childId, name])
}

model FoodDislike {
  childId String
  foodId  String
  child   Child  @relation(fields: [childId], references: [id], onDelete: Cascade)
  food    Food   @relation(fields: [foodId], references: [id], onDelete: Cascade)
  @@id([childId, foodId])
}

model Food {
  id             String     @id @default(uuid())
  name           String     @unique
  category       String
  allergens      Allergen[]
  nutrition      Json       // per 100 g: calories, protein, carbs, fat, fiber, iron, calcium, vitaminA, vitaminC, vitaminD, zinc
  ageMinMonths   Int        @default(0)
  ageMaxMonths   Int        @default(144)
  createdAt      DateTime   @default(now())
  updatedAt      DateTime   @updatedAt
  recipeFoods    RecipeFood[]
  dislikes       FoodDislike[]
  introductions  FoodIntroduction[]
  @@index([category])
}

model Recipe {
  id            String     @id @default(uuid())
  name          String     @unique
  instructions  String
  prepMinutes   Int
  ageMinMonths  Int        @default(6)
  ageMaxMonths  Int        @default(144)
  slots         MealSlot[]
  suitableDiets DietType[]
  createdAt     DateTime   @default(now())
  updatedAt     DateTime   @updatedAt
  foods         RecipeFood[]
  entries       MealPlanEntry[]
}

model RecipeFood {
  recipeId  String
  foodId    String
  quantityG Decimal @db.Decimal(8, 1)
  recipe    Recipe  @relation(fields: [recipeId], references: [id], onDelete: Cascade)
  food      Food    @relation(fields: [foodId], references: [id])
  @@id([recipeId, foodId])
}

model MealPlanEntry {
  id              String      @id // client UUID
  childId         String
  date            DateTime    @db.Date
  slot            MealSlot
  recipeId        String
  portion         Decimal     @db.Decimal(4, 2) @default(1)
  createdBy       PlanCreator @default(PARENT)
  clientUpdatedAt DateTime
  createdAt       DateTime    @default(now())
  updatedAt       DateTime    @updatedAt
  child           Child       @relation(fields: [childId], references: [id], onDelete: Cascade)
  recipe          Recipe      @relation(fields: [recipeId], references: [id])
  @@unique([childId, date, slot])
  @@index([childId, date])
}

model GroceryCheck {
  childId         String
  foodId          String
  weekStart       DateTime @db.Date
  checked         Boolean
  clientUpdatedAt DateTime
  child           Child    @relation(fields: [childId], references: [id], onDelete: Cascade)
  @@id([childId, foodId, weekStart])
}

model GrowthRecord {
  id                  String   @id // client UUID
  childId             String
  date                DateTime @db.Date
  heightCm            Decimal? @db.Decimal(5, 1)
  weightKg            Decimal? @db.Decimal(5, 2)
  headCircumferenceCm Decimal? @db.Decimal(4, 1)
  clientUpdatedAt     DateTime
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt
  child               Child    @relation(fields: [childId], references: [id], onDelete: Cascade)
  @@index([childId, date])
}

model FeedingLog {
  id              String      @id // client UUID
  childId         String
  type            FeedingType
  at              DateTime
  durationMinutes Int?
  notes           String?
  clientUpdatedAt DateTime
  updatedAt       DateTime    @updatedAt
  child           Child       @relation(fields: [childId], references: [id], onDelete: Cascade)
  @@index([childId, at])
}

model FoodIntroduction {
  id              String   @id // client UUID
  childId         String
  foodId          String
  introducedOn    DateTime @db.Date
  reaction        String?
  notes           String?
  clientUpdatedAt DateTime
  updatedAt       DateTime @updatedAt
  child           Child    @relation(fields: [childId], references: [id], onDelete: Cascade)
  food            Food     @relation(fields: [foodId], references: [id])
  @@unique([childId, foodId])
}

model Vaccine {
  id             String              @id @default(uuid())
  code           String              @unique
  name           String
  disease        String
  description    String
  availability   VaccineAvailability
  isMandatory    Boolean             @default(false)
  priceMinBdt    Int?
  priceMaxBdt    Int?
  priceNote      String?
  priceUpdatedAt DateTime?
  sourceNote     String
  verified       Boolean             @default(false)
  schedule       VaccineScheduleItem[]
}

model VaccineScheduleItem {
  id                       String   @id @default(uuid())
  vaccineId                String
  doseNumber               Int
  suggestedAgeDays         Int
  minAgeDays               Int
  maxAgeDays               Int?
  intervalFromPreviousDays Int?
  notes                    String?
  vaccine                  Vaccine  @relation(fields: [vaccineId], references: [id], onDelete: Cascade)
  childVaccinations        ChildVaccination[]
  @@unique([vaccineId, doseNumber])
}

model ChildVaccination {
  id              String    @id @default(uuid())
  childId         String
  scheduleItemId  String
  dueDate         DateTime  @db.Date
  givenDate       DateTime? @db.Date
  facilityName    String?
  paidType        PaidType?
  amountPaidBdt   Int?
  batchNo         String?
  notes           String?
  cardPhotoUrl    String?
  clientUpdatedAt DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  child           Child     @relation(fields: [childId], references: [id], onDelete: Cascade)
  scheduleItem    VaccineScheduleItem @relation(fields: [scheduleItemId], references: [id], onDelete: Cascade)
  @@unique([childId, scheduleItemId])
  @@index([childId, dueDate])
}

model Hospital {
  id         String    @id @default(uuid())
  name       String
  type       String
  address    String
  district   String
  lat        Float
  lng        Float
  phone      String?
  services   String[]
  source     String
  verifiedAt DateTime?
  @@unique([name, district])
  @@index([lat, lng])
}

model PushSubscription {
  id       String @id @default(uuid())
  userId   String
  endpoint String @unique
  p256dh   String
  auth     String
  user     User   @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model NotificationPreference {
  userId    String
  type      NotificationType
  enabled   Boolean          @default(true)
  timeOfDay String?          // "HH:mm" in the user's timezone
  user      User             @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@id([userId, type])
}

model MealReminder {
  childId   String
  slot      MealSlot
  timeOfDay String   // "HH:mm" in the user's timezone
  enabled   Boolean  @default(true)
  child     Child    @relation(fields: [childId], references: [id], onDelete: Cascade)
  @@id([childId, slot])
}
```

- [ ] **Step 2: Create the migration**

Run:
```bash
cd apps/api && cp .env.example .env && pnpm prisma migrate dev --name init && cd ../..
```
Expected: `prisma/migrations/<ts>_init/migration.sql` created; client generated.
Then: `DATABASE_URL=postgresql://nutrikids:nutrikids@localhost:5433/nutrikids_test pnpm --filter api exec prisma migrate deploy`.

- [ ] **Step 3: Prisma service and module**

`apps/api/src/prisma/prisma.service.ts`:
```ts
import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect();
  }
  async onModuleDestroy() {
    await this.$disconnect();
  }
}
```
`apps/api/src/prisma/prisma.module.ts`:
```ts
import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global()
@Module({ providers: [PrismaService], exports: [PrismaService] })
export class PrismaModule {}
```
Add `PrismaModule` to `AppModule.imports`.

- [ ] **Step 4: Test helpers and a failing DB test**

`apps/api/test/helpers.ts`:
```ts
import { INestApplication } from '@nestjs/common';
import { Test, TestingModuleBuilder } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/configure-app';
import { PrismaService } from '../src/prisma/prisma.service';

export async function createTestApp(
  customize?: (b: TestingModuleBuilder) => TestingModuleBuilder,
): Promise<INestApplication> {
  let builder = Test.createTestingModule({ imports: [AppModule] });
  if (customize) builder = customize(builder);
  const mod = await builder.compile();
  const app = mod.createNestApplication();
  configureApp(app);
  await app.init();
  return app;
}

export async function resetDb(prisma: PrismaService): Promise<void> {
  const rows = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  if (rows.length === 0) return;
  const list = rows.map((r) => `"${r.tablename}"`).join(', ');
  await prisma.$executeRawUnsafe(`TRUNCATE ${list} RESTART IDENTITY CASCADE`);
}
```
`apps/api/test/prisma.e2e-spec.ts`:
```ts
import { INestApplication } from '@nestjs/common';
import { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp, resetDb } from './helpers';

describe('prisma', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });
  afterAll(() => app.close());

  it('creates and reads a user, then resets', async () => {
    await resetDb(prisma);
    await prisma.user.create({ data: { email: 'a@b.com' } });
    expect(await prisma.user.count()).toBe(1);
    await resetDb(prisma);
    expect(await prisma.user.count()).toBe(0);
  });
});
```

- [ ] **Step 5: Run it**

Run: `pnpm test:e2e`
Expected: health and prisma suites pass.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat(db): Prisma schema, initial migration, test helpers"
```

---

### Task 3: Errors, auth guards, decorators, OpenAPI export

**Files:**
- Create: `apps/api/src/common/{api-error.ts, api-exception.filter.ts, public.decorator.ts, roles.decorator.ts, current-user.ts, age.ts, lww.ts}`, `apps/api/scripts/export-openapi.ts`
- Modify: `apps/api/src/configure-app.ts`, `apps/api/nest-cli.json`, `apps/api/package.json`
- Test: `apps/api/src/common/age.spec.ts`, `apps/api/src/common/lww.spec.ts`, `apps/api/test/errors.e2e-spec.ts`

**Interfaces:**
- Produces:
  - `class ApiError extends HttpException` with `new ApiError(status, code, message, details?)`; helpers `notFound(what?: string)`, `unauthorized(code?: string)`, `conflict(code, message, details?)`.
  - `ageInMonths(dob: Date, now?: Date): number`; `ageInDays(dob: Date, now?: Date): number`.
  - `resolveLww(existing: { clientUpdatedAt: Date } | null, incoming: Date): { apply: boolean; superseded: boolean }`.
  - `@Public()`, `@Roles(...roles: Role[])`, `@CurrentUser()` returning `AuthUser = { id: string; role: Role }`.

- [ ] **Step 1: Failing unit tests**

`apps/api/src/common/age.spec.ts`:
```ts
import { ageInDays, ageInMonths } from './age';

describe('age', () => {
  const now = new Date('2026-03-31T00:00:00Z');
  it('counts whole months', () => {
    expect(ageInMonths(new Date('2025-03-31'), now)).toBe(12);
    expect(ageInMonths(new Date('2025-04-01'), now)).toBe(11);
    expect(ageInMonths(new Date('2026-03-31'), now)).toBe(0);
  });
  it('counts days', () => {
    expect(ageInDays(new Date('2026-03-01'), now)).toBe(30);
  });
});
```
`apps/api/src/common/lww.spec.ts`:
```ts
import { resolveLww } from './lww';

describe('resolveLww', () => {
  const t1 = new Date('2026-01-01T10:00:00Z');
  const t2 = new Date('2026-01-01T11:00:00Z');
  it('applies when nothing exists', () => {
    expect(resolveLww(null, t1)).toEqual({ apply: true, superseded: false });
  });
  it('applies a newer write', () => {
    expect(resolveLww({ clientUpdatedAt: t1 }, t2)).toEqual({ apply: true, superseded: false });
  });
  it('applies an equal timestamp (idempotent replay)', () => {
    expect(resolveLww({ clientUpdatedAt: t1 }, t1)).toEqual({ apply: true, superseded: false });
  });
  it('rejects an older write and flags it superseded', () => {
    expect(resolveLww({ clientUpdatedAt: t2 }, t1)).toEqual({ apply: false, superseded: true });
  });
});
```
Run: `pnpm test -- common` → FAIL (modules missing).

- [ ] **Step 2: Implement the helpers**

`apps/api/src/common/age.ts`:
```ts
const MS_DAY = 86_400_000;

export function ageInMonths(dob: Date, now: Date = new Date()): number {
  let months = (now.getUTCFullYear() - dob.getUTCFullYear()) * 12 + (now.getUTCMonth() - dob.getUTCMonth());
  if (now.getUTCDate() < dob.getUTCDate()) months -= 1;
  return Math.max(0, months);
}

export function ageInDays(dob: Date, now: Date = new Date()): number {
  const start = Date.UTC(dob.getUTCFullYear(), dob.getUTCMonth(), dob.getUTCDate());
  const end = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.floor((end - start) / MS_DAY);
}
```
`apps/api/src/common/lww.ts`:
```ts
export function resolveLww(
  existing: { clientUpdatedAt: Date } | null,
  incoming: Date,
): { apply: boolean; superseded: boolean } {
  if (!existing) return { apply: true, superseded: false };
  if (incoming.getTime() >= existing.clientUpdatedAt.getTime()) return { apply: true, superseded: false };
  return { apply: false, superseded: true };
}
```
`apps/api/src/common/api-error.ts`:
```ts
import { HttpException } from '@nestjs/common';

export class ApiError extends HttpException {
  constructor(
    status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super({ code, message, details }, status);
  }
}

export const notFound = (what = 'Resource') => new ApiError(404, 'NOT_FOUND', `${what} not found`);
export const unauthorized = (code = 'UNAUTHORIZED') => new ApiError(401, code, 'Authentication required');
export const forbidden = (code = 'FORBIDDEN') => new ApiError(403, code, 'Not allowed');
export const conflict = (code: string, message: string, details?: unknown) =>
  new ApiError(409, code, message, details);
```
`apps/api/src/common/api-exception.filter.ts`:
```ts
import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly log = new Logger('Exceptions');

  catch(exception: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse() as any;
      if (typeof body === 'object' && body && 'code' in body) {
        return res.status(status).json(body);
      }
      const messages = Array.isArray(body?.message) ? body.message : undefined;
      return res.status(status).json({
        code: status === 400 ? 'VALIDATION_FAILED' : status === 404 ? 'NOT_FOUND' : 'HTTP_ERROR',
        message: messages ? 'Validation failed' : (body?.message ?? exception.message),
        details: messages,
      });
    }
    this.log.error(exception);
    return res.status(500).json({ code: 'INTERNAL', message: 'Internal server error' });
  }
}
```
`apps/api/src/common/public.decorator.ts`:
```ts
import { SetMetadata } from '@nestjs/common';
export const IS_PUBLIC = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC, true);
```
`apps/api/src/common/roles.decorator.ts`:
```ts
import { SetMetadata } from '@nestjs/common';
import { Role } from '@prisma/client';
export const ROLES = 'roles';
export const Roles = (...roles: Role[]) => SetMetadata(ROLES, roles);
```
`apps/api/src/common/current-user.ts`:
```ts
import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Role } from '@prisma/client';

export type AuthUser = { id: string; role: Role };

export const CurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): AuthUser => ctx.switchToHttp().getRequest().user,
);
```
In `configure-app.ts` add `app.useGlobalFilters(new ApiExceptionFilter());`.

- [ ] **Step 3: Error e2e test**

`apps/api/test/errors.e2e-spec.ts`:
```ts
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './helpers';

describe('error shape', () => {
  let app: INestApplication;
  beforeAll(async () => (app = await createTestApp()));
  afterAll(() => app.close());

  it('returns {code,message} for an unknown route', async () => {
    const res = await request(app.getHttpServer()).get('/v1/nope').expect(404);
    expect(res.body).toMatchObject({ code: 'NOT_FOUND' });
    expect(typeof res.body.message).toBe('string');
  });
});
```

- [ ] **Step 4: OpenAPI export script**

`apps/api/nest-cli.json` → add `"compilerOptions": { "plugins": ["@nestjs/swagger"] }`.
`apps/api/scripts/export-openapi.ts`:
```ts
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { mkdirSync, writeFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/configure-app';

async function main() {
  process.env.DATABASE_URL ??= 'postgresql://nutrikids:nutrikids@localhost:5433/nutrikids';
  process.env.JWT_ACCESS_SECRET ??= 'x'.repeat(32);
  const app = await NestFactory.create(AppModule, { logger: false });
  configureApp(app);
  const config = new DocumentBuilder().setTitle('NutriKids API').setVersion('1').addBearerAuth().build();
  const doc = SwaggerModule.createDocument(app, config);
  const out = resolve(__dirname, '../../../packages/contracts/openapi.json');
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify(doc, null, 2) + '\n');
  await app.close();
}
void main();
```
Add script `"export:openapi": "ts-node scripts/export-openapi.ts"` and `pnpm --filter api add -D ts-node`.

- [ ] **Step 5: Run everything**

Run: `pnpm test && pnpm test:e2e && pnpm --filter api export:openapi`
Expected: all pass; `packages/contracts/openapi.json` exists and contains `/v1/health`.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat(common): error shape, decorators, age/lww helpers, OpenAPI export"
```

**Checkpoint:** after this task, push the branch and tell Antigravity that `packages/contracts/openapi.json` exists and will grow with every task. They may start the web app skeleton against it.

---

# PHASE 1 — Backend modules

### Task 4: Auth module

**Files:**
- Create: `apps/api/src/auth/{auth.module.ts, auth.controller.ts, auth.service.ts, token.service.ts, password.service.ts, jwt-auth.guard.ts, roles.guard.ts, mail.service.ts, identity-verifier.ts, dto.ts}`
- Modify: `apps/api/src/app.module.ts` (import `AuthModule`)
- Test: `apps/api/src/auth/token.service.spec.ts`, `apps/api/test/auth.e2e-spec.ts`

**Interfaces:**
- Consumes: `PrismaService`, `ApiError` helpers, `Public`, `Roles`.
- Produces:
  - `abstract class MailService { abstract send(to: string, subject: string, text: string): Promise<void> }`, with `ConsoleMailService` (default) and test `MemoryMailService { outbox: {to,subject,text}[] }`.
  - `abstract class IdentityVerifier { abstract verify(provider: 'google' | 'apple', idToken: string): Promise<{ sub: string; email: string; emailVerified: boolean }> }`.
  - Endpoints (all under `/v1/auth`, public): `POST register {email,password}`, `POST login`, `POST refresh {refreshToken}`, `POST logout {refreshToken}`, `POST verify-email {token}`, `POST forgot-password {email}`, `POST reset-password {token,password}`, `POST social {provider,idToken}`.
  - Token response: `{ accessToken: string; refreshToken: string; expiresIn: number }`.
  - `JwtAuthGuard` registered as `APP_GUARD` (all routes need a bearer token unless `@Public()`); `RolesGuard` as `APP_GUARD` second.

- [ ] **Step 1: Write the failing token-hash unit test**

`apps/api/src/auth/token.service.spec.ts`:
```ts
import { sha256, randomToken } from './token.service';

describe('token helpers', () => {
  it('sha256 is stable and hex', () => {
    expect(sha256('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });
  it('randomToken is 64 hex chars and unique', () => {
    const a = randomToken();
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(randomToken()).not.toBe(a);
  });
});
```
Run: `pnpm test -- token.service` → FAIL.

- [ ] **Step 2: Implement services**

`apps/api/src/auth/password.service.ts`:
```ts
import { Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';

@Injectable()
export class PasswordService {
  hash(plain: string) {
    return argon2.hash(plain);
  }
  verify(hash: string, plain: string) {
    return argon2.verify(hash, plain);
  }
}
```
`apps/api/src/auth/token.service.ts`:
```ts
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';
import { createHash, randomBytes, randomUUID } from 'crypto';
import { Env } from '../config/env';
import { unauthorized } from '../common/api-error';
import { PrismaService } from '../prisma/prisma.service';

export const sha256 = (v: string) => createHash('sha256').update(v).digest('hex');
export const randomToken = () => randomBytes(32).toString('hex');

export type TokenPair = { accessToken: string; refreshToken: string; expiresIn: number };

@Injectable()
export class TokenService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async issue(user: { id: string; role: Role }, familyId: string = randomUUID()): Promise<TokenPair> {
    const expiresIn = this.config.get('JWT_ACCESS_TTL_SECONDS', { infer: true });
    const accessToken = await this.jwt.signAsync({ sub: user.id, role: user.role }, { expiresIn });
    const refreshToken = randomToken();
    const ttlDays = this.config.get('REFRESH_TTL_DAYS', { infer: true });
    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        familyId,
        tokenHash: sha256(refreshToken),
        expiresAt: new Date(Date.now() + ttlDays * 86_400_000),
      },
    });
    return { accessToken, refreshToken, expiresIn };
  }

  async rotate(raw: string): Promise<TokenPair> {
    const row = await this.prisma.refreshToken.findUnique({ where: { tokenHash: sha256(raw) } });
    if (!row || row.revokedAt || row.expiresAt < new Date()) throw unauthorized('INVALID_REFRESH_TOKEN');
    const claimed = await this.prisma.refreshToken.updateMany({
      where: { id: row.id, usedAt: null },
      data: { usedAt: new Date() },
    });
    if (claimed.count === 0) {
      await this.prisma.refreshToken.updateMany({
        where: { familyId: row.familyId },
        data: { revokedAt: new Date() },
      });
      throw unauthorized('REFRESH_TOKEN_REUSED');
    }
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: row.userId } });
    return this.issue(user, row.familyId);
  }

  async revokeFamilyOf(raw: string) {
    const row = await this.prisma.refreshToken.findUnique({ where: { tokenHash: sha256(raw) } });
    if (row) {
      await this.prisma.refreshToken.updateMany({ where: { familyId: row.familyId }, data: { revokedAt: new Date() } });
    }
  }

  revokeAllFor(userId: string) {
    return this.prisma.refreshToken.updateMany({ where: { userId }, data: { revokedAt: new Date() } });
  }
}
```
`apps/api/src/auth/mail.service.ts`:
```ts
import { Injectable, Logger } from '@nestjs/common';

export abstract class MailService {
  abstract send(to: string, subject: string, text: string): Promise<void>;
}

@Injectable()
export class ConsoleMailService extends MailService {
  private readonly log = new Logger('Mail');
  async send(to: string, subject: string, text: string) {
    this.log.log(`to=${to} subject=${subject}\n${text}`);
  }
}

export class MemoryMailService extends MailService {
  outbox: { to: string; subject: string; text: string }[] = [];
  async send(to: string, subject: string, text: string) {
    this.outbox.push({ to, subject, text });
  }
}
```
`apps/api/src/auth/identity-verifier.ts`:
```ts
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OAuth2Client } from 'google-auth-library';
import appleSignin from 'apple-signin-auth';
import { Env } from '../config/env';
import { ApiError } from '../common/api-error';

export type VerifiedIdentity = { sub: string; email: string; emailVerified: boolean };

export abstract class IdentityVerifier {
  abstract verify(provider: 'google' | 'apple', idToken: string): Promise<VerifiedIdentity>;
}

@Injectable()
export class RealIdentityVerifier extends IdentityVerifier {
  constructor(private readonly config: ConfigService<Env, true>) {
    super();
  }

  async verify(provider: 'google' | 'apple', idToken: string): Promise<VerifiedIdentity> {
    try {
      if (provider === 'google') {
        const audience = this.config.get('GOOGLE_CLIENT_ID', { infer: true });
        const ticket = await new OAuth2Client().verifyIdToken({ idToken, audience });
        const p = ticket.getPayload();
        if (!p?.sub || !p.email) throw new Error('missing claims');
        return { sub: p.sub, email: p.email, emailVerified: !!p.email_verified };
      }
      const audience = this.config.get('APPLE_CLIENT_ID', { infer: true });
      const p = await appleSignin.verifyIdToken(idToken, { audience });
      if (!p.sub || !p.email) throw new Error('missing claims');
      return { sub: p.sub, email: p.email, emailVerified: String(p.email_verified) === 'true' };
    } catch {
      throw new ApiError(401, 'INVALID_SOCIAL_TOKEN', 'Could not verify the sign-in token');
    }
  }
}
```
`apps/api/src/auth/jwt-auth.guard.ts`:
```ts
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { unauthorized } from '../common/api-error';
import { IS_PUBLIC } from '../common/public.decorator';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly reflector: Reflector, private readonly jwt: JwtService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [ctx.getHandler(), ctx.getClass()])) return true;
    const req = ctx.switchToHttp().getRequest();
    const header: string | undefined = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) throw unauthorized();
    try {
      const payload = await this.jwt.verifyAsync<{ sub: string; role: any }>(header.slice(7));
      req.user = { id: payload.sub, role: payload.role };
      return true;
    } catch {
      throw unauthorized('INVALID_ACCESS_TOKEN');
    }
  }
}
```
`apps/api/src/auth/roles.guard.ts`:
```ts
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { forbidden } from '../common/api-error';
import { ROLES } from '../common/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}
  canActivate(ctx: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<Role[]>(ROLES, [ctx.getHandler(), ctx.getClass()]);
    if (!roles?.length) return true;
    const user = ctx.switchToHttp().getRequest().user;
    if (!user || !roles.includes(user.role)) throw forbidden();
    return true;
  }
}
```
Run: `pnpm test -- token.service` → PASS.

- [ ] **Step 3: DTOs, service, controller, module**

`apps/api/src/auth/dto.ts`:
```ts
import { IsEmail, IsIn, IsString, MaxLength, MinLength } from 'class-validator';

export class RegisterDto {
  @IsEmail() email!: string;
  @IsString() @MinLength(8) @MaxLength(128) password!: string;
}
export class LoginDto {
  @IsEmail() email!: string;
  @IsString() password!: string;
}
export class RefreshDto {
  @IsString() refreshToken!: string;
}
export class TokenDto {
  @IsString() token!: string;
}
export class ForgotDto {
  @IsEmail() email!: string;
}
export class ResetDto {
  @IsString() token!: string;
  @IsString() @MinLength(8) @MaxLength(128) password!: string;
}
export class SocialDto {
  @IsIn(['google', 'apple']) provider!: 'google' | 'apple';
  @IsString() idToken!: string;
}
```
`apps/api/src/auth/auth.service.ts`:
```ts
import { Injectable } from '@nestjs/common';
import { AuthTokenType } from '@prisma/client';
import { ApiError, conflict, unauthorized } from '../common/api-error';
import { PrismaService } from '../prisma/prisma.service';
import { IdentityVerifier } from './identity-verifier';
import { MailService } from './mail.service';
import { PasswordService } from './password.service';
import { randomToken, sha256, TokenService } from './token.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly tokens: TokenService,
    private readonly mail: MailService,
    private readonly identity: IdentityVerifier,
  ) {}

  private async createAuthToken(userId: string, type: AuthTokenType, ttlMinutes: number) {
    const raw = randomToken();
    await this.prisma.authToken.create({
      data: { userId, type, tokenHash: sha256(raw), expiresAt: new Date(Date.now() + ttlMinutes * 60_000) },
    });
    return raw;
  }

  private async consumeAuthToken(raw: string, type: AuthTokenType) {
    const row = await this.prisma.authToken.findUnique({ where: { tokenHash: sha256(raw) } });
    if (!row || row.type !== type || row.usedAt || row.expiresAt < new Date()) {
      throw new ApiError(400, 'INVALID_TOKEN', 'This link is invalid or has expired');
    }
    await this.prisma.authToken.update({ where: { id: row.id }, data: { usedAt: new Date() } });
    return row.userId;
  }

  async register(email: string, password: string) {
    const normalized = email.trim().toLowerCase();
    if (await this.prisma.user.findUnique({ where: { email: normalized } })) {
      throw conflict('EMAIL_TAKEN', 'An account with this email already exists');
    }
    const user = await this.prisma.user.create({
      data: { email: normalized, passwordHash: await this.passwords.hash(password) },
    });
    const token = await this.createAuthToken(user.id, 'VERIFY_EMAIL', 60 * 24);
    await this.mail.send(normalized, 'Verify your NutriKids email', `Verification token: ${token}`);
    return this.tokens.issue(user);
  }

  async login(email: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
    if (!user?.passwordHash || !(await this.passwords.verify(user.passwordHash, password))) {
      throw unauthorized('INVALID_CREDENTIALS');
    }
    return this.tokens.issue(user);
  }

  refresh(raw: string) {
    return this.tokens.rotate(raw);
  }

  logout(raw: string) {
    return this.tokens.revokeFamilyOf(raw);
  }

  async verifyEmail(raw: string) {
    const userId = await this.consumeAuthToken(raw, 'VERIFY_EMAIL');
    await this.prisma.user.update({ where: { id: userId }, data: { emailVerifiedAt: new Date() } });
  }

  async forgotPassword(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
    if (!user) return; // never reveal whether the account exists
    const token = await this.createAuthToken(user.id, 'RESET_PASSWORD', 30);
    await this.mail.send(user.email, 'Reset your NutriKids password', `Reset token: ${token}`);
  }

  async resetPassword(raw: string, password: string) {
    const userId = await this.consumeAuthToken(raw, 'RESET_PASSWORD');
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash: await this.passwords.hash(password) } });
    await this.tokens.revokeAllFor(userId);
  }

  async social(provider: 'google' | 'apple', idToken: string) {
    const id = await this.identity.verify(provider, idToken);
    const subField = provider === 'google' ? 'googleSub' : 'appleSub';
    let user = await this.prisma.user.findUnique({ where: { [subField]: id.sub } as any });
    if (!user) {
      const email = id.email.toLowerCase();
      const existing = await this.prisma.user.findUnique({ where: { email } });
      if (existing && !id.emailVerified) throw unauthorized('SOCIAL_EMAIL_UNVERIFIED');
      user = existing
        ? await this.prisma.user.update({ where: { id: existing.id }, data: { [subField]: id.sub } as any })
        : await this.prisma.user.create({
            data: { email, [subField]: id.sub, emailVerifiedAt: id.emailVerified ? new Date() : null } as any,
          });
    }
    return this.tokens.issue(user);
  }
}
```
`apps/api/src/auth/auth.controller.ts`:
```ts
import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { Public } from '../common/public.decorator';
import { AuthService } from './auth.service';
import { ForgotDto, LoginDto, RefreshDto, RegisterDto, ResetDto, SocialDto, TokenDto } from './dto';

@Public()
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register') register(@Body() b: RegisterDto) { return this.auth.register(b.email, b.password); }
  @Post('login') @HttpCode(200) login(@Body() b: LoginDto) { return this.auth.login(b.email, b.password); }
  @Post('refresh') @HttpCode(200) refresh(@Body() b: RefreshDto) { return this.auth.refresh(b.refreshToken); }
  @Post('logout') @HttpCode(204) async logout(@Body() b: RefreshDto) { await this.auth.logout(b.refreshToken); }
  @Post('verify-email') @HttpCode(204) async verify(@Body() b: TokenDto) { await this.auth.verifyEmail(b.token); }
  @Post('forgot-password') @HttpCode(204) async forgot(@Body() b: ForgotDto) { await this.auth.forgotPassword(b.email); }
  @Post('reset-password') @HttpCode(204) async reset(@Body() b: ResetDto) { await this.auth.resetPassword(b.token, b.password); }
  @Post('social') @HttpCode(200) social(@Body() b: SocialDto) { return this.auth.social(b.provider, b.idToken); }
}
```
`apps/api/src/auth/auth.module.ts`:
```ts
import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { Env } from '../config/env';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { RealIdentityVerifier, IdentityVerifier } from './identity-verifier';
import { JwtAuthGuard } from './jwt-auth.guard';
import { ConsoleMailService, MailService } from './mail.service';
import { PasswordService } from './password.service';
import { RolesGuard } from './roles.guard';
import { TokenService } from './token.service';

@Global()
@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (c: ConfigService<Env, true>) => ({ secret: c.get('JWT_ACCESS_SECRET', { infer: true }) }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService, PasswordService, TokenService,
    { provide: MailService, useClass: ConsoleMailService },
    { provide: IdentityVerifier, useClass: RealIdentityVerifier },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
  exports: [JwtModule, TokenService],
})
export class AuthModule {}
```
Add `AuthModule` to `AppModule.imports`. Update `health.controller.ts` to add `@Public()` on the class.

- [ ] **Step 4: Failing e2e test**

`apps/api/test/auth.e2e-spec.ts`:
```ts
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { IdentityVerifier } from '../src/auth/identity-verifier';
import { MailService, MemoryMailService } from '../src/auth/mail.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp, resetDb } from './helpers';

describe('auth', () => {
  let app: INestApplication;
  let mail: MemoryMailService;
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    mail = new MemoryMailService();
    app = await createTestApp((b) =>
      b.overrideProvider(MailService).useValue(mail).overrideProvider(IdentityVerifier).useValue({
        verify: async () => ({ sub: 'g-1', email: 'social@example.com', emailVerified: true }),
      }),
    );
  });
  beforeEach(async () => {
    await resetDb(app.get(PrismaService));
    mail.outbox = [];
  });
  afterAll(() => app.close());

  const register = (email = 'p@example.com') =>
    http().post('/v1/auth/register').send({ email, password: 'password123' }).expect(201);

  it('registers, logs in, and protects routes', async () => {
    const { body } = await register();
    expect(body.accessToken).toBeDefined();
    await http().post('/v1/auth/login').send({ email: 'p@example.com', password: 'password123' }).expect(200);
    await http().post('/v1/auth/login').send({ email: 'p@example.com', password: 'wrongwrong' }).expect(401);
    await http().get('/v1/children').expect(401);
  });

  it('rejects a duplicate email', async () => {
    await register();
    const res = await http().post('/v1/auth/register').send({ email: 'P@example.com', password: 'password123' }).expect(409);
    expect(res.body.code).toBe('EMAIL_TAKEN');
  });

  it('rotates refresh tokens and revokes the family on reuse', async () => {
    const { body: first } = await register();
    const { body: second } = await http().post('/v1/auth/refresh').send({ refreshToken: first.refreshToken }).expect(200);
    const reuse = await http().post('/v1/auth/refresh').send({ refreshToken: first.refreshToken }).expect(401);
    expect(reuse.body.code).toBe('REFRESH_TOKEN_REUSED');
    await http().post('/v1/auth/refresh').send({ refreshToken: second.refreshToken }).expect(401);
  });

  it('verifies email with the mailed token', async () => {
    await register();
    const token = mail.outbox[0].text.split(': ')[1];
    await http().post('/v1/auth/verify-email').send({ token }).expect(204);
    await http().post('/v1/auth/verify-email').send({ token }).expect(400);
  });

  it('resets a password and invalidates old refresh tokens', async () => {
    const { body } = await register();
    mail.outbox = [];
    await http().post('/v1/auth/forgot-password').send({ email: 'p@example.com' }).expect(204);
    const token = mail.outbox[0].text.split(': ')[1];
    await http().post('/v1/auth/reset-password').send({ token, password: 'newpassword1' }).expect(204);
    await http().post('/v1/auth/login').send({ email: 'p@example.com', password: 'newpassword1' }).expect(200);
    await http().post('/v1/auth/refresh').send({ refreshToken: body.refreshToken }).expect(401);
  });

  it('does not reveal unknown emails on forgot-password', async () => {
    await http().post('/v1/auth/forgot-password').send({ email: 'ghost@example.com' }).expect(204);
    expect(mail.outbox).toHaveLength(0);
  });

  it('signs in with a verified social identity', async () => {
    const res = await http().post('/v1/auth/social').send({ provider: 'google', idToken: 'x' }).expect(200);
    expect(res.body.accessToken).toBeDefined();
  });
});
```
(`GET /v1/children` returns 401 even before the route exists because the guard runs first; the route is added in Task 6.)

- [ ] **Step 5: Run and iterate until green**

Run: `pnpm test:e2e -- auth`
Expected: 7 passed.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat(auth): register/login/refresh rotation, verify, reset, social, guards"
```

---

### Task 5: User module (profile, account deletion, data export)

**Files:**
- Create: `apps/api/src/user/{user.module.ts, user.controller.ts, user.service.ts}`
- Modify: `apps/api/src/app.module.ts`
- Test: `apps/api/test/user.e2e-spec.ts`

**Interfaces:**
- Consumes: `CurrentUser`, `PrismaService`.
- Produces: `GET /v1/me → { id, email, role, emailVerified: boolean, timezone }`; `PATCH /v1/me { timezone }`; `GET /v1/me/export` (JSON of the user and all their children data); `DELETE /v1/me` (204, cascades).
- Test helper added to `test/helpers.ts`: `registerAndLogin(app, email?): Promise<{ token: string; userId: string }>`.

- [ ] **Step 1: Add the helper**

Append to `apps/api/test/helpers.ts`:
```ts
import request from 'supertest';

export async function registerAndLogin(app: INestApplication, email = 'parent@example.com') {
  const res = await request(app.getHttpServer())
    .post('/v1/auth/register')
    .send({ email, password: 'password123' })
    .expect(201);
  const me = await request(app.getHttpServer()).get('/v1/me').set('Authorization', `Bearer ${res.body.accessToken}`);
  return { token: res.body.accessToken as string, userId: me.body.id as string };
}
```

- [ ] **Step 2: Failing test**

`apps/api/test/user.e2e-spec.ts`:
```ts
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp, registerAndLogin, resetDb } from './helpers';

describe('user', () => {
  let app: INestApplication;
  beforeAll(async () => (app = await createTestApp()));
  beforeEach(() => resetDb(app.get(PrismaService)));
  afterAll(() => app.close());

  it('returns and updates the profile', async () => {
    const { token } = await registerAndLogin(app);
    const auth = { Authorization: `Bearer ${token}` };
    const me = await request(app.getHttpServer()).get('/v1/me').set(auth).expect(200);
    expect(me.body).toMatchObject({ email: 'parent@example.com', role: 'PARENT', emailVerified: false, timezone: 'Asia/Dhaka' });
    await request(app.getHttpServer()).patch('/v1/me').set(auth).send({ timezone: 'Asia/Kolkata' }).expect(200);
    await request(app.getHttpServer()).patch('/v1/me').set(auth).send({ timezone: 'Mars/Base' }).expect(400);
  });

  it('exports and deletes all user data', async () => {
    const { token, userId } = await registerAndLogin(app);
    const auth = { Authorization: `Bearer ${token}` };
    const exp = await request(app.getHttpServer()).get('/v1/me/export').set(auth).expect(200);
    expect(exp.body.user.id).toBe(userId);
    await request(app.getHttpServer()).delete('/v1/me').set(auth).expect(204);
    expect(await app.get(PrismaService).user.count()).toBe(0);
  });
});
```
Run: `pnpm test:e2e -- user` → FAIL (404).

- [ ] **Step 3: Implement**

`apps/api/src/user/user.service.ts`:
```ts
import { Injectable } from '@nestjs/common';
import { ApiError } from '../common/api-error';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  async me(id: string) {
    const u = await this.prisma.user.findUniqueOrThrow({ where: { id } });
    return { id: u.id, email: u.email, role: u.role, emailVerified: !!u.emailVerifiedAt, timezone: u.timezone };
  }

  async setTimezone(id: string, timezone: string) {
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: timezone });
    } catch {
      throw new ApiError(400, 'INVALID_TIMEZONE', 'Unknown timezone');
    }
    await this.prisma.user.update({ where: { id }, data: { timezone } });
    return this.me(id);
  }

  async export(id: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id },
      select: {
        id: true, email: true, role: true, timezone: true, createdAt: true,
        children: {
          include: {
            allergies: true, conditions: true, dislikes: true, feedingLogs: true, introductions: true,
            growthRecords: true, mealPlanEntries: true, vaccinations: true, mealReminders: true,
          },
        },
        notificationPreferences: true,
      },
    });
    return { exportedAt: new Date().toISOString(), user };
  }

  async remove(id: string) {
    await this.prisma.user.delete({ where: { id } });
  }
}
```
`apps/api/src/user/user.controller.ts`:
```ts
import { Body, Controller, Delete, Get, HttpCode, Patch } from '@nestjs/common';
import { IsString } from 'class-validator';
import { AuthUser, CurrentUser } from '../common/current-user';
import { UserService } from './user.service';

class UpdateMeDto {
  @IsString() timezone!: string;
}

@Controller('me')
export class UserController {
  constructor(private readonly users: UserService) {}
  @Get() me(@CurrentUser() u: AuthUser) { return this.users.me(u.id); }
  @Patch() update(@CurrentUser() u: AuthUser, @Body() b: UpdateMeDto) { return this.users.setTimezone(u.id, b.timezone); }
  @Get('export') export(@CurrentUser() u: AuthUser) { return this.users.export(u.id); }
  @Delete() @HttpCode(204) async remove(@CurrentUser() u: AuthUser) { await this.users.remove(u.id); }
}
```
`apps/api/src/user/user.module.ts`:
```ts
import { Module } from '@nestjs/common';
import { UserController } from './user.controller';
import { UserService } from './user.service';

@Module({ controllers: [UserController], providers: [UserService] })
export class UserModule {}
```
Add `UserModule` to `AppModule`.

- [ ] **Step 4: Run, then commit**

Run: `pnpm test:e2e -- user` → 2 passed.
```bash
git add -A && git commit -m "feat(user): profile, timezone, data export, account deletion"
```

---

### Task 6: Food module

**Files:**
- Create: `apps/api/src/food/{food.module.ts, food.controller.ts, food.service.ts, nutrition.ts}`
- Modify: `apps/api/src/app.module.ts`
- Test: `apps/api/src/food/nutrition.spec.ts`, `apps/api/test/food.e2e-spec.ts`

**Interfaces:**
- Produces:
  - `type NutritionPer100g = { calories: number; protein: number; carbs: number; fat: number; fiber: number; iron: number; calcium: number; vitaminA: number; vitaminC: number; vitaminD: number; zinc: number }` (units: kcal, g, g, g, g, mg, mg, µg RAE, mg, µg, mg).
  - `validateNutrition(n: unknown): NutritionPer100g` (throws `ApiError(400,'INVALID_NUTRITION')`).
  - `FoodService.findByIds(ids: string[]): Promise<Food[]>`, exported from `FoodModule`.
  - Endpoints: `GET /v1/foods?search&category&excludeAllergens=MILK,EGG&page&pageSize`, `GET /v1/foods/categories`, `GET /v1/foods/:id`; admin only: `POST /v1/foods`, `PATCH /v1/foods/:id`, `DELETE /v1/foods/:id`.
- Test helper added: `makeAdmin(app, email?): Promise<{ token: string }>` which registers a user and sets `role = ADMIN` in the DB, then logs in again.

- [ ] **Step 1: Failing nutrition test**

`apps/api/src/food/nutrition.spec.ts`:
```ts
import { validateNutrition } from './nutrition';

const ok = { calories: 130, protein: 2.7, carbs: 28, fat: 0.3, fiber: 0.4, iron: 0.2, calcium: 10, vitaminA: 0, vitaminC: 0, vitaminD: 0, zinc: 0.5 };

describe('validateNutrition', () => {
  it('accepts a valid object', () => expect(validateNutrition(ok)).toEqual(ok));
  it('rejects negative values', () => expect(() => validateNutrition({ ...ok, iron: -1 })).toThrow());
  it('rejects calories above 900 per 100 g', () => expect(() => validateNutrition({ ...ok, calories: 901 })).toThrow());
  it('rejects macros summing above 100 g per 100 g', () =>
    expect(() => validateNutrition({ ...ok, protein: 50, carbs: 50, fat: 10 })).toThrow());
  it('rejects missing fields', () => expect(() => validateNutrition({ calories: 1 })).toThrow());
});
```
Run → FAIL.

- [ ] **Step 2: Implement nutrition validation**

`apps/api/src/food/nutrition.ts`:
```ts
import { z } from 'zod';
import { ApiError } from '../common/api-error';

const nn = (max: number) => z.number().min(0).max(max);

const schema = z.object({
  calories: nn(900), protein: nn(100), carbs: nn(100), fat: nn(100), fiber: nn(100),
  iron: nn(100), calcium: nn(2000), vitaminA: nn(30000), vitaminC: nn(2000), vitaminD: nn(1000), zinc: nn(100),
});

export type NutritionPer100g = z.infer<typeof schema>;
export const NUTRIENT_KEYS = Object.keys(schema.shape) as (keyof NutritionPer100g)[];

export function validateNutrition(n: unknown): NutritionPer100g {
  const r = schema.safeParse(n);
  if (!r.success) throw new ApiError(400, 'INVALID_NUTRITION', 'Invalid nutrition data', r.error.issues);
  if (r.data.protein + r.data.carbs + r.data.fat > 100) {
    throw new ApiError(400, 'INVALID_NUTRITION', 'Protein + carbs + fat cannot exceed 100 g per 100 g');
  }
  return r.data;
}
```
Run: `pnpm test -- nutrition` → PASS.

- [ ] **Step 3: Service, controller, module**

`apps/api/src/food/food.service.ts`:
```ts
import { Injectable } from '@nestjs/common';
import { Allergen, Prisma } from '@prisma/client';
import { notFound } from '../common/api-error';
import { PrismaService } from '../prisma/prisma.service';
import { validateNutrition } from './nutrition';

export type FoodInput = {
  name: string; category: string; allergens?: Allergen[]; nutrition: unknown;
  ageMinMonths?: number; ageMaxMonths?: number;
};

@Injectable()
export class FoodService {
  constructor(private readonly prisma: PrismaService) {}

  async list(q: { search?: string; category?: string; excludeAllergens?: Allergen[]; page: number; pageSize: number }) {
    const where: Prisma.FoodWhereInput = {
      ...(q.search ? { name: { contains: q.search, mode: 'insensitive' } } : {}),
      ...(q.category ? { category: q.category } : {}),
      ...(q.excludeAllergens?.length ? { NOT: { allergens: { hasSome: q.excludeAllergens } } } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.food.findMany({ where, orderBy: { name: 'asc' }, skip: (q.page - 1) * q.pageSize, take: q.pageSize }),
      this.prisma.food.count({ where }),
    ]);
    return { items, total, page: q.page, pageSize: q.pageSize };
  }

  async categories() {
    const rows = await this.prisma.food.findMany({ distinct: ['category'], select: { category: true }, orderBy: { category: 'asc' } });
    return rows.map((r) => r.category);
  }

  async get(id: string) {
    const f = await this.prisma.food.findUnique({ where: { id } });
    if (!f) throw notFound('Food');
    return f;
  }

  findByIds(ids: string[]) {
    return this.prisma.food.findMany({ where: { id: { in: ids } } });
  }

  create(input: FoodInput) {
    return this.prisma.food.create({
      data: { ...input, allergens: input.allergens ?? [], nutrition: validateNutrition(input.nutrition) as Prisma.InputJsonValue },
    });
  }

  async update(id: string, input: Partial<FoodInput>) {
    await this.get(id);
    return this.prisma.food.update({
      where: { id },
      data: { ...input, ...(input.nutrition ? { nutrition: validateNutrition(input.nutrition) as Prisma.InputJsonValue } : {}) } as Prisma.FoodUpdateInput,
    });
  }

  async remove(id: string) {
    await this.get(id);
    await this.prisma.food.delete({ where: { id } });
  }
}
```
`apps/api/src/food/food.controller.ts`:
```ts
import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { Allergen } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import { IsArray, IsEnum, IsInt, IsNotEmpty, IsObject, IsOptional, IsString, Max, Min } from 'class-validator';
import { Roles } from '../common/roles.decorator';
import { FoodService } from './food.service';

class ListFoodsQuery {
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsString() category?: string;
  @IsOptional() @Transform(({ value }) => (typeof value === 'string' ? value.split(',') : value))
  @IsArray() @IsEnum(Allergen, { each: true }) excludeAllergens?: Allergen[];
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize = 20;
}

class CreateFoodDto {
  @IsString() @IsNotEmpty() name!: string;
  @IsString() @IsNotEmpty() category!: string;
  @IsOptional() @IsArray() @IsEnum(Allergen, { each: true }) allergens?: Allergen[];
  @IsObject() nutrition!: Record<string, number>;
  @IsOptional() @IsInt() @Min(0) ageMinMonths?: number;
  @IsOptional() @IsInt() @Min(0) ageMaxMonths?: number;
}

class UpdateFoodDto {
  @IsOptional() @IsString() @IsNotEmpty() name?: string;
  @IsOptional() @IsString() @IsNotEmpty() category?: string;
  @IsOptional() @IsArray() @IsEnum(Allergen, { each: true }) allergens?: Allergen[];
  @IsOptional() @IsObject() nutrition?: Record<string, number>;
  @IsOptional() @IsInt() @Min(0) ageMinMonths?: number;
  @IsOptional() @IsInt() @Min(0) ageMaxMonths?: number;
}

@Controller('foods')
export class FoodController {
  constructor(private readonly foods: FoodService) {}

  @Get() list(@Query() q: ListFoodsQuery) { return this.foods.list(q); }
  @Get('categories') categories() { return this.foods.categories(); }
  @Get(':id') get(@Param('id', ParseUUIDPipe) id: string) { return this.foods.get(id); }

  @Roles('ADMIN') @Post() create(@Body() b: CreateFoodDto) { return this.foods.create(b); }
  @Roles('ADMIN') @Patch(':id') update(@Param('id', ParseUUIDPipe) id: string, @Body() b: UpdateFoodDto) { return this.foods.update(id, b); }
  @Roles('ADMIN') @Delete(':id') @HttpCode(204) remove(@Param('id', ParseUUIDPipe) id: string) { return this.foods.remove(id); }
}
```
`apps/api/src/food/food.module.ts`:
```ts
import { Module } from '@nestjs/common';
import { FoodController } from './food.controller';
import { FoodService } from './food.service';

@Module({ controllers: [FoodController], providers: [FoodService], exports: [FoodService] })
export class FoodModule {}
```
Add `FoodModule` to `AppModule`. Append to `test/helpers.ts`:
```ts
export async function makeAdmin(app: INestApplication, email = 'admin@example.com') {
  const { userId } = await registerAndLogin(app, email);
  await app.get(PrismaService).user.update({ where: { id: userId }, data: { role: 'ADMIN' } });
  const res = await request(app.getHttpServer()).post('/v1/auth/login').send({ email, password: 'password123' });
  return { token: res.body.accessToken as string };
}
```

- [ ] **Step 4: E2E test**

`apps/api/test/food.e2e-spec.ts`:
```ts
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp, makeAdmin, registerAndLogin, resetDb } from './helpers';

const nutrition = { calories: 61, protein: 3.2, carbs: 4.8, fat: 3.3, fiber: 0, iron: 0.03, calcium: 113, vitaminA: 46, vitaminC: 0, vitaminD: 1.3, zinc: 0.4 };

describe('foods', () => {
  let app: INestApplication;
  const http = () => request(app.getHttpServer());
  beforeAll(async () => (app = await createTestApp()));
  beforeEach(() => resetDb(app.get(PrismaService)));
  afterAll(() => app.close());

  it('lets only admins create foods', async () => {
    const parent = await registerAndLogin(app);
    await http().post('/v1/foods').set('Authorization', `Bearer ${parent.token}`)
      .send({ name: 'Milk', category: 'Dairy', allergens: ['MILK'], nutrition }).expect(403);
    const admin = await makeAdmin(app);
    await http().post('/v1/foods').set('Authorization', `Bearer ${admin.token}`)
      .send({ name: 'Milk', category: 'Dairy', allergens: ['MILK'], nutrition }).expect(201);
  });

  it('rejects invalid nutrition', async () => {
    const admin = await makeAdmin(app);
    const res = await http().post('/v1/foods').set('Authorization', `Bearer ${admin.token}`)
      .send({ name: 'Bad', category: 'X', nutrition: { ...nutrition, calories: 5000 } }).expect(400);
    expect(res.body.code).toBe('INVALID_NUTRITION');
  });

  it('searches, filters by category, and excludes allergens', async () => {
    const admin = await makeAdmin(app);
    const auth = { Authorization: `Bearer ${admin.token}` };
    await http().post('/v1/foods').set(auth).send({ name: 'Milk', category: 'Dairy', allergens: ['MILK'], nutrition });
    await http().post('/v1/foods').set(auth).send({ name: 'Rice', category: 'Grains', nutrition });
    const all = await http().get('/v1/foods').set(auth).expect(200);
    expect(all.body.total).toBe(2);
    const search = await http().get('/v1/foods?search=ric').set(auth);
    expect(search.body.items.map((f: any) => f.name)).toEqual(['Rice']);
    const safe = await http().get('/v1/foods?excludeAllergens=MILK,EGG').set(auth);
    expect(safe.body.items.map((f: any) => f.name)).toEqual(['Rice']);
    const cats = await http().get('/v1/foods/categories').set(auth);
    expect(cats.body).toEqual(['Dairy', 'Grains']);
  });
});
```

- [ ] **Step 5: Run and commit**

Run: `pnpm test && pnpm test:e2e -- food` → pass.
```bash
git add -A && git commit -m "feat(food): food CRUD with allergen tags, nutrition validation, search"
```

---

### Task 7: Child module (profile, allergies, conditions, dislikes, feeding, introductions)

**Files:**
- Create: `apps/api/src/child/{child.module.ts, child.controller.ts, child.service.ts, child-access.service.ts, child.events.ts, dto.ts}`
- Modify: `apps/api/src/app.module.ts` (import `ChildModule`, `EventEmitterModule.forRoot()`)
- Test: `apps/api/test/child.e2e-spec.ts`

**Interfaces:**
- Consumes: `FoodService.findByIds`, `ageInMonths`, `resolveLww`.
- Produces:
  - `ChildAccessService.assertOwned(userId: string, childId: string): Promise<Child>` — throws `notFound('Child')` when absent or owned by another user. Exported by `ChildModule`; every child-scoped controller in later tasks calls it first.
  - Events (via `EventEmitter2`): `child.created` and `child.dob_changed`, payload `{ childId: string; dateOfBirth: Date }`. Constants `CHILD_CREATED = 'child.created'`, `CHILD_DOB_CHANGED = 'child.dob_changed'` exported from `child.events.ts`.
  - Endpoints under `/v1/children`: `GET /`, `POST /`, `GET /:id`, `PATCH /:id`, `DELETE /:id`; `PUT /:id/allergies` (replace the list: `[{allergen, severity}]`); `PUT /:id/conditions` (`{names: string[]}`); `PUT /:id/dislikes` (`{foodIds: string[]}`); `PUT /:id/feeding-logs/:logId`, `GET /:id/feeding-logs?from&to&updatedSince`, `DELETE /:id/feeding-logs/:logId`; `PUT /:id/food-introductions/:introId`, `GET /:id/food-introductions`.
  - Child response includes computed `ageMonths`.
  - Sync response shape for PUT sync endpoints: `{ data: T, sync: { superseded: boolean } }`.

- [ ] **Step 1: Failing e2e test**

`apps/api/test/child.e2e-spec.ts`:
```ts
import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'crypto';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp, registerAndLogin, resetDb } from './helpers';

describe('children', () => {
  let app: INestApplication;
  const http = () => request(app.getHttpServer());
  beforeAll(async () => (app = await createTestApp()));
  beforeEach(() => resetDb(app.get(PrismaService)));
  afterAll(() => app.close());

  const newChild = (token: string, body: object = {}) =>
    http().post('/v1/children').set('Authorization', `Bearer ${token}`)
      .send({ name: 'Amina', dateOfBirth: '2024-06-15', gender: 'FEMALE', weightKg: 9.5, ...body });

  it('creates a child with computed age and lists only own children', async () => {
    const a = await registerAndLogin(app, 'a@example.com');
    const b = await registerAndLogin(app, 'b@example.com');
    const created = await newChild(a.token).expect(201);
    expect(created.body.ageMonths).toBeGreaterThanOrEqual(0);
    expect(created.body.dateOfBirth).toBe('2024-06-15');
    await newChild(b.token, { name: 'Other' }).expect(201);
    const list = await http().get('/v1/children').set('Authorization', `Bearer ${a.token}`).expect(200);
    expect(list.body.map((c: any) => c.name)).toEqual(['Amina']);
  });

  it('returns 404 for another parent\'s child', async () => {
    const a = await registerAndLogin(app, 'a@example.com');
    const b = await registerAndLogin(app, 'b@example.com');
    const child = (await newChild(a.token)).body;
    await http().get(`/v1/children/${child.id}`).set('Authorization', `Bearer ${b.token}`).expect(404);
    await http().delete(`/v1/children/${child.id}`).set('Authorization', `Bearer ${b.token}`).expect(404);
  });

  it('rejects a future date of birth and an unknown gender', async () => {
    const a = await registerAndLogin(app);
    await newChild(a.token, { dateOfBirth: '2999-01-01' }).expect(400);
    await newChild(a.token, { gender: 'ROBOT' }).expect(400);
  });

  it('replaces allergies, conditions and dislikes', async () => {
    const a = await registerAndLogin(app);
    const auth = { Authorization: `Bearer ${a.token}` };
    const child = (await newChild(a.token)).body;
    const prisma = app.get(PrismaService);
    const food = await prisma.food.create({ data: { name: 'Egg', category: 'Protein', allergens: ['EGG'], nutrition: {} } });

    await http().put(`/v1/children/${child.id}/allergies`).set(auth)
      .send({ items: [{ allergen: 'EGG', severity: 'SEVERE' }, { allergen: 'MILK', severity: 'MILD' }] }).expect(200);
    await http().put(`/v1/children/${child.id}/allergies`).set(auth)
      .send({ items: [{ allergen: 'EGG', severity: 'MODERATE' }] }).expect(200);
    const got = await http().get(`/v1/children/${child.id}`).set(auth);
    expect(got.body.allergies).toEqual([{ allergen: 'EGG', severity: 'MODERATE' }]);

    await http().put(`/v1/children/${child.id}/conditions`).set(auth).send({ names: ['lactose intolerance'] }).expect(200);
    await http().put(`/v1/children/${child.id}/dislikes`).set(auth).send({ foodIds: [food.id] }).expect(200);
    await http().put(`/v1/children/${child.id}/dislikes`).set(auth).send({ foodIds: [randomUUID()] }).expect(400);
    const again = await http().get(`/v1/children/${child.id}`).set(auth);
    expect(again.body.conditions).toEqual(['lactose intolerance']);
    expect(again.body.dislikes).toEqual([food.id]);
  });

  it('applies feeding logs idempotently with last-write-wins', async () => {
    const a = await registerAndLogin(app);
    const auth = { Authorization: `Bearer ${a.token}` };
    const child = (await newChild(a.token)).body;
    const id = randomUUID();
    const url = `/v1/children/${child.id}/feeding-logs/${id}`;
    const body = (notes: string, ts: string) => ({ type: 'BREAST', at: '2026-03-01T08:00:00Z', durationMinutes: 15, notes, clientUpdatedAt: ts });

    const first = await http().put(url).set(auth).send(body('first', '2026-03-01T09:00:00Z')).expect(200);
    expect(first.body.sync.superseded).toBe(false);
    await http().put(url).set(auth).send(body('first', '2026-03-01T09:00:00Z')).expect(200); // replay
    const newer = await http().put(url).set(auth).send(body('newer', '2026-03-01T10:00:00Z')).expect(200);
    expect(newer.body.data.notes).toBe('newer');
    const older = await http().put(url).set(auth).send(body('stale', '2026-03-01T09:30:00Z')).expect(200);
    expect(older.body.sync.superseded).toBe(true);
    expect(older.body.data.notes).toBe('newer');
    const list = await http().get(`/v1/children/${child.id}/feeding-logs`).set(auth);
    expect(list.body).toHaveLength(1);
  });

  it('records food introductions once per food', async () => {
    const a = await registerAndLogin(app);
    const auth = { Authorization: `Bearer ${a.token}` };
    const child = (await newChild(a.token)).body;
    const food = await app.get(PrismaService).food.create({ data: { name: 'Banana', category: 'Fruit', nutrition: {} } });
    const id = randomUUID();
    await http().put(`/v1/children/${child.id}/food-introductions/${id}`).set(auth)
      .send({ foodId: food.id, introducedOn: '2026-02-01', reaction: 'none', clientUpdatedAt: '2026-02-01T10:00:00Z' }).expect(200);
    const list = await http().get(`/v1/children/${child.id}/food-introductions`).set(auth);
    expect(list.body).toHaveLength(1);
  });
});
```
Run: `pnpm test:e2e -- child` → FAIL (404s).

- [ ] **Step 2: Implement events, access, DTOs**

`apps/api/src/child/child.events.ts`:
```ts
export const CHILD_CREATED = 'child.created';
export const CHILD_DOB_CHANGED = 'child.dob_changed';
export type ChildEvent = { childId: string; dateOfBirth: Date };
```
`apps/api/src/child/child-access.service.ts`:
```ts
import { Injectable } from '@nestjs/common';
import { Child } from '@prisma/client';
import { notFound } from '../common/api-error';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ChildAccessService {
  constructor(private readonly prisma: PrismaService) {}

  async assertOwned(userId: string, childId: string): Promise<Child> {
    const child = await this.prisma.child.findFirst({ where: { id: childId, userId } });
    if (!child) throw notFound('Child');
    return child;
  }
}
```
`apps/api/src/child/dto.ts`:
```ts
import { ActivityLevel, Allergen, DietType, FeedingType, Gender, Severity } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize, IsArray, IsDateString, IsEnum, IsInt, IsNumber, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength,
  ValidateNested, registerDecorator, ValidationOptions,
} from 'class-validator';

function NotFuture(opts?: ValidationOptions) {
  return (obj: object, prop: string) =>
    registerDecorator({
      name: 'notFuture', target: obj.constructor, propertyName: prop, options: opts,
      validator: { validate: (v: string) => new Date(v).getTime() <= Date.now(), defaultMessage: () => '$property cannot be in the future' },
    });
}

export class CreateChildDto {
  @IsString() @MinLength(1) @MaxLength(80) name!: string;
  @IsDateString() @NotFuture() dateOfBirth!: string;
  @IsEnum(Gender) gender!: Gender;
  @IsOptional() @IsNumber() @Min(20) @Max(250) heightCm?: number;
  @IsOptional() @IsNumber() @Min(0.5) @Max(200) weightKg?: number;
  @IsOptional() @IsEnum(ActivityLevel) activityLevel?: ActivityLevel;
  @IsOptional() @IsEnum(DietType) dietType?: DietType;
  @IsOptional() @IsString() photoUrl?: string;
}

export class UpdateChildDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(80) name?: string;
  @IsOptional() @IsDateString() @NotFuture() dateOfBirth?: string;
  @IsOptional() @IsEnum(Gender) gender?: Gender;
  @IsOptional() @IsNumber() @Min(20) @Max(250) heightCm?: number;
  @IsOptional() @IsNumber() @Min(0.5) @Max(200) weightKg?: number;
  @IsOptional() @IsEnum(ActivityLevel) activityLevel?: ActivityLevel;
  @IsOptional() @IsEnum(DietType) dietType?: DietType;
  @IsOptional() @IsString() photoUrl?: string;
}

export class AllergyDto {
  @IsEnum(Allergen) allergen!: Allergen;
  @IsEnum(Severity) severity!: Severity;
}
export class ConditionsDto {
  @IsArray() @ArrayMaxSize(30) @IsString({ each: true }) names!: string[];
}
export class DislikesDto {
  @IsArray() @ArrayMaxSize(100) @IsUUID('all', { each: true }) foodIds!: string[];
}

export class FeedingLogDto {
  @IsEnum(FeedingType) type!: FeedingType;
  @IsDateString() at!: string;
  @IsOptional() @IsInt() @Min(0) @Max(600) durationMinutes?: number;
  @IsOptional() @IsString() @MaxLength(500) notes?: string;
  @IsDateString() clientUpdatedAt!: string;
}

export class FoodIntroductionDto {
  @IsUUID() foodId!: string;
  @IsDateString() introducedOn!: string;
  @IsOptional() @IsString() @MaxLength(300) reaction?: string;
  @IsOptional() @IsString() @MaxLength(500) notes?: string;
  @IsDateString() clientUpdatedAt!: string;
}

export class FeedingQuery {
  @IsOptional() @IsDateString() from?: string;
  @IsOptional() @IsDateString() to?: string;
  @IsOptional() @IsDateString() updatedSince?: string;
}
```
(Remove unused imports `Type`, `ValidateNested` if the linter complains.)

- [ ] **Step 3: Implement the service**

`apps/api/src/child/child.service.ts`:
```ts
import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Allergen, Child, Severity } from '@prisma/client';
import { ageInMonths } from '../common/age';
import { ApiError } from '../common/api-error';
import { resolveLww } from '../common/lww';
import { PrismaService } from '../prisma/prisma.service';
import { ChildAccessService } from './child-access.service';
import { CHILD_CREATED, CHILD_DOB_CHANGED, ChildEvent } from './child.events';
import { CreateChildDto, FeedingLogDto, FeedingQuery, FoodIntroductionDto, UpdateChildDto } from './dto';

const include = { allergies: true, conditions: true, dislikes: true } as const;
const isoDate = (d: Date) => d.toISOString().slice(0, 10);

@Injectable()
export class ChildService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: ChildAccessService,
    private readonly events: EventEmitter2,
  ) {}

  private view(c: Child & { allergies: { allergen: Allergen; severity: Severity }[]; conditions: { name: string }[]; dislikes: { foodId: string }[] }) {
    return {
      id: c.id, name: c.name, dateOfBirth: isoDate(c.dateOfBirth), ageMonths: ageInMonths(c.dateOfBirth),
      gender: c.gender, heightCm: c.heightCm ? Number(c.heightCm) : null, weightKg: c.weightKg ? Number(c.weightKg) : null,
      activityLevel: c.activityLevel, dietType: c.dietType, photoUrl: c.photoUrl,
      allergies: c.allergies.map((a) => ({ allergen: a.allergen, severity: a.severity })),
      conditions: c.conditions.map((x) => x.name),
      dislikes: c.dislikes.map((d) => d.foodId),
    };
  }

  async list(userId: string) {
    const rows = await this.prisma.child.findMany({ where: { userId }, include, orderBy: { createdAt: 'asc' } });
    return rows.map((r) => this.view(r));
  }

  async get(userId: string, id: string) {
    await this.access.assertOwned(userId, id);
    return this.view(await this.prisma.child.findUniqueOrThrow({ where: { id }, include }));
  }

  async create(userId: string, dto: CreateChildDto) {
    const child = await this.prisma.child.create({
      data: { ...dto, userId, dateOfBirth: new Date(dto.dateOfBirth) },
      include,
    });
    await this.events.emitAsync(CHILD_CREATED, { childId: child.id, dateOfBirth: child.dateOfBirth } satisfies ChildEvent);
    return this.view(child);
  }

  async update(userId: string, id: string, dto: UpdateChildDto) {
    const before = await this.access.assertOwned(userId, id);
    const child = await this.prisma.child.update({
      where: { id },
      data: { ...dto, ...(dto.dateOfBirth ? { dateOfBirth: new Date(dto.dateOfBirth) } : {}) },
      include,
    });
    if (dto.dateOfBirth && isoDate(before.dateOfBirth) !== dto.dateOfBirth.slice(0, 10)) {
      await this.events.emitAsync(CHILD_DOB_CHANGED, { childId: id, dateOfBirth: child.dateOfBirth } satisfies ChildEvent);
    }
    return this.view(child);
  }

  async remove(userId: string, id: string) {
    await this.access.assertOwned(userId, id);
    await this.prisma.child.delete({ where: { id } });
  }

  async setAllergies(userId: string, id: string, items: { allergen: Allergen; severity: Severity }[]) {
    await this.access.assertOwned(userId, id);
    const unique = [...new Map(items.map((i) => [i.allergen, i])).values()];
    await this.prisma.$transaction([
      this.prisma.childAllergy.deleteMany({ where: { childId: id } }),
      this.prisma.childAllergy.createMany({ data: unique.map((i) => ({ childId: id, ...i })) }),
    ]);
    return this.get(userId, id);
  }

  async setConditions(userId: string, id: string, names: string[]) {
    await this.access.assertOwned(userId, id);
    const unique = [...new Set(names.map((n) => n.trim()).filter(Boolean))];
    await this.prisma.$transaction([
      this.prisma.childCondition.deleteMany({ where: { childId: id } }),
      this.prisma.childCondition.createMany({ data: unique.map((name) => ({ childId: id, name })) }),
    ]);
    return this.get(userId, id);
  }

  async setDislikes(userId: string, id: string, foodIds: string[]) {
    await this.access.assertOwned(userId, id);
    const unique = [...new Set(foodIds)];
    const found = await this.prisma.food.count({ where: { id: { in: unique } } });
    if (found !== unique.length) throw new ApiError(400, 'UNKNOWN_FOOD', 'One or more foods do not exist');
    await this.prisma.$transaction([
      this.prisma.foodDislike.deleteMany({ where: { childId: id } }),
      this.prisma.foodDislike.createMany({ data: unique.map((foodId) => ({ childId: id, foodId })) }),
    ]);
    return this.get(userId, id);
  }

  // ---- feeding logs (sync) ----
  async upsertFeedingLog(userId: string, childId: string, logId: string, dto: FeedingLogDto) {
    await this.access.assertOwned(userId, childId);
    const existing = await this.prisma.feedingLog.findUnique({ where: { id: logId } });
    if (existing && existing.childId !== childId) throw new ApiError(409, 'ID_IN_USE', 'This id belongs to another record');
    const { apply, superseded } = resolveLww(existing, new Date(dto.clientUpdatedAt));
    const data = {
      type: dto.type, at: new Date(dto.at), durationMinutes: dto.durationMinutes ?? null,
      notes: dto.notes ?? null, clientUpdatedAt: new Date(dto.clientUpdatedAt),
    };
    const row = apply
      ? await this.prisma.feedingLog.upsert({ where: { id: logId }, create: { id: logId, childId, ...data }, update: data })
      : existing!;
    return { data: row, sync: { superseded } };
  }

  async listFeedingLogs(userId: string, childId: string, q: FeedingQuery) {
    await this.access.assertOwned(userId, childId);
    return this.prisma.feedingLog.findMany({
      where: {
        childId,
        ...(q.from || q.to ? { at: { ...(q.from ? { gte: new Date(q.from) } : {}), ...(q.to ? { lte: new Date(q.to) } : {}) } } : {}),
        ...(q.updatedSince ? { updatedAt: { gt: new Date(q.updatedSince) } } : {}),
      },
      orderBy: { at: 'desc' },
    });
  }

  async deleteFeedingLog(userId: string, childId: string, logId: string) {
    await this.access.assertOwned(userId, childId);
    await this.prisma.feedingLog.deleteMany({ where: { id: logId, childId } });
  }

  // ---- food introductions (sync) ----
  async upsertIntroduction(userId: string, childId: string, introId: string, dto: FoodIntroductionDto) {
    await this.access.assertOwned(userId, childId);
    const existing = await this.prisma.foodIntroduction.findUnique({ where: { id: introId } });
    const { apply, superseded } = resolveLww(existing, new Date(dto.clientUpdatedAt));
    const data = {
      foodId: dto.foodId, introducedOn: new Date(dto.introducedOn), reaction: dto.reaction ?? null,
      notes: dto.notes ?? null, clientUpdatedAt: new Date(dto.clientUpdatedAt),
    };
    const row = apply
      ? await this.prisma.foodIntroduction.upsert({ where: { id: introId }, create: { id: introId, childId, ...data }, update: data })
      : existing!;
    return { data: row, sync: { superseded } };
  }

  async listIntroductions(userId: string, childId: string) {
    await this.access.assertOwned(userId, childId);
    return this.prisma.foodIntroduction.findMany({ where: { childId }, orderBy: { introducedOn: 'desc' } });
  }
}
```
`apps/api/src/child/child.controller.ts`:
```ts
import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Put, Query } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsArray, ValidateNested } from 'class-validator';
import { AuthUser, CurrentUser } from '../common/current-user';
import { ChildService } from './child.service';
import {
  AllergyDto, ConditionsDto, CreateChildDto, DislikesDto, FeedingLogDto, FeedingQuery, FoodIntroductionDto, UpdateChildDto,
} from './dto';

class AllergiesBody {
  @IsArray() @ValidateNested({ each: true }) @Type(() => AllergyDto) items!: AllergyDto[];
}

@Controller('children')
export class ChildController {
  constructor(private readonly children: ChildService) {}

  @Get() list(@CurrentUser() u: AuthUser) { return this.children.list(u.id); }
  @Post() create(@CurrentUser() u: AuthUser, @Body() b: CreateChildDto) { return this.children.create(u.id, b); }
  @Get(':id') get(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) { return this.children.get(u.id, id); }
  @Patch(':id') update(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() b: UpdateChildDto) { return this.children.update(u.id, id, b); }
  @Delete(':id') @HttpCode(204) remove(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) { return this.children.remove(u.id, id); }

  @Put(':id/allergies') setAllergies(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() b: AllergiesBody) {
    return this.children.setAllergies(u.id, id, b.items);
  }
  @Put(':id/conditions') setConditions(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() b: ConditionsDto) {
    return this.children.setConditions(u.id, id, b.names);
  }
  @Put(':id/dislikes') setDislikes(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() b: DislikesDto) {
    return this.children.setDislikes(u.id, id, b.foodIds);
  }

  @Put(':id/feeding-logs/:logId') putLog(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Param('logId', ParseUUIDPipe) logId: string, @Body() b: FeedingLogDto) {
    return this.children.upsertFeedingLog(u.id, id, logId, b);
  }
  @Get(':id/feeding-logs') logs(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Query() q: FeedingQuery) {
    return this.children.listFeedingLogs(u.id, id, q);
  }
  @Delete(':id/feeding-logs/:logId') @HttpCode(204) delLog(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Param('logId', ParseUUIDPipe) logId: string) {
    return this.children.deleteFeedingLog(u.id, id, logId);
  }

  @Put(':id/food-introductions/:introId') putIntro(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Param('introId', ParseUUIDPipe) introId: string, @Body() b: FoodIntroductionDto) {
    return this.children.upsertIntroduction(u.id, id, introId, b);
  }
  @Get(':id/food-introductions') intros(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.children.listIntroductions(u.id, id);
  }
}
```
The allergies endpoint takes `{ "items": [{ "allergen", "severity" }] }` (not a bare array), because `ValidationPipe` does not validate bare arrays.

`apps/api/src/child/child.module.ts`:
```ts
import { Module } from '@nestjs/common';
import { FoodModule } from '../food/food.module';
import { ChildAccessService } from './child-access.service';
import { ChildController } from './child.controller';
import { ChildService } from './child.service';

@Module({
  imports: [FoodModule],
  controllers: [ChildController],
  providers: [ChildService, ChildAccessService],
  exports: [ChildAccessService],
})
export class ChildModule {}
```
Add `ChildModule` and `EventEmitterModule.forRoot()` to `AppModule`.

- [ ] **Step 4: Run until green**

Run: `pnpm test:e2e -- child`
Expected: 6 passed.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(child): profiles, allergies, conditions, dislikes, feeding logs, introductions"
```

---

### Task 8: Allergy check (pure function)

**Files:**
- Create: `apps/api/src/meal/allergy.ts`
- Test: `apps/api/src/meal/allergy.spec.ts`

**Interfaces:**
- Produces:
```ts
export type ChildAllergyInfo = { allergen: Allergen; severity: Severity };
export type FoodAllergenInfo = { id: string; name: string; allergens: Allergen[] };
export type AllergenMatch = { allergen: Allergen; severity: Severity; foodId: string; foodName: string };
export type AllergyVerdict = { status: 'OK' | 'CONFIRM' | 'BLOCKED'; matches: AllergenMatch[] };
export function evaluateAllergens(childAllergies: ChildAllergyInfo[], foods: FoodAllergenInfo[]): AllergyVerdict;
export function assertAllergySafe(verdict: AllergyVerdict, confirmAllergen: boolean): void; // throws ApiError 409
```

- [ ] **Step 1: Failing tests**

`apps/api/src/meal/allergy.spec.ts`:
```ts
import { ApiError } from '../common/api-error';
import { assertAllergySafe, evaluateAllergens } from './allergy';

const egg = { id: 'f1', name: 'Egg', allergens: ['EGG' as const] };
const milk = { id: 'f2', name: 'Milk', allergens: ['MILK' as const] };
const custard = { id: 'f3', name: 'Custard', allergens: ['EGG' as const, 'MILK' as const] };
const rice = { id: 'f4', name: 'Rice', allergens: [] };

describe('evaluateAllergens', () => {
  it('is OK with no allergies', () => {
    expect(evaluateAllergens([], [egg, milk]).status).toBe('OK');
  });
  it('is OK when no food matches', () => {
    expect(evaluateAllergens([{ allergen: 'EGG', severity: 'SEVERE' }], [rice, milk]).status).toBe('OK');
  });
  it('asks to confirm for mild and moderate', () => {
    expect(evaluateAllergens([{ allergen: 'EGG', severity: 'MILD' }], [egg]).status).toBe('CONFIRM');
    expect(evaluateAllergens([{ allergen: 'EGG', severity: 'MODERATE' }], [egg]).status).toBe('CONFIRM');
  });
  it('blocks for severe', () => {
    expect(evaluateAllergens([{ allergen: 'EGG', severity: 'SEVERE' }], [egg]).status).toBe('BLOCKED');
  });
  it('blocks if any match is severe even when others are mild', () => {
    const v = evaluateAllergens([{ allergen: 'EGG', severity: 'MILD' }, { allergen: 'MILK', severity: 'SEVERE' }], [custard]);
    expect(v.status).toBe('BLOCKED');
    expect(v.matches).toHaveLength(2);
  });
  it('matches derived ingredients through tags', () => {
    const v = evaluateAllergens([{ allergen: 'MILK', severity: 'MILD' }], [custard]);
    expect(v.matches).toEqual([{ allergen: 'MILK', severity: 'MILD', foodId: 'f3', foodName: 'Custard' }]);
  });
});

describe('assertAllergySafe', () => {
  const blocked = evaluateAllergens([{ allergen: 'EGG', severity: 'SEVERE' }], [egg]);
  const confirm = evaluateAllergens([{ allergen: 'EGG', severity: 'MILD' }], [egg]);
  it('never allows a severe match, even with confirmation', () => {
    expect(() => assertAllergySafe(blocked, true)).toThrow(ApiError);
    try { assertAllergySafe(blocked, true); } catch (e: any) { expect(e.getStatus()).toBe(409); expect(e.code).toBe('ALLERGEN_BLOCKED'); }
  });
  it('requires confirmation for mild/moderate', () => {
    try { assertAllergySafe(confirm, false); fail('should throw'); } catch (e: any) { expect(e.code).toBe('ALLERGEN_CONFIRM_REQUIRED'); }
    expect(() => assertAllergySafe(confirm, true)).not.toThrow();
  });
  it('passes when OK', () => {
    expect(() => assertAllergySafe({ status: 'OK', matches: [] }, false)).not.toThrow();
  });
});
```
Run: `pnpm test -- allergy` → FAIL.

- [ ] **Step 2: Implement**

`apps/api/src/meal/allergy.ts`:
```ts
import { Allergen, Severity } from '@prisma/client';
import { conflict } from '../common/api-error';

export type ChildAllergyInfo = { allergen: Allergen; severity: Severity };
export type FoodAllergenInfo = { id: string; name: string; allergens: Allergen[] };
export type AllergenMatch = { allergen: Allergen; severity: Severity; foodId: string; foodName: string };
export type AllergyVerdict = { status: 'OK' | 'CONFIRM' | 'BLOCKED'; matches: AllergenMatch[] };

export function evaluateAllergens(childAllergies: ChildAllergyInfo[], foods: FoodAllergenInfo[]): AllergyVerdict {
  const bySeverity = new Map(childAllergies.map((a) => [a.allergen, a.severity]));
  const matches: AllergenMatch[] = [];
  for (const food of foods) {
    for (const allergen of food.allergens) {
      const severity = bySeverity.get(allergen);
      if (severity) matches.push({ allergen, severity, foodId: food.id, foodName: food.name });
    }
  }
  if (matches.length === 0) return { status: 'OK', matches };
  return { status: matches.some((m) => m.severity === 'SEVERE') ? 'BLOCKED' : 'CONFIRM', matches };
}

export function assertAllergySafe(verdict: AllergyVerdict, confirmAllergen: boolean): void {
  if (verdict.status === 'BLOCKED') {
    throw conflict('ALLERGEN_BLOCKED', 'This meal contains a severe allergen for this child', verdict.matches);
  }
  if (verdict.status === 'CONFIRM' && !confirmAllergen) {
    throw conflict('ALLERGEN_CONFIRM_REQUIRED', 'This meal contains an allergen for this child. Confirm to add it.', verdict.matches);
  }
}
```

- [ ] **Step 3: Run and commit**

Run: `pnpm test -- allergy` → all pass.
```bash
git add -A && git commit -m "feat(meal): allergy evaluation and enforcement"
```

---

### Task 9: Recipes, meal plans, plan generation, grocery list

**Files:**
- Create: `apps/api/src/meal/{meal.module.ts, recipe-nutrition.ts, plan-generator.ts, grocery.ts, recipe.controller.ts, plan.controller.ts, plan.service.ts}`
- Modify: `apps/api/src/app.module.ts`
- Test: `apps/api/src/meal/recipe-nutrition.spec.ts`, `apps/api/src/meal/plan-generator.spec.ts`, `apps/api/src/meal/grocery.spec.ts`, `apps/api/test/meal.e2e-spec.ts`

**Interfaces:**
- Consumes: `evaluateAllergens`, `assertAllergySafe`, `ChildAccessService`, `ageInMonths`, `NutritionPer100g`, `resolveLww`.
- Produces:
```ts
// recipe-nutrition.ts
export type NutrientTotals = Record<keyof NutritionPer100g, number>;
export function recipeNutrition(foods: { quantityG: number; nutrition: NutritionPer100g }[], portion = 1): NutrientTotals;
export function portionForAge(ageMonths: number): number; // provisional multipliers

// plan-generator.ts
export type CandidateRecipe = { id: string; name: string; slots: MealSlot[]; suitableDiets: DietType[]; ageMinMonths: number; ageMaxMonths: number; foodIds: string[]; allergens: Allergen[] };
export type GenerateInput = {
  dates: string[];                       // 'YYYY-MM-DD'
  slots: MealSlot[];
  ageMonths: number; dietType: DietType;
  allergies: Allergen[]; dislikedFoodIds: string[];
  recipes: CandidateRecipe[];
  occupied: Set<string>;                 // `${date}|${slot}` keys that must not be filled
  varietyWindowDays: number;             // default 3
};
export type GeneratedEntry = { date: string; slot: MealSlot; recipeId: string };
export function generatePlan(input: GenerateInput): GeneratedEntry[];
export function datesBetween(from: string, to: string): string[];

// grocery.ts
export type GroceryLine = { foodId: string; foodName: string; totalG: number };
export function buildGroceryList(entries: { portion: number; foods: { foodId: string; foodName: string; quantityG: number }[] }[]): GroceryLine[];
```
- Endpoints:
  - Recipes: `GET /v1/recipes?slot&maxAgeMonths`, `GET /v1/recipes/:id` (includes foods, allergens union, per-serving nutrition); admin: `POST /v1/recipes`, `PATCH /v1/recipes/:id`, `DELETE /v1/recipes/:id`.
  - Plans: `POST /v1/children/:id/meal-plans/generate {startDate,endDate,type}` → `{ entries, skipped: string[] }`; `GET /v1/children/:id/meal-plans?from&to&updatedSince` → entries with recipe summary and `allergyStatus`; `PUT /v1/children/:id/meal-entries/:entryId {date,slot,recipeId,portion?,confirmAllergen?,clientUpdatedAt}` → `{ data, sync, warnings }`; `DELETE /v1/children/:id/meal-entries/:entryId`.
  - Grocery: `GET /v1/children/:id/grocery-list?from&to` → lines with `checked`; `PUT /v1/children/:id/grocery-list/checks {weekStart, foodId, checked, clientUpdatedAt}`.
  - Plan type window limits: DAILY = 1 day, WEEKLY = 7 days, CUSTOM = up to 31 days.

- [ ] **Step 1: Failing unit tests (nutrition, portion, generator, grocery)**

`apps/api/src/meal/recipe-nutrition.spec.ts`:
```ts
import { portionForAge, recipeNutrition } from './recipe-nutrition';

const n = (o: Partial<Record<string, number>> = {}) => ({
  calories: 100, protein: 10, carbs: 10, fat: 1, fiber: 1, iron: 1, calcium: 100, vitaminA: 10, vitaminC: 10, vitaminD: 1, zinc: 1, ...o,
}) as any;

describe('recipeNutrition', () => {
  it('scales per-100g values by grams', () => {
    const t = recipeNutrition([{ quantityG: 50, nutrition: n() }, { quantityG: 200, nutrition: n({ calories: 50 }) }]);
    expect(t.calories).toBeCloseTo(50 + 100);
    expect(t.protein).toBeCloseTo(5 + 20);
  });
  it('applies the portion multiplier', () => {
    expect(recipeNutrition([{ quantityG: 100, nutrition: n() }], 0.5).calories).toBeCloseTo(50);
  });
});

describe('portionForAge', () => {
  it.each([[6, 0.25], [11, 0.25], [12, 0.5], [47, 0.5], [48, 0.75], [107, 0.75], [108, 1]])('%i months -> %d', (m, p) => {
    expect(portionForAge(m)).toBe(p);
  });
});
```
`apps/api/src/meal/plan-generator.spec.ts`:
```ts
import { datesBetween, generatePlan, CandidateRecipe } from './plan-generator';

const r = (id: string, over: Partial<CandidateRecipe> = {}): CandidateRecipe => ({
  id, name: id, slots: ['BREAKFAST', 'LUNCH', 'DINNER'], suitableDiets: ['NON_VEGETARIAN', 'VEGETARIAN', 'VEGAN', 'PESCATARIAN'],
  ageMinMonths: 0, ageMaxMonths: 144, foodIds: [id + '-food'], allergens: [], ...over,
});
const base = {
  dates: ['2026-04-01', '2026-04-02', '2026-04-03'], slots: ['LUNCH' as const], ageMonths: 36, dietType: 'VEGETARIAN' as const,
  allergies: [], dislikedFoodIds: [], occupied: new Set<string>(), varietyWindowDays: 3,
};

describe('datesBetween', () => {
  it('is inclusive', () => expect(datesBetween('2026-04-01', '2026-04-03')).toEqual(['2026-04-01', '2026-04-02', '2026-04-03']));
  it('handles one day', () => expect(datesBetween('2026-04-01', '2026-04-01')).toEqual(['2026-04-01']));
});

describe('generatePlan', () => {
  it('fills every date/slot when recipes exist', () => {
    const out = generatePlan({ ...base, recipes: [r('a'), r('b'), r('c')] });
    expect(out).toHaveLength(3);
  });
  it('avoids repeating a recipe inside the variety window when possible', () => {
    const out = generatePlan({ ...base, recipes: [r('a'), r('b'), r('c')] });
    expect(new Set(out.map((e) => e.recipeId)).size).toBe(3);
  });
  it('repeats only when there are fewer recipes than the window', () => {
    const out = generatePlan({ ...base, recipes: [r('a'), r('b')] });
    expect(out).toHaveLength(3);
  });
  it('never includes a recipe with any allergen the child has, whatever the severity', () => {
    const out = generatePlan({ ...base, allergies: ['EGG'], recipes: [r('a', { allergens: ['EGG'] }), r('b')] });
    expect(out.every((e) => e.recipeId === 'b')).toBe(true);
  });
  it('excludes recipes containing disliked foods', () => {
    const out = generatePlan({ ...base, dislikedFoodIds: ['a-food'], recipes: [r('a'), r('b')] });
    expect(out.every((e) => e.recipeId === 'b')).toBe(true);
  });
  it('respects diet and age range', () => {
    const out = generatePlan({
      ...base, dietType: 'VEGAN',
      recipes: [r('meat', { suitableDiets: ['NON_VEGETARIAN'] }), r('young', { ageMinMonths: 48 }), r('ok')],
    });
    expect(out.every((e) => e.recipeId === 'ok')).toBe(true);
  });
  it('respects slot compatibility', () => {
    const out = generatePlan({ ...base, recipes: [r('a', { slots: ['DINNER'] }), r('b', { slots: ['LUNCH'] })] });
    expect(out.every((e) => e.recipeId === 'b')).toBe(true);
  });
  it('skips occupied slots', () => {
    const out = generatePlan({ ...base, occupied: new Set(['2026-04-02|LUNCH']), recipes: [r('a'), r('b'), r('c')] });
    expect(out.map((e) => e.date)).toEqual(['2026-04-01', '2026-04-03']);
  });
  it('leaves a slot empty when nothing qualifies', () => {
    expect(generatePlan({ ...base, recipes: [] })).toEqual([]);
  });
  it('is deterministic', () => {
    const recipes = [r('a'), r('b'), r('c')];
    expect(generatePlan({ ...base, recipes })).toEqual(generatePlan({ ...base, recipes }));
  });
});
```
`apps/api/src/meal/grocery.spec.ts`:
```ts
import { buildGroceryList } from './grocery';

describe('buildGroceryList', () => {
  it('sums grams per food across entries and scales by portion', () => {
    const list = buildGroceryList([
      { portion: 1, foods: [{ foodId: 'rice', foodName: 'Rice', quantityG: 100 }, { foodId: 'dal', foodName: 'Dal', quantityG: 50 }] },
      { portion: 0.5, foods: [{ foodId: 'rice', foodName: 'Rice', quantityG: 200 }] },
    ]);
    expect(list).toEqual([
      { foodId: 'dal', foodName: 'Dal', totalG: 50 },
      { foodId: 'rice', foodName: 'Rice', totalG: 200 },
    ]);
  });
  it('returns an empty list for no entries', () => expect(buildGroceryList([])).toEqual([]));
});
```
Run → FAIL.

- [ ] **Step 2: Implement the pure modules**

`apps/api/src/meal/recipe-nutrition.ts`:
```ts
import { NUTRIENT_KEYS, NutritionPer100g } from '../food/nutrition';

export type NutrientTotals = Record<keyof NutritionPer100g, number>;

export function recipeNutrition(foods: { quantityG: number; nutrition: NutritionPer100g }[], portion = 1): NutrientTotals {
  const totals = Object.fromEntries(NUTRIENT_KEYS.map((k) => [k, 0])) as NutrientTotals;
  for (const f of foods) {
    for (const k of NUTRIENT_KEYS) totals[k] += ((f.nutrition[k] ?? 0) * f.quantityG) / 100;
  }
  for (const k of NUTRIENT_KEYS) totals[k] = Math.round(totals[k] * portion * 100) / 100;
  return totals;
}

// PROVISIONAL: portion multipliers need nutritionist review.
export function portionForAge(ageMonths: number): number {
  if (ageMonths < 12) return 0.25;
  if (ageMonths < 48) return 0.5;
  if (ageMonths < 108) return 0.75;
  return 1;
}
```
`apps/api/src/meal/plan-generator.ts`:
```ts
import { Allergen, DietType, MealSlot } from '@prisma/client';

export type CandidateRecipe = {
  id: string; name: string; slots: MealSlot[]; suitableDiets: DietType[];
  ageMinMonths: number; ageMaxMonths: number; foodIds: string[]; allergens: Allergen[];
};
export type GenerateInput = {
  dates: string[]; slots: MealSlot[]; ageMonths: number; dietType: DietType;
  allergies: Allergen[]; dislikedFoodIds: string[]; recipes: CandidateRecipe[];
  occupied: Set<string>; varietyWindowDays: number;
};
export type GeneratedEntry = { date: string; slot: MealSlot; recipeId: string };

export function datesBetween(from: string, to: string): string[] {
  const out: string[] = [];
  for (let t = Date.parse(from); t <= Date.parse(to); t += 86_400_000) out.push(new Date(t).toISOString().slice(0, 10));
  return out;
}

export function generatePlan(input: GenerateInput): GeneratedEntry[] {
  const banned = new Set(input.allergies);
  const disliked = new Set(input.dislikedFoodIds);
  const eligible = input.recipes
    .filter((r) => r.suitableDiets.includes(input.dietType))
    .filter((r) => input.ageMonths >= r.ageMinMonths && input.ageMonths <= r.ageMaxMonths)
    .filter((r) => !r.allergens.some((a) => banned.has(a)))
    .filter((r) => !r.foodIds.some((f) => disliked.has(f)))
    .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));

  const out: GeneratedEntry[] = [];
  const lastUsedDay = new Map<string, number>(); // recipeId -> day index of last use
  input.dates.forEach((date, dayIdx) => {
    input.slots.forEach((slot, slotIdx) => {
      if (input.occupied.has(`${date}|${slot}`)) return;
      const forSlot = eligible.filter((r) => r.slots.includes(slot));
      if (forSlot.length === 0) return;
      const fresh = forSlot.filter((r) => {
        const last = lastUsedDay.get(r.id);
        return last === undefined || dayIdx - last >= input.varietyWindowDays;
      });
      const pool = fresh.length ? fresh : forSlot;
      // rotate through the pool deterministically so consecutive days differ
      const pick = pool[(dayIdx + slotIdx) % pool.length];
      lastUsedDay.set(pick.id, dayIdx);
      out.push({ date, slot, recipeId: pick.id });
    });
  });
  return out;
}
```
`apps/api/src/meal/grocery.ts`:
```ts
export type GroceryLine = { foodId: string; foodName: string; totalG: number };

export function buildGroceryList(
  entries: { portion: number; foods: { foodId: string; foodName: string; quantityG: number }[] }[],
): GroceryLine[] {
  const map = new Map<string, GroceryLine>();
  for (const e of entries) {
    for (const f of e.foods) {
      const cur = map.get(f.foodId) ?? { foodId: f.foodId, foodName: f.foodName, totalG: 0 };
      cur.totalG += f.quantityG * e.portion;
      map.set(f.foodId, cur);
    }
  }
  return [...map.values()]
    .map((l) => ({ ...l, totalG: Math.round(l.totalG * 10) / 10 }))
    .sort((a, b) => a.foodName.localeCompare(b.foodName));
}
```
Run: `pnpm test -- meal` → all pass. Verify the "avoids repeating" test: with 3 recipes over 3 days and rotation index `dayIdx+slotIdx` (slotIdx 0), picks a, b, c. Good.

- [ ] **Step 3: Failing e2e test**

`apps/api/test/meal.e2e-spec.ts`:
```ts
import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'crypto';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp, makeAdmin, registerAndLogin, resetDb } from './helpers';

const nutrition = { calories: 100, protein: 5, carbs: 15, fat: 2, fiber: 1, iron: 1, calcium: 50, vitaminA: 10, vitaminC: 5, vitaminD: 0, zinc: 1 };

describe('meals', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const http = () => request(app.getHttpServer());
  beforeAll(async () => { app = await createTestApp(); prisma = app.get(PrismaService); });
  beforeEach(() => resetDb(prisma));
  afterAll(() => app.close());

  async function seed() {
    const rice = await prisma.food.create({ data: { name: 'Rice', category: 'Grains', nutrition } });
    const egg = await prisma.food.create({ data: { name: 'Egg', category: 'Protein', allergens: ['EGG'], nutrition } });
    const dal = await prisma.food.create({ data: { name: 'Dal', category: 'Pulses', nutrition } });
    const mk = (name: string, foods: { id: string }[]) =>
      prisma.recipe.create({
        data: {
          name, instructions: 'Cook.', prepMinutes: 15, ageMinMonths: 12, slots: ['LUNCH', 'DINNER'],
          suitableDiets: ['NON_VEGETARIAN', 'VEGETARIAN'],
          foods: { create: foods.map((f) => ({ foodId: f.id, quantityG: 100 })) },
        },
      });
    return { rice, egg, dal, riceDal: await mk('Rice and dal', [rice, dal]), eggRice: await mk('Egg rice', [egg, rice]) };
  }

  async function parentWithChild(allergies: object[] = []) {
    const p = await registerAndLogin(app);
    const auth = { Authorization: `Bearer ${p.token}` };
    const child = (await http().post('/v1/children').set(auth).send({ name: 'Amina', dateOfBirth: '2023-01-10', gender: 'FEMALE' })).body;
    if (allergies.length) await http().put(`/v1/children/${child.id}/allergies`).set(auth).send({ items: allergies });
    return { auth, child };
  }

  it('generates a plan that never contains a recipe with the child\'s allergen', async () => {
    const s = await seed();
    const { auth, child } = await parentWithChild([{ allergen: 'EGG', severity: 'MILD' }]);
    const res = await http().post(`/v1/children/${child.id}/meal-plans/generate`).set(auth)
      .send({ startDate: '2026-04-01', endDate: '2026-04-07', type: 'WEEKLY' }).expect(201);
    expect(res.body.entries.length).toBeGreaterThan(0);
    expect(res.body.entries.every((e: any) => e.recipeId === s.riceDal.id)).toBe(true);
  });

  it('rejects a window that does not match the plan type', async () => {
    await seed();
    const { auth, child } = await parentWithChild();
    await http().post(`/v1/children/${child.id}/meal-plans/generate`).set(auth)
      .send({ startDate: '2026-04-01', endDate: '2026-04-05', type: 'DAILY' }).expect(400);
  });

  it('blocks a severe allergen on manual add, even with confirmation', async () => {
    const s = await seed();
    const { auth, child } = await parentWithChild([{ allergen: 'EGG', severity: 'SEVERE' }]);
    const res = await http().put(`/v1/children/${child.id}/meal-entries/${randomUUID()}`).set(auth)
      .send({ date: '2026-04-01', slot: 'LUNCH', recipeId: s.eggRice.id, confirmAllergen: true, clientUpdatedAt: '2026-04-01T08:00:00Z' }).expect(409);
    expect(res.body.code).toBe('ALLERGEN_BLOCKED');
  });

  it('requires confirmation for a mild allergen, then accepts it', async () => {
    const s = await seed();
    const { auth, child } = await parentWithChild([{ allergen: 'EGG', severity: 'MILD' }]);
    const id = randomUUID();
    const url = `/v1/children/${child.id}/meal-entries/${id}`;
    const body = { date: '2026-04-01', slot: 'LUNCH', recipeId: s.eggRice.id, clientUpdatedAt: '2026-04-01T08:00:00Z' };
    const first = await http().put(url).set(auth).send(body).expect(409);
    expect(first.body.code).toBe('ALLERGEN_CONFIRM_REQUIRED');
    const ok = await http().put(url).set(auth).send({ ...body, confirmAllergen: true }).expect(200);
    expect(ok.body.warnings).toHaveLength(1);
  });

  it('applies last-write-wins to entries and keeps one entry per slot', async () => {
    const s = await seed();
    const { auth, child } = await parentWithChild();
    const id = randomUUID();
    const url = `/v1/children/${child.id}/meal-entries/${id}`;
    const body = (recipeId: string, ts: string) => ({ date: '2026-04-01', slot: 'LUNCH', recipeId, clientUpdatedAt: ts });
    await http().put(url).set(auth).send(body(s.riceDal.id, '2026-04-01T10:00:00Z')).expect(200);
    const stale = await http().put(url).set(auth).send(body(s.eggRice.id, '2026-04-01T09:00:00Z')).expect(200);
    expect(stale.body.sync.superseded).toBe(true);
    expect(stale.body.data.recipeId).toBe(s.riceDal.id);
    await http().put(`/v1/children/${child.id}/meal-entries/${randomUUID()}`).set(auth)
      .send(body(s.riceDal.id, '2026-04-01T11:00:00Z')).expect(409); // slot taken by another entry
  });

  it('builds an aggregated grocery list and remembers check-offs', async () => {
    const s = await seed();
    const { auth, child } = await parentWithChild();
    for (const [d, r] of [['2026-04-01', s.riceDal.id], ['2026-04-02', s.riceDal.id]]) {
      await http().put(`/v1/children/${child.id}/meal-entries/${randomUUID()}`).set(auth)
        .send({ date: d, slot: 'LUNCH', recipeId: r, portion: 1, clientUpdatedAt: '2026-04-01T08:00:00Z' }).expect(200);
    }
    const list = await http().get(`/v1/children/${child.id}/grocery-list?from=2026-04-01&to=2026-04-07`).set(auth).expect(200);
    expect(list.body.lines).toEqual([
      expect.objectContaining({ foodName: 'Dal', totalG: 200, checked: false }),
      expect.objectContaining({ foodName: 'Rice', totalG: 200, checked: false }),
    ]);
    await http().put(`/v1/children/${child.id}/grocery-list/checks`).set(auth)
      .send({ weekStart: '2026-04-01', foodId: s.rice.id, checked: true, clientUpdatedAt: '2026-04-01T09:00:00Z' }).expect(200);
    const again = await http().get(`/v1/children/${child.id}/grocery-list?from=2026-04-01&to=2026-04-07`).set(auth);
    expect(again.body.lines.find((l: any) => l.foodName === 'Rice').checked).toBe(true);
  });

  it('lets admins manage recipes and returns per-serving nutrition', async () => {
    const s = await seed();
    const admin = await makeAdmin(app);
    const res = await http().get(`/v1/recipes/${s.riceDal.id}`).set('Authorization', `Bearer ${admin.token}`).expect(200);
    expect(res.body.nutrition.calories).toBeCloseTo(200);
    expect(res.body.allergens).toEqual([]);
    const egg = await http().get(`/v1/recipes/${s.eggRice.id}`).set('Authorization', `Bearer ${admin.token}`);
    expect(egg.body.allergens).toEqual(['EGG']);
  });
});
```
Run → FAIL.

- [ ] **Step 4: Implement the service, controllers and module**

`apps/api/src/meal/plan.service.ts`:
```ts
import { Injectable } from '@nestjs/common';
import { MealSlot, PlanType, Prisma } from '@prisma/client';
import { ageInMonths } from '../common/age';
import { ApiError, conflict, notFound } from '../common/api-error';
import { resolveLww } from '../common/lww';
import { ChildAccessService } from '../child/child-access.service';
import { NutritionPer100g } from '../food/nutrition';
import { PrismaService } from '../prisma/prisma.service';
import { assertAllergySafe, evaluateAllergens } from './allergy';
import { buildGroceryList } from './grocery';
import { datesBetween, generatePlan } from './plan-generator';
import { portionForAge, recipeNutrition } from './recipe-nutrition';

const ALL_SLOTS: MealSlot[] = ['BREAKFAST', 'LUNCH', 'MORNING_SNACK', 'AFTERNOON_SNACK', 'DINNER'];
const MAX_DAYS: Record<PlanType, number> = { DAILY: 1, WEEKLY: 7, CUSTOM: 31 };
const day = (s: string) => new Date(`${s}T00:00:00Z`);
const iso = (d: Date) => d.toISOString().slice(0, 10);

export const recipeInclude = { foods: { include: { food: true } } } satisfies Prisma.RecipeInclude;
export type RecipeWithFoods = Prisma.RecipeGetPayload<{ include: typeof recipeInclude }>;

export function recipeView(r: RecipeWithFoods, portion = 1) {
  return {
    id: r.id, name: r.name, instructions: r.instructions, prepMinutes: r.prepMinutes,
    ageMinMonths: r.ageMinMonths, ageMaxMonths: r.ageMaxMonths, slots: r.slots, suitableDiets: r.suitableDiets,
    foods: r.foods.map((f) => ({ foodId: f.foodId, name: f.food.name, quantityG: Number(f.quantityG) })),
    allergens: [...new Set(r.foods.flatMap((f) => f.food.allergens))].sort(),
    nutrition: recipeNutrition(r.foods.map((f) => ({ quantityG: Number(f.quantityG), nutrition: f.food.nutrition as NutritionPer100g })), portion),
  };
}

@Injectable()
export class PlanService {
  constructor(private readonly prisma: PrismaService, private readonly access: ChildAccessService) {}

  async generate(userId: string, childId: string, dto: { startDate: string; endDate: string; type: PlanType }) {
    const child = await this.access.assertOwned(userId, childId);
    const dates = datesBetween(dto.startDate, dto.endDate);
    if (dates.length === 0 || dates.length > MAX_DAYS[dto.type] || (dto.type !== 'CUSTOM' && dates.length !== MAX_DAYS[dto.type])) {
      throw new ApiError(400, 'INVALID_PLAN_WINDOW', `A ${dto.type} plan must cover ${dto.type === 'DAILY' ? '1 day' : dto.type === 'WEEKLY' ? '7 days' : 'at most 31 days'}`);
    }
    const [allergies, dislikes, recipes, existing] = await Promise.all([
      this.prisma.childAllergy.findMany({ where: { childId } }),
      this.prisma.foodDislike.findMany({ where: { childId } }),
      this.prisma.recipe.findMany({ include: recipeInclude }),
      this.prisma.mealPlanEntry.findMany({ where: { childId, date: { gte: day(dto.startDate), lte: day(dto.endDate) } } }),
    ]);
    const ageMonths = ageInMonths(child.dateOfBirth);
    const generated = generatePlan({
      dates, slots: ALL_SLOTS, ageMonths, dietType: child.dietType,
      allergies: allergies.map((a) => a.allergen), dislikedFoodIds: dislikes.map((d) => d.foodId),
      recipes: recipes.map((r) => ({
        id: r.id, name: r.name, slots: r.slots, suitableDiets: r.suitableDiets, ageMinMonths: r.ageMinMonths, ageMaxMonths: r.ageMaxMonths,
        foodIds: r.foods.map((f) => f.foodId), allergens: [...new Set(r.foods.flatMap((f) => f.food.allergens))],
      })),
      occupied: new Set(existing.map((e) => `${iso(e.date)}|${e.slot}`)),
      varietyWindowDays: 3,
    });
    const portion = portionForAge(ageMonths);
    const now = new Date();
    const entries = await this.prisma.$transaction(
      generated.map((g) =>
        this.prisma.mealPlanEntry.create({
          data: { id: crypto.randomUUID(), childId, date: day(g.date), slot: g.slot, recipeId: g.recipeId, portion, createdBy: 'SYSTEM', clientUpdatedAt: now },
        }),
      ),
    );
    return { entries: entries.map((e) => ({ ...e, date: iso(e.date), portion: Number(e.portion) })) };
  }

  async list(userId: string, childId: string, q: { from?: string; to?: string; updatedSince?: string }) {
    await this.access.assertOwned(userId, childId);
    const [allergies, rows] = await Promise.all([
      this.prisma.childAllergy.findMany({ where: { childId } }),
      this.prisma.mealPlanEntry.findMany({
        where: {
          childId,
          ...(q.from || q.to ? { date: { ...(q.from ? { gte: day(q.from) } : {}), ...(q.to ? { lte: day(q.to) } : {}) } } : {}),
          ...(q.updatedSince ? { updatedAt: { gt: new Date(q.updatedSince) } } : {}),
        },
        include: { recipe: { include: recipeInclude } },
        orderBy: [{ date: 'asc' }, { slot: 'asc' }],
      }),
    ]);
    return rows.map((e) => {
      const foods = e.recipe.foods.map((f) => ({ id: f.foodId, name: f.food.name, allergens: f.food.allergens }));
      return {
        id: e.id, date: iso(e.date), slot: e.slot, portion: Number(e.portion), createdBy: e.createdBy, clientUpdatedAt: e.clientUpdatedAt,
        allergyStatus: evaluateAllergens(allergies, foods).status,
        recipe: recipeView(e.recipe, Number(e.portion)),
      };
    });
  }

  async putEntry(
    userId: string, childId: string, entryId: string,
    dto: { date: string; slot: MealSlot; recipeId: string; portion?: number; confirmAllergen?: boolean; clientUpdatedAt: string },
  ) {
    const child = await this.access.assertOwned(userId, childId);
    const recipe = await this.prisma.recipe.findUnique({ where: { id: dto.recipeId }, include: recipeInclude });
    if (!recipe) throw notFound('Recipe');
    const existing = await this.prisma.mealPlanEntry.findUnique({ where: { id: entryId } });
    if (existing && existing.childId !== childId) throw conflict('ID_IN_USE', 'This id belongs to another record');
    const { apply, superseded } = resolveLww(existing, new Date(dto.clientUpdatedAt));
    if (!apply) return { data: existing, sync: { superseded }, warnings: [] };

    const allergies = await this.prisma.childAllergy.findMany({ where: { childId } });
    const verdict = evaluateAllergens(allergies, recipe.foods.map((f) => ({ id: f.foodId, name: f.food.name, allergens: f.food.allergens })));
    assertAllergySafe(verdict, dto.confirmAllergen === true);

    const slotTaken = await this.prisma.mealPlanEntry.findFirst({
      where: { childId, date: day(dto.date), slot: dto.slot, NOT: { id: entryId } },
    });
    if (slotTaken) throw conflict('SLOT_TAKEN', 'This meal slot already has an entry');

    const data = {
      date: day(dto.date), slot: dto.slot, recipeId: dto.recipeId,
      portion: dto.portion ?? portionForAge(ageInMonths(child.dateOfBirth)),
      createdBy: 'PARENT' as const, clientUpdatedAt: new Date(dto.clientUpdatedAt),
    };
    const row = await this.prisma.mealPlanEntry.upsert({ where: { id: entryId }, create: { id: entryId, childId, ...data }, update: data });
    return { data: { ...row, date: iso(row.date), portion: Number(row.portion) }, sync: { superseded: false }, warnings: verdict.matches };
  }

  async deleteEntry(userId: string, childId: string, entryId: string) {
    await this.access.assertOwned(userId, childId);
    await this.prisma.mealPlanEntry.deleteMany({ where: { id: entryId, childId } });
  }

  async groceryList(userId: string, childId: string, from: string, to: string) {
    await this.access.assertOwned(userId, childId);
    const entries = await this.prisma.mealPlanEntry.findMany({
      where: { childId, date: { gte: day(from), lte: day(to) } },
      include: { recipe: { include: recipeInclude } },
    });
    const lines = buildGroceryList(
      entries.map((e) => ({
        portion: Number(e.portion),
        foods: e.recipe.foods.map((f) => ({ foodId: f.foodId, foodName: f.food.name, quantityG: Number(f.quantityG) })),
      })),
    );
    const checks = await this.prisma.groceryCheck.findMany({ where: { childId, weekStart: day(from) } });
    const checked = new Map(checks.map((c) => [c.foodId, c.checked]));
    return { weekStart: from, lines: lines.map((l) => ({ ...l, checked: checked.get(l.foodId) ?? false })) };
  }

  async setCheck(userId: string, childId: string, dto: { weekStart: string; foodId: string; checked: boolean; clientUpdatedAt: string }) {
    await this.access.assertOwned(userId, childId);
    const key = { childId_foodId_weekStart: { childId, foodId: dto.foodId, weekStart: day(dto.weekStart) } };
    const existing = await this.prisma.groceryCheck.findUnique({ where: key });
    const { apply, superseded } = resolveLww(existing, new Date(dto.clientUpdatedAt));
    if (apply) {
      await this.prisma.groceryCheck.upsert({
        where: key,
        create: { childId, foodId: dto.foodId, weekStart: day(dto.weekStart), checked: dto.checked, clientUpdatedAt: new Date(dto.clientUpdatedAt) },
        update: { checked: dto.checked, clientUpdatedAt: new Date(dto.clientUpdatedAt) },
      });
    }
    return { sync: { superseded } };
  }
}
```
Use `import { randomUUID } from 'crypto'` and replace `crypto.randomUUID()` accordingly.

`apps/api/src/meal/plan.controller.ts`:
```ts
import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post, Put, Query } from '@nestjs/common';
import { MealSlot, PlanType } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsBoolean, IsDateString, IsEnum, IsNumber, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { AuthUser, CurrentUser } from '../common/current-user';
import { PlanService } from './plan.service';

class GenerateDto {
  @IsDateString() startDate!: string;
  @IsDateString() endDate!: string;
  @IsEnum(PlanType) type!: PlanType;
}
class EntryDto {
  @IsDateString() date!: string;
  @IsEnum(MealSlot) slot!: MealSlot;
  @IsUUID() recipeId!: string;
  @IsOptional() @IsNumber() @Min(0.1) @Max(3) portion?: number;
  @IsOptional() @IsBoolean() confirmAllergen?: boolean;
  @IsDateString() clientUpdatedAt!: string;
}
class RangeQuery {
  @IsOptional() @IsDateString() from?: string;
  @IsOptional() @IsDateString() to?: string;
  @IsOptional() @IsDateString() updatedSince?: string;
}
class GroceryQuery {
  @IsDateString() from!: string;
  @IsDateString() to!: string;
}
class CheckDto {
  @IsDateString() weekStart!: string;
  @IsUUID() foodId!: string;
  @IsBoolean() checked!: boolean;
  @IsDateString() clientUpdatedAt!: string;
}

@Controller('children/:childId')
export class PlanController {
  constructor(private readonly plans: PlanService) {}

  @Post('meal-plans/generate') generate(@CurrentUser() u: AuthUser, @Param('childId', ParseUUIDPipe) c: string, @Body() b: GenerateDto) {
    return this.plans.generate(u.id, c, b);
  }
  @Get('meal-plans') list(@CurrentUser() u: AuthUser, @Param('childId', ParseUUIDPipe) c: string, @Query() q: RangeQuery) {
    return this.plans.list(u.id, c, q);
  }
  @Put('meal-entries/:entryId') put(@CurrentUser() u: AuthUser, @Param('childId', ParseUUIDPipe) c: string, @Param('entryId', ParseUUIDPipe) e: string, @Body() b: EntryDto) {
    return this.plans.putEntry(u.id, c, e, b);
  }
  @Delete('meal-entries/:entryId') @HttpCode(204) del(@CurrentUser() u: AuthUser, @Param('childId', ParseUUIDPipe) c: string, @Param('entryId', ParseUUIDPipe) e: string) {
    return this.plans.deleteEntry(u.id, c, e);
  }
  @Get('grocery-list') grocery(@CurrentUser() u: AuthUser, @Param('childId', ParseUUIDPipe) c: string, @Query() q: GroceryQuery) {
    return this.plans.groceryList(u.id, c, q.from, q.to);
  }
  @Put('grocery-list/checks') check(@CurrentUser() u: AuthUser, @Param('childId', ParseUUIDPipe) c: string, @Body() b: CheckDto) {
    return this.plans.setCheck(u.id, c, b);
  }
}
```
`apps/api/src/meal/recipe.controller.ts`:
```ts
import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { DietType, MealSlot } from '@prisma/client';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsEnum, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, Min, ValidateNested } from 'class-validator';
import { notFound } from '../common/api-error';
import { Roles } from '../common/roles.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { recipeInclude, recipeView } from './plan.service';

class RecipeFoodDto {
  @IsUUID() foodId!: string;
  @IsNumber() @Min(1) quantityG!: number;
}
class RecipeDto {
  @IsString() @IsNotEmpty() name!: string;
  @IsString() @IsNotEmpty() instructions!: string;
  @IsInt() @Min(0) prepMinutes!: number;
  @IsInt() @Min(0) ageMinMonths!: number;
  @IsInt() @Min(0) ageMaxMonths!: number;
  @IsArray() @ArrayMinSize(1) @IsEnum(MealSlot, { each: true }) slots!: MealSlot[];
  @IsArray() @ArrayMinSize(1) @IsEnum(DietType, { each: true }) suitableDiets!: DietType[];
  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => RecipeFoodDto) foods!: RecipeFoodDto[];
}
class UpdateRecipeDto extends RecipeDto {}
class RecipeQuery {
  @IsOptional() @IsEnum(MealSlot) slot?: MealSlot;
  @IsOptional() @Type(() => Number) @IsInt() maxAgeMonths?: number;
}

@Controller('recipes')
export class RecipeController {
  constructor(private readonly prisma: PrismaService) {}

  @Get() async list(@Query() q: RecipeQuery) {
    const rows = await this.prisma.recipe.findMany({
      where: { ...(q.slot ? { slots: { has: q.slot } } : {}), ...(q.maxAgeMonths !== undefined ? { ageMinMonths: { lte: q.maxAgeMonths }, ageMaxMonths: { gte: q.maxAgeMonths } } : {}) },
      include: recipeInclude, orderBy: { name: 'asc' },
    });
    return rows.map((r) => recipeView(r));
  }

  @Get(':id') async get(@Param('id', ParseUUIDPipe) id: string) {
    const r = await this.prisma.recipe.findUnique({ where: { id }, include: recipeInclude });
    if (!r) throw notFound('Recipe');
    return recipeView(r);
  }

  @Roles('ADMIN') @Post() async create(@Body() b: RecipeDto) {
    const { foods, ...rest } = b;
    const r = await this.prisma.recipe.create({ data: { ...rest, foods: { create: foods } }, include: recipeInclude });
    return recipeView(r);
  }

  @Roles('ADMIN') @Patch(':id') async update(@Param('id', ParseUUIDPipe) id: string, @Body() b: UpdateRecipeDto) {
    const { foods, ...rest } = b;
    await this.get(id);
    const r = await this.prisma.recipe.update({
      where: { id }, data: { ...rest, foods: { deleteMany: {}, create: foods } }, include: recipeInclude,
    });
    return recipeView(r);
  }

  @Roles('ADMIN') @Delete(':id') @HttpCode(204) async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.get(id);
    await this.prisma.recipe.delete({ where: { id } });
  }
}
```
`apps/api/src/meal/meal.module.ts`:
```ts
import { Module } from '@nestjs/common';
import { ChildModule } from '../child/child.module';
import { PlanController } from './plan.controller';
import { PlanService } from './plan.service';
import { RecipeController } from './recipe.controller';

@Module({ imports: [ChildModule], controllers: [PlanController, RecipeController], providers: [PlanService], exports: [PlanService] })
export class MealModule {}
```
Add `MealModule` to `AppModule`.

- [ ] **Step 5: Run everything and fix**

Run: `pnpm test && pnpm test:e2e -- meal`
Expected: unit specs and 7 e2e tests pass. If the "blocks severe allergen" test returns 400 instead of 409, check `EntryDto` validation; if `recipeId` is not a UUID the pipe rejects it first.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat(meal): recipes, plan generation, allergy-enforced entries, grocery list"
```

---

### Task 10: Growth module (WHO percentiles, records, chart data, PDF)

**Files:**
- Create: `apps/api/src/growth/{growth.module.ts, who-lms.ts, growth.service.ts, growth.controller.ts, growth-pdf.ts}`, `data/who/README.md`, `data/who/{wfa,hfa,bfa,hcfa}_{boys,girls}.json`, `apps/api/scripts/import-who.ts`
- Modify: `apps/api/src/app.module.ts`
- Test: `apps/api/src/growth/who-lms.spec.ts`, `apps/api/test/growth.e2e-spec.ts`

**Interfaces:**
- Consumes: `ChildAccessService`, `ageInMonths`, `resolveLww`.
- Produces:
```ts
export type Indicator = 'WFA' | 'HFA' | 'BFA' | 'HCFA'; // weight/height/BMI/head-circumference for age
export type LmsRow = { ageMonths: number; L: number; M: number; S: number };
export function zScore(value: number, row: { L: number; M: number; S: number }): number;
export function normalCdf(z: number): number;
export function percentileFromZ(z: number): number;           // 0..100, 1 decimal
export function lmsAt(table: LmsRow[], ageMonths: number): LmsRow; // linear interpolation between rows
export function valueAtZ(z: number, row: { L: number; M: number; S: number }): number; // inverse, for reference curves
export type GrowthStatus = 'UNDERWEIGHT' | 'NORMAL' | 'OVERWEIGHT';
export function bmiStatus(z: number): GrowthStatus;           // < -2 UNDERWEIGHT, > 2 OVERWEIGHT, else NORMAL (PROVISIONAL)
export class WhoTables { constructor(tables: Record<string, LmsRow[]>); table(ind: Indicator, gender: Gender): LmsRow[]; }
```
- `GrowthService.computeRecord(child, record): { weight?: Measure; height?: Measure; bmi?: Measure; head?: Measure }` where `Measure = { value: number; z: number; percentile: number }`.
- Endpoints: `PUT /v1/children/:id/growth-records/:recId {date,heightCm?,weightKg?,headCircumferenceCm?,clientUpdatedAt}` → `{ data, sync, measures }`; `GET /v1/children/:id/growth-records?updatedSince`; `DELETE .../growth-records/:recId`; `GET /v1/children/:id/growth/chart` → `{ provisional: true, points: [...], reference: { WFA: { p3:[{ageMonths,value}], p15, p50, p85, p97 }, ... } }`; `GET /v1/children/:id/growth/export.pdf`.

- [ ] **Step 1: Failing math tests**

`apps/api/src/growth/who-lms.spec.ts`:
```ts
import { bmiStatus, lmsAt, normalCdf, percentileFromZ, valueAtZ, zScore } from './who-lms';

describe('WHO LMS maths', () => {
  const boysWfa0 = { L: 0.3487, M: 3.3464, S: 0.14602 }; // WHO weight-for-age, boys, birth

  it('gives z = 0 and the 50th percentile at the median', () => {
    expect(zScore(3.3464, boysWfa0)).toBeCloseTo(0, 6);
    expect(percentileFromZ(0)).toBe(50);
  });
  it('is symmetric: z(+1) ~ 84.1, z(-1) ~ 15.9', () => {
    expect(normalCdf(1)).toBeCloseTo(0.8413, 4);
    expect(normalCdf(-1)).toBeCloseTo(0.1587, 4);
  });
  it('uses the log form when L = 0', () => {
    expect(zScore(Math.E * 10, { L: 0, M: 10, S: 1 })).toBeCloseTo(1, 6);
  });
  it('round-trips value -> z -> value', () => {
    const z = zScore(4.2, boysWfa0);
    expect(valueAtZ(z, boysWfa0)).toBeCloseTo(4.2, 5);
  });
  it('interpolates linearly between rows and clamps at the ends', () => {
    const t = [{ ageMonths: 0, L: 1, M: 10, S: 0.1 }, { ageMonths: 2, L: 1, M: 14, S: 0.2 }];
    expect(lmsAt(t, 1)).toEqual({ ageMonths: 1, L: 1, M: 12, S: 0.15000000000000002 });
    expect(lmsAt(t, -1).M).toBe(10);
    expect(lmsAt(t, 99).M).toBe(14);
  });
  it('classifies BMI z-scores (provisional thresholds)', () => {
    expect(bmiStatus(-2.1)).toBe('UNDERWEIGHT');
    expect(bmiStatus(0)).toBe('NORMAL');
    expect(bmiStatus(2.1)).toBe('OVERWEIGHT');
  });
});
```
Run → FAIL.

- [ ] **Step 2: Implement the maths**

`apps/api/src/growth/who-lms.ts`:
```ts
import { Gender } from '@prisma/client';

export type Indicator = 'WFA' | 'HFA' | 'BFA' | 'HCFA';
export type LmsRow = { ageMonths: number; L: number; M: number; S: number };
export type GrowthStatus = 'UNDERWEIGHT' | 'NORMAL' | 'OVERWEIGHT';

export function zScore(x: number, { L, M, S }: { L: number; M: number; S: number }): number {
  return L === 0 ? Math.log(x / M) / S : (Math.pow(x / M, L) - 1) / (L * S);
}

export function valueAtZ(z: number, { L, M, S }: { L: number; M: number; S: number }): number {
  return L === 0 ? M * Math.exp(S * z) : M * Math.pow(1 + L * S * z, 1 / L);
}

// Abramowitz & Stegun 7.1.26 approximation of the error function
function erf(x: number): number {
  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * ax);
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-ax * ax);
  return sign * y;
}
export const normalCdf = (z: number) => 0.5 * (1 + erf(z / Math.SQRT2));
export const percentileFromZ = (z: number) => Math.round(normalCdf(z) * 1000) / 10;

export function lmsAt(table: LmsRow[], ageMonths: number): LmsRow {
  if (ageMonths <= table[0].ageMonths) return table[0];
  const last = table[table.length - 1];
  if (ageMonths >= last.ageMonths) return last;
  const hi = table.findIndex((r) => r.ageMonths >= ageMonths);
  const a = table[hi - 1];
  const b = table[hi];
  const f = (ageMonths - a.ageMonths) / (b.ageMonths - a.ageMonths);
  return { ageMonths, L: a.L + f * (b.L - a.L), M: a.M + f * (b.M - a.M), S: a.S + f * (b.S - a.S) };
}

// PROVISIONAL thresholds; need medical advisor approval.
export function bmiStatus(z: number): GrowthStatus {
  if (z < -2) return 'UNDERWEIGHT';
  if (z > 2) return 'OVERWEIGHT';
  return 'NORMAL';
}

export class WhoTables {
  constructor(private readonly tables: Record<string, LmsRow[]>) {}
  table(ind: Indicator, gender: Gender): LmsRow[] {
    const key = `${ind}_${gender}`;
    const t = this.tables[key];
    if (!t?.length) throw new Error(`Missing WHO table ${key}`);
    return t;
  }
}
```
Run: `pnpm test -- who-lms` → PASS.

- [ ] **Step 3: Obtain the WHO data**

The numbers must come from WHO, not from memory. Do:
1. Download the WHO Child Growth Standards LMS tables (0–5 years: weight-for-age, length/height-for-age, BMI-for-age, head-circumference-for-age; boys and girls) and the WHO 2007 growth reference tables (5–19 years: height-for-age and BMI-for-age; weight-for-age to 10 years) from the WHO website's "Child growth standards" and "Growth reference data for 5–19 years" pages. Save raw files to `data/who/raw/` (gitignored if large).
2. Write `apps/api/scripts/import-who.ts` that reads each raw table (columns Month/Age, L, M, S) and writes `data/who/<ind>_<gender>.json` as `[{ "ageMonths": 0, "L": 0.3487, "M": 3.3464, "S": 0.14602 }, ...]` sorted by `ageMonths`. For height-for-age and BMI-for-age, concatenate the 0–60 month standard rows and the 61–228 month reference rows. Weight-for-age covers 0–120 months; head circumference covers 0–60 months.
3. `data/who/README.md` records the source URLs, the download date and the checksum of each raw file.

Sanity checks (these are published WHO values, used here as a guard against import errors): boys weight-for-age at 0 months has L=0.3487, M=3.3464, S=0.14602; girls L=0.3809, M=3.2322, S=0.14171; boys length-for-age at 0 months M=49.8842, S=0.03795; girls M=49.1477, S=0.0379. Add them as a test:

`apps/api/src/growth/who-data.spec.ts`:
```ts
import { readFileSync } from 'fs';
import { resolve } from 'path';

const load = (f: string) => JSON.parse(readFileSync(resolve(__dirname, '../../../../data/who', f), 'utf8')) as { ageMonths: number; L: number; M: number; S: number }[];

describe('WHO data files', () => {
  it('boys weight-for-age at birth', () => expect(load('WFA_MALE.json')[0]).toMatchObject({ ageMonths: 0, L: 0.3487, M: 3.3464, S: 0.14602 }));
  it('girls weight-for-age at birth', () => expect(load('WFA_FEMALE.json')[0]).toMatchObject({ ageMonths: 0, L: 0.3809, M: 3.2322, S: 0.14171 }));
  it('boys length-for-age at birth', () => expect(load('HFA_MALE.json')[0]).toMatchObject({ ageMonths: 0, M: 49.8842, S: 0.03795 }));
  it.each(['WFA', 'HFA', 'BFA', 'HCFA'])('%s tables are sorted with no gaps larger than 1 month', (ind) => {
    for (const g of ['MALE', 'FEMALE']) {
      const t = load(`${ind}_${g}.json`);
      for (let i = 1; i < t.length; i++) {
        expect(t[i].ageMonths).toBeGreaterThan(t[i - 1].ageMonths);
        expect(t[i].ageMonths - t[i - 1].ageMonths).toBeLessThanOrEqual(1);
      }
    }
  });
});
```
File names use the Prisma `Gender` values (`MALE`, `FEMALE`) so the loader can build keys as `${ind}_${gender}`.
Run: `pnpm test -- who-data` → PASS once the import is done. If a sanity value differs, the import is wrong or the file is the wrong table; fix the import, do not edit the test.

- [ ] **Step 4: Growth service, controller, PDF, module**

`apps/api/src/growth/growth.service.ts`:
```ts
import { Injectable } from '@nestjs/common';
import { Child, Gender, GrowthRecord } from '@prisma/client';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { ageInMonths } from '../common/age';
import { ApiError } from '../common/api-error';
import { resolveLww } from '../common/lww';
import { ChildAccessService } from '../child/child-access.service';
import { PrismaService } from '../prisma/prisma.service';
import { bmiStatus, Indicator, lmsAt, LmsRow, percentileFromZ, valueAtZ, WhoTables, zScore } from './who-lms';

export type Measure = { value: number; z: number; percentile: number };
const IND: Indicator[] = ['WFA', 'HFA', 'BFA', 'HCFA'];
const Z_LINES = { p3: -1.88079, p15: -1.03643, p50: 0, p85: 1.03643, p97: 1.88079 };
const iso = (d: Date) => d.toISOString().slice(0, 10);

function loadTables(): WhoTables {
  const dir = resolve(__dirname, '../../../../data/who');
  const t: Record<string, LmsRow[]> = {};
  for (const i of IND) for (const g of ['MALE', 'FEMALE']) t[`${i}_${g}`] = JSON.parse(readFileSync(`${dir}/${i}_${g}.json`, 'utf8'));
  return new WhoTables(t);
}

@Injectable()
export class GrowthService {
  private readonly who = loadTables();
  constructor(private readonly prisma: PrismaService, private readonly access: ChildAccessService) {}

  private measure(ind: Indicator, gender: Gender, ageMonths: number, value: number): Measure {
    const z = zScore(value, lmsAt(this.who.table(ind, gender), ageMonths));
    return { value, z: Math.round(z * 100) / 100, percentile: percentileFromZ(z) };
  }

  measures(child: Pick<Child, 'dateOfBirth' | 'gender'>, r: Pick<GrowthRecord, 'date' | 'heightCm' | 'weightKg' | 'headCircumferenceCm'>) {
    const age = ageInMonths(child.dateOfBirth, r.date);
    const out: { weight?: Measure; height?: Measure; bmi?: Measure; head?: Measure; bmiStatus?: string } = {};
    const w = r.weightKg ? Number(r.weightKg) : undefined;
    const h = r.heightCm ? Number(r.heightCm) : undefined;
    const hc = r.headCircumferenceCm ? Number(r.headCircumferenceCm) : undefined;
    if (w !== undefined) out.weight = this.measure('WFA', child.gender, age, w);
    if (h !== undefined) out.height = this.measure('HFA', child.gender, age, h);
    if (w !== undefined && h !== undefined) {
      const bmi = w / Math.pow(h / 100, 2);
      out.bmi = this.measure('BFA', child.gender, age, Math.round(bmi * 10) / 10);
      out.bmiStatus = bmiStatus(out.bmi.z);
    }
    if (hc !== undefined && age <= 60) out.head = this.measure('HCFA', child.gender, age, hc);
    return out;
  }

  async upsert(userId: string, childId: string, recId: string, dto: { date: string; heightCm?: number; weightKg?: number; headCircumferenceCm?: number; clientUpdatedAt: string }) {
    const child = await this.access.assertOwned(userId, childId);
    if (dto.heightCm === undefined && dto.weightKg === undefined && dto.headCircumferenceCm === undefined) {
      throw new ApiError(400, 'EMPTY_RECORD', 'Provide at least one measurement');
    }
    if (new Date(dto.date) < child.dateOfBirth) throw new ApiError(400, 'DATE_BEFORE_BIRTH', 'Measurement date is before the date of birth');
    const existing = await this.prisma.growthRecord.findUnique({ where: { id: recId } });
    if (existing && existing.childId !== childId) throw new ApiError(409, 'ID_IN_USE', 'This id belongs to another record');
    const { apply, superseded } = resolveLww(existing, new Date(dto.clientUpdatedAt));
    const data = {
      date: new Date(dto.date), heightCm: dto.heightCm ?? null, weightKg: dto.weightKg ?? null,
      headCircumferenceCm: dto.headCircumferenceCm ?? null, clientUpdatedAt: new Date(dto.clientUpdatedAt),
    };
    const row = apply
      ? await this.prisma.growthRecord.upsert({ where: { id: recId }, create: { id: recId, childId, ...data }, update: data })
      : existing!;
    return { data: this.view(row), sync: { superseded }, measures: this.measures(child, row), provisional: true };
  }

  private view(r: GrowthRecord) {
    return {
      id: r.id, date: iso(r.date), heightCm: r.heightCm ? Number(r.heightCm) : null,
      weightKg: r.weightKg ? Number(r.weightKg) : null, headCircumferenceCm: r.headCircumferenceCm ? Number(r.headCircumferenceCm) : null,
      clientUpdatedAt: r.clientUpdatedAt,
    };
  }

  async list(userId: string, childId: string, updatedSince?: string) {
    await this.access.assertOwned(userId, childId);
    const rows = await this.prisma.growthRecord.findMany({
      where: { childId, ...(updatedSince ? { updatedAt: { gt: new Date(updatedSince) } } : {}) },
      orderBy: { date: 'asc' },
    });
    return rows.map((r) => this.view(r));
  }

  async remove(userId: string, childId: string, recId: string) {
    await this.access.assertOwned(userId, childId);
    await this.prisma.growthRecord.deleteMany({ where: { id: recId, childId } });
  }

  async chart(userId: string, childId: string) {
    const child = await this.access.assertOwned(userId, childId);
    const rows = await this.prisma.growthRecord.findMany({ where: { childId }, orderBy: { date: 'asc' } });
    const points = rows.map((r) => ({
      ...this.view(r), ageMonths: ageInMonths(child.dateOfBirth, r.date), measures: this.measures(child, r),
    }));
    const maxAge = Math.min(Math.max(ageInMonths(child.dateOfBirth) + 6, 24), 228);
    const reference: Record<string, Record<string, { ageMonths: number; value: number }[]>> = {};
    for (const ind of IND) {
      const table = this.who.table(ind, child.gender).filter((r) => r.ageMonths <= maxAge);
      reference[ind] = Object.fromEntries(
        Object.entries(Z_LINES).map(([name, z]) => [name, table.map((r) => ({ ageMonths: r.ageMonths, value: Math.round(valueAtZ(z, r) * 100) / 100 }))]),
      );
    }
    return { provisional: true, points, reference };
  }

  async summary(userId: string, childId: string) {
    const child = await this.access.assertOwned(userId, childId);
    const rows = await this.prisma.growthRecord.findMany({ where: { childId }, orderBy: { date: 'asc' } });
    return { child, rows, latest: rows.length ? { record: this.view(rows[rows.length - 1]), measures: this.measures(child, rows[rows.length - 1]) } : null };
  }
}
```
`apps/api/src/growth/growth-pdf.ts`:
```ts
import PDFDocument from 'pdfkit';

export type PdfInput = {
  childName: string; dateOfBirth: string; gender: string; ageMonths: number;
  rows: { date: string; heightCm: number | null; weightKg: number | null; headCircumferenceCm: number | null }[];
  latest: { weightPercentile?: number; heightPercentile?: number; bmiPercentile?: number; bmiStatus?: string } | null;
};

export function renderGrowthPdf(input: PdfInput): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const chunks: Buffer[] = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(18).text('NutriKids — Growth summary');
    doc.moveDown().fontSize(12)
      .text(`Child: ${input.childName}`).text(`Date of birth: ${input.dateOfBirth}`)
      .text(`Sex: ${input.gender}`).text(`Age: ${input.ageMonths} months`);
    if (input.latest) {
      doc.moveDown().text('Latest percentiles (WHO Child Growth Standards)');
      if (input.latest.weightPercentile !== undefined) doc.text(`  Weight-for-age: ${input.latest.weightPercentile}th`);
      if (input.latest.heightPercentile !== undefined) doc.text(`  Height-for-age: ${input.latest.heightPercentile}th`);
      if (input.latest.bmiPercentile !== undefined) doc.text(`  BMI-for-age: ${input.latest.bmiPercentile}th (${input.latest.bmiStatus})`);
    }
    doc.moveDown().text('History');
    for (const r of input.rows) {
      doc.text(`${r.date}   height ${r.heightCm ?? '-'} cm   weight ${r.weightKg ?? '-'} kg   head ${r.headCircumferenceCm ?? '-'} cm`);
    }
    doc.moveDown().fontSize(9).text(
      'NutriKids provides nutritional guidance, not a medical diagnosis. Percentile and status values are provisional and must be interpreted by a healthcare professional.',
    );
    doc.end();
  });
}
```
`apps/api/src/growth/growth.controller.ts`:
```ts
import { Body, Controller, Delete, Get, Header, HttpCode, Param, ParseUUIDPipe, Put, Query, Res, StreamableFile } from '@nestjs/common';
import { IsDateString, IsNumber, IsOptional, Max, Min } from 'class-validator';
import { AuthUser, CurrentUser } from '../common/current-user';
import { GrowthService } from './growth.service';
import { renderGrowthPdf } from './growth-pdf';

class GrowthDto {
  @IsDateString() date!: string;
  @IsOptional() @IsNumber() @Min(20) @Max(250) heightCm?: number;
  @IsOptional() @IsNumber() @Min(0.5) @Max(200) weightKg?: number;
  @IsOptional() @IsNumber() @Min(20) @Max(70) headCircumferenceCm?: number;
  @IsDateString() clientUpdatedAt!: string;
}
class SinceQuery { @IsOptional() @IsDateString() updatedSince?: string; }

@Controller('children/:childId')
export class GrowthController {
  constructor(private readonly growth: GrowthService) {}

  @Put('growth-records/:recId') put(@CurrentUser() u: AuthUser, @Param('childId', ParseUUIDPipe) c: string, @Param('recId', ParseUUIDPipe) r: string, @Body() b: GrowthDto) {
    return this.growth.upsert(u.id, c, r, b);
  }
  @Get('growth-records') list(@CurrentUser() u: AuthUser, @Param('childId', ParseUUIDPipe) c: string, @Query() q: SinceQuery) {
    return this.growth.list(u.id, c, q.updatedSince);
  }
  @Delete('growth-records/:recId') @HttpCode(204) del(@CurrentUser() u: AuthUser, @Param('childId', ParseUUIDPipe) c: string, @Param('recId', ParseUUIDPipe) r: string) {
    return this.growth.remove(u.id, c, r);
  }
  @Get('growth/chart') chart(@CurrentUser() u: AuthUser, @Param('childId', ParseUUIDPipe) c: string) {
    return this.growth.chart(u.id, c);
  }

  @Get('growth/export.pdf')
  @Header('Content-Type', 'application/pdf')
  @Header('Content-Disposition', 'attachment; filename="growth-summary.pdf"')
  async pdf(@CurrentUser() u: AuthUser, @Param('childId', ParseUUIDPipe) c: string) {
    const s = await this.growth.summary(u.id, c);
    const buf = await renderGrowthPdf({
      childName: s.child.name, dateOfBirth: s.child.dateOfBirth.toISOString().slice(0, 10), gender: s.child.gender,
      ageMonths: Math.floor((Date.now() - s.child.dateOfBirth.getTime()) / (30.4375 * 86_400_000)),
      rows: s.rows.map((r) => ({
        date: r.date.toISOString().slice(0, 10), heightCm: r.heightCm ? Number(r.heightCm) : null,
        weightKg: r.weightKg ? Number(r.weightKg) : null, headCircumferenceCm: r.headCircumferenceCm ? Number(r.headCircumferenceCm) : null,
      })),
      latest: s.latest && {
        weightPercentile: s.latest.measures.weight?.percentile, heightPercentile: s.latest.measures.height?.percentile,
        bmiPercentile: s.latest.measures.bmi?.percentile, bmiStatus: s.latest.measures.bmiStatus,
      },
    });
    return new StreamableFile(buf);
  }
}
```
(Remove the unused `Res` import.) `apps/api/src/growth/growth.module.ts`:
```ts
import { Module } from '@nestjs/common';
import { ChildModule } from '../child/child.module';
import { GrowthController } from './growth.controller';
import { GrowthService } from './growth.service';

@Module({ imports: [ChildModule], controllers: [GrowthController], providers: [GrowthService], exports: [GrowthService] })
export class GrowthModule {}
```
Add `GrowthModule` to `AppModule`.

- [ ] **Step 5: E2E test**

`apps/api/test/growth.e2e-spec.ts`:
```ts
import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'crypto';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp, registerAndLogin, resetDb } from './helpers';

describe('growth', () => {
  let app: INestApplication;
  const http = () => request(app.getHttpServer());
  beforeAll(async () => (app = await createTestApp()));
  beforeEach(() => resetDb(app.get(PrismaService)));
  afterAll(() => app.close());

  async function setup() {
    const p = await registerAndLogin(app);
    const auth = { Authorization: `Bearer ${p.token}` };
    const child = (await http().post('/v1/children').set(auth).send({ name: 'Rahim', dateOfBirth: '2025-03-01', gender: 'MALE' })).body;
    return { auth, child };
  }

  it('computes percentiles for a record (median weight at birth is ~50th)', async () => {
    const { auth, child } = await setup();
    const res = await http().put(`/v1/children/${child.id}/growth-records/${randomUUID()}`).set(auth)
      .send({ date: '2025-03-01', weightKg: 3.3464, heightCm: 49.9, clientUpdatedAt: '2025-03-01T10:00:00Z' }).expect(200);
    expect(res.body.measures.weight.percentile).toBe(50);
    expect(res.body.provisional).toBe(true);
    expect(res.body.measures.bmi).toBeDefined();
  });

  it('rejects empty records and dates before birth', async () => {
    const { auth, child } = await setup();
    const put = (b: object) => http().put(`/v1/children/${child.id}/growth-records/${randomUUID()}`).set(auth).send(b);
    await put({ date: '2025-04-01', clientUpdatedAt: '2025-04-01T00:00:00Z' }).expect(400);
    await put({ date: '2024-01-01', weightKg: 3, clientUpdatedAt: '2025-04-01T00:00:00Z' }).expect(400);
  });

  it('returns chart points and WHO reference curves', async () => {
    const { auth, child } = await setup();
    await http().put(`/v1/children/${child.id}/growth-records/${randomUUID()}`).set(auth)
      .send({ date: '2025-09-01', weightKg: 7.5, heightCm: 67, clientUpdatedAt: '2025-09-01T10:00:00Z' }).expect(200);
    const chart = await http().get(`/v1/children/${child.id}/growth/chart`).set(auth).expect(200);
    expect(chart.body.points).toHaveLength(1);
    expect(chart.body.reference.WFA.p50[0].ageMonths).toBe(0);
    expect(chart.body.reference.WFA.p3[10].value).toBeLessThan(chart.body.reference.WFA.p97[10].value);
  });

  it('exports a PDF', async () => {
    const { auth, child } = await setup();
    await http().put(`/v1/children/${child.id}/growth-records/${randomUUID()}`).set(auth)
      .send({ date: '2025-09-01', weightKg: 7.5, heightCm: 67, clientUpdatedAt: '2025-09-01T10:00:00Z' });
    const res = await http().get(`/v1/children/${child.id}/growth/export.pdf`).set(auth).buffer().expect(200);
    expect(res.headers['content-type']).toContain('application/pdf');
    expect(res.body.slice(0, 4).toString()).toBe('%PDF');
  });

  it('hides another parent\'s child', async () => {
    const { child } = await setup();
    const other = await registerAndLogin(app, 'other@example.com');
    await http().get(`/v1/children/${child.id}/growth/chart`).set('Authorization', `Bearer ${other.token}`).expect(404);
  });
});
```

- [ ] **Step 6: Run and commit**

Run: `pnpm test && pnpm test:e2e -- growth`
Expected: pass. (The 50th-percentile assertion depends on the imported WHO table matching the sanity values in Step 3.)
```bash
git add -A && git commit -m "feat(growth): WHO LMS percentiles, records with sync, chart data, PDF export"
```

---

### Task 11: Nutrition score

**Files:**
- Create: `apps/api/src/nutrition/{nutrition.module.ts, rda.ts, score.ts, nutrition.controller.ts}`
- Modify: `apps/api/src/app.module.ts`
- Test: `apps/api/src/nutrition/score.spec.ts`, `apps/api/test/nutrition.e2e-spec.ts`

**Interfaces:**
- Consumes: `NutrientTotals`, `recipeNutrition`, `ChildAccessService`, `PlanService` (via Prisma directly), `ageInMonths`.
- Produces:
```ts
export const SCORE_NUTRIENTS = ['protein','iron','calcium','vitaminA','vitaminC','vitaminD','zinc','fiber'] as const;
export type ScoreNutrient = typeof SCORE_NUTRIENTS[number];
export type Rating = 'GOOD' | 'MEDIUM' | 'LOW';
export function rdaFor(ageMonths: number): Record<ScoreNutrient, number> | null;  // null under 12 months
export function rate(ratio: number): Rating;                                      // >=0.8 GOOD, >=0.5 MEDIUM, else LOW
export type NutritionScore = { applicable: boolean; provisional: true; scorePercent: number | null; nutrients: { nutrient: ScoreNutrient; intake: number; target: number; ratio: number; rating: Rating }[] };
export function computeScore(totals: NutrientTotals, ageMonths: number): NutritionScore;
```
- Endpoint: `GET /v1/children/:id/nutrition/daily?date=YYYY-MM-DD` → `NutritionScore & { date, mealsPlanned: number }`; `GET /v1/children/:id/nutrition/weekly?weekStart=` → `{ days: [...], averageScorePercent }`.

- [ ] **Step 1: Failing tests**

`apps/api/src/nutrition/score.spec.ts`:
```ts
import { computeScore, rate, rdaFor } from './score';

const zero = { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, iron: 0, calcium: 0, vitaminA: 0, vitaminC: 0, vitaminD: 0, zinc: 0 };

describe('rate', () => {
  it.each([[1, 'GOOD'], [0.8, 'GOOD'], [0.79, 'MEDIUM'], [0.5, 'MEDIUM'], [0.49, 'LOW'], [0, 'LOW']])('%d -> %s', (r, e) => expect(rate(r)).toBe(e));
});

describe('rdaFor', () => {
  it('is not applicable under 12 months', () => expect(rdaFor(11)).toBeNull());
  it('selects an age band', () => {
    expect(rdaFor(24)!.iron).toBeLessThan(rdaFor(60)!.iron + 1);
    expect(rdaFor(120)!.calcium).toBeGreaterThan(rdaFor(24)!.calcium);
  });
});

describe('computeScore', () => {
  it('is 100% when every target is met', () => {
    const rda = rdaFor(36)!;
    const s = computeScore({ ...zero, ...rda }, 36);
    expect(s.scorePercent).toBe(100);
    expect(s.nutrients.every((n) => n.rating === 'GOOD')).toBe(true);
  });
  it('caps each nutrient at 100% so one excess does not hide a gap', () => {
    const rda = rdaFor(36)!;
    const s = computeScore({ ...zero, ...rda, protein: rda.protein * 10, iron: 0 }, 36);
    expect(s.scorePercent).toBe(88); // 7 of 8 nutrients at 100%, one at 0 -> 87.5 rounded
  });
  it('is 0% with no intake', () => expect(computeScore(zero, 36).scorePercent).toBe(0));
  it('returns not applicable under 12 months', () => {
    const s = computeScore(zero, 8);
    expect(s).toMatchObject({ applicable: false, scorePercent: null, nutrients: [] });
  });
});
```
Run → FAIL.

- [ ] **Step 2: Implement**

`apps/api/src/nutrition/rda.ts`:
```ts
export const SCORE_NUTRIENTS = ['protein', 'iron', 'calcium', 'vitaminA', 'vitaminC', 'vitaminD', 'zinc', 'fiber'] as const;
export type ScoreNutrient = (typeof SCORE_NUTRIENTS)[number];
export type Targets = Record<ScoreNutrient, number>;

// PROVISIONAL daily targets (units: g, mg, mg, µg RAE, mg, µg, mg, g). Modelled on common
// national dietary reference intakes for age bands; must be replaced or approved by the
// project's medical advisor / WHO-FAO values before launch.
export const RDA_BANDS: { fromMonths: number; toMonths: number; targets: Targets }[] = [
  { fromMonths: 12, toMonths: 47, targets: { protein: 13, iron: 7, calcium: 700, vitaminA: 300, vitaminC: 15, vitaminD: 15, zinc: 3, fiber: 19 } },
  { fromMonths: 48, toMonths: 107, targets: { protein: 19, iron: 10, calcium: 1000, vitaminA: 400, vitaminC: 25, vitaminD: 15, zinc: 5, fiber: 25 } },
  { fromMonths: 108, toMonths: 1000, targets: { protein: 34, iron: 8, calcium: 1300, vitaminA: 600, vitaminC: 45, vitaminD: 15, zinc: 8, fiber: 26 } },
];
```
`apps/api/src/nutrition/score.ts`:
```ts
import { NutrientTotals } from '../meal/recipe-nutrition';
import { RDA_BANDS, SCORE_NUTRIENTS, ScoreNutrient, Targets } from './rda';

export { SCORE_NUTRIENTS, ScoreNutrient };
export type Rating = 'GOOD' | 'MEDIUM' | 'LOW';
export type NutritionScore = {
  applicable: boolean; provisional: true; scorePercent: number | null;
  nutrients: { nutrient: ScoreNutrient; intake: number; target: number; ratio: number; rating: Rating }[];
};

export function rdaFor(ageMonths: number): Targets | null {
  if (ageMonths < 12) return null; // milk/formula-led diet; score does not apply
  return RDA_BANDS.find((b) => ageMonths >= b.fromMonths && ageMonths <= b.toMonths)!.targets;
}

export function rate(ratio: number): Rating {
  if (ratio >= 0.8) return 'GOOD';
  if (ratio >= 0.5) return 'MEDIUM';
  return 'LOW';
}

export function computeScore(totals: NutrientTotals, ageMonths: number): NutritionScore {
  const targets = rdaFor(ageMonths);
  if (!targets) return { applicable: false, provisional: true, scorePercent: null, nutrients: [] };
  const nutrients = SCORE_NUTRIENTS.map((nutrient) => {
    const intake = totals[nutrient] ?? 0;
    const target = targets[nutrient];
    const ratio = Math.round((intake / target) * 1000) / 1000;
    return { nutrient, intake: Math.round(intake * 100) / 100, target, ratio, rating: rate(ratio) };
  });
  const mean = nutrients.reduce((s, n) => s + Math.min(n.ratio, 1), 0) / nutrients.length;
  return { applicable: true, provisional: true, scorePercent: Math.round(mean * 100), nutrients };
}
```
Run: `pnpm test -- score` → PASS (the cap test expects 88: seven nutrients at 1.0 and one at 0 gives 87.5, which rounds to 88).

- [ ] **Step 3: Controller and module**

`apps/api/src/nutrition/nutrition.controller.ts`:
```ts
import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { IsDateString } from 'class-validator';
import { ageInMonths } from '../common/age';
import { AuthUser, CurrentUser } from '../common/current-user';
import { ChildAccessService } from '../child/child-access.service';
import { NutritionPer100g } from '../food/nutrition';
import { recipeInclude } from '../meal/plan.service';
import { recipeNutrition, NutrientTotals } from '../meal/recipe-nutrition';
import { PrismaService } from '../prisma/prisma.service';
import { computeScore } from './score';

class DailyQuery { @IsDateString() date!: string; }
class WeeklyQuery { @IsDateString() weekStart!: string; }
const day = (s: string) => new Date(`${s}T00:00:00Z`);

@Controller('children/:childId/nutrition')
export class NutritionController {
  constructor(private readonly prisma: PrismaService, private readonly access: ChildAccessService) {}

  private async scoreFor(childId: string, dob: Date, date: string) {
    const entries = await this.prisma.mealPlanEntry.findMany({ where: { childId, date: day(date) }, include: { recipe: { include: recipeInclude } } });
    const totals: NutrientTotals = { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, iron: 0, calcium: 0, vitaminA: 0, vitaminC: 0, vitaminD: 0, zinc: 0 };
    for (const e of entries) {
      const t = recipeNutrition(e.recipe.foods.map((f) => ({ quantityG: Number(f.quantityG), nutrition: f.food.nutrition as NutritionPer100g })), Number(e.portion));
      for (const k of Object.keys(totals) as (keyof NutrientTotals)[]) totals[k] += t[k];
    }
    return { date, mealsPlanned: entries.length, ...computeScore(totals, ageInMonths(dob, day(date))) };
  }

  @Get('daily') async daily(@CurrentUser() u: AuthUser, @Param('childId', ParseUUIDPipe) id: string, @Query() q: DailyQuery) {
    const child = await this.access.assertOwned(u.id, id);
    return this.scoreFor(id, child.dateOfBirth, q.date);
  }

  @Get('weekly') async weekly(@CurrentUser() u: AuthUser, @Param('childId', ParseUUIDPipe) id: string, @Query() q: WeeklyQuery) {
    const child = await this.access.assertOwned(u.id, id);
    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(day(q.weekStart).getTime() + i * 86_400_000).toISOString().slice(0, 10);
      days.push(await this.scoreFor(id, child.dateOfBirth, d));
    }
    const scored = days.filter((d) => d.scorePercent !== null && d.mealsPlanned > 0);
    const averageScorePercent = scored.length ? Math.round(scored.reduce((s, d) => s + (d.scorePercent as number), 0) / scored.length) : null;
    return { provisional: true, days, averageScorePercent };
  }
}
```
`apps/api/src/nutrition/nutrition.module.ts`:
```ts
import { Module } from '@nestjs/common';
import { ChildModule } from '../child/child.module';
import { NutritionController } from './nutrition.controller';

@Module({ imports: [ChildModule], controllers: [NutritionController] })
export class NutritionModule {}
```
Add `NutritionModule` to `AppModule`.

- [ ] **Step 4: E2E test**

`apps/api/test/nutrition.e2e-spec.ts`:
```ts
import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'crypto';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp, registerAndLogin, resetDb } from './helpers';

describe('nutrition score', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const http = () => request(app.getHttpServer());
  beforeAll(async () => { app = await createTestApp(); prisma = app.get(PrismaService); });
  beforeEach(() => resetDb(prisma));
  afterAll(() => app.close());

  it('scores a day from the planned meals and marks it provisional', async () => {
    const p = await registerAndLogin(app);
    const auth = { Authorization: `Bearer ${p.token}` };
    const child = (await http().post('/v1/children').set(auth).send({ name: 'Amina', dateOfBirth: '2022-01-10', gender: 'FEMALE' })).body;
    const food = await prisma.food.create({
      data: { name: 'Super food', category: 'Test', nutrition: { calories: 100, protein: 20, carbs: 10, fat: 5, fiber: 10, iron: 10, calcium: 1000, vitaminA: 500, vitaminC: 50, vitaminD: 20, zinc: 10 } },
    });
    const recipe = await prisma.recipe.create({
      data: { name: 'Test meal', instructions: 'x', prepMinutes: 5, ageMinMonths: 12, slots: ['LUNCH'], suitableDiets: ['NON_VEGETARIAN'], foods: { create: [{ foodId: food.id, quantityG: 100 }] } },
    });
    await http().put(`/v1/children/${child.id}/meal-entries/${randomUUID()}`).set(auth)
      .send({ date: '2026-04-01', slot: 'LUNCH', recipeId: recipe.id, portion: 1, clientUpdatedAt: '2026-04-01T08:00:00Z' }).expect(200);
    const res = await http().get(`/v1/children/${child.id}/nutrition/daily?date=2026-04-01`).set(auth).expect(200);
    expect(res.body).toMatchObject({ applicable: true, provisional: true, mealsPlanned: 1, scorePercent: 100 });
    const empty = await http().get(`/v1/children/${child.id}/nutrition/daily?date=2026-04-02`).set(auth);
    expect(empty.body.scorePercent).toBe(0);
  });

  it('is not applicable for infants under 12 months', async () => {
    const p = await registerAndLogin(app);
    const auth = { Authorization: `Bearer ${p.token}` };
    const child = (await http().post('/v1/children').set(auth).send({ name: 'Baby', dateOfBirth: '2026-01-10', gender: 'MALE' })).body;
    const res = await http().get(`/v1/children/${child.id}/nutrition/daily?date=2026-04-01`).set(auth).expect(200);
    expect(res.body).toMatchObject({ applicable: false, scorePercent: null });
  });
});
```

- [ ] **Step 5: Run and commit**

Run: `pnpm test && pnpm test:e2e -- nutrition` → pass.
```bash
git add -A && git commit -m "feat(nutrition): provisional daily and weekly nutrition score"
```

---

### Task 12: Vaccination module

**Files:**
- Create: `apps/api/src/vaccination/{vaccination.module.ts, status.ts, vaccination.service.ts, vaccination.controller.ts}`, `data/seed/vaccines.bd.json`
- Modify: `apps/api/src/app.module.ts`
- Test: `apps/api/src/vaccination/status.spec.ts`, `apps/api/test/vaccination.e2e-spec.ts`

**Interfaces:**
- Consumes: events `CHILD_CREATED`, `CHILD_DOB_CHANGED`; `ChildAccessService`; `ageInDays`.
- Produces:
```ts
export type VaccineStatus = 'UPCOMING' | 'DUE' | 'OVERDUE' | 'GIVEN' | 'GIVEN_LATE';
export function vaccineStatus(i: { dateOfBirth: Date; givenDate: Date | null; minAgeDays: number; maxAgeDays: number | null; now?: Date }): VaccineStatus;
export function dueDateFor(dateOfBirth: Date, suggestedAgeDays: number): Date;
```
- Endpoints: `GET /v1/vaccines` (catalogue with doses); `GET /v1/children/:id/vaccinations?status=` → items `{ id, vaccine: {code,name,disease,description,availability,isMandatory,priceMinBdt,priceMaxBdt,priceNote,priceUpdatedAt}, doseNumber, suggestedAgeDays, minAgeDays, maxAgeDays, notes, dueDate, status, givenDate, facilityName, paidType, amountPaidBdt, batchNo, notes, cardPhotoUrl }`, grouped by `GET /v1/children/:id/vaccinations/summary` → `{ given: n, due: n, upcoming: n, overdue: n }`; `PUT /v1/children/:id/vaccinations/:id {givenDate|null, facilityName?, paidType?, amountPaidBdt?, batchNo?, notes?, cardPhotoUrl?, clientUpdatedAt}` (givenDate null marks as not given).

- [ ] **Step 1: Failing tests**

`apps/api/src/vaccination/status.spec.ts`:
```ts
import { dueDateFor, vaccineStatus } from './status';

const dob = new Date('2026-01-01T00:00:00Z');
const at = (days: number) => new Date(dob.getTime() + days * 86_400_000);
const base = { dateOfBirth: dob, givenDate: null as Date | null, minAgeDays: 42, maxAgeDays: 84 as number | null };

describe('vaccineStatus', () => {
  it('is UPCOMING before the minimum age', () => expect(vaccineStatus({ ...base, now: at(10) })).toBe('UPCOMING'));
  it('is DUE inside the window, inclusive', () => {
    expect(vaccineStatus({ ...base, now: at(42) })).toBe('DUE');
    expect(vaccineStatus({ ...base, now: at(84) })).toBe('DUE');
  });
  it('is OVERDUE after the maximum age', () => expect(vaccineStatus({ ...base, now: at(85) })).toBe('OVERDUE'));
  it('stays DUE when there is no maximum age', () => expect(vaccineStatus({ ...base, maxAgeDays: null, now: at(9999) })).toBe('DUE'));
  it('is GIVEN when given inside the window', () => expect(vaccineStatus({ ...base, givenDate: at(50), now: at(500) })).toBe('GIVEN'));
  it('is GIVEN_LATE when given after the maximum age', () => expect(vaccineStatus({ ...base, givenDate: at(100), now: at(500) })).toBe('GIVEN_LATE'));
});

describe('dueDateFor', () => {
  it('adds the suggested age in days', () => expect(dueDateFor(dob, 42).toISOString().slice(0, 10)).toBe('2026-02-12'));
});
```
Run → FAIL.

- [ ] **Step 2: Implement status and the data file**

`apps/api/src/vaccination/status.ts`:
```ts
import { ageInDays } from '../common/age';

export type VaccineStatus = 'UPCOMING' | 'DUE' | 'OVERDUE' | 'GIVEN' | 'GIVEN_LATE';

export function dueDateFor(dateOfBirth: Date, suggestedAgeDays: number): Date {
  return new Date(Date.UTC(dateOfBirth.getUTCFullYear(), dateOfBirth.getUTCMonth(), dateOfBirth.getUTCDate() + suggestedAgeDays));
}

export function vaccineStatus(i: {
  dateOfBirth: Date; givenDate: Date | null; minAgeDays: number; maxAgeDays: number | null; now?: Date;
}): VaccineStatus {
  if (i.givenDate) {
    const ageWhenGiven = ageInDays(i.dateOfBirth, i.givenDate);
    return i.maxAgeDays !== null && ageWhenGiven > i.maxAgeDays ? 'GIVEN_LATE' : 'GIVEN';
  }
  const age = ageInDays(i.dateOfBirth, i.now ?? new Date());
  if (age < i.minAgeDays) return 'UPCOMING';
  if (i.maxAgeDays !== null && age > i.maxAgeDays) return 'OVERDUE';
  return 'DUE';
}
```
Run: `pnpm test -- status` → PASS.

`data/seed/vaccines.bd.json` — **data task.** Format (every vaccine and dose):
```json
{
  "region": "BD",
  "verified": false,
  "vaccines": [
    {
      "code": "BCG",
      "name": "BCG",
      "disease": "Tuberculosis",
      "description": "Protects against severe forms of tuberculosis in young children.",
      "availability": "GOVERNMENT_FREE",
      "isMandatory": true,
      "priceMinBdt": null,
      "priceMaxBdt": null,
      "priceNote": null,
      "priceUpdatedAt": null,
      "sourceNote": "URL or document name of the official schedule used, and the date checked",
      "schedule": [
        { "doseNumber": 1, "suggestedAgeDays": 0, "minAgeDays": 0, "maxAgeDays": 365, "intervalFromPreviousDays": null, "notes": "At birth, or as early as possible." }
      ]
    }
  ]
}
```
Fill it as follows (research, not memory):
1. Find the current official Bangladesh EPI (Expanded Programme on Immunization, DGHS) routine schedule. Record every government-provided vaccine and dose with its recommended age, window and any catch-up notes. Put the source URL and date checked in each `sourceNote`.
2. Find vaccines commonly given privately in Bangladesh that are not in the EPI schedule (for example typhoid conjugate, varicella, hepatitis A, influenza, and others the sources list). Mark them `PRIVATE_PAID` with `isMandatory: false`, and mark vaccines available both ways as `BOTH`.
3. For paid vaccines, record `priceMinBdt` and `priceMaxBdt` only from a source you can cite, with `priceNote` (for example "per dose, private hospitals, varies by brand") and `priceUpdatedAt`. If no citable price exists, leave the prices `null`; the API then shows "price not available". Never estimate.
4. Keep `"verified": false`. A medical advisor sets it to true after review.

Validation test `apps/api/src/vaccination/vaccines-data.spec.ts`:
```ts
import { readFileSync } from 'fs';
import { resolve } from 'path';

const data = JSON.parse(readFileSync(resolve(__dirname, '../../../../data/seed/vaccines.bd.json'), 'utf8'));

describe('vaccines.bd.json', () => {
  it('has unique codes and valid doses', () => {
    const codes = data.vaccines.map((v: any) => v.code);
    expect(new Set(codes).size).toBe(codes.length);
    for (const v of data.vaccines) {
      expect(['GOVERNMENT_FREE', 'PRIVATE_PAID', 'BOTH']).toContain(v.availability);
      expect(v.sourceNote).toBeTruthy();
      expect(v.schedule.length).toBeGreaterThan(0);
      v.schedule.forEach((d: any, i: number) => {
        expect(d.doseNumber).toBe(i + 1);
        expect(d.minAgeDays).toBeLessThanOrEqual(d.suggestedAgeDays);
        if (d.maxAgeDays !== null) expect(d.maxAgeDays).toBeGreaterThanOrEqual(d.suggestedAgeDays);
      });
      if (v.availability === 'GOVERNMENT_FREE') expect(v.priceMinBdt).toBeNull();
      if (v.priceMinBdt !== null) expect(v.priceMaxBdt).toBeGreaterThanOrEqual(v.priceMinBdt);
    }
  });
  it('is marked unverified until a medical advisor approves it', () => {
    expect(typeof data.verified).toBe('boolean');
  });
});
```

- [ ] **Step 3: Service, controller, module**

`apps/api/src/vaccination/vaccination.service.ts`:
```ts
import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PaidType } from '@prisma/client';
import { ApiError } from '../common/api-error';
import { resolveLww } from '../common/lww';
import { ChildAccessService } from '../child/child-access.service';
import { CHILD_CREATED, CHILD_DOB_CHANGED, ChildEvent } from '../child/child.events';
import { PrismaService } from '../prisma/prisma.service';
import { dueDateFor, vaccineStatus, VaccineStatus } from './status';

const iso = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

@Injectable()
export class VaccinationService {
  constructor(private readonly prisma: PrismaService, private readonly access: ChildAccessService) {}

  /** Creates missing rows and re-dates doses that have not been given. */
  async syncSchedule(childId: string, dateOfBirth: Date) {
    const items = await this.prisma.vaccineScheduleItem.findMany();
    const existing = await this.prisma.childVaccination.findMany({ where: { childId } });
    const byItem = new Map(existing.map((e) => [e.scheduleItemId, e]));
    for (const item of items) {
      const dueDate = dueDateFor(dateOfBirth, item.suggestedAgeDays);
      const row = byItem.get(item.id);
      if (!row) {
        await this.prisma.childVaccination.create({ data: { childId, scheduleItemId: item.id, dueDate } });
      } else if (!row.givenDate && row.dueDate.getTime() !== dueDate.getTime()) {
        await this.prisma.childVaccination.update({ where: { id: row.id }, data: { dueDate } });
      }
    }
  }

  @OnEvent(CHILD_CREATED, { async: true })
  onCreated(e: ChildEvent) { return this.syncSchedule(e.childId, e.dateOfBirth); }

  @OnEvent(CHILD_DOB_CHANGED, { async: true })
  onDobChanged(e: ChildEvent) { return this.syncSchedule(e.childId, e.dateOfBirth); }

  catalogue() {
    return this.prisma.vaccine.findMany({ include: { schedule: { orderBy: { doseNumber: 'asc' } } }, orderBy: { name: 'asc' } });
  }

  private async rows(childId: string) {
    return this.prisma.childVaccination.findMany({
      where: { childId }, include: { scheduleItem: { include: { vaccine: true } } }, orderBy: { dueDate: 'asc' },
    });
  }

  private view(r: Awaited<ReturnType<VaccinationService['rows']>>[number], dob: Date) {
    const s = r.scheduleItem;
    const v = s.vaccine;
    return {
      id: r.id,
      vaccine: {
        code: v.code, name: v.name, disease: v.disease, description: v.description, availability: v.availability, isMandatory: v.isMandatory,
        priceMinBdt: v.priceMinBdt, priceMaxBdt: v.priceMaxBdt, priceNote: v.priceNote, priceUpdatedAt: v.priceUpdatedAt, verified: v.verified,
      },
      doseNumber: s.doseNumber, suggestedAgeDays: s.suggestedAgeDays, minAgeDays: s.minAgeDays, maxAgeDays: s.maxAgeDays, scheduleNotes: s.notes,
      dueDate: iso(r.dueDate),
      status: vaccineStatus({ dateOfBirth: dob, givenDate: r.givenDate, minAgeDays: s.minAgeDays, maxAgeDays: s.maxAgeDays }),
      givenDate: iso(r.givenDate), facilityName: r.facilityName, paidType: r.paidType, amountPaidBdt: r.amountPaidBdt,
      batchNo: r.batchNo, notes: r.notes, cardPhotoUrl: r.cardPhotoUrl,
    };
  }

  async list(userId: string, childId: string, status?: VaccineStatus) {
    const child = await this.access.assertOwned(userId, childId);
    const all = (await this.rows(childId)).map((r) => this.view(r, child.dateOfBirth));
    return status ? all.filter((r) => r.status === status) : all;
  }

  async summary(userId: string, childId: string) {
    const items = await this.list(userId, childId);
    const count = (...s: VaccineStatus[]) => items.filter((i) => s.includes(i.status)).length;
    return { given: count('GIVEN', 'GIVEN_LATE'), due: count('DUE'), upcoming: count('UPCOMING'), overdue: count('OVERDUE'), total: items.length };
  }

  async update(
    userId: string, childId: string, id: string,
    dto: { givenDate: string | null; facilityName?: string; paidType?: PaidType; amountPaidBdt?: number; batchNo?: string; notes?: string; cardPhotoUrl?: string; clientUpdatedAt: string },
  ) {
    const child = await this.access.assertOwned(userId, childId);
    const existing = await this.prisma.childVaccination.findFirst({ where: { id, childId } });
    if (!existing) throw new ApiError(404, 'NOT_FOUND', 'Vaccination not found');
    const { apply, superseded } = resolveLww(existing, new Date(dto.clientUpdatedAt));
    if (apply) {
      if (dto.givenDate && new Date(dto.givenDate) < child.dateOfBirth) throw new ApiError(400, 'DATE_BEFORE_BIRTH', 'Given date is before the date of birth');
      if (dto.givenDate && new Date(dto.givenDate).getTime() > Date.now() + 86_400_000) throw new ApiError(400, 'DATE_IN_FUTURE', 'Given date is in the future');
      const given = dto.givenDate ? new Date(dto.givenDate) : null;
      await this.prisma.childVaccination.update({
        where: { id },
        data: {
          givenDate: given,
          facilityName: given ? (dto.facilityName ?? null) : null, paidType: given ? (dto.paidType ?? null) : null,
          amountPaidBdt: given ? (dto.amountPaidBdt ?? null) : null, batchNo: given ? (dto.batchNo ?? null) : null,
          notes: dto.notes ?? null, cardPhotoUrl: given ? (dto.cardPhotoUrl ?? null) : null, clientUpdatedAt: new Date(dto.clientUpdatedAt),
        },
      });
    }
    const [row] = (await this.rows(childId)).filter((r) => r.id === id);
    return { data: this.view(row, child.dateOfBirth), sync: { superseded } };
  }
}
```
`apps/api/src/vaccination/vaccination.controller.ts`:
```ts
import { Body, Controller, Get, Param, ParseUUIDPipe, Put, Query } from '@nestjs/common';
import { PaidType } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsInt, IsOptional, IsString, IsIn, Max, MaxLength, Min, ValidateIf } from 'class-validator';
import { AuthUser, CurrentUser } from '../common/current-user';
import { VaccinationService } from './vaccination.service';
import { VaccineStatus } from './status';

class UpdateDto {
  @ValidateIf((_, v) => v !== null) @IsDateString() givenDate!: string | null;
  @IsOptional() @IsString() @MaxLength(200) facilityName?: string;
  @IsOptional() @IsEnum(PaidType) paidType?: PaidType;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(1_000_000) amountPaidBdt?: number;
  @IsOptional() @IsString() @MaxLength(100) batchNo?: string;
  @IsOptional() @IsString() @MaxLength(500) notes?: string;
  @IsOptional() @IsString() cardPhotoUrl?: string;
  @IsDateString() clientUpdatedAt!: string;
}
class ListQuery {
  @IsOptional() @IsIn(['UPCOMING', 'DUE', 'OVERDUE', 'GIVEN', 'GIVEN_LATE']) status?: VaccineStatus;
}

@Controller()
export class VaccinationController {
  constructor(private readonly vaccines: VaccinationService) {}

  @Get('vaccines') catalogue() { return this.vaccines.catalogue(); }
  @Get('children/:childId/vaccinations') list(@CurrentUser() u: AuthUser, @Param('childId', ParseUUIDPipe) c: string, @Query() q: ListQuery) {
    return this.vaccines.list(u.id, c, q.status);
  }
  @Get('children/:childId/vaccinations/summary') summary(@CurrentUser() u: AuthUser, @Param('childId', ParseUUIDPipe) c: string) {
    return this.vaccines.summary(u.id, c);
  }
  @Put('children/:childId/vaccinations/:id') update(@CurrentUser() u: AuthUser, @Param('childId', ParseUUIDPipe) c: string, @Param('id', ParseUUIDPipe) id: string, @Body() b: UpdateDto) {
    return this.vaccines.update(u.id, c, id, b);
  }
}
```
`apps/api/src/vaccination/vaccination.module.ts`:
```ts
import { Module } from '@nestjs/common';
import { ChildModule } from '../child/child.module';
import { VaccinationController } from './vaccination.controller';
import { VaccinationService } from './vaccination.service';

@Module({ imports: [ChildModule], controllers: [VaccinationController], providers: [VaccinationService], exports: [VaccinationService] })
export class VaccinationModule {}
```
Add `VaccinationModule` to `AppModule`.

- [ ] **Step 4: E2E test**

`apps/api/test/vaccination.e2e-spec.ts`:
```ts
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp, registerAndLogin, resetDb } from './helpers';

describe('vaccination', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const http = () => request(app.getHttpServer());
  beforeAll(async () => { app = await createTestApp(); prisma = app.get(PrismaService); });
  beforeEach(() => resetDb(prisma));
  afterAll(() => app.close());

  async function seedVaccines() {
    await prisma.vaccine.create({
      data: {
        code: 'BCG', name: 'BCG', disease: 'TB', description: 'd', availability: 'GOVERNMENT_FREE', isMandatory: true, sourceNote: 'test',
        schedule: { create: [{ doseNumber: 1, suggestedAgeDays: 0, minAgeDays: 0, maxAgeDays: 365 }] },
      },
    });
    await prisma.vaccine.create({
      data: {
        code: 'TCV', name: 'Typhoid conjugate', disease: 'Typhoid', description: 'd', availability: 'PRIVATE_PAID', priceMinBdt: 1000, priceMaxBdt: 2500,
        priceNote: 'per dose', sourceNote: 'test',
        schedule: { create: [{ doseNumber: 1, suggestedAgeDays: 270, minAgeDays: 270, maxAgeDays: null }] },
      },
    });
  }

  async function childWithSchedule(dob: string) {
    const p = await registerAndLogin(app);
    const auth = { Authorization: `Bearer ${p.token}` };
    const child = (await http().post('/v1/children').set(auth).send({ name: 'Amina', dateOfBirth: dob, gender: 'FEMALE' })).body;
    // the schedule is generated by an async event; wait for it
    for (let i = 0; i < 20 && (await prisma.childVaccination.count({ where: { childId: child.id } })) < 2; i++) await new Promise((r) => setTimeout(r, 50));
    return { auth, child };
  }

  it('generates a schedule when a child is created, with free/paid info', async () => {
    await seedVaccines();
    const { auth, child } = await childWithSchedule('2026-01-01');
    const list = await http().get(`/v1/children/${child.id}/vaccinations`).set(auth).expect(200);
    expect(list.body).toHaveLength(2);
    const bcg = list.body.find((v: any) => v.vaccine.code === 'BCG');
    const tcv = list.body.find((v: any) => v.vaccine.code === 'TCV');
    expect(bcg.vaccine.availability).toBe('GOVERNMENT_FREE');
    expect(tcv.vaccine).toMatchObject({ availability: 'PRIVATE_PAID', priceMinBdt: 1000, priceMaxBdt: 2500 });
    expect(bcg.dueDate).toBe('2026-01-01');
    expect(tcv.dueDate).toBe('2026-09-28');
  });

  it('marks a dose given, then undone, and tracks the summary', async () => {
    await seedVaccines();
    const { auth, child } = await childWithSchedule('2026-01-01');
    const bcg = (await http().get(`/v1/children/${child.id}/vaccinations`).set(auth)).body.find((v: any) => v.vaccine.code === 'BCG');
    const given = await http().put(`/v1/children/${child.id}/vaccinations/${bcg.id}`).set(auth)
      .send({ givenDate: '2026-01-02', facilityName: 'Upazila Health Complex', paidType: 'GOVERNMENT', clientUpdatedAt: '2026-01-02T10:00:00Z' }).expect(200);
    expect(given.body.data.status).toBe('GIVEN');
    let summary = (await http().get(`/v1/children/${child.id}/vaccinations/summary`).set(auth)).body;
    expect(summary.given).toBe(1);
    await http().put(`/v1/children/${child.id}/vaccinations/${bcg.id}`).set(auth)
      .send({ givenDate: null, clientUpdatedAt: '2026-01-03T10:00:00Z' }).expect(200);
    summary = (await http().get(`/v1/children/${child.id}/vaccinations/summary`).set(auth)).body;
    expect(summary.given).toBe(0);
  });

  it('rejects a given date before birth and ignores stale writes', async () => {
    await seedVaccines();
    const { auth, child } = await childWithSchedule('2026-01-01');
    const bcg = (await http().get(`/v1/children/${child.id}/vaccinations`).set(auth)).body.find((v: any) => v.vaccine.code === 'BCG');
    const url = `/v1/children/${child.id}/vaccinations/${bcg.id}`;
    await http().put(url).set(auth).send({ givenDate: '2025-12-01', clientUpdatedAt: '2026-01-02T10:00:00Z' }).expect(400);
    await http().put(url).set(auth).send({ givenDate: '2026-01-02', clientUpdatedAt: '2026-01-02T10:00:00Z' }).expect(200);
    const stale = await http().put(url).set(auth).send({ givenDate: null, clientUpdatedAt: '2026-01-01T10:00:00Z' }).expect(200);
    expect(stale.body.sync.superseded).toBe(true);
    expect(stale.body.data.givenDate).toBe('2026-01-02');
  });

  it('re-dates ungiven doses when the date of birth changes', async () => {
    await seedVaccines();
    const { auth, child } = await childWithSchedule('2026-01-01');
    await http().patch(`/v1/children/${child.id}`).set(auth).send({ dateOfBirth: '2026-02-01' }).expect(200);
    await new Promise((r) => setTimeout(r, 200));
    const tcv = (await http().get(`/v1/children/${child.id}/vaccinations`).set(auth)).body.find((v: any) => v.vaccine.code === 'TCV');
    expect(tcv.dueDate).toBe('2026-10-29');
  });

  it('hides another parent\'s vaccinations', async () => {
    await seedVaccines();
    const { child } = await childWithSchedule('2026-01-01');
    const other = await registerAndLogin(app, 'other@example.com');
    await http().get(`/v1/children/${child.id}/vaccinations`).set('Authorization', `Bearer ${other.token}`).expect(404);
  });
});
```
Note: the TCV due date (dob + 270 days): 2026-01-01 + 270 days = 2026-09-28; 2026-02-01 + 270 days = 2026-10-29. If either differs when run, recompute rather than editing the code.

- [ ] **Step 5: Run and commit**

Run: `pnpm test && pnpm test:e2e -- vaccination` → pass.
```bash
git add -A && git commit -m "feat(vaccination): schedule generation, free/paid info, given tracking, status"
```

---

### Task 13: Hospital module (nearby search and CSV import)

**Files:**
- Create: `apps/api/src/hospital/{hospital.module.ts, hospital.service.ts, hospital.controller.ts, hospital-csv.ts}`, `data/seed/hospitals.bd.csv`
- Modify: `apps/api/src/app.module.ts`
- Test: `apps/api/src/hospital/hospital-csv.spec.ts`, `apps/api/src/hospital/distance.spec.ts`, `apps/api/test/hospital.e2e-spec.ts`

**Interfaces:**
- Produces:
```ts
export function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number;
export function boundingBox(lat: number, lng: number, radiusKm: number): { minLat: number; maxLat: number; minLng: number; maxLng: number };
export type HospitalRow = { name: string; type: string; address: string; district: string; lat: number; lng: number; phone: string | null; services: string[]; source: string };
export function parseHospitalCsv(text: string): { rows: HospitalRow[]; errors: { line: number; message: string }[] };
```
CSV header (exact): `name,type,address,district,lat,lng,phone,services,source` — `services` is `;`-separated; `source` is required (where the row came from).
- Endpoints: `GET /v1/hospitals/nearby?lat&lng&radiusKm=10&service&limit=20` → `[{ id, name, type, address, district, lat, lng, phone, services, distanceKm }]` sorted by distance; `POST /v1/admin/hospitals/import` (ADMIN, `text/csv` body) → `{ imported: n, updated: n, errors: [...] }`.

- [ ] **Step 1: Failing unit tests**

`apps/api/src/hospital/distance.spec.ts`:
```ts
import { boundingBox, haversineKm } from './hospital.service';

describe('haversineKm', () => {
  it('is 0 for the same point', () => expect(haversineKm({ lat: 23.8, lng: 90.4 }, { lat: 23.8, lng: 90.4 })).toBe(0));
  it('Dhaka to Chattogram is about 215 km', () => {
    expect(haversineKm({ lat: 23.8103, lng: 90.4125 }, { lat: 22.3569, lng: 91.7832 })).toBeGreaterThan(205);
    expect(haversineKm({ lat: 23.8103, lng: 90.4125 }, { lat: 22.3569, lng: 91.7832 })).toBeLessThan(225);
  });
});

describe('boundingBox', () => {
  it('contains every point within the radius', () => {
    const c = { lat: 23.8, lng: 90.4 };
    const box = boundingBox(c.lat, c.lng, 10);
    const east = { lat: c.lat, lng: c.lng + 9.9 / (111.32 * Math.cos((c.lat * Math.PI) / 180)) };
    expect(haversineKm(c, east)).toBeLessThan(10);
    expect(east.lng).toBeLessThanOrEqual(box.maxLng);
    expect(box.minLat).toBeLessThan(c.lat);
    expect(box.maxLat).toBeGreaterThan(c.lat);
  });
});
```
`apps/api/src/hospital/hospital-csv.spec.ts`:
```ts
import { parseHospitalCsv } from './hospital-csv';

const header = 'name,type,address,district,lat,lng,phone,services,source';

describe('parseHospitalCsv', () => {
  it('parses a valid row', () => {
    const r = parseHospitalCsv(`${header}\nCity Hospital,Hospital,"1 Main Rd, Dhaka",Dhaka,23.75,90.39,0171,Vaccination;Pediatrics,OSM`);
    expect(r.errors).toEqual([]);
    expect(r.rows[0]).toMatchObject({ name: 'City Hospital', lat: 23.75, lng: 90.39, services: ['Vaccination', 'Pediatrics'], phone: '0171' });
  });
  it('reports bad coordinates and missing source per line', () => {
    const r = parseHospitalCsv(`${header}\nA,Hospital,x,Dhaka,999,90,,,OSM\nB,Hospital,x,Dhaka,23,90,,,`);
    expect(r.rows).toHaveLength(0);
    expect(r.errors.map((e) => e.line)).toEqual([2, 3]);
  });
  it('rejects a wrong header', () => {
    expect(parseHospitalCsv('a,b\n1,2').errors[0].message).toMatch(/header/i);
  });
  it('handles an empty phone and services', () => {
    const r = parseHospitalCsv(`${header}\nB,Clinic,x,Sylhet,24.9,91.8,,,OSM`);
    expect(r.rows[0]).toMatchObject({ phone: null, services: [] });
  });
});
```
Run → FAIL.

- [ ] **Step 2: Implement**

`apps/api/src/hospital/hospital-csv.ts`:
```ts
import { parse } from 'csv-parse/sync';

export type HospitalRow = {
  name: string; type: string; address: string; district: string; lat: number; lng: number;
  phone: string | null; services: string[]; source: string;
};
const HEADER = ['name', 'type', 'address', 'district', 'lat', 'lng', 'phone', 'services', 'source'];

export function parseHospitalCsv(text: string): { rows: HospitalRow[]; errors: { line: number; message: string }[] } {
  const records = parse(text, { skip_empty_lines: true, relax_column_count: true }) as string[][];
  const errors: { line: number; message: string }[] = [];
  const rows: HospitalRow[] = [];
  if (!records.length || records[0].map((h) => h.trim()).join(',') !== HEADER.join(',')) {
    return { rows, errors: [{ line: 1, message: `Header must be exactly: ${HEADER.join(',')}` }] };
  }
  records.slice(1).forEach((c, i) => {
    const line = i + 2;
    const [name, type, address, district, latS, lngS, phone, services, source] = c.map((v) => (v ?? '').trim());
    const lat = Number(latS);
    const lng = Number(lngS);
    const problems: string[] = [];
    if (!name) problems.push('name is required');
    if (!district) problems.push('district is required');
    if (!source) problems.push('source is required');
    if (!Number.isFinite(lat) || lat < -90 || lat > 90) problems.push('lat out of range');
    if (!Number.isFinite(lng) || lng < -180 || lng > 180) problems.push('lng out of range');
    if (problems.length) return errors.push({ line, message: problems.join('; ') });
    rows.push({
      name, type: type || 'Hospital', address, district, lat, lng, phone: phone || null,
      services: services ? services.split(';').map((s) => s.trim()).filter(Boolean) : [], source,
    });
  });
  return { rows, errors };
}
```
`apps/api/src/hospital/hospital.service.ts`:
```ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { HospitalRow } from './hospital-csv';

const R = 6371;
const rad = (d: number) => (d * Math.PI) / 180;

export function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.min(1, Math.sqrt(h))) * 1000) / 1000;
}

export function boundingBox(lat: number, lng: number, radiusKm: number) {
  const dLat = (radiusKm / R) * (180 / Math.PI);
  const dLng = dLat / Math.max(0.01, Math.cos(rad(lat)));
  return { minLat: lat - dLat, maxLat: lat + dLat, minLng: lng - dLng, maxLng: lng + dLng };
}

@Injectable()
export class HospitalService {
  constructor(private readonly prisma: PrismaService) {}

  async nearby(q: { lat: number; lng: number; radiusKm: number; service?: string; limit: number }) {
    const box = boundingBox(q.lat, q.lng, q.radiusKm);
    const rows = await this.prisma.hospital.findMany({
      where: {
        lat: { gte: box.minLat, lte: box.maxLat }, lng: { gte: box.minLng, lte: box.maxLng },
        ...(q.service ? { services: { has: q.service } } : {}),
      },
    });
    return rows
      .map((h) => ({ id: h.id, name: h.name, type: h.type, address: h.address, district: h.district, lat: h.lat, lng: h.lng, phone: h.phone, services: h.services, distanceKm: haversineKm(q, h) }))
      .filter((h) => h.distanceKm <= q.radiusKm)
      .sort((a, b) => a.distanceKm - b.distanceKm)
      .slice(0, q.limit);
  }

  async import(rows: HospitalRow[]) {
    let imported = 0;
    let updated = 0;
    for (const r of rows) {
      const where = { name_district: { name: r.name, district: r.district } };
      const exists = await this.prisma.hospital.findUnique({ where });
      await this.prisma.hospital.upsert({ where, create: r, update: r });
      exists ? updated++ : imported++;
    }
    return { imported, updated };
  }
}
```
`apps/api/src/hospital/hospital.controller.ts`:
```ts
import { Body, Controller, Get, Post, Query, RawBodyRequest, Req } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsString, Max, Min, IsInt } from 'class-validator';
import { ApiError } from '../common/api-error';
import { Roles } from '../common/roles.decorator';
import { parseHospitalCsv } from './hospital-csv';
import { HospitalService } from './hospital.service';

class NearbyQuery {
  @Type(() => Number) @IsNumber() @Min(-90) @Max(90) lat!: number;
  @Type(() => Number) @IsNumber() @Min(-180) @Max(180) lng!: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0.1) @Max(100) radiusKm = 10;
  @IsOptional() @IsString() service?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 20;
}

@Controller()
export class HospitalController {
  constructor(private readonly hospitals: HospitalService) {}

  @Get('hospitals/nearby') nearby(@Query() q: NearbyQuery) { return this.hospitals.nearby(q); }

  @Roles('ADMIN') @Post('admin/hospitals/import')
  async import(@Body() body: unknown) {
    const text = typeof body === 'string' ? body : '';
    if (!text.trim()) throw new ApiError(400, 'EMPTY_BODY', 'Send the CSV as the request body with Content-Type: text/csv');
    const { rows, errors } = parseHospitalCsv(text);
    const result = await this.hospitals.import(rows);
    return { ...result, errors };
  }
}
```
Enable text bodies: in `configure-app.ts` add `import { text } from 'express'` and, if the app is an Express app, `app.use(text({ type: 'text/csv', limit: '5mb' }));`. (Remove the unused `RawBodyRequest`, `Req` imports.)
`apps/api/src/hospital/hospital.module.ts`:
```ts
import { Module } from '@nestjs/common';
import { HospitalController } from './hospital.controller';
import { HospitalService } from './hospital.service';

@Module({ controllers: [HospitalController], providers: [HospitalService] })
export class HospitalModule {}
```
Add `HospitalModule` to `AppModule`.

- [ ] **Step 3: E2E test**

`apps/api/test/hospital.e2e-spec.ts`:
```ts
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp, makeAdmin, registerAndLogin, resetDb } from './helpers';

const csv = [
  'name,type,address,district,lat,lng,phone,services,source',
  'Near Hospital,Hospital,1 Rd,Dhaka,23.8110,90.4130,0171,Vaccination;Pediatrics,OSM',
  'Far Hospital,Hospital,2 Rd,Chattogram,22.3569,91.7832,,Pediatrics,OSM',
  'Bad Row,Hospital,3 Rd,Dhaka,999,90,,,OSM',
].join('\n');

describe('hospitals', () => {
  let app: INestApplication;
  const http = () => request(app.getHttpServer());
  beforeAll(async () => (app = await createTestApp()));
  beforeEach(() => resetDb(app.get(PrismaService)));
  afterAll(() => app.close());

  it('imports CSV (admin only), reports row errors, and is idempotent', async () => {
    const parent = await registerAndLogin(app);
    await http().post('/v1/admin/hospitals/import').set('Authorization', `Bearer ${parent.token}`).set('Content-Type', 'text/csv').send(csv).expect(403);
    const admin = await makeAdmin(app);
    const auth = { Authorization: `Bearer ${admin.token}` };
    const first = await http().post('/v1/admin/hospitals/import').set(auth).set('Content-Type', 'text/csv').send(csv).expect(201);
    expect(first.body).toMatchObject({ imported: 2, updated: 0 });
    expect(first.body.errors).toHaveLength(1);
    const second = await http().post('/v1/admin/hospitals/import').set(auth).set('Content-Type', 'text/csv').send(csv).expect(201);
    expect(second.body).toMatchObject({ imported: 0, updated: 2 });
  });

  it('finds nearby hospitals sorted by distance and filters by service and radius', async () => {
    const admin = await makeAdmin(app);
    await http().post('/v1/admin/hospitals/import').set('Authorization', `Bearer ${admin.token}`).set('Content-Type', 'text/csv').send(csv);
    const parent = await registerAndLogin(app);
    const auth = { Authorization: `Bearer ${parent.token}` };
    const near = await http().get('/v1/hospitals/nearby?lat=23.8103&lng=90.4125&radiusKm=10').set(auth).expect(200);
    expect(near.body.map((h: any) => h.name)).toEqual(['Near Hospital']);
    expect(near.body[0].distanceKm).toBeLessThan(1);
    const wide = await http().get('/v1/hospitals/nearby?lat=23.8103&lng=90.4125&radiusKm=300').set(auth);
    expect(wide.body.map((h: any) => h.name)).toEqual(['Near Hospital', 'Far Hospital']);
    const svc = await http().get('/v1/hospitals/nearby?lat=23.8103&lng=90.4125&radiusKm=300&service=Vaccination').set(auth);
    expect(svc.body.map((h: any) => h.name)).toEqual(['Near Hospital']);
    await http().get('/v1/hospitals/nearby?lat=abc&lng=90').set(auth).expect(400);
  });
});
```
`data/seed/hospitals.bd.csv` — **data task:** header exactly as above. Collect rows from sources whose licence allows reuse (OpenStreetMap via an Overpass query for `amenity=hospital` and `amenity=clinic` in Bangladesh, and the government's published hospital lists where reuse is permitted). Do not copy from Google Maps or commercial directories. Every row needs a `source` (for example `OpenStreetMap contributors, ODbL, queried 2026-10-18`). Phone numbers and service tags only when the source provides them. Then run the import through the admin endpoint. Rows with problems appear in the `errors` array; fix them at the source rather than editing the parser.

- [ ] **Step 4: Run and commit**

Run: `pnpm test && pnpm test:e2e -- hospital` → pass.
```bash
git add -A && git commit -m "feat(hospital): nearby search and admin CSV import"
```

---

### Task 14: Notification module (push, preferences, meal and vaccine reminders)

**Files:**
- Create: `apps/api/src/notification/{notification.module.ts, due.ts, push-sender.ts, notification.service.ts, notification.controller.ts, reminder.job.ts}`
- Modify: `apps/api/src/app.module.ts` (import `ScheduleModule.forRoot()`, `NotificationModule`)
- Test: `apps/api/src/notification/due.spec.ts`, `apps/api/test/notification.e2e-spec.ts`

**Interfaces:**
- Consumes: `ChildAccessService`, `PrismaService`, `vaccineStatus`.
- Produces:
```ts
// due.ts
export function localTimeParts(now: Date, timeZone: string): { hhmm: string; date: string }; // user-local "HH:mm" and "YYYY-MM-DD"
export function isDueNow(now: Date, timeZone: string, timeOfDay: string): boolean;            // true when local HH:mm === timeOfDay

// push-sender.ts
export type PushPayload = { title: string; body: string; url?: string; tag?: string };
export abstract class PushSender { abstract send(sub: { endpoint: string; p256dh: string; auth: string }, payload: PushPayload): Promise<'SENT' | 'GONE'>; }
export class WebPushSender extends PushSender {}   // uses VAPID env
export class MemoryPushSender extends PushSender { sent: { endpoint: string; payload: PushPayload }[] }   // for tests

// notification.service.ts
class NotificationService {
  runMealReminders(now: Date): Promise<number>;     // returns notifications sent
  runVaccineReminders(now: Date): Promise<number>;
}
```
- Endpoints: `GET /v1/notifications/vapid-public-key` (public); `POST /v1/notifications/subscriptions {endpoint, keys:{p256dh,auth}}`; `DELETE /v1/notifications/subscriptions {endpoint}`; `GET /v1/notifications/preferences`; `PUT /v1/notifications/preferences/:type {enabled, timeOfDay?}`; `GET /v1/children/:id/meal-reminders`; `PUT /v1/children/:id/meal-reminders/:slot {timeOfDay, enabled}`.
- Rules: meal reminders are off until the parent creates one; the push body names today's planned recipe for that slot and adds "Contains <allergen>" if the allergy status is not OK; vaccine reminders go out at the user's `VACCINE_REMINDER` time (default 09:00 local) for doses that are DUE or fall due within 3 days and are not given; a push that returns `GONE` deletes that subscription; a type disabled in preferences sends nothing.

- [ ] **Step 1: Failing time-zone tests**

`apps/api/src/notification/due.spec.ts`:
```ts
import { isDueNow, localTimeParts } from './due';

describe('localTimeParts', () => {
  it('converts UTC to Asia/Dhaka (UTC+6)', () => {
    expect(localTimeParts(new Date('2026-04-01T02:30:00Z'), 'Asia/Dhaka')).toEqual({ hhmm: '08:30', date: '2026-04-01' });
  });
  it('rolls the date over at local midnight', () => {
    expect(localTimeParts(new Date('2026-04-01T18:30:00Z'), 'Asia/Dhaka')).toEqual({ hhmm: '00:30', date: '2026-04-02' });
  });
});

describe('isDueNow', () => {
  const now = new Date('2026-04-01T02:30:20Z'); // 08:30 in Dhaka
  it('matches the local minute', () => expect(isDueNow(now, 'Asia/Dhaka', '08:30')).toBe(true));
  it('does not match another minute', () => expect(isDueNow(now, 'Asia/Dhaka', '08:31')).toBe(false));
  it('respects the time zone', () => expect(isDueNow(now, 'UTC', '08:30')).toBe(false));
});
```
Run → FAIL.

- [ ] **Step 2: Implement due.ts and push-sender.ts**

`apps/api/src/notification/due.ts`:
```ts
export function localTimeParts(now: Date, timeZone: string): { hhmm: string; date: string } {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)!.value;
  return { hhmm: `${get('hour')}:${get('minute')}`, date: `${get('year')}-${get('month')}-${get('day')}` };
}

export const isDueNow = (now: Date, timeZone: string, timeOfDay: string) => localTimeParts(now, timeZone).hhmm === timeOfDay;
```
Run: `pnpm test -- due` → PASS.

`apps/api/src/notification/push-sender.ts`:
```ts
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as webpush from 'web-push';
import { Env } from '../config/env';

export type PushPayload = { title: string; body: string; url?: string; tag?: string };
export type PushTarget = { endpoint: string; p256dh: string; auth: string };

export abstract class PushSender {
  abstract send(sub: PushTarget, payload: PushPayload): Promise<'SENT' | 'GONE'>;
}

@Injectable()
export class WebPushSender extends PushSender {
  private readonly log = new Logger('WebPush');
  private readonly enabled: boolean;

  constructor(config: ConfigService<Env, true>) {
    super();
    const pub = config.get('VAPID_PUBLIC_KEY', { infer: true });
    const priv = config.get('VAPID_PRIVATE_KEY', { infer: true });
    this.enabled = !!pub && !!priv;
    if (this.enabled) webpush.setVapidDetails(config.get('VAPID_SUBJECT', { infer: true }), pub!, priv!);
    else this.log.warn('VAPID keys not set; push notifications are disabled');
  }

  async send(sub: PushTarget, payload: PushPayload) {
    if (!this.enabled) return 'SENT';
    try {
      await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, JSON.stringify(payload));
      return 'SENT';
    } catch (e: any) {
      if (e?.statusCode === 404 || e?.statusCode === 410) return 'GONE';
      this.log.error(e);
      return 'SENT';
    }
  }
}

export class MemoryPushSender extends PushSender {
  sent: { endpoint: string; payload: PushPayload }[] = [];
  gone = new Set<string>();
  async send(sub: PushTarget, payload: PushPayload) {
    if (this.gone.has(sub.endpoint)) return 'GONE';
    this.sent.push({ endpoint: sub.endpoint, payload });
    return 'SENT';
  }
}
```

- [ ] **Step 3: Service, controller, job, module**

`apps/api/src/notification/notification.service.ts`:
```ts
import { Injectable } from '@nestjs/common';
import { MealSlot, NotificationType } from '@prisma/client';
import { ChildAccessService } from '../child/child-access.service';
import { evaluateAllergens } from '../meal/allergy';
import { PrismaService } from '../prisma/prisma.service';
import { vaccineStatus } from '../vaccination/status';
import { isDueNow, localTimeParts } from './due';
import { PushSender } from './push-sender';

const SLOT_LABEL: Record<MealSlot, string> = {
  BREAKFAST: 'Breakfast', LUNCH: 'Lunch', MORNING_SNACK: 'Morning snack', AFTERNOON_SNACK: 'Afternoon snack', DINNER: 'Dinner',
};
const DEFAULT_VACCINE_TIME = '09:00';

@Injectable()
export class NotificationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: ChildAccessService,
    private readonly sender: PushSender,
  ) {}

  // ---- subscriptions & preferences ----
  subscribe(userId: string, endpoint: string, p256dh: string, auth: string) {
    return this.prisma.pushSubscription.upsert({
      where: { endpoint }, create: { userId, endpoint, p256dh, auth }, update: { userId, p256dh, auth },
    });
  }
  async unsubscribe(userId: string, endpoint: string) {
    await this.prisma.pushSubscription.deleteMany({ where: { userId, endpoint } });
  }
  async preferences(userId: string) {
    const rows = await this.prisma.notificationPreference.findMany({ where: { userId } });
    const types = Object.values(NotificationType);
    return types.map((type) => {
      const r = rows.find((x) => x.type === type);
      return { type, enabled: r?.enabled ?? true, timeOfDay: r?.timeOfDay ?? (type === 'VACCINE_REMINDER' ? DEFAULT_VACCINE_TIME : null) };
    });
  }
  setPreference(userId: string, type: NotificationType, enabled: boolean, timeOfDay?: string) {
    return this.prisma.notificationPreference.upsert({
      where: { userId_type: { userId, type } }, create: { userId, type, enabled, timeOfDay }, update: { enabled, ...(timeOfDay ? { timeOfDay } : {}) },
    });
  }

  // ---- meal reminders ----
  async mealReminders(userId: string, childId: string) {
    await this.access.assertOwned(userId, childId);
    return this.prisma.mealReminder.findMany({ where: { childId }, orderBy: { slot: 'asc' } });
  }
  async setMealReminder(userId: string, childId: string, slot: MealSlot, timeOfDay: string, enabled: boolean) {
    await this.access.assertOwned(userId, childId);
    return this.prisma.mealReminder.upsert({
      where: { childId_slot: { childId, slot } }, create: { childId, slot, timeOfDay, enabled }, update: { timeOfDay, enabled },
    });
  }

  private async pushToUser(userId: string, payload: { title: string; body: string; url?: string; tag?: string }) {
    const subs = await this.prisma.pushSubscription.findMany({ where: { userId } });
    let sent = 0;
    for (const s of subs) {
      const r = await this.sender.send(s, payload);
      if (r === 'GONE') await this.prisma.pushSubscription.delete({ where: { id: s.id } });
      else sent++;
    }
    return sent;
  }

  private async enabledFor(userId: string, type: NotificationType) {
    const pref = await this.prisma.notificationPreference.findUnique({ where: { userId_type: { userId, type } } });
    return pref?.enabled ?? true;
  }

  async runMealReminders(now: Date): Promise<number> {
    const reminders = await this.prisma.mealReminder.findMany({ where: { enabled: true }, include: { child: { include: { user: true, allergies: true } } } });
    let count = 0;
    for (const r of reminders) {
      const tz = r.child.user.timezone;
      if (!isDueNow(now, tz, r.timeOfDay)) continue;
      if (!(await this.enabledFor(r.child.userId, 'DAILY_PLAN'))) continue;
      const { date } = localTimeParts(now, tz);
      const entry = await this.prisma.mealPlanEntry.findFirst({
        where: { childId: r.childId, date: new Date(`${date}T00:00:00Z`), slot: r.slot },
        include: { recipe: { include: { foods: { include: { food: true } } } } },
      });
      if (!entry) continue;
      const verdict = evaluateAllergens(r.child.allergies, entry.recipe.foods.map((f) => ({ id: f.foodId, name: f.food.name, allergens: f.food.allergens })));
      const warn = verdict.status === 'OK' ? '' : ` Contains ${[...new Set(verdict.matches.map((m) => m.allergen.toLowerCase()))].join(', ')}.`;
      count += await this.pushToUser(r.child.userId, {
        title: `${SLOT_LABEL[r.slot]} for ${r.child.name}`, body: `${entry.recipe.name}.${warn}`, url: `/children/${r.childId}/meals`, tag: `meal-${r.childId}-${r.slot}`,
      });
    }
    return count;
  }

  async runVaccineReminders(now: Date): Promise<number> {
    const users = await this.prisma.user.findMany({ where: { children: { some: {} }, pushSubscriptions: { some: {} } } });
    let count = 0;
    for (const u of users) {
      const prefs = await this.prisma.notificationPreference.findUnique({ where: { userId_type: { userId: u.id, type: 'VACCINE_REMINDER' } } });
      if (prefs && !prefs.enabled) continue;
      if (!isDueNow(now, u.timezone, prefs?.timeOfDay ?? DEFAULT_VACCINE_TIME)) continue;
      const rows = await this.prisma.childVaccination.findMany({
        where: { child: { userId: u.id }, givenDate: null },
        include: { child: true, scheduleItem: { include: { vaccine: true } } },
      });
      const soon = now.getTime() + 3 * 86_400_000;
      for (const v of rows) {
        const status = vaccineStatus({ dateOfBirth: v.child.dateOfBirth, givenDate: null, minAgeDays: v.scheduleItem.minAgeDays, maxAgeDays: v.scheduleItem.maxAgeDays, now });
        const dueSoon = v.dueDate.getTime() <= soon;
        if (!(status === 'DUE' || status === 'OVERDUE' || (status === 'UPCOMING' && dueSoon))) continue;
        const free = v.scheduleItem.vaccine.availability === 'GOVERNMENT_FREE' ? ' (free, government programme)' : '';
        count += await this.pushToUser(u.id, {
          title: `Vaccine reminder for ${v.child.name}`,
          body: `${v.scheduleItem.vaccine.name} dose ${v.scheduleItem.doseNumber} is ${status === 'OVERDUE' ? 'overdue' : 'due'}${free}.`,
          url: `/children/${v.childId}/vaccinations`, tag: `vaccine-${v.id}`,
        });
      }
    }
    return count;
  }
}
```
`apps/api/src/notification/reminder.job.ts`:
```ts
import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { NotificationService } from './notification.service';

@Injectable()
export class ReminderJob {
  constructor(private readonly notifications: NotificationService) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async tick() {
    const now = new Date();
    await this.notifications.runMealReminders(now);
    await this.notifications.runVaccineReminders(now);
  }
}
```
`apps/api/src/notification/notification.controller.ts`:
```ts
import { Body, Controller, Delete, Get, HttpCode, Param, ParseEnumPipe, ParseUUIDPipe, Post, Put } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MealSlot, NotificationType } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, Matches, ValidateNested } from 'class-validator';
import { AuthUser, CurrentUser } from '../common/current-user';
import { Public } from '../common/public.decorator';
import { Env } from '../config/env';
import { NotificationService } from './notification.service';

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
class KeysDto {
  @IsString() p256dh!: string;
  @IsString() auth!: string;
}
class SubscribeDto {
  @IsString() endpoint!: string;
  @ValidateNested() @Type(() => KeysDto) keys!: KeysDto;
}
class UnsubscribeDto {
  @IsString() endpoint!: string;
}
class PreferenceDto {
  @IsBoolean() enabled!: boolean;
  @IsOptional() @Matches(HHMM) timeOfDay?: string;
}
class MealReminderDto {
  @Matches(HHMM) timeOfDay!: string;
  @IsBoolean() enabled!: boolean;
}

@Controller()
export class NotificationController {
  constructor(private readonly notifications: NotificationService, private readonly config: ConfigService<Env, true>) {}

  @Public() @Get('notifications/vapid-public-key')
  key() { return { publicKey: this.config.get('VAPID_PUBLIC_KEY', { infer: true }) ?? null }; }

  @Post('notifications/subscriptions') @HttpCode(204)
  async subscribe(@CurrentUser() u: AuthUser, @Body() b: SubscribeDto) { await this.notifications.subscribe(u.id, b.endpoint, b.keys.p256dh, b.keys.auth); }

  @Delete('notifications/subscriptions') @HttpCode(204)
  unsubscribe(@CurrentUser() u: AuthUser, @Body() b: UnsubscribeDto) { return this.notifications.unsubscribe(u.id, b.endpoint); }

  @Get('notifications/preferences') prefs(@CurrentUser() u: AuthUser) { return this.notifications.preferences(u.id); }

  @Put('notifications/preferences/:type') async setPref(
    @CurrentUser() u: AuthUser, @Param('type', new ParseEnumPipe(NotificationType)) type: NotificationType, @Body() b: PreferenceDto,
  ) {
    await this.notifications.setPreference(u.id, type, b.enabled, b.timeOfDay);
    return this.notifications.preferences(u.id);
  }

  @Get('children/:childId/meal-reminders') meal(@CurrentUser() u: AuthUser, @Param('childId', ParseUUIDPipe) c: string) {
    return this.notifications.mealReminders(u.id, c);
  }

  @Put('children/:childId/meal-reminders/:slot') setMeal(
    @CurrentUser() u: AuthUser, @Param('childId', ParseUUIDPipe) c: string, @Param('slot', new ParseEnumPipe(MealSlot)) slot: MealSlot, @Body() b: MealReminderDto,
  ) {
    return this.notifications.setMealReminder(u.id, c, slot, b.timeOfDay, b.enabled);
  }
}
```
`apps/api/src/notification/notification.module.ts`:
```ts
import { Module } from '@nestjs/common';
import { ChildModule } from '../child/child.module';
import { NotificationController } from './notification.controller';
import { NotificationService } from './notification.service';
import { PushSender, WebPushSender } from './push-sender';
import { ReminderJob } from './reminder.job';

@Module({
  imports: [ChildModule],
  controllers: [NotificationController],
  providers: [NotificationService, ReminderJob, { provide: PushSender, useClass: WebPushSender }],
  exports: [NotificationService],
})
export class NotificationModule {}
```
Add `ScheduleModule.forRoot()` and `NotificationModule` to `AppModule`. In tests, override the `ReminderJob` is unnecessary (the cron fires per minute but sends nothing unless data matches); to avoid flakiness, override it: `b.overrideProvider(ReminderJob).useValue({ tick: async () => {} })`.

- [ ] **Step 4: E2E test**

`apps/api/test/notification.e2e-spec.ts`:
```ts
import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'crypto';
import request from 'supertest';
import { NotificationService } from '../src/notification/notification.service';
import { MemoryPushSender, PushSender } from '../src/notification/push-sender';
import { ReminderJob } from '../src/notification/reminder.job';
import { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp, registerAndLogin, resetDb } from './helpers';

describe('notifications', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let push: MemoryPushSender;
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    push = new MemoryPushSender();
    app = await createTestApp((b) => b.overrideProvider(PushSender).useValue(push).overrideProvider(ReminderJob).useValue({ tick: async () => {} }));
    prisma = app.get(PrismaService);
  });
  beforeEach(async () => { await resetDb(prisma); push.sent = []; push.gone.clear(); });
  afterAll(() => app.close());

  async function setup() {
    const p = await registerAndLogin(app);
    const auth = { Authorization: `Bearer ${p.token}` };
    const child = (await http().post('/v1/children').set(auth).send({ name: 'Amina', dateOfBirth: '2022-01-10', gender: 'FEMALE' })).body;
    await http().post('/v1/notifications/subscriptions').set(auth).send({ endpoint: 'https://push.example/1', keys: { p256dh: 'k', auth: 'a' } }).expect(204);
    return { auth, child, userId: p.userId };
  }

  it('sends a lunch reminder at the local time, with an allergen warning', async () => {
    const { auth, child } = await setup();
    await http().put(`/v1/children/${child.id}/allergies`).set(auth).send({ items: [{ allergen: 'EGG', severity: 'MILD' }] });
    const egg = await prisma.food.create({ data: { name: 'Egg', category: 'P', allergens: ['EGG'], nutrition: {} } });
    const recipe = await prisma.recipe.create({
      data: { name: 'Egg rice', instructions: 'x', prepMinutes: 5, slots: ['LUNCH'], suitableDiets: ['NON_VEGETARIAN'], foods: { create: [{ foodId: egg.id, quantityG: 50 }] } },
    });
    await http().put(`/v1/children/${child.id}/meal-entries/${randomUUID()}`).set(auth)
      .send({ date: '2026-04-01', slot: 'LUNCH', recipeId: recipe.id, confirmAllergen: true, clientUpdatedAt: '2026-04-01T00:00:00Z' }).expect(200);
    await http().put(`/v1/children/${child.id}/meal-reminders/LUNCH`).set(auth).send({ timeOfDay: '13:00', enabled: true }).expect(200);

    const svc = app.get(NotificationService);
    expect(await svc.runMealReminders(new Date('2026-04-01T06:59:00Z'))).toBe(0);   // 12:59 in Dhaka
    expect(await svc.runMealReminders(new Date('2026-04-01T07:00:10Z'))).toBe(1);   // 13:00 in Dhaka
    expect(push.sent[0].payload.title).toBe('Lunch for Amina');
    expect(push.sent[0].payload.body).toBe('Egg rice. Contains egg.');
  });

  it('sends nothing when the type is disabled', async () => {
    const { auth, child } = await setup();
    const food = await prisma.food.create({ data: { name: 'Rice', category: 'G', nutrition: {} } });
    const recipe = await prisma.recipe.create({ data: { name: 'Plain rice', instructions: 'x', prepMinutes: 5, slots: ['LUNCH'], suitableDiets: ['NON_VEGETARIAN'], foods: { create: [{ foodId: food.id, quantityG: 50 }] } } });
    await http().put(`/v1/children/${child.id}/meal-entries/${randomUUID()}`).set(auth)
      .send({ date: '2026-04-01', slot: 'LUNCH', recipeId: recipe.id, clientUpdatedAt: '2026-04-01T00:00:00Z' }).expect(200);
    await http().put(`/v1/children/${child.id}/meal-reminders/LUNCH`).set(auth).send({ timeOfDay: '13:00', enabled: true });
    await http().put('/v1/notifications/preferences/DAILY_PLAN').set(auth).send({ enabled: false }).expect(200);
    expect(await app.get(NotificationService).runMealReminders(new Date('2026-04-01T07:00:10Z'))).toBe(0);
  });

  it('removes subscriptions the push service reports as gone', async () => {
    const { auth, child } = await setup();
    const food = await prisma.food.create({ data: { name: 'Rice', category: 'G', nutrition: {} } });
    const recipe = await prisma.recipe.create({ data: { name: 'Plain rice', instructions: 'x', prepMinutes: 5, slots: ['LUNCH'], suitableDiets: ['NON_VEGETARIAN'], foods: { create: [{ foodId: food.id, quantityG: 50 }] } } });
    await http().put(`/v1/children/${child.id}/meal-entries/${randomUUID()}`).set(auth)
      .send({ date: '2026-04-01', slot: 'LUNCH', recipeId: recipe.id, clientUpdatedAt: '2026-04-01T00:00:00Z' });
    await http().put(`/v1/children/${child.id}/meal-reminders/LUNCH`).set(auth).send({ timeOfDay: '13:00', enabled: true });
    push.gone.add('https://push.example/1');
    await app.get(NotificationService).runMealReminders(new Date('2026-04-01T07:00:10Z'));
    expect(await prisma.pushSubscription.count()).toBe(0);
  });

  it('sends vaccine reminders for due doses at the default 09:00 local time', async () => {
    const { child } = await setup();
    const v = await prisma.vaccine.create({
      data: { code: 'BCG', name: 'BCG', disease: 'TB', description: 'd', availability: 'GOVERNMENT_FREE', sourceNote: 't', schedule: { create: [{ doseNumber: 1, suggestedAgeDays: 0, minAgeDays: 0, maxAgeDays: 365 }] } },
      include: { schedule: true },
    });
    await prisma.childVaccination.create({ data: { childId: child.id, scheduleItemId: v.schedule[0].id, dueDate: new Date('2022-01-10') } });
    const svc = app.get(NotificationService);
    expect(await svc.runVaccineReminders(new Date('2026-04-01T02:00:00Z'))).toBe(0);  // 08:00 Dhaka
    expect(await svc.runVaccineReminders(new Date('2026-04-01T03:00:10Z'))).toBe(1);  // 09:00 Dhaka
    expect(push.sent[0].payload.body).toContain('free, government programme');
  });

  it('validates reminder times and hides other parents\' children', async () => {
    const { auth, child } = await setup();
    await http().put(`/v1/children/${child.id}/meal-reminders/LUNCH`).set(auth).send({ timeOfDay: '25:61', enabled: true }).expect(400);
    const other = await registerAndLogin(app, 'other@example.com');
    await http().put(`/v1/children/${child.id}/meal-reminders/LUNCH`).set('Authorization', `Bearer ${other.token}`).send({ timeOfDay: '13:00', enabled: true }).expect(404);
  });
});
```
Note: the vaccine test depends on the child being created before the `BCG` vaccine exists, so no schedule row is auto-generated; the test inserts one directly.

- [ ] **Step 5: Run and commit**

Run: `pnpm test && pnpm test:e2e -- notification` → pass.
```bash
git add -A && git commit -m "feat(notification): web push, preferences, meal and vaccine reminders"
```

---

### Task 15: Seed pipeline and starter data

**Files:**
- Create: `apps/api/prisma/seed.ts`, `data/seed/foods.json`, `data/seed/recipes.json`
- Modify: `apps/api/package.json` (`"prisma": { "seed": "ts-node prisma/seed.ts" }`)
- Test: `apps/api/test/seed.e2e-spec.ts`

**Interfaces:**
- Produces: `seedAll(prisma: PrismaClient, dataDir?: string): Promise<{ foods: number; recipes: number; vaccines: number; doses: number }>`, idempotent (upserts by `name` / `code`). `pnpm --filter api exec prisma db seed` runs it against `DATABASE_URL`.

- [ ] **Step 1: Data file formats**

`data/seed/foods.json`: `{ "verified": false, "source": "...", "foods": [{ "name": "Rice, cooked", "category": "Grains", "allergens": [], "ageMinMonths": 6, "ageMaxMonths": 144, "nutrition": { "calories": 130, "protein": 2.7, "carbs": 28, "fat": 0.3, "fiber": 0.4, "iron": 0.2, "calcium": 10, "vitaminA": 0, "vitaminC": 0, "vitaminD": 0, "zinc": 0.5 } }] }`
`data/seed/recipes.json`: `{ "verified": false, "recipes": [{ "name": "...", "instructions": "...", "prepMinutes": 20, "ageMinMonths": 12, "ageMaxMonths": 144, "slots": ["LUNCH","DINNER"], "suitableDiets": ["NON_VEGETARIAN","VEGETARIAN"], "foods": [{ "food": "Rice, cooked", "quantityG": 100 }] }] }`

Start with the 10-food, 4-recipe starter set below so the pipeline and tests have data; the 200–300 meal library is the data workstream in Step 6. Nutrition values for the starter foods must be copied from a cited public composition table (for example the Bangladesh food composition table or USDA FoodData Central), with the table named in `source`; do not type values from memory.

`apps/api/prisma/seed.ts`:
```ts
import { Allergen, DietType, MealSlot, PrismaClient } from '@prisma/client';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { validateNutrition } from '../src/food/nutrition';

const defaultDir = resolve(__dirname, '../../../data/seed');
const read = (dir: string, f: string) => JSON.parse(readFileSync(resolve(dir, f), 'utf8'));

export async function seedAll(prisma: PrismaClient, dataDir = defaultDir) {
  const foods = existsSync(resolve(dataDir, 'foods.json')) ? read(dataDir, 'foods.json').foods : [];
  for (const f of foods) {
    const data = {
      category: f.category, allergens: (f.allergens ?? []) as Allergen[], nutrition: validateNutrition(f.nutrition) as object,
      ageMinMonths: f.ageMinMonths ?? 0, ageMaxMonths: f.ageMaxMonths ?? 144,
    };
    await prisma.food.upsert({ where: { name: f.name }, create: { name: f.name, ...data }, update: data });
  }

  const recipes = existsSync(resolve(dataDir, 'recipes.json')) ? read(dataDir, 'recipes.json').recipes : [];
  for (const r of recipes) {
    const foodRows = await prisma.food.findMany({ where: { name: { in: r.foods.map((x: any) => x.food) } } });
    const byName = new Map(foodRows.map((x) => [x.name, x.id]));
    const missing = r.foods.filter((x: any) => !byName.has(x.food));
    if (missing.length) throw new Error(`Recipe "${r.name}" uses unknown foods: ${missing.map((m: any) => m.food).join(', ')}`);
    const base = {
      instructions: r.instructions, prepMinutes: r.prepMinutes, ageMinMonths: r.ageMinMonths, ageMaxMonths: r.ageMaxMonths,
      slots: r.slots as MealSlot[], suitableDiets: r.suitableDiets as DietType[],
    };
    const links = r.foods.map((x: any) => ({ foodId: byName.get(x.food)!, quantityG: x.quantityG }));
    await prisma.recipe.upsert({
      where: { name: r.name },
      create: { name: r.name, ...base, foods: { create: links } },
      update: { ...base, foods: { deleteMany: {}, create: links } },
    });
  }

  let vaccines = 0;
  let doses = 0;
  if (existsSync(resolve(dataDir, 'vaccines.bd.json'))) {
    const v = read(dataDir, 'vaccines.bd.json');
    for (const x of v.vaccines) {
      const { schedule, ...rest } = x;
      const data = { ...rest, priceUpdatedAt: rest.priceUpdatedAt ? new Date(rest.priceUpdatedAt) : null, verified: !!v.verified };
      const saved = await prisma.vaccine.upsert({ where: { code: x.code }, create: data, update: data });
      vaccines++;
      for (const d of schedule) {
        await prisma.vaccineScheduleItem.upsert({
          where: { vaccineId_doseNumber: { vaccineId: saved.id, doseNumber: d.doseNumber } }, create: { vaccineId: saved.id, ...d }, update: d,
        });
        doses++;
      }
    }
  }
  return { foods: foods.length, recipes: recipes.length, vaccines, doses };
}

if (require.main === module) {
  const prisma = new PrismaClient();
  seedAll(prisma).then((r) => console.log('seeded', r)).finally(() => prisma.$disconnect());
}
```

- [ ] **Step 2: Failing test**

`apps/api/test/seed.e2e-spec.ts`:
```ts
import { mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { INestApplication } from '@nestjs/common';
import { seedAll } from '../prisma/seed';
import { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp, resetDb } from './helpers';

const nutrition = { calories: 130, protein: 2.7, carbs: 28, fat: 0.3, fiber: 0.4, iron: 0.2, calcium: 10, vitaminA: 0, vitaminC: 0, vitaminD: 0, zinc: 0.5 };

describe('seed', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  beforeAll(async () => { app = await createTestApp(); prisma = app.get(PrismaService); });
  beforeEach(() => resetDb(prisma));
  afterAll(() => app.close());

  function dir() {
    const d = mkdtempSync(join(tmpdir(), 'seed-'));
    writeFileSync(join(d, 'foods.json'), JSON.stringify({ foods: [{ name: 'Rice', category: 'Grains', nutrition }, { name: 'Egg', category: 'Protein', allergens: ['EGG'], nutrition }] }));
    writeFileSync(join(d, 'recipes.json'), JSON.stringify({ recipes: [{ name: 'Egg rice', instructions: 'x', prepMinutes: 10, ageMinMonths: 12, ageMaxMonths: 144, slots: ['LUNCH'], suitableDiets: ['NON_VEGETARIAN'], foods: [{ food: 'Rice', quantityG: 100 }, { food: 'Egg', quantityG: 50 }] }] }));
    writeFileSync(join(d, 'vaccines.bd.json'), JSON.stringify({ verified: false, vaccines: [{ code: 'BCG', name: 'BCG', disease: 'TB', description: 'd', availability: 'GOVERNMENT_FREE', isMandatory: true, sourceNote: 's', schedule: [{ doseNumber: 1, suggestedAgeDays: 0, minAgeDays: 0, maxAgeDays: 365 }] }] }));
    return d;
  }

  it('loads data and is idempotent', async () => {
    const d = dir();
    expect(await seedAll(prisma, d)).toEqual({ foods: 2, recipes: 1, vaccines: 1, doses: 1 });
    await seedAll(prisma, d);
    expect(await prisma.food.count()).toBe(2);
    expect(await prisma.recipe.count()).toBe(1);
    expect(await prisma.vaccineScheduleItem.count()).toBe(1);
    expect((await prisma.vaccine.findUniqueOrThrow({ where: { code: 'BCG' } })).verified).toBe(false);
  });

  it('fails clearly when a recipe references an unknown food', async () => {
    const d = dir();
    writeFileSync(join(d, 'foods.json'), JSON.stringify({ foods: [] }));
    await expect(seedAll(prisma, d)).rejects.toThrow(/unknown foods/);
  });

  it('rejects invalid nutrition in the data files', async () => {
    const d = dir();
    writeFileSync(join(d, 'foods.json'), JSON.stringify({ foods: [{ name: 'Bad', category: 'X', nutrition: { ...nutrition, calories: 9999 } }] }));
    await expect(seedAll(prisma, d)).rejects.toThrow();
  });
});
```
Run: `pnpm test:e2e -- seed` → FAIL until Step 1's `seed.ts` exists; then PASS.

- [ ] **Step 3: Run the seed against the dev database**

Run: `pnpm --filter api exec prisma db seed`
Expected: `seeded { foods: N, recipes: M, vaccines: K, doses: D }` matching the files.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat(seed): idempotent seeding of foods, recipes and vaccines"
```

- [ ] **Step 5: Grow the library (data workstream, reviewed before launch)**

Expand `foods.json` and `recipes.json` to the Phase 1 target of 200–300 meals. Rules: every nutrition value copied from a cited composition table; every allergen tag set honestly (include derived ingredients: ghee and butter carry MILK, fish sauce carries FISH, many sweets carry WHEAT/EGG/MILK); recipes tagged with correct diets and age ranges (no honey under 12 months, no whole nuts under 4 years, no added salt or sugar under 12 months). Keep `"verified": false`. A nutritionist reviews the files before the production seed.

---

### Task 16: End-to-end flow, OpenAPI contract, README

**Files:**
- Create: `apps/api/test/flow.e2e-spec.ts`, `README.md`
- Modify: `packages/contracts/openapi.json` (regenerated)

- [ ] **Step 1: The full-flow test**

`apps/api/test/flow.e2e-spec.ts`:
```ts
import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'crypto';
import request from 'supertest';
import { seedAll } from '../prisma/seed';
import { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp, registerAndLogin, resetDb } from './helpers';

describe('core flow', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const http = () => request(app.getHttpServer());
  beforeAll(async () => { app = await createTestApp(); prisma = app.get(PrismaService); });
  afterAll(() => app.close());

  it('register -> child -> allergy -> plan -> no severe allergen -> vaccine given', async () => {
    await resetDb(prisma);
    await seedAll(prisma);                       // uses data/seed
    const p = await registerAndLogin(app);
    const auth = { Authorization: `Bearer ${p.token}` };
    const child = (await http().post('/v1/children').set(auth).send({ name: 'Amina', dateOfBirth: '2023-01-10', gender: 'FEMALE' }).expect(201)).body;
    await http().put(`/v1/children/${child.id}/allergies`).set(auth).send({ items: [{ allergen: 'EGG', severity: 'SEVERE' }, { allergen: 'MILK', severity: 'SEVERE' }] }).expect(200);

    const gen = await http().post(`/v1/children/${child.id}/meal-plans/generate`).set(auth)
      .send({ startDate: '2026-04-01', endDate: '2026-04-07', type: 'WEEKLY' }).expect(201);
    expect(gen.body.entries.length).toBeGreaterThan(0);

    const plan = await http().get(`/v1/children/${child.id}/meal-plans?from=2026-04-01&to=2026-04-07`).set(auth).expect(200);
    for (const e of plan.body) {
      expect(e.recipe.allergens).not.toContain('EGG');
      expect(e.recipe.allergens).not.toContain('MILK');
      expect(e.allergyStatus).toBe('OK');
    }

    for (let i = 0; i < 20 && (await prisma.childVaccination.count({ where: { childId: child.id } })) === 0; i++) await new Promise((r) => setTimeout(r, 50));
    const vaccs = await http().get(`/v1/children/${child.id}/vaccinations`).set(auth).expect(200);
    if (vaccs.body.length) {
      const first = vaccs.body[0];
      const done = await http().put(`/v1/children/${child.id}/vaccinations/${first.id}`).set(auth)
        .send({ givenDate: '2023-02-01', facilityName: 'Clinic', clientUpdatedAt: '2023-02-01T10:00:00Z' }).expect(200);
      expect(['GIVEN', 'GIVEN_LATE']).toContain(done.body.data.status);
    }

    const grocery = await http().get(`/v1/children/${child.id}/grocery-list?from=2026-04-01&to=2026-04-07`).set(auth).expect(200);
    expect(grocery.body.lines.length).toBeGreaterThan(0);
  });
});
```
(The test needs the starter data from Task 15 to contain at least one allergen-free, age-suitable recipe for slots in the plan.)

- [ ] **Step 2: Run the whole suite, regenerate the contract, check it is current**

Run:
```bash
pnpm test && pnpm test:e2e && pnpm --filter api export:openapi && git diff --stat packages/contracts/openapi.json
```
Expected: all green; `openapi.json` now lists every endpoint in this plan. Spot check: `grep -c '"/v1/' packages/contracts/openapi.json` is at least 40.

- [ ] **Step 3: README**

`README.md` covers: what the repo is, `pnpm install`, `pnpm db:up`, `cp apps/api/.env.example apps/api/.env`, `pnpm --filter api exec prisma migrate dev`, `pnpm --filter api exec prisma db seed`, `pnpm --filter api start:dev`, `pnpm test`, `pnpm test:e2e`, how to regenerate the contract (`pnpm --filter api export:openapi`), the "provisional data" rule from Global Constraints, and links to the spec and both plans.

- [ ] **Step 4: Commit and push**

```bash
git add -A && git commit -m "test: end-to-end core flow; docs: README; chore: regenerate OpenAPI contract"
git push origin HEAD
```

---

## Spec coverage check

| Spec requirement | Task |
|---|---|
| Auth: email, Google/Apple, verification, reset, JWT + rotation | 4 |
| Account export / deletion (BRD privacy) | 5 |
| Food database, allergen tags, nutrition validation | 6 |
| Child profile, allergies, conditions, dislikes, feeding logs, food introductions | 7 |
| Allergy rule: severe blocked, mild/moderate confirmed | 8, 9 |
| Meal plans: auto-generate + manual edit, variety, grocery list | 9 |
| Sync: client UUIDs, idempotent, last-write-wins, `superseded` flag, `updatedSince` | 3, 7, 9, 10, 12 |
| Growth: WHO percentiles, chart overlay data, PDF export, head circumference | 10 |
| Nutrition score (provisional) | 11 |
| Vaccination: government/private, prices, given tracking, suggested ages | 12 |
| Nearby hospitals with own table and CSV import | 13 |
| Notifications incl. per-meal reminders and vaccine reminders | 14 |
| Seed pipeline and data workstream | 15 |
| OpenAPI contract for the front end | 3, 16 |
| Offline support | Server side only: idempotent writes, `updatedSince`, client UUIDs (the web app's service worker is in the front-end plan) |

**Not in this plan (by design):** Phase 2–4 modules, admin and nutritionist panels, subscriptions, payments, AI, store, and the "available support" feature.
