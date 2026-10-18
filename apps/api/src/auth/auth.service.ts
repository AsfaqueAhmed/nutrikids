import { Injectable } from '@nestjs/common';
import { AuthTokenType, Prisma } from '@prisma/client';
import { ApiError, conflict, unauthorized } from '../common/api-error';
import { PrismaService } from '../prisma/prisma.service';
import { IdentityVerifier } from './identity-verifier';
import { MailService } from './mail.service';
import { PasswordService } from './password.service';
import { randomToken, sha256, TokenService } from './token.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly tokens: TokenService,
    private readonly mail: MailService,
    private readonly identity: IdentityVerifier,
  ) {}

  private async createAuthToken(
    userId: string,
    type: AuthTokenType,
    ttlMinutes: number,
  ) {
    const raw = randomToken();
    await this.prisma.authToken.create({
      data: {
        userId,
        type,
        tokenHash: sha256(raw),
        expiresAt: new Date(Date.now() + ttlMinutes * 60_000),
      },
    });
    return raw;
  }

  private async consumeAuthToken(raw: string, type: AuthTokenType) {
    const row = await this.prisma.authToken.findUnique({
      where: { tokenHash: sha256(raw) },
    });
    if (!row || row.type !== type || row.usedAt || row.expiresAt < new Date()) {
      throw new ApiError(
        400,
        'INVALID_TOKEN',
        'This link is invalid or has expired',
      );
    }
    await this.prisma.authToken.update({
      where: { id: row.id },
      data: { usedAt: new Date() },
    });
    return row.userId;
  }

  async register(email: string, password: string) {
    const normalized = email.trim().toLowerCase();
    if (await this.prisma.user.findUnique({ where: { email: normalized } })) {
      throw conflict(
        'EMAIL_TAKEN',
        'An account with this email already exists',
      );
    }
    const user = await this.prisma.user.create({
      data: {
        email: normalized,
        passwordHash: await this.passwords.hash(password),
      },
    });
    const token = await this.createAuthToken(user.id, 'VERIFY_EMAIL', 60 * 24);
    await this.mail.send(
      normalized,
      'Verify your NutriKids email',
      `Verification token: ${token}`,
    );
    return this.tokens.issue(user);
  }

  async login(email: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
    });
    if (
      !user?.passwordHash ||
      !(await this.passwords.verify(user.passwordHash, password))
    ) {
      throw unauthorized('INVALID_CREDENTIALS');
    }
    return this.tokens.issue(user);
  }

  refresh(raw: string) {
    return this.tokens.rotate(raw);
  }

  logout(raw: string) {
    return this.tokens.revokeFamilyOf(raw);
  }

  async verifyEmail(raw: string) {
    const userId = await this.consumeAuthToken(raw, 'VERIFY_EMAIL');
    await this.prisma.user.update({
      where: { id: userId },
      data: { emailVerifiedAt: new Date() },
    });
  }

  async forgotPassword(email: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
    });
    if (!user) return; // never reveal whether the account exists
    const token = await this.createAuthToken(user.id, 'RESET_PASSWORD', 30);
    await this.mail.send(
      user.email,
      'Reset your NutriKids password',
      `Reset token: ${token}`,
    );
  }

  async resetPassword(raw: string, password: string) {
    const userId = await this.consumeAuthToken(raw, 'RESET_PASSWORD');
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: await this.passwords.hash(password) },
    });
    await this.tokens.revokeAllFor(userId);
  }

  async social(provider: 'google' | 'apple', idToken: string) {
    const id = await this.identity.verify(provider, idToken);
    const link: Pick<Prisma.UserCreateInput, 'googleSub' | 'appleSub'> =
      provider === 'google' ? { googleSub: id.sub } : { appleSub: id.sub };
    let user = await this.prisma.user.findUnique({
      where:
        provider === 'google' ? { googleSub: id.sub } : { appleSub: id.sub },
    });
    if (!user) {
      const email = id.email.toLowerCase();
      const existing = await this.prisma.user.findUnique({ where: { email } });
      if (existing && !id.emailVerified)
        throw unauthorized('SOCIAL_EMAIL_UNVERIFIED');
      user = existing
        ? await this.prisma.user.update({
            where: { id: existing.id },
            data: link,
          })
        : await this.prisma.user.create({
            data: {
              email,
              ...link,
              emailVerifiedAt: id.emailVerified ? new Date() : null,
            },
          });
    }
    return this.tokens.issue(user);
  }
}
