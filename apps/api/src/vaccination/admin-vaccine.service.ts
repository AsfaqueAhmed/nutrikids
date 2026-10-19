import { Injectable } from '@nestjs/common';
import { Prisma, VaccineAvailability } from '@prisma/client';
import { ApiError, notFound } from '../common/api-error';
import { PrismaService } from '../prisma/prisma.service';

export type VaccinePatch = {
  name?: string;
  disease?: string;
  description?: string;
  availability?: VaccineAvailability;
  isMandatory?: boolean;
  priceMinBdt?: number | null;
  priceMaxBdt?: number | null;
  priceNote?: string | null;
  sourceNote?: string;
  verified?: boolean;
};
export type ItemPatch = {
  suggestedAgeDays?: number;
  minAgeDays?: number;
  maxAgeDays?: number | null;
  intervalFromPreviousDays?: number | null;
  notes?: string | null;
};

const include = {
  schedule: { orderBy: { doseNumber: 'asc' } },
} satisfies Prisma.VaccineInclude;

@Injectable()
export class AdminVaccineService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.vaccine.findMany({ orderBy: { code: 'asc' }, include });
  }

  async updateVaccine(id: string, dto: VaccinePatch) {
    const v = await this.prisma.vaccine.findUnique({ where: { id } });
    if (!v) throw notFound('Vaccine');
    const min = dto.priceMinBdt === undefined ? v.priceMinBdt : dto.priceMinBdt;
    const max = dto.priceMaxBdt === undefined ? v.priceMaxBdt : dto.priceMaxBdt;
    if (min != null && max != null && min > max)
      throw new ApiError(
        400,
        'INVALID_PRICE_RANGE',
        'The minimum price must not exceed the maximum price',
      );
    const touchedPrice =
      dto.priceMinBdt !== undefined || dto.priceMaxBdt !== undefined;
    return this.prisma.vaccine.update({
      where: { id },
      data: { ...dto, ...(touchedPrice ? { priceUpdatedAt: new Date() } : {}) },
      include,
    });
  }

  async updateItem(id: string, dto: ItemPatch) {
    const item = await this.prisma.vaccineScheduleItem.findUnique({
      where: { id },
    });
    if (!item) throw notFound('Schedule item');
    const suggested = dto.suggestedAgeDays ?? item.suggestedAgeDays;
    const min = dto.minAgeDays ?? item.minAgeDays;
    const max = dto.maxAgeDays === undefined ? item.maxAgeDays : dto.maxAgeDays;
    if (min > suggested || (max != null && max < suggested))
      throw new ApiError(
        400,
        'INVALID_AGE_WINDOW',
        'Ages must satisfy min <= suggested <= max',
      );
    return this.prisma.vaccineScheduleItem.update({ where: { id }, data: dto });
  }
}
