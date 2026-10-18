import { Injectable } from '@nestjs/common';
import { MealSlot, NotificationType } from '@prisma/client';
import { ChildAccessService } from '../child/child-access.service';
import { evaluateAllergens } from '../meal/allergy';
import { PrismaService } from '../prisma/prisma.service';
import { vaccineStatus } from '../vaccination/status';
import { isDueNow, localTimeParts } from './due';
import { PushSender } from './push-sender';

const SLOT_LABEL: Record<MealSlot, string> = {
  BREAKFAST: 'Breakfast',
  LUNCH: 'Lunch',
  MORNING_SNACK: 'Morning snack',
  AFTERNOON_SNACK: 'Afternoon snack',
  DINNER: 'Dinner',
};
const DEFAULT_VACCINE_TIME = '09:00';

@Injectable()
export class NotificationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: ChildAccessService,
    private readonly sender: PushSender,
  ) {}

  // ---- subscriptions & preferences ----
  subscribe(userId: string, endpoint: string, p256dh: string, auth: string) {
    return this.prisma.pushSubscription.upsert({
      where: { endpoint },
      create: { userId, endpoint, p256dh, auth },
      update: { userId, p256dh, auth },
    });
  }
  async unsubscribe(userId: string, endpoint: string) {
    await this.prisma.pushSubscription.deleteMany({
      where: { userId, endpoint },
    });
  }
  async preferences(userId: string) {
    const rows = await this.prisma.notificationPreference.findMany({
      where: { userId },
    });
    const types = Object.values(NotificationType);
    return types.map((type) => {
      const r = rows.find((x) => x.type === type);
      return {
        type,
        enabled: r?.enabled ?? true,
        timeOfDay:
          r?.timeOfDay ??
          (type === 'VACCINE_REMINDER' ? DEFAULT_VACCINE_TIME : null),
      };
    });
  }
  setPreference(
    userId: string,
    type: NotificationType,
    enabled: boolean,
    timeOfDay?: string,
  ) {
    return this.prisma.notificationPreference.upsert({
      where: { userId_type: { userId, type } },
      create: { userId, type, enabled, timeOfDay },
      update: { enabled, ...(timeOfDay ? { timeOfDay } : {}) },
    });
  }

  // ---- meal reminders ----
  async mealReminders(userId: string, childId: string) {
    await this.access.assertOwned(userId, childId);
    return this.prisma.mealReminder.findMany({
      where: { childId },
      orderBy: { slot: 'asc' },
    });
  }
  async setMealReminder(
    userId: string,
    childId: string,
    slot: MealSlot,
    timeOfDay: string,
    enabled: boolean,
  ) {
    await this.access.assertOwned(userId, childId);
    return this.prisma.mealReminder.upsert({
      where: { childId_slot: { childId, slot } },
      create: { childId, slot, timeOfDay, enabled },
      update: { timeOfDay, enabled },
    });
  }

  private async pushToUser(
    userId: string,
    payload: { title: string; body: string; url?: string; tag?: string },
  ) {
    const subs = await this.prisma.pushSubscription.findMany({
      where: { userId },
    });
    let sent = 0;
    for (const s of subs) {
      const r = await this.sender.send(s, payload);
      if (r === 'GONE')
        await this.prisma.pushSubscription.delete({ where: { id: s.id } });
      else sent++;
    }
    return sent;
  }

  private async enabledFor(userId: string, type: NotificationType) {
    const pref = await this.prisma.notificationPreference.findUnique({
      where: { userId_type: { userId, type } },
    });
    return pref?.enabled ?? true;
  }

  async runMealReminders(now: Date): Promise<number> {
    const reminders = await this.prisma.mealReminder.findMany({
      where: { enabled: true },
      include: { child: { include: { user: true, allergies: true } } },
    });
    let count = 0;
    for (const r of reminders) {
      const tz = r.child.user.timezone;
      if (!isDueNow(now, tz, r.timeOfDay)) continue;
      if (!(await this.enabledFor(r.child.userId, 'DAILY_PLAN'))) continue;
      const { date } = localTimeParts(now, tz);
      const entry = await this.prisma.mealPlanEntry.findFirst({
        where: {
          childId: r.childId,
          date: new Date(`${date}T00:00:00Z`),
          slot: r.slot,
        },
        include: {
          recipe: { include: { foods: { include: { food: true } } } },
        },
      });
      if (!entry) continue;
      const verdict = evaluateAllergens(
        r.child.allergies,
        entry.recipe.foods.map((f) => ({
          id: f.foodId,
          name: f.food.name,
          allergens: f.food.allergens,
        })),
      );
      const warn =
        verdict.status === 'OK'
          ? ''
          : ` Contains ${[...new Set(verdict.matches.map((m) => m.allergen.toLowerCase()))].join(', ')}.`;
      count += await this.pushToUser(r.child.userId, {
        title: `${SLOT_LABEL[r.slot]} for ${r.child.name}`,
        body: `${entry.recipe.name}.${warn}`,
        url: `/children/${r.childId}/meals`,
        tag: `meal-${r.childId}-${r.slot}`,
      });
    }
    return count;
  }

  async runVaccineReminders(now: Date): Promise<number> {
    const users = await this.prisma.user.findMany({
      where: { children: { some: {} }, pushSubscriptions: { some: {} } },
    });
    let count = 0;
    for (const u of users) {
      const prefs = await this.prisma.notificationPreference.findUnique({
        where: { userId_type: { userId: u.id, type: 'VACCINE_REMINDER' } },
      });
      if (prefs && !prefs.enabled) continue;
      if (!isDueNow(now, u.timezone, prefs?.timeOfDay ?? DEFAULT_VACCINE_TIME))
        continue;
      const rows = await this.prisma.childVaccination.findMany({
        where: { child: { userId: u.id }, givenDate: null },
        include: { child: true, scheduleItem: { include: { vaccine: true } } },
      });
      const soon = now.getTime() + 3 * 86_400_000;
      for (const v of rows) {
        const status = vaccineStatus({
          dateOfBirth: v.child.dateOfBirth,
          givenDate: null,
          minAgeDays: v.scheduleItem.minAgeDays,
          maxAgeDays: v.scheduleItem.maxAgeDays,
          now,
        });
        const dueSoon = v.dueDate.getTime() <= soon;
        if (!(
          status === 'DUE' ||
          status === 'OVERDUE' ||
          (status === 'UPCOMING' && dueSoon)
        ))
          continue;
        const free =
          v.scheduleItem.vaccine.availability === 'GOVERNMENT_FREE'
            ? ' (free, government programme)'
            : '';
        count += await this.pushToUser(u.id, {
          title: `Vaccine reminder for ${v.child.name}`,
          body: `${v.scheduleItem.vaccine.name} dose ${v.scheduleItem.doseNumber} is ${status === 'OVERDUE' ? 'overdue' : 'due'}${free}.`,
          url: `/children/${v.childId}/vaccinations`,
          tag: `vaccine-${v.id}`,
        });
      }
    }
    return count;
  }
}
