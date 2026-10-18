import { buildGroceryList } from './grocery';

describe('buildGroceryList', () => {
  it('sums grams per food across entries and scales by portion', () => {
    const list = buildGroceryList([
      {
        portion: 1,
        foods: [
          { foodId: 'rice', foodName: 'Rice', quantityG: 100 },
          { foodId: 'dal', foodName: 'Dal', quantityG: 50 },
        ],
      },
      {
        portion: 0.5,
        foods: [{ foodId: 'rice', foodName: 'Rice', quantityG: 200 }],
      },
    ]);
    expect(list).toEqual([
      { foodId: 'dal', foodName: 'Dal', totalG: 50 },
      { foodId: 'rice', foodName: 'Rice', totalG: 200 },
    ]);
  });
  it('returns an empty list for no entries', () =>
    expect(buildGroceryList([])).toEqual([]));
});
