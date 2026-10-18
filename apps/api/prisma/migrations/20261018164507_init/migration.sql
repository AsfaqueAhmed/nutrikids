-- CreateEnum
CREATE TYPE "Role" AS ENUM ('PARENT', 'NUTRITIONIST', 'ADMIN');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE');

-- CreateEnum
CREATE TYPE "ActivityLevel" AS ENUM ('SEDENTARY', 'MODERATE', 'ACTIVE');

-- CreateEnum
CREATE TYPE "DietType" AS ENUM ('NON_VEGETARIAN', 'VEGETARIAN', 'VEGAN', 'PESCATARIAN');

-- CreateEnum
CREATE TYPE "Severity" AS ENUM ('MILD', 'MODERATE', 'SEVERE');

-- CreateEnum
CREATE TYPE "Allergen" AS ENUM ('MILK', 'EGG', 'PEANUT', 'TREE_NUT', 'WHEAT', 'SOY', 'FISH', 'SHELLFISH', 'SESAME');

-- CreateEnum
CREATE TYPE "MealSlot" AS ENUM ('BREAKFAST', 'LUNCH', 'MORNING_SNACK', 'AFTERNOON_SNACK', 'DINNER');

-- CreateEnum
CREATE TYPE "FeedingType" AS ENUM ('BREAST', 'FORMULA', 'SOLID');

-- CreateEnum
CREATE TYPE "PlanType" AS ENUM ('DAILY', 'WEEKLY', 'CUSTOM');

-- CreateEnum
CREATE TYPE "PlanCreator" AS ENUM ('PARENT', 'SYSTEM', 'NUTRITIONIST');

-- CreateEnum
CREATE TYPE "VaccineAvailability" AS ENUM ('GOVERNMENT_FREE', 'PRIVATE_PAID', 'BOTH');

-- CreateEnum
CREATE TYPE "PaidType" AS ENUM ('GOVERNMENT', 'PRIVATE');

-- CreateEnum
CREATE TYPE "AuthTokenType" AS ENUM ('VERIFY_EMAIL', 'RESET_PASSWORD');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('DAILY_PLAN', 'WATER', 'WEEKLY_SCORE', 'GROWTH_REMINDER', 'VACCINE_REMINDER');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT,
    "role" "Role" NOT NULL DEFAULT 'PARENT',
    "emailVerifiedAt" TIMESTAMP(3),
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Dhaka',
    "googleSub" TEXT,
    "appleSub" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "AuthTokenType" NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),

    CONSTRAINT "AuthToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Child" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "dateOfBirth" DATE NOT NULL,
    "gender" "Gender" NOT NULL,
    "heightCm" DECIMAL(5,1),
    "weightKg" DECIMAL(5,2),
    "activityLevel" "ActivityLevel" NOT NULL DEFAULT 'MODERATE',
    "dietType" "DietType" NOT NULL DEFAULT 'NON_VEGETARIAN',
    "photoUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Child_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChildAllergy" (
    "childId" TEXT NOT NULL,
    "allergen" "Allergen" NOT NULL,
    "severity" "Severity" NOT NULL,

    CONSTRAINT "ChildAllergy_pkey" PRIMARY KEY ("childId","allergen")
);

