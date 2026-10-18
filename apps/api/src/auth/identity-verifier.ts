import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OAuth2Client } from 'google-auth-library';
import appleSignin from 'apple-signin-auth';
import { Env } from '../config/env';
import { ApiError } from '../common/api-error';

export type VerifiedIdentity = {
  sub: string;
  email: string;
  emailVerified: boolean;
};

export abstract class IdentityVerifier {
  abstract verify(
    provider: 'google' | 'apple',
    idToken: string,
  ): Promise<VerifiedIdentity>;
}

@Injectable()
export class RealIdentityVerifier extends IdentityVerifier {
  constructor(private readonly config: ConfigService<Env, true>) {
    super();
  }

  async verify(
    provider: 'google' | 'apple',
    idToken: string,
  ): Promise<VerifiedIdentity> {
    try {
      if (provider === 'google') {
        const audience = this.config.get('GOOGLE_CLIENT_ID', { infer: true });
        const ticket = await new OAuth2Client().verifyIdToken({
          idToken,
          audience,
        });
        const p = ticket.getPayload();
        if (!p?.sub || !p.email) throw new Error('missing claims');
        return {
          sub: p.sub,
          email: p.email,
          emailVerified: !!p.email_verified,
        };
      }
      const audience = this.config.get('APPLE_CLIENT_ID', { infer: true });
      const p = await appleSignin.verifyIdToken(idToken, { audience });
      if (!p.sub || !p.email) throw new Error('missing claims');
      return {
        sub: p.sub,
        email: p.email,
        emailVerified: String(p.email_verified) === 'true',
      };
    } catch {
      throw new ApiError(
        401,
        'INVALID_SOCIAL_TOKEN',
        'Could not verify the sign-in token',
      );
    }
  }
}
