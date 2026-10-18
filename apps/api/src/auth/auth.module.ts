import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { Env } from '../config/env';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { RealIdentityVerifier, IdentityVerifier } from './identity-verifier';
import { JwtAuthGuard } from './jwt-auth.guard';
import { ConsoleMailService, MailService } from './mail.service';
import { PasswordService } from './password.service';
import { RolesGuard } from './roles.guard';
import { TokenService } from './token.service';

@Global()
@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (c: ConfigService<Env, true>) => ({
        secret: c.get('JWT_ACCESS_SECRET', { infer: true }),
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    PasswordService,
    TokenService,
    { provide: MailService, useClass: ConsoleMailService },
    { provide: IdentityVerifier, useClass: RealIdentityVerifier },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
  exports: [JwtModule, TokenService],
})
export class AuthModule {}
