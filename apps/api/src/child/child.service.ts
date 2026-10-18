import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Allergen, Child, Severity } from '@prisma/client';
import { ageInMonths } from '../common/age';
import { ApiError } from '../common/api-error';
import { resolveLww } from '../common/lww';
import { PrismaService } from '../prisma/prisma.service';
import { ChildAccessService } from './child-access.service';
import { CHILD_CREATED, CHILD_DOB_CHANGED, ChildEvent } from './child.events';
import {
  CreateChildDto,
  FeedingLogDto,
  FeedingQuery,
  FoodIntroductionDto,
  UpdateChildDto,
} from './dto';

const include = { allergies: true, conditions: true, dislikes: true } as const;
const isoDate = (d: Date) => d.toISOString().slice(0, 10);

@Injectable()
export class ChildService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: ChildAccessService,
    private readonly events: EventEmitter2,
  ) {}

  private view(
    c: Child & {
      allergies: { allergen: Allergen; severity: Severity }[];
      conditions: { name: string }[];
      dislikes: { foodId: string }[];
    },
  ) {
    return {
      id: c.id,
      name: c.name,
      dateOfBirth: isoDate(c.dateOfBirth),
      ageMonths: ageInMonths(c.dateOfBirth),
      gender: c.gender,
      heightCm: c.heightCm ? Number(c.heightCm) : null,
      weightKg: c.weightKg ? Number(c.weightKg) : null,
      activityLevel: c.activityLevel,
      dietType: c.dietType,
      photoUrl: c.photoUrl,
      allergies: c.allergies.map((a) => ({
        allergen: a.allergen,
        severity: a.severity,
      })),
      conditions: c.conditions.map((x) => x.name),
      dislikes: c.dislikes.map((d) => d.foodId),
    };
  }

  async list(userId: string) {
    const rows = await this.prisma.child.findMany({
      where: { userId },
      include,
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((r) => this.view(r));
  }

  async get(userId: string, id: string) {
    await this.access.assertOwned(userId, id);
    return this.view(
      await this.prisma.child.findUniqueOrThrow({ where: { id }, include }),
    );
  }

  async create(userId: string, dto: CreateChildDto) {
    const child = await this.prisma.child.create({
      data: { ...dto, userId, dateOfBirth: new Date(dto.dateOfBirth) },
      include,
    });
    await this.events.emitAsync(CHILD_CREATED, {
      childId: child.id,
      dateOfBirth: child.dateOfBirth,
    } satisfies ChildEvent);
    return this.view(child);
  }

  async update(userId: string, id: string, dto: UpdateChildDto) {
    const before = await this.access.assertOwned(userId, id);
    const child = await this.prisma.child.update({
      where: { id },
      data: {
        ...dto,
        ...(dto.dateOfBirth ? { dateOfBirth: new Date(dto.dateOfBirth) } : {}),
      },
      include,
    });
    if (
      dto.dateOfBirth &&
      isoDate(before.dateOfBirth) !== dto.dateOfBirth.slice(0, 10)
    ) {
      await this.events.emitAsync(CHILD_DOB_CHANGED, {
        childId: id,
        dateOfBirth: child.dateOfBirth,
      } satisfies ChildEvent);
    }
    return this.view(child);
  }

  async remove(userId: string, id: string) {
    await this.access.assertOwned(userId, id);
    await this.prisma.child.delete({ where: { id } });
  }

  async setAllergies(
    userId: string,
    id: string,
    items: { allergen: Allergen; severity: Severity }[],
  ) {
    await this.access.assertOwned(userId, id);
    const unique = [...new Map(items.map((i) => [i.allergen, i])).values()];
    await this.prisma.$transaction([
      this.prisma.childAllergy.deleteMany({ where: { childId: id } }),
      this.prisma.childAllergy.createMany({
        data: unique.map((i) => ({ childId: id, ...i })),
      }),
    ]);
    return this.get(userId, id);
  }

  async setConditions(userId: string, id: string, names: string[]) {
    await this.access.assertOwned(userId, id);
    const unique = [...new Set(names.map((n) => n.trim()).filter(Boolean))];
    await this.prisma.$transaction([
      this.prisma.childCondition.deleteMany({ where: { childId: id } }),
      this.prisma.childCondition.createMany({
        data: unique.map((name) => ({ childId: id, name })),
      }),
    ]);
    return this.get(userId, id);
  }

  async setDislikes(userId: string, id: string, foodIds: string[]) {
    await this.access.assertOwned(userId, id);
    const unique = [...new Set(foodIds)];
    const found = await this.prisma.food.count({
      where: { id: { in: unique } },
    });
    if (found !== unique.length)
      throw new ApiError(400, 'UNKNOWN_FOOD', 'One or more foods do not exist');
    await this.prisma.$transaction([
      this.prisma.foodDislike.deleteMany({ where: { childId: id } }),
      this.prisma.foodDislike.createMany({
        data: unique.map((foodId) => ({ childId: id, foodId })),
      }),
    ]);
    return this.get(userId, id);
  }

  // ---- feeding logs (sync) ----
  async upsertFeedingLog(
    userId: string,
    childId: string,
    logId: string,
    dto: FeedingLogDto,
  ) {
    await this.access.assertOwned(userId, childId);
    const existing = await this.prisma.feedingLog.findUnique({
      where: { id: logId },
    });
    if (existing && existing.childId !== childId)
      throw new ApiError(409, 'ID_IN_USE', 'This id belongs to another record');
    const { apply, superseded } = resolveLww(
      existing,
      new Date(dto.clientUpdatedAt),
    );
    const data = {
      type: dto.type,
      at: new Date(dto.at),
      durationMinutes: dto.durationMinutes ?? null,
      notes: dto.notes ?? null,
      clientUpdatedAt: new Date(dto.clientUpdatedAt),
    };
    const row = apply
      ? await this.prisma.feedingLog.upsert({
          where: { id: logId },
          create: { id: logId, childId, ...data },
          update: data,
        })
      : existing!;
    return { data: row, sync: { superseded } };
  }

  async listFeedingLogs(userId: string, childId: string, q: FeedingQuery) {
    await this.access.assertOwned(userId, childId);
    return this.prisma.feedingLog.findMany({
      where: {
        childId,
        ...(q.from || q.to
          ? {
              at: {
                ...(q.from ? { gte: new Date(q.from) } : {}),
                ...(q.to ? { lte: new Date(q.to) } : {}),
              },
            }
          : {}),
        ...(q.updatedSince
          ? { updatedAt: { gt: new Date(q.updatedSince) } }
          : {}),
      },
      orderBy: { at: 'desc' },
    });
  }

  async deleteFeedingLog(userId: string, childId: string, logId: string) {
    await this.access.assertOwned(userId, childId);
    await this.prisma.feedingLog.deleteMany({ where: { id: logId, childId } });
  }

  // ---- food introductions (sync) ----
  async upsertIntroduction(
    userId: string,
    childId: string,
    introId: string,
    dto: FoodIntroductionDto,
  ) {
    await this.access.assertOwned(userId, childId);
    const existing = await this.prisma.foodIntroduction.findUnique({
      where: { id: introId },
    });
    const { apply, superseded } = resolveLww(
      existing,
      new Date(dto.clientUpdatedAt),
    );
    const data = {
      foodId: dto.foodId,
      introducedOn: new Date(dto.introducedOn),
      reaction: dto.reaction ?? null,
      notes: dto.notes ?? null,
      clientUpdatedAt: new Date(dto.clientUpdatedAt),
    };
    const row = apply
      ? await this.prisma.foodIntroduction.upsert({
          where: { id: introId },
          create: { id: introId, childId, ...data },
          update: data,
        })
      : existing!;
    return { data: row, sync: { superseded } };
  }

  async listIntroductions(userId: string, childId: string) {
    await this.access.assertOwned(userId, childId);
    return this.prisma.foodIntroduction.findMany({
      where: { childId },
      orderBy: { introducedOn: 'desc' },
    });
  }
}
