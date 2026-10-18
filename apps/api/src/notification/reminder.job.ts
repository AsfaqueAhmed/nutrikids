import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { NotificationService } from './notification.service';

@Injectable()
export class ReminderJob {
  constructor(private readonly notifications: NotificationService) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async tick() {
    const now = new Date();
    await this.notifications.runMealReminders(now);
    await this.notifications.runVaccineReminders(now);
  }
}
