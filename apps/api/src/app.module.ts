import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { loadEnv } from './config/env';
import { AuthModule } from './auth/auth.module';
import { PrismaModule } from './prisma/prisma.module';
import { UserModule } from './user/user.module';
import { FoodModule } from './food/food.module';
import { ChildModule } from './child/child.module';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { MealModule } from './meal/meal.module';
import { GrowthModule } from './growth/growth.module';
import { NutritionModule } from './nutrition/nutrition.module';
import { NutritionLogModule } from './nutrition-log/nutrition-log.module';
import { VaccinationModule } from './vaccination/vaccination.module';
import { HospitalModule } from './hospital/hospital.module';
import { ScheduleModule } from '@nestjs/schedule';
import { NotificationModule } from './notification/notification.module';
import { HealthController } from './health/health.controller';
import { ArticleModule } from './article/article.module';
import { AdminModule } from './admin/admin.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: (raw) => loadEnv(raw as NodeJS.ProcessEnv),
    }),
    PrismaModule,
    AuthModule,
    UserModule,
    FoodModule,
    EventEmitterModule.forRoot(),
    ChildModule,
    MealModule,
    GrowthModule,
    NutritionModule,
    NutritionLogModule,
    VaccinationModule,
    HospitalModule,
    ScheduleModule.forRoot(),
    NotificationModule,
    ArticleModule,
    AdminModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
