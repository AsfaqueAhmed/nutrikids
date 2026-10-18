import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { loadEnv } from './config/env';
import { AuthModule } from './auth/auth.module';
import { PrismaModule } from './prisma/prisma.module';
import { UserModule } from './user/user.module';
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
  ],
  controllers: [HealthController],
})
export class AppModule {}
