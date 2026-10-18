export const SCORE_NUTRIENTS = [
  'protein',
  'iron',
  'calcium',
  'vitaminA',
  'vitaminC',
  'vitaminD',
  'zinc',
  'fiber',
] as const;
export type ScoreNutrient = (typeof SCORE_NUTRIENTS)[number];
export type Targets = Record<ScoreNutrient, number>;

// PROVISIONAL daily targets (units: g, mg, mg, µg RAE, mg, µg, mg, g). Modelled on common
// national dietary reference intakes for age bands; must be replaced or approved by the
// project's medical advisor / WHO-FAO values before launch.
export const RDA_BANDS: {
  fromMonths: number;
  toMonths: number;
  targets: Targets;
}[] = [
  {
    fromMonths: 12,
    toMonths: 47,
    targets: {
      protein: 13,
      iron: 7,
      calcium: 700,
      vitaminA: 300,
      vitaminC: 15,
      vitaminD: 15,
      zinc: 3,
      fiber: 19,
    },
  },
  {
    fromMonths: 48,
    toMonths: 107,
    targets: {
      protein: 19,
      iron: 10,
      calcium: 1000,
      vitaminA: 400,
      vitaminC: 25,
      vitaminD: 15,
      zinc: 5,
      fiber: 25,
    },
  },
  {
    fromMonths: 108,
    toMonths: 1000,
    targets: {
      protein: 34,
      iron: 8,
      calcium: 1300,
      vitaminA: 600,
      vitaminC: 45,
      vitaminD: 15,
      zinc: 8,
      fiber: 26,
    },
  },
];
