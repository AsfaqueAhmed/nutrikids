import { Allergen, DietType, MealSlot } from '@prisma/client';

export type CandidateRecipe = {
  id: string;
  name: string;
  slots: MealSlot[];
  suitableDiets: DietType[];
  ageMinMonths: number;
  ageMaxMonths: number;
  foodIds: string[];
  allergens: Allergen[];
};
export type GenerateInput = {
  dates: string[];
  slots: MealSlot[];
  ageMonths: number;
  dietType: DietType;
  allergies: Allergen[];
  dislikedFoodIds: string[];
  recipes: CandidateRecipe[];
  occupied: Set<string>;
  varietyWindowDays: number;
};
export type GeneratedEntry = { date: string; slot: MealSlot; recipeId: string };

export function datesBetween(from: string, to: string): string[] {
  const out: string[] = [];
  for (let t = Date.parse(from); t <= Date.parse(to); t += 86_400_000)
    out.push(new Date(t).toISOString().slice(0, 10));
  return out;
}

export function generatePlan(input: GenerateInput): GeneratedEntry[] {
  const banned = new Set(input.allergies);
  const disliked = new Set(input.dislikedFoodIds);
  const eligible = input.recipes
    .filter((r) => r.suitableDiets.includes(input.dietType))
    .filter(
      (r) =>
        input.ageMonths >= r.ageMinMonths && input.ageMonths <= r.ageMaxMonths,
    )
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
