import { Module } from '@nestjs/common';
import { ChildModule } from '../child/child.module';
import { NotificationController } from './notification.controller';
import { NotificationService } from './notification.service';
import { PushSender, WebPushSender } from './push-sender';
import { ReminderJob } from './reminder.job';

@Module({
  imports: [ChildModule],
  controllers: [NotificationController],
  providers: [
    NotificationService,
    ReminderJob,
    { provide: PushSender, useClass: WebPushSender },
  ],
  exports: [NotificationService],
})
export class NotificationModule {}