-- CreateTable
CREATE TABLE "ChildCondition" (
    "id" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "ChildCondition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FoodDislike" (
    "childId" TEXT NOT NULL,
    "foodId" TEXT NOT NULL,

    CONSTRAINT "FoodDislike_pkey" PRIMARY KEY ("childId","foodId")
);

-- CreateTable
CREATE TABLE "Food" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "allergens" "Allergen"[],
    "nutrition" JSONB NOT NULL,
    "ageMinMonths" INTEGER NOT NULL DEFAULT 0,
    "ageMaxMonths" INTEGER NOT NULL DEFAULT 144,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Food_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Recipe" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "instructions" TEXT NOT NULL,
    "prepMinutes" INTEGER NOT NULL,
    "ageMinMonths" INTEGER NOT NULL DEFAULT 6,
    "ageMaxMonths" INTEGER NOT NULL DEFAULT 144,
    "slots" "MealSlot"[],
    "suitableDiets" "DietType"[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Recipe_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecipeFood" (
    "recipeId" TEXT NOT NULL,
    "foodId" TEXT NOT NULL,
    "quantityG" DECIMAL(8,1) NOT NULL,

    CONSTRAINT "RecipeFood_pkey" PRIMARY KEY ("recipeId","foodId")
);

-- CreateTable
CREATE TABLE "MealPlanEntry" (
    "id" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "slot" "MealSlot" NOT NULL,
    "recipeId" TEXT NOT NULL,
    "portion" DECIMAL(4,2) NOT NULL DEFAULT 1,
    "createdBy" "PlanCreator" NOT NULL DEFAULT 'PARENT',
    "clientUpdatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MealPlanEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroceryCheck" (
    "childId" TEXT NOT NULL,
    "foodId" TEXT NOT NULL,
    "weekStart" DATE NOT NULL,
    "checked" BOOLEAN NOT NULL,
    "clientUpdatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GroceryCheck_pkey" PRIMARY KEY ("childId","foodId","weekStart")
);

-- CreateTable
CREATE TABLE "GrowthRecord" (
    "id" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "heightCm" DECIMAL(5,1),
    "weightKg" DECIMAL(5,2),
    "headCircumferenceCm" DECIMAL(4,1),
    "clientUpdatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GrowthRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeedingLog" (
    "id" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "type" "FeedingType" NOT NULL,
    "at" TIMESTAMP(3) NOT NULL,
    "durationMinutes" INTEGER,
    "notes" TEXT,
    "clientUpdatedAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeedingLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FoodIntroduction" (
    "id" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "foodId" TEXT NOT NULL,
    "introducedOn" DATE NOT NULL,
    "reaction" TEXT,
    "notes" TEXT,
    "clientUpdatedAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FoodIntroduction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vaccine" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "disease" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "availability" "VaccineAvailability" NOT NULL,
    "isMandatory" BOOLEAN NOT NULL DEFAULT false,
    "priceMinBdt" INTEGER,
    "priceMaxBdt" INTEGER,
    "priceNote" TEXT,
    "priceUpdatedAt" TIMESTAMP(3),
    "sourceNote" TEXT NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Vaccine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VaccineScheduleItem" (
    "id" TEXT NOT NULL,
    "vaccineId" TEXT NOT NULL,
    "doseNumber" INTEGER NOT NULL,
    "suggestedAgeDays" INTEGER NOT NULL,
    "minAgeDays" INTEGER NOT NULL,
    "maxAgeDays" INTEGER,
    "intervalFromPreviousDays" INTEGER,
    "notes" TEXT,

    CONSTRAINT "VaccineScheduleItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChildVaccination" (
    "id" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "scheduleItemId" TEXT NOT NULL,
    "dueDate" DATE NOT NULL,
    "givenDate" DATE,
    "facilityName" TEXT,
    "paidType" "PaidType",
    "amountPaidBdt" INTEGER,
    "batchNo" TEXT,
    "notes" TEXT,
    "cardPhotoUrl" TEXT,
    "clientUpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChildVaccination_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Hospital" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "district" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "phone" TEXT,
    "services" TEXT[],
    "source" TEXT NOT NULL,
    "verifiedAt" TIMESTAMP(3),

    CONSTRAINT "Hospital_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PushSubscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,

    CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationPreference" (
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "timeOfDay" TEXT,

    CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY ("userId","type")
);

-- CreateTable
CREATE TABLE "MealReminder" (
    "childId" TEXT NOT NULL,
    "slot" "MealSlot" NOT NULL,
    "timeOfDay" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "MealReminder_pkey" PRIMARY KEY ("childId","slot")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_googleSub_key" ON "User"("googleSub");

-- CreateIndex
CREATE UNIQUE INDEX "User_appleSub_key" ON "User"("appleSub");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_tokenHash_key" ON "RefreshToken"("tokenHash");

-- CreateIndex
CREATE INDEX "RefreshToken_familyId_idx" ON "RefreshToken"("familyId");

-- CreateIndex
CREATE UNIQUE INDEX "AuthToken_tokenHash_key" ON "AuthToken"("tokenHash");

-- CreateIndex
CREATE INDEX "Child_userId_idx" ON "Child"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ChildCondition_childId_name_key" ON "ChildCondition"("childId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Food_name_key" ON "Food"("name");

-- CreateIndex
CREATE INDEX "Food_category_idx" ON "Food"("category");

-- CreateIndex
CREATE UNIQUE INDEX "Recipe_name_key" ON "Recipe"("name");

-- CreateIndex
CREATE INDEX "MealPlanEntry_childId_date_idx" ON "MealPlanEntry"("childId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "MealPlanEntry_childId_date_slot_key" ON "MealPlanEntry"("childId", "date", "slot");

-- CreateIndex
CREATE INDEX "GrowthRecord_childId_date_idx" ON "GrowthRecord"("childId", "date");

-- CreateIndex
CREATE INDEX "FeedingLog_childId_at_idx" ON "FeedingLog"("childId", "at");

-- CreateIndex
CREATE UNIQUE INDEX "FoodIntroduction_childId_foodId_key" ON "FoodIntroduction"("childId", "foodId");

-- CreateIndex
CREATE UNIQUE INDEX "Vaccine_code_key" ON "Vaccine"("code");

-- CreateIndex
CREATE UNIQUE INDEX "VaccineScheduleItem_vaccineId_doseNumber_key" ON "VaccineScheduleItem"("vaccineId", "doseNumber");

-- CreateIndex
CREATE INDEX "ChildVaccination_childId_dueDate_idx" ON "ChildVaccination"("childId", "dueDate");

-- CreateIndex
CREATE UNIQUE INDEX "ChildVaccination_childId_scheduleItemId_key" ON "ChildVaccination"("childId", "scheduleItemId");

-- CreateIndex
CREATE INDEX "Hospital_lat_lng_idx" ON "Hospital"("lat", "lng");

-- CreateIndex
CREATE UNIQUE INDEX "Hospital_name_district_key" ON "Hospital"("name", "district");

-- CreateIndex
CREATE UNIQUE INDEX "PushSubscription_endpoint_key" ON "PushSubscription"("endpoint");

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthToken" ADD CONSTRAINT "AuthToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Child" ADD CONSTRAINT "Child_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChildAllergy" ADD CONSTRAINT "ChildAllergy_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Child"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChildCondition" ADD CONSTRAINT "ChildCondition_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Child"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FoodDislike" ADD CONSTRAINT "FoodDislike_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Child"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FoodDislike" ADD CONSTRAINT "FoodDislike_foodId_fkey" FOREIGN KEY ("foodId") REFERENCES "Food"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeFood" ADD CONSTRAINT "RecipeFood_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeFood" ADD CONSTRAINT "RecipeFood_foodId_fkey" FOREIGN KEY ("foodId") REFERENCES "Food"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealPlanEntry" ADD CONSTRAINT "MealPlanEntry_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Child"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealPlanEntry" ADD CONSTRAINT "MealPlanEntry_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroceryCheck" ADD CONSTRAINT "GroceryCheck_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Child"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GrowthRecord" ADD CONSTRAINT "GrowthRecord_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Child"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedingLog" ADD CONSTRAINT "FeedingLog_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Child"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FoodIntroduction" ADD CONSTRAINT "FoodIntroduction_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Child"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FoodIntroduction" ADD CONSTRAINT "FoodIntroduction_foodId_fkey" FOREIGN KEY ("foodId") REFERENCES "Food"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VaccineScheduleItem" ADD CONSTRAINT "VaccineScheduleItem_vaccineId_fkey" FOREIGN KEY ("vaccineId") REFERENCES "Vaccine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChildVaccination" ADD CONSTRAINT "ChildVaccination_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Child"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChildVaccination" ADD CONSTRAINT "ChildVaccination_scheduleItemId_fkey" FOREIGN KEY ("scheduleItemId") REFERENCES "VaccineScheduleItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PushSubscription" ADD CONSTRAINT "PushSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationPreference" ADD CONSTRAINT "NotificationPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealReminder" ADD CONSTRAINT "MealReminder_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Child"("id") ON DELETE CASCADE ON UPDATE CASCADE;
