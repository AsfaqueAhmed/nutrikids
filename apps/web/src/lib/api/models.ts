// Response shapes. The backend contract types request bodies but not responses yet,
// so these mirror the backend's actual JSON (apps/api/src/*/*.service.ts views).
// TODO: replace with generated types once the API declares response DTOs.
import type { ActivityLevel, Allergen, DietType, Gender, Severity } from './domain';

export type TokenPair = { accessToken: string; refreshToken: string; expiresIn: number };

export type User = {
  id: string;
  email: string;
  role: 'PARENT' | 'NUTRITIONIST' | 'ADMIN';
  emailVerified: boolean;
  timezone: string;
};

export type Allergy = { allergen: Allergen; severity: Severity };

export type Child = {
  id: string;
  name: string;
  dateOfBirth: string; // YYYY-MM-DD
  ageMonths: number;
  gender: Gender;
  heightCm: number | null;
  weightKg: number | null;
  activityLevel: ActivityLevel;
  dietType: DietType;
  photoUrl: string | null;
  allergies: Allergy[];
  conditions: string[];
  dislikes: string[]; // food ids
};

export type Food = {
  id: string;
  name: string;
  category: string;
  allergens: Allergen[];
  ageMinMonths: number;
  ageMaxMonths: number;
};

export type FoodPage = { items: Food[]; total: number; page: number; pageSize: number };

export type EatenStatus = 'FULL' | 'PARTIAL' | 'SKIPPED';
export type MealSlot = 'BREAKFAST' | 'MORNING_SNACK' | 'LUNCH' | 'AFTERNOON_SNACK' | 'DINNER';

export type NutritionLog = {
  id: string;
  date: string;
  slot: MealSlot;
  eatenStatus: EatenStatus;
  percent: number | null;
  notes: string | null;
  clientUpdatedAt: string;
};

export type NutritionSummary = {
  from: string;
  to: string;
  plannedCount: number;
  loggedCount: number;
  fullCount: number;
  partialCount: number;
  skippedCount: number;
  loggedPercent: number | null;
  eatenPercent: number | null;
  perSlot: { slot: MealSlot; logged: number; full: number; partial: number; skipped: number }[];
};

export type ArticleKind = 'ARTICLE' | 'TIP' | 'PAGE';
export type ArticleStatus = 'DRAFT' | 'PUBLISHED';

export type ArticleSummary = {
  id: string;
  kind: ArticleKind;
  slug: string;
  title: string;
  summary: string;
  category: string;
  ageMinMonths: number | null;
  ageMaxMonths: number | null;
  coverUrl: string | null;
  status: ArticleStatus;
  publishedAt: string | null;
};

export type ArticleDetail = ArticleSummary & { body: string };
export type Page<T> = { items: T[]; total: number; page: number; limit: number };

export type AdminUser = {
  id: string;
  email: string;
  role: 'PARENT' | 'NUTRITIONIST' | 'ADMIN';
  disabled: boolean;
  emailVerified: boolean;
  childCount: number;
  createdAt: string;
};

export type AdminStats = {
  totalUsers: number;
  verifiedUsers: number;
  disabledUsers: number;
  totalChildren: number;
  mealEntriesGenerated: number;
  vaccinationsGiven: number;
  signupsByDay: { date: string; count: number }[];
};

export type AdminVaccine = {
  id: string;
  code: string;
  name: string;
  disease: string;
  description: string;
  availability: 'GOVERNMENT_FREE' | 'PRIVATE_PAID' | 'BOTH';
  isMandatory: boolean;
  priceMinBdt: number | null;
  priceMaxBdt: number | null;
  priceNote: string | null;
  priceUpdatedAt: string | null;
  sourceNote: string;
  verified: boolean;
  schedule: {
    id: string;
    doseNumber: number;
    suggestedAgeDays: number;
    minAgeDays: number;
    maxAgeDays: number | null;
    intervalFromPreviousDays: number | null;
    notes: string | null;
  }[];
};
