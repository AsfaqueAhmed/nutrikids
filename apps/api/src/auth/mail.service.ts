import { Injectable, Logger } from '@nestjs/common';

export abstract class MailService {
  abstract send(to: string, subject: string, text: string): Promise<void>;
}

@Injectable()
export class ConsoleMailService extends MailService {
  private readonly log = new Logger('Mail');
  send(to: string, subject: string, text: string) {
    this.log.log(`to=${to} subject=${subject}\n${text}`);
    return Promise.resolve();
  }
}

export class MemoryMailService extends MailService {
  outbox: { to: string; subject: string; text: string }[] = [];
  send(to: string, subject: string, text: string) {
    this.outbox.push({ to, subject, text });
    return Promise.resolve();
  }
}
