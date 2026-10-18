import { INestApplication } from '@nestjs/common';
import { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp, resetDb } from './helpers';

describe('prisma', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });
  afterAll(() => app.close());

  it('creates and reads a user, then resets', async () => {
    await resetDb(prisma);
    await prisma.user.create({ data: { email: 'a@b.com' } });
    expect(await prisma.user.count()).toBe(1);
    await resetDb(prisma);
    expect(await prisma.user.count()).toBe(0);
  });
});
