import { Injectable } from '@nestjs/common';
import { EatenStatus, MealSlot, NutritionLog } from '@prisma/client';
import { ApiError, conflict } from '../common/api-error';
import { resolveLww } from '../common/lww';
import { ChildAccessService } from '../child/child-access.service';
import { PrismaService } from '../prisma/prisma.service';
import { summarize } from './nutrition-log.summary';

const iso = (d: Date) => d.toISOString().slice(0, 10);
const day = (s: string) => new Date(`${s}T00:00:00Z`);
const MAX_SPAN_DAYS = 92;

export type UpsertLogInput = {
  date: string;
  slot: MealSlot;
  eatenStatus: EatenStatus;
  percent?: number;
  notes?: string;
  clientUpdatedAt: string;
};

@Injectable()
export class NutritionLogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: ChildAccessService,
  ) {}

  private view(l: NutritionLog) {
    return {
      id: l.id,
      date: iso(l.date),
      slot: l.slot,
      eatenStatus: l.eatenStatus,
      percent: l.percent,
      notes: l.notes,
      clientUpdatedAt: l.clientUpdatedAt,
    };
  }

  private checkRange(from: string, to: string) {
    const span = (day(to).getTime() - day(from).getTime()) / 86_400_000;
    if (span < 0 || span > MAX_SPAN_DAYS)
      throw new ApiError(
        400,
        'RANGE_TOO_LARGE',
        `Choose a range of at most ${MAX_SPAN_DAYS} days`,
      );
  }

  async upsert(
    userId: string,
    childId: string,
    logId: string,
    dto: UpsertLogInput,
  ) {
    const child = await this.access.assertOwned(userId, childId);
    const needsPercent = dto.eatenStatus === 'PARTIAL';
    if (needsPercent !== (dto.percent !== undefined))
      throw new ApiError(
        400,
        'INVALID_PERCENT',
        'Give a percent (1-99) only when the meal was partly eaten',
      );
    if (day(dto.date) < child.dateOfBirth)
      throw new ApiError(
        400,
        'DATE_BEFORE_BIRTH',
        'Log date is before the date of birth',
      );
    const existing = await this.prisma.nutritionLog.findUnique({
      where: { id: logId },
    });
    if (existing && existing.childId !== childId)
      throw new ApiError(409, 'ID_IN_USE', 'This id belongs to another log');
    const holder = await this.prisma.nutritionLog.findUnique({
      where: {
        childId_date_slot: {
          childId,
          date: day(dto.date),
          slot: dto.slot,
        },
      },
    });
    if (holder && holder.id !== logId)
      throw conflict(
        'LOG_EXISTS',
        'This meal slot already has a log',
        { id: holder.id },
      );
    const { apply, superseded } = resolveLww(
      existing,
      new Date(dto.clientUpdatedAt),
    );
    const data = {
      date: day(dto.date),
      slot: dto.slot,
      eatenStatus: dto.eatenStatus,
      percent: dto.percent ?? null,
      notes: dto.notes ?? null,
      clientUpdatedAt: new Date(dto.clientUpdatedAt),
    };
    const row = apply
      ? await this.prisma.nutritionLog.upsert({
          where: { id: logId },
          create: { id: logId, childId, ...data },
          update: data,
        })
      : existing!;
    return { data: this.view(row), sync: { superseded } };
  }

  async list(
    userId: string,
    childId: string,
    q: { from?: string; to?: string; updatedSince?: string },
  ) {
    await this.access.assertOwned(userId, childId);
    if (q.from && q.to) this.checkRange(q.from, q.to);
    const rows = await this.prisma.nutritionLog.findMany({
      where: {
        childId,
        ...(q.from ? { date: { gte: day(q.from), ...(q.to ? { lte: day(q.to) } : {}) } } : {}),
        ...(q.updatedSince ? { updatedAt: { gt: new Date(q.updatedSince) } } : {}),
      },
      orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
    });
    return rows.map((r) => this.view(r));
  }

  async remove(userId: string, childId: string, logId: string) {
    await this.access.assertOwned(userId, childId);
    await this.prisma.nutritionLog.deleteMany({ where: { id: logId, childId } });
  }

  async summary(userId: string, childId: string, from: string, to: string) {
    await this.access.assertOwned(userId, childId);
    this.checkRange(from, to);
    const range = { gte: day(from), lte: day(to) };
    const [logs, plannedCount] = await Promise.all([
      this.prisma.nutritionLog.findMany({ where: { childId, date: range } }),
      this.prisma.mealPlanEntry.count({ where: { childId, date: range } }),
    ]);
    return { from, to, ...summarize(logs, plannedCount) };
  }
}
