import { parse } from 'csv-parse/sync';

export type HospitalRow = {
  name: string;
  type: string;
  address: string;
  district: string;
  lat: number;
  lng: number;
  phone: string | null;
  services: string[];
  source: string;
};
const HEADER = [
  'name',
  'type',
  'address',
  'district',
  'lat',
  'lng',
  'phone',
  'services',
  'source',
];

export function parseHospitalCsv(text: string): {
  rows: HospitalRow[];
  errors: { line: number; message: string }[];
} {
  const records: string[][] = parse(text, {
    skip_empty_lines: true,
    relax_column_count: true,
  });
  const errors: { line: number; message: string }[] = [];
  const rows: HospitalRow[] = [];
  if (
    !records.length ||
    records[0].map((h) => h.trim()).join(',') !== HEADER.join(',')
  ) {
    return {
      rows,
      errors: [
        { line: 1, message: `Header must be exactly: ${HEADER.join(',')}` },
      ],
    };
  }
  records.slice(1).forEach((c, i) => {
    const line = i + 2;
    const [name, type, address, district, latS, lngS, phone, services, source] =
      c.map((v) => (v ?? '').trim());
    const lat = Number(latS);
    const lng = Number(lngS);
    const problems: string[] = [];
    if (!name) problems.push('name is required');
    if (!district) problems.push('district is required');
    if (!source) problems.push('source is required');
    if (!Number.isFinite(lat) || lat < -90 || lat > 90)
      problems.push('lat out of range');
    if (!Number.isFinite(lng) || lng < -180 || lng > 180)
      problems.push('lng out of range');
    if (problems.length)
      return errors.push({ line, message: problems.join('; ') });
    rows.push({
      name,
      type: type || 'Hospital',
      address,
      district,
      lat,
      lng,
      phone: phone || null,
      services: services
        ? services
            .split(';')
            .map((s) => s.trim())
            .filter(Boolean)
        : [],
      source,
    });
  });
  return { rows, errors };
}
