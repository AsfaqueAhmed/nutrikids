import { parseHospitalCsv } from './hospital-csv';

const header = 'name,type,address,district,lat,lng,phone,services,source';

describe('parseHospitalCsv', () => {
  it('parses a valid row', () => {
    const r = parseHospitalCsv(
      `${header}\nCity Hospital,Hospital,"1 Main Rd, Dhaka",Dhaka,23.75,90.39,0171,Vaccination;Pediatrics,OSM`,
    );
    expect(r.errors).toEqual([]);
    expect(r.rows[0]).toMatchObject({
      name: 'City Hospital',
      lat: 23.75,
      lng: 90.39,
      services: ['Vaccination', 'Pediatrics'],
      phone: '0171',
    });
  });
  it('reports bad coordinates and missing source per line', () => {
    const r = parseHospitalCsv(
      `${header}\nA,Hospital,x,Dhaka,999,90,,,OSM\nB,Hospital,x,Dhaka,23,90,,,`,
    );
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
