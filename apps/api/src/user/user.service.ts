import { Injectable } from '@nestjs/common';
import { ApiError } from '../common/api-error';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  async me(id: string) {
    const u = await this.prisma.user.findUniqueOrThrow({ where: { id } });
    return {
      id: u.id,
      email: u.email,
      role: u.role,
      emailVerified: !!u.emailVerifiedAt,
      timezone: u.timezone,
    };
  }

  async setTimezone(id: string, timezone: string) {
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: timezone });
    } catch {
      throw new ApiError(400, 'INVALID_TIMEZONE', 'Unknown timezone');
    }
    await this.prisma.user.update({ where: { id }, data: { timezone } });
    return this.me(id);
  }

  async export(id: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id },
      select: {
        id: true,
        email: true,
        role: true,
        timezone: true,
        createdAt: true,
        children: {
          include: {
            allergies: true,
            conditions: true,
            dislikes: true,
            feedingLogs: true,
            introductions: true,
            growthRecords: true,
            mealPlanEntries: true,
            groceryChecks: true,
            vaccinations: true,
            mealReminders: true,
          },
        },
        notificationPreferences: true,
      },
    });
    return { exportedAt: new Date().toISOString(), user };
  }

  async remove(id: string) {
    await this.prisma.user.delete({ where: { id } });
  }
}
