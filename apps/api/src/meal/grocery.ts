export type GroceryLine = { foodId: string; foodName: string; totalG: number };

export function buildGroceryList(
  entries: {
    portion: number;
    foods: { foodId: string; foodName: string; quantityG: number }[];
  }[],
): GroceryLine[] {
  const map = new Map<string, GroceryLine>();
  for (const e of entries) {
    for (const f of e.foods) {
      const cur = map.get(f.foodId) ?? {
        foodId: f.foodId,
        foodName: f.foodName,
        totalG: 0,
      };
      cur.totalG += f.quantityG * e.portion;
      map.set(f.foodId, cur);
    }
  }
  return [...map.values()]
    .map((l) => ({ ...l, totalG: Math.round(l.totalG * 10) / 10 }))
    .sort((a, b) => a.foodName.localeCompare(b.foodName));
}
