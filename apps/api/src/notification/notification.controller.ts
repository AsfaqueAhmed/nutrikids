import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseEnumPipe,
  ParseUUIDPipe,
  Post,
  Put,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MealSlot, NotificationType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsOptional,
  IsString,
  Matches,
  ValidateNested,
} from 'class-validator';
import { type AuthUser, CurrentUser } from '../common/current-user';
import { Public } from '../common/public.decorator';
import { Env } from '../config/env';
import { NotificationService } from './notification.service';

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
class KeysDto {
  @IsString() p256dh!: string;
  @IsString() auth!: string;
}
class SubscribeDto {
  @IsString() endpoint!: string;
  @ValidateNested() @Type(() => KeysDto) keys!: KeysDto;
}
class UnsubscribeDto {
  @IsString() endpoint!: string;
}
class PreferenceDto {
  @IsBoolean() enabled!: boolean;
  @IsOptional() @Matches(HHMM) timeOfDay?: string;
}
class MealReminderDto {
  @Matches(HHMM) timeOfDay!: string;
  @IsBoolean() enabled!: boolean;
}

@Controller()
export class NotificationController {
  constructor(
    private readonly notifications: NotificationService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  @Public()
  @Get('notifications/vapid-public-key')
  key() {
    return {
      publicKey: this.config.get('VAPID_PUBLIC_KEY', { infer: true }) ?? null,
    };
  }

  @Post('notifications/subscriptions')
  @HttpCode(204)
  async subscribe(@CurrentUser() u: AuthUser, @Body() b: SubscribeDto) {
    await this.notifications.subscribe(
      u.id,
      b.endpoint,
      b.keys.p256dh,
      b.keys.auth,
    );
  }

  @Delete('notifications/subscriptions')
  @HttpCode(204)
  unsubscribe(@CurrentUser() u: AuthUser, @Body() b: UnsubscribeDto) {
    return this.notifications.unsubscribe(u.id, b.endpoint);
  }

  @Get('notifications/preferences') prefs(@CurrentUser() u: AuthUser) {
    return this.notifications.preferences(u.id);
  }

  @Put('notifications/preferences/:type') async setPref(
    @CurrentUser() u: AuthUser,
    @Param('type', new ParseEnumPipe(NotificationType)) type: NotificationType,
    @Body() b: PreferenceDto,
  ) {
    await this.notifications.setPreference(u.id, type, b.enabled, b.timeOfDay);
    return this.notifications.preferences(u.id);
  }

  @Get('children/:childId/meal-reminders') meal(
    @CurrentUser() u: AuthUser,
    @Param('childId', ParseUUIDPipe) c: string,
  ) {
    return this.notifications.mealReminders(u.id, c);
  }

  @Put('children/:childId/meal-reminders/:slot') setMeal(
    @CurrentUser() u: AuthUser,
    @Param('childId', ParseUUIDPipe) c: string,
    @Param('slot', new ParseEnumPipe(MealSlot)) slot: MealSlot,
    @Body() b: MealReminderDto,
  ) {
    return this.notifications.setMealReminder(
      u.id,
      c,
      slot,
      b.timeOfDay,
      b.enabled,
    );
  }
}
