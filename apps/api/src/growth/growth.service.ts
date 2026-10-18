import { Injectable } from '@nestjs/common';
import { Child, Gender, GrowthRecord } from '@prisma/client';
import { readFileSync } from 'fs';
import { ageInMonths } from '../common/age';
import { dataPath } from '../common/data-dir';
import { ApiError } from '../common/api-error';
import { resolveLww } from '../common/lww';
import { ChildAccessService } from '../child/child-access.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  bmiStatus,
  Indicator,
  lmsAt,
  LmsRow,
  percentileFromZ,
  valueAtZ,
  WhoTables,
  zScore,
} from './who-lms';

export type Measure = { value: number; z: number; percentile: number };
const IND: Indicator[] = ['WFA', 'HFA', 'BFA', 'HCFA'];
const Z_LINES = {
  p3: -1.88079,
  p15: -1.03643,
  p50: 0,
  p85: 1.03643,
  p97: 1.88079,
};
const iso = (d: Date) => d.toISOString().slice(0, 10);

function loadTables(): WhoTables {
  const dir = dataPath('who');
  const t: Record<string, LmsRow[]> = {};
  for (const i of IND)
    for (const g of ['MALE', 'FEMALE'])
      t[`${i}_${g}`] = JSON.parse(
        readFileSync(`${dir}/${i}_${g}.json`, 'utf8'),
      ) as LmsRow[];
  return new WhoTables(t);
}

@Injectable()
export class GrowthService {
  private readonly who = loadTables();
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: ChildAccessService,
  ) {}

  private measure(
    ind: Indicator,
    gender: Gender,
    ageMonths: number,
    value: number,
  ): Measure {
    const z = zScore(value, lmsAt(this.who.table(ind, gender), ageMonths));
    return {
      value,
      z: Math.round(z * 100) / 100,
      percentile: percentileFromZ(z),
    };
  }

  measures(
    child: Pick<Child, 'dateOfBirth' | 'gender'>,
    r: Pick<
      GrowthRecord,
      'date' | 'heightCm' | 'weightKg' | 'headCircumferenceCm'
    >,
  ) {
    const age = ageInMonths(child.dateOfBirth, r.date);
    const out: {
      weight?: Measure;
      height?: Measure;
      bmi?: Measure;
      head?: Measure;
      bmiStatus?: string;
    } = {};
    const w = r.weightKg ? Number(r.weightKg) : undefined;
    const h = r.heightCm ? Number(r.heightCm) : undefined;
    const hc = r.headCircumferenceCm
      ? Number(r.headCircumferenceCm)
      : undefined;
    if (w !== undefined) out.weight = this.measure('WFA', child.gender, age, w);
    if (h !== undefined) out.height = this.measure('HFA', child.gender, age, h);
    if (w !== undefined && h !== undefined) {
      const bmi = w / Math.pow(h / 100, 2);
      out.bmi = this.measure(
        'BFA',
        child.gender,
        age,
        Math.round(bmi * 10) / 10,
      );
      out.bmiStatus = bmiStatus(out.bmi.z);
    }
    if (hc !== undefined && age <= 60)
      out.head = this.measure('HCFA', child.gender, age, hc);
    return out;
  }

  async upsert(
    userId: string,
    childId: string,
    recId: string,
    dto: {
      date: string;
      heightCm?: number;
      weightKg?: number;
      headCircumferenceCm?: number;
      clientUpdatedAt: string;
    },
  ) {
    const child = await this.access.assertOwned(userId, childId);
    if (
      dto.heightCm === undefined &&
      dto.weightKg === undefined &&
      dto.headCircumferenceCm === undefined
    ) {
      throw new ApiError(
        400,
        'EMPTY_RECORD',
        'Provide at least one measurement',
      );
    }
    if (new Date(dto.date) < child.dateOfBirth)
      throw new ApiError(
        400,
        'DATE_BEFORE_BIRTH',
        'Measurement date is before the date of birth',
      );
    const existing = await this.prisma.growthRecord.findUnique({
      where: { id: recId },
    });
    if (existing && existing.childId !== childId)
      throw new ApiError(409, 'ID_IN_USE', 'This id belongs to another record');
    const { apply, superseded } = resolveLww(
      existing,
      new Date(dto.clientUpdatedAt),
    );
    const data = {
      date: new Date(dto.date),
      heightCm: dto.heightCm ?? null,
      weightKg: dto.weightKg ?? null,
      headCircumferenceCm: dto.headCircumferenceCm ?? null,
      clientUpdatedAt: new Date(dto.clientUpdatedAt),
    };
    const row = apply
      ? await this.prisma.growthRecord.upsert({
          where: { id: recId },
          create: { id: recId, childId, ...data },
          update: data,
        })
      : existing!;
    return {
      data: this.view(row),
      sync: { superseded },
      measures: this.measures(child, row),
      provisional: true,
    };
  }

  private view(r: GrowthRecord) {
    return {
      id: r.id,
      date: iso(r.date),
      heightCm: r.heightCm ? Number(r.heightCm) : null,
      weightKg: r.weightKg ? Number(r.weightKg) : null,
      headCircumferenceCm: r.headCircumferenceCm
        ? Number(r.headCircumferenceCm)
        : null,
      clientUpdatedAt: r.clientUpdatedAt,
    };
  }

  async list(userId: string, childId: string, updatedSince?: string) {
    await this.access.assertOwned(userId, childId);
    const rows = await this.prisma.growthRecord.findMany({
      where: {
        childId,
        ...(updatedSince ? { updatedAt: { gt: new Date(updatedSince) } } : {}),
      },
      orderBy: { date: 'asc' },
    });
    return rows.map((r) => this.view(r));
  }

  async remove(userId: string, childId: string, recId: string) {
    await this.access.assertOwned(userId, childId);
    await this.prisma.growthRecord.deleteMany({
      where: { id: recId, childId },
    });
  }

  async chart(userId: string, childId: string) {
    const child = await this.access.assertOwned(userId, childId);
    const rows = await this.prisma.growthRecord.findMany({
      where: { childId },
      orderBy: { date: 'asc' },
    });
    const points = rows.map((r) => ({
      ...this.view(r),
      ageMonths: ageInMonths(child.dateOfBirth, r.date),
      measures: this.measures(child, r),
    }));
    const maxAge = Math.min(
      Math.max(ageInMonths(child.dateOfBirth) + 6, 24),
      228,
    );
    const reference: Record<
      string,
      Record<string, { ageMonths: number; value: number }[]>
    > = {};
    for (const ind of IND) {
      const table = this.who
        .table(ind, child.gender)
        .filter((r) => r.ageMonths <= maxAge);
      reference[ind] = Object.fromEntries(
        Object.entries(Z_LINES).map(([name, z]) => [
          name,
          table.map((r) => ({
            ageMonths: r.ageMonths,
            value: Math.round(valueAtZ(z, r) * 100) / 100,
          })),
        ]),
      );
    }
    return { provisional: true, points, reference };
  }

  async summary(userId: string, childId: string) {
    const child = await this.access.assertOwned(userId, childId);
    const rows = await this.prisma.growthRecord.findMany({
      where: { childId },
      orderBy: { date: 'asc' },
    });
    return {
      child,
      rows,
      latest: rows.length
        ? {
            record: this.view(rows[rows.length - 1]),
            measures: this.measures(child, rows[rows.length - 1]),
          }
        : null,
    };
  }
}
