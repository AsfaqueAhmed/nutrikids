import { boundingBox, haversineKm } from './hospital.service';

describe('haversineKm', () => {
  it('is 0 for the same point', () =>
    expect(
      haversineKm({ lat: 23.8, lng: 90.4 }, { lat: 23.8, lng: 90.4 }),
    ).toBe(0));
  it('Dhaka to Chattogram is about 215 km', () => {
    expect(
      haversineKm(
        { lat: 23.8103, lng: 90.4125 },
        { lat: 22.3569, lng: 91.7832 },
      ),
    ).toBeGreaterThan(205);
    expect(
      haversineKm(
        { lat: 23.8103, lng: 90.4125 },
        { lat: 22.3569, lng: 91.7832 },
      ),
    ).toBeLessThan(225);
  });
});

describe('boundingBox', () => {
  it('contains every point within the radius', () => {
    const c = { lat: 23.8, lng: 90.4 };
    const box = boundingBox(c.lat, c.lng, 10);
    const east = {
      lat: c.lat,
      lng: c.lng + 9.9 / (111.32 * Math.cos((c.lat * Math.PI) / 180)),
    };
    expect(haversineKm(c, east)).toBeLessThan(10);
    expect(east.lng).toBeLessThanOrEqual(box.maxLng);
    expect(box.minLat).toBeLessThan(c.lat);
    expect(box.maxLat).toBeGreaterThan(c.lat);
  });
});
