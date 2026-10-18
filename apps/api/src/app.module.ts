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
import { VaccinationModule } from './vaccination/vaccination.module';
import { HospitalModule } from './hospital/hospital.module';
import { HealthController } from './health/health.controller';

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
    VaccinationModule,
    HospitalModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
