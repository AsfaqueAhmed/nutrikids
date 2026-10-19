import type { components } from './schema';

type S = components['schemas'];

export type Gender = S['CreateChildDto']['gender'];
export type ActivityLevel = NonNullable<S['CreateChildDto']['activityLevel']>;
export type DietType = NonNullable<S['CreateChildDto']['dietType']>;
export type Allergen = S['AllergyDto']['allergen'];
export type Severity = S['AllergyDto']['severity'];

export const GENDERS: { value: Gender; label: string }[] = [
  { value: 'FEMALE', label: 'Female' },
  { value: 'MALE', label: 'Male' },
];

export const ACTIVITY_LEVELS: { value: ActivityLevel; label: string }[] = [
  { value: 'SEDENTARY', label: 'Sedentary (quiet play)' },
  { value: 'MODERATE', label: 'Moderate (regular active play)' },
  { value: 'ACTIVE', label: 'Active (very high energy / sports)' },
];

export const DIET_TYPES: { value: DietType; label: string }[] = [
  { value: 'NON_VEGETARIAN', label: 'Standard (includes meat and fish)' },
  { value: 'PESCATARIAN', label: 'Pescatarian (fish, no meat)' },
  { value: 'VEGETARIAN', label: 'Vegetarian' },
  { value: 'VEGAN', label: 'Vegan' },
];

export const ALLERGENS: { value: Allergen; label: string }[] = [
  { value: 'MILK', label: 'Milk' },
  { value: 'EGG', label: 'Egg' },
  { value: 'PEANUT', label: 'Peanut' },
  { value: 'TREE_NUT', label: 'Tree nuts' },
  { value: 'WHEAT', label: 'Wheat / gluten' },
  { value: 'SOY', label: 'Soy' },
  { value: 'FISH', label: 'Fish' },
  { value: 'SHELLFISH', label: 'Shellfish' },
  { value: 'SESAME', label: 'Sesame' },
];

export const SEVERITIES: { value: Severity; label: string }[] = [
  { value: 'MILD', label: 'Mild (Warning)' },
  { value: 'MODERATE', label: 'Moderate (Confirmation)' },
  { value: 'SEVERE', label: 'Severe (Hard Block)' },
];

export const allergenLabel = (a: Allergen) => ALLERGENS.find((x) => x.value === a)?.label ?? a;
