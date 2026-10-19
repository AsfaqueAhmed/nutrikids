import { Injectable } from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { ApiError, notFound } from '../common/api-error';
import { TokenService } from '../auth/token.service';
import { PrismaService } from '../prisma/prisma.service';

const iso = (d: Date) => d.toISOString().slice(0, 10);

type UserRow = Prisma.UserGetPayload<{
  include: { _count: { select: { children: true } } };
}>;
const view = (u: UserRow) => ({
  id: u.id,
  email: u.email,
  role: u.role,
  disabled: !!u.disabledAt,
  emailVerified: !!u.emailVerifiedAt,
  childCount: u._count.children,
  createdAt: u.createdAt,
});

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
  ) {}

  async stats() {
    const since = new Date();
    since.setUTCHours(0, 0, 0, 0);
    since.setUTCDate(since.getUTCDate() - 29);
    const [
      totalUsers,
      verifiedUsers,
      disabledUsers,
      totalChildren,
      mealEntriesGenerated,
      vaccinationsGiven,
      signups,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { emailVerifiedAt: { not: null } } }),
      this.prisma.user.count({ where: { disabledAt: { not: null } } }),
      this.prisma.child.count(),
      this.prisma.mealPlanEntry.count({ where: { createdBy: 'SYSTEM' } }),
      this.prisma.childVaccination.count({
        where: { givenDate: { not: null } },
      }),
      this.prisma.$queryRaw<{ d: Date; c: bigint }[]>`
        SELECT date_trunc('day', "createdAt" AT TIME ZONE 'UTC')::date AS d, COUNT(*) AS c
        FROM "User" WHERE "createdAt" >= ${since} GROUP BY 1`,
    ]);
    const byDay = new Map(signups.map((r) => [iso(r.d), Number(r.c)]));
    const signupsByDay = Array.from({ length: 30 }, (_, i) => {
      const d = new Date(since);
      d.setUTCDate(since.getUTCDate() + i);
      return { date: iso(d), count: byDay.get(iso(d)) ?? 0 };
    });
    return {
      totalUsers,
      verifiedUsers,
      disabledUsers,
      totalChildren,
      mealEntriesGenerated,
      vaccinationsGiven,
      signupsByDay,
    };
  }

  async listUsers(q: {
    q?: string;
    role?: Role;
    disabled?: boolean;
    page: number;
    limit: number;
  }) {
    const where: Prisma.UserWhereInput = {
      ...(q.q ? { email: { contains: q.q, mode: 'insensitive' } } : {}),
      ...(q.role ? { role: q.role } : {}),
      ...(q.disabled === undefined
        ? {}
        : { disabledAt: q.disabled ? { not: null } : null }),
    };
    const [rows, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: 'asc' },
        skip: (q.page - 1) * q.limit,
        take: q.limit,
        include: { _count: { select: { children: true } } },
      }),
      this.prisma.user.count({ where }),
    ]);
    return { items: rows.map(view), total, page: q.page, limit: q.limit };
  }

  async updateUser(
    actorId: string,
    id: string,
    dto: { disabled?: boolean; role?: Role },
  ) {
    if (id === actorId)
      throw new ApiError(
        400,
        'CANNOT_MODIFY_SELF',
        'You cannot change your own role or status',
      );
    const existing = await this.prisma.user.findUnique({ where: { id } });
    if (!existing) throw notFound('User');
    const row = await this.prisma.user.update({
      where: { id },
      data: {
        ...(dto.role ? { role: dto.role } : {}),
        ...(dto.disabled === undefined
          ? {}
          : { disabledAt: dto.disabled ? new Date() : null }),
      },
      include: { _count: { select: { children: true } } },
    });
    if (dto.disabled) await this.tokens.revokeAllFor(id);
    return view(row);
  }
}
