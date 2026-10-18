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
