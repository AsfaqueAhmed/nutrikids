import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as webpush from 'web-push';
import { Env } from '../config/env';

export type PushPayload = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
};
export type PushTarget = { endpoint: string; p256dh: string; auth: string };

export abstract class PushSender {
  abstract send(
    sub: PushTarget,
    payload: PushPayload,
  ): Promise<'SENT' | 'GONE'>;
}

@Injectable()
export class WebPushSender extends PushSender {
  private readonly log = new Logger('WebPush');
  private readonly enabled: boolean;

  constructor(config: ConfigService<Env, true>) {
    super();
    const pub = config.get('VAPID_PUBLIC_KEY', { infer: true });
    const priv = config.get('VAPID_PRIVATE_KEY', { infer: true });
    this.enabled = !!pub && !!priv;
    if (this.enabled)
      webpush.setVapidDetails(
        config.get('VAPID_SUBJECT', { infer: true }),
        pub!,
        priv!,
      );
    else this.log.warn('VAPID keys not set; push notifications are disabled');
  }

  async send(sub: PushTarget, payload: PushPayload) {
    if (!this.enabled) return 'SENT';
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        JSON.stringify(payload),
      );
      return 'SENT';
    } catch (e: unknown) {
      const status = (e as { statusCode?: number } | null)?.statusCode;
      if (status === 404 || status === 410) return 'GONE';
      this.log.error(e);
      return 'SENT';
    }
  }
}

export class MemoryPushSender extends PushSender {
  sent: { endpoint: string; payload: PushPayload }[] = [];
  gone = new Set<string>();
  send(sub: PushTarget, payload: PushPayload): Promise<'SENT' | 'GONE'> {
    if (this.gone.has(sub.endpoint)) return Promise.resolve('GONE');
    this.sent.push({ endpoint: sub.endpoint, payload });
    return Promise.resolve('SENT');
  }
}
