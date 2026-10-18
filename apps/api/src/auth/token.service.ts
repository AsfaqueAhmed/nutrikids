import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';
import { createHash, randomBytes, randomUUID } from 'crypto';
import { Env } from '../config/env';
import { unauthorized } from '../common/api-error';
import { PrismaService } from '../prisma/prisma.service';

export const sha256 = (v: string) =>
  createHash('sha256').update(v).digest('hex');
export const randomToken = () => randomBytes(32).toString('hex');

export type TokenPair = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
};

@Injectable()
export class TokenService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async issue(
    user: { id: string; role: Role },
    familyId: string = randomUUID(),
  ): Promise<TokenPair> {
    const expiresIn = this.config.get('JWT_ACCESS_TTL_SECONDS', {
      infer: true,
    });
    const accessToken = await this.jwt.signAsync(
      { sub: user.id, role: user.role },
      { expiresIn },
    );
    const refreshToken = randomToken();
    const ttlDays = this.config.get('REFRESH_TTL_DAYS', { infer: true });
    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        familyId,
        tokenHash: sha256(refreshToken),
        expiresAt: new Date(Date.now() + ttlDays * 86_400_000),
      },
    });
    return { accessToken, refreshToken, expiresIn };
  }

  async rotate(raw: string): Promise<TokenPair> {
    const row = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: sha256(raw) },
    });
    if (!row || row.revokedAt || row.expiresAt < new Date())
      throw unauthorized('INVALID_REFRESH_TOKEN');
    const claimed = await this.prisma.refreshToken.updateMany({
      where: { id: row.id, usedAt: null },
      data: { usedAt: new Date() },
    });
    if (claimed.count === 0) {
      await this.prisma.refreshToken.updateMany({
        where: { familyId: row.familyId },
        data: { revokedAt: new Date() },
      });
      throw unauthorized('REFRESH_TOKEN_REUSED');
    }
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: row.userId },
    });
    return this.issue(user, row.familyId);
  }

  async revokeFamilyOf(raw: string) {
    const row = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: sha256(raw) },
    });
    if (row) {
      await this.prisma.refreshToken.updateMany({
        where: { familyId: row.familyId },
        data: { revokedAt: new Date() },
      });
    }
  }

  revokeAllFor(userId: string) {
    return this.prisma.refreshToken.updateMany({
      where: { userId },
      data: { revokedAt: new Date() },
    });
  }
}
