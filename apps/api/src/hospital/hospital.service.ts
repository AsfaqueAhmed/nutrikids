import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { HospitalRow } from './hospital-csv';

const R = 6371;
const rad = (d: number) => (d * Math.PI) / 180;

export function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.min(1, Math.sqrt(h))) * 1000) / 1000;
}

export function boundingBox(lat: number, lng: number, radiusKm: number) {
  const dLat = (radiusKm / R) * (180 / Math.PI);
  const dLng = dLat / Math.max(0.01, Math.cos(rad(lat)));
  return {
    minLat: lat - dLat,
    maxLat: lat + dLat,
    minLng: lng - dLng,
    maxLng: lng + dLng,
  };
}

@Injectable()
export class HospitalService {
  constructor(private readonly prisma: PrismaService) {}

  async nearby(q: {
    lat: number;
    lng: number;
    radiusKm: number;
    service?: string;
    limit: number;
  }) {
    const box = boundingBox(q.lat, q.lng, q.radiusKm);
    const rows = await this.prisma.hospital.findMany({
      where: {
        lat: { gte: box.minLat, lte: box.maxLat },
        lng: { gte: box.minLng, lte: box.maxLng },
        ...(q.service ? { services: { has: q.service } } : {}),
      },
    });
    return rows
      .map((h) => ({
        id: h.id,
        name: h.name,
        type: h.type,
        address: h.address,
        district: h.district,
        lat: h.lat,
        lng: h.lng,
        phone: h.phone,
        services: h.services,
        distanceKm: haversineKm(q, h),
      }))
      .filter((h) => h.distanceKm <= q.radiusKm)
      .sort((a, b) => a.distanceKm - b.distanceKm)
      .slice(0, q.limit);
  }

  async import(rows: HospitalRow[]) {
    let imported = 0;
    let updated = 0;
    for (const r of rows) {
      const where = { name_district: { name: r.name, district: r.district } };
      const exists = await this.prisma.hospital.findUnique({ where });
      await this.prisma.hospital.upsert({ where, create: r, update: r });
      if (exists) updated++;
      else imported++;
    }
    return { imported, updated };
  }
}
