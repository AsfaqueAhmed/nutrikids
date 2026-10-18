import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PaidType } from '@prisma/client';
import { ApiError } from '../common/api-error';
import { resolveLww } from '../common/lww';
import { ChildAccessService } from '../child/child-access.service';
import {
  CHILD_CREATED,
  CHILD_DOB_CHANGED,
  type ChildEvent,
} from '../child/child.events';
import { PrismaService } from '../prisma/prisma.service';
import { dueDateFor, vaccineStatus, type VaccineStatus } from './status';

const iso = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

@Injectable()
export class VaccinationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: ChildAccessService,
  ) {}

  /** Creates missing rows and re-dates doses that have not been given. */
  async syncSchedule(childId: string, dateOfBirth: Date) {
    const items = await this.prisma.vaccineScheduleItem.findMany();
    const existing = await this.prisma.childVaccination.findMany({
      where: { childId },
    });
    const byItem = new Map(existing.map((e) => [e.scheduleItemId, e]));
    for (const item of items) {
      const dueDate = dueDateFor(dateOfBirth, item.suggestedAgeDays);
      const row = byItem.get(item.id);
      if (!row) {
        // epoch: generated rows must lose to any client write under last-write-wins
        await this.prisma.childVaccination.create({
          data: {
            childId,
            scheduleItemId: item.id,
            dueDate,
            clientUpdatedAt: new Date(0),
          },
        });
      } else if (
        !row.givenDate &&
        row.dueDate.getTime() !== dueDate.getTime()
      ) {
        await this.prisma.childVaccination.update({
          where: { id: row.id },
          data: { dueDate },
        });
      }
    }
  }

  @OnEvent(CHILD_CREATED, { async: true })
  onCreated(e: ChildEvent) {
    return this.syncSchedule(e.childId, e.dateOfBirth);
  }

  @OnEvent(CHILD_DOB_CHANGED, { async: true })
  onDobChanged(e: ChildEvent) {
    return this.syncSchedule(e.childId, e.dateOfBirth);
  }

  catalogue() {
    return this.prisma.vaccine.findMany({
      include: { schedule: { orderBy: { doseNumber: 'asc' } } },
      orderBy: { name: 'asc' },
    });
  }

  private async rows(childId: string) {
    return this.prisma.childVaccination.findMany({
      where: { childId },
      include: { scheduleItem: { include: { vaccine: true } } },
      orderBy: { dueDate: 'asc' },
    });
  }

  private view(
    r: Awaited<ReturnType<VaccinationService['rows']>>[number],
    dob: Date,
  ) {
    const s = r.scheduleItem;
    const v = s.vaccine;
    return {
      id: r.id,
      vaccine: {
        code: v.code,
        name: v.name,
        disease: v.disease,
        description: v.description,
        availability: v.availability,
        isMandatory: v.isMandatory,
        priceMinBdt: v.priceMinBdt,
        priceMaxBdt: v.priceMaxBdt,
        priceNote: v.priceNote,
        priceUpdatedAt: v.priceUpdatedAt,
        verified: v.verified,
      },
      doseNumber: s.doseNumber,
      suggestedAgeDays: s.suggestedAgeDays,
      minAgeDays: s.minAgeDays,
      maxAgeDays: s.maxAgeDays,
      scheduleNotes: s.notes,
      dueDate: iso(r.dueDate),
      status: vaccineStatus({
        dateOfBirth: dob,
        givenDate: r.givenDate,
        minAgeDays: s.minAgeDays,
        maxAgeDays: s.maxAgeDays,
      }),
      givenDate: iso(r.givenDate),
      facilityName: r.facilityName,
      paidType: r.paidType,
      amountPaidBdt: r.amountPaidBdt,
      batchNo: r.batchNo,
      notes: r.notes,
      cardPhotoUrl: r.cardPhotoUrl,
    };
  }

  async list(userId: string, childId: string, status?: VaccineStatus) {
    const child = await this.access.assertOwned(userId, childId);
    const all = (await this.rows(childId)).map((r) =>
      this.view(r, child.dateOfBirth),
    );
    return status ? all.filter((r) => r.status === status) : all;
  }

  async summary(userId: string, childId: string) {
    const items = await this.list(userId, childId);
    const count = (...s: VaccineStatus[]) =>
      items.filter((i) => s.includes(i.status)).length;
    return {
      given: count('GIVEN', 'GIVEN_LATE'),
      due: count('DUE'),
      upcoming: count('UPCOMING'),
      overdue: count('OVERDUE'),
      total: items.length,
    };
  }

  async update(
    userId: string,
    childId: string,
    id: string,
    dto: {
      givenDate: string | null;
      facilityName?: string;
      paidType?: PaidType;
      amountPaidBdt?: number;
      batchNo?: string;
      notes?: string;
      cardPhotoUrl?: string;
      clientUpdatedAt: string;
    },
  ) {
    const child = await this.access.assertOwned(userId, childId);
    const existing = await this.prisma.childVaccination.findFirst({
      where: { id, childId },
    });
    if (!existing)
      throw new ApiError(404, 'NOT_FOUND', 'Vaccination not found');
    const { apply, superseded } = resolveLww(
      existing,
      new Date(dto.clientUpdatedAt),
    );
    if (apply) {
      if (dto.givenDate && new Date(dto.givenDate) < child.dateOfBirth)
        throw new ApiError(
          400,
          'DATE_BEFORE_BIRTH',
          'Given date is before the date of birth',
        );
      if (
        dto.givenDate &&
        new Date(dto.givenDate).getTime() > Date.now() + 86_400_000
      )
        throw new ApiError(
          400,
          'DATE_IN_FUTURE',
          'Given date is in the future',
        );
      const given = dto.givenDate ? new Date(dto.givenDate) : null;
      await this.prisma.childVaccination.update({
        where: { id },
        data: {
          givenDate: given,
          facilityName: given ? (dto.facilityName ?? null) : null,
          paidType: given ? (dto.paidType ?? null) : null,
          amountPaidBdt: given ? (dto.amountPaidBdt ?? null) : null,
          batchNo: given ? (dto.batchNo ?? null) : null,
          notes: dto.notes ?? null,
          cardPhotoUrl: given ? (dto.cardPhotoUrl ?? null) : null,
          clientUpdatedAt: new Date(dto.clientUpdatedAt),
        },
      });
    }
    const [row] = (await this.rows(childId)).filter((r) => r.id === id);
    return { data: this.view(row, child.dateOfBirth), sync: { superseded } };
  }
}
