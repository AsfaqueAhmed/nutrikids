import { INestApplication, Type } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { Test, TestingModuleBuilder } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/configure-app';
import { PrismaService } from '../src/prisma/prisma.service';

export async function createTestApp(
  customize?: (b: TestingModuleBuilder) => TestingModuleBuilder,
  controllers: Type<unknown>[] = [],
): Promise<INestApplication> {
  let builder = Test.createTestingModule({ imports: [AppModule], controllers });
  if (customize) builder = customize(builder);
  const mod = await builder.compile();
  const app = mod.createNestApplication();
  configureApp(app);
  await app.init();
  return app;
}

export async function resetDb(prisma: PrismaService): Promise<void> {
  const rows = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  if (rows.length === 0) return;
  const list = rows.map((r) => `"${r.tablename}"`).join(', ');
  await prisma.$executeRawUnsafe(`TRUNCATE ${list} RESTART IDENTITY CASCADE`);
}

export async function registerAndLogin(
  app: INestApplication,
  email = 'parent@example.com',
) {
  const res = await request(app.getHttpServer() as App)
    .post('/v1/auth/register')
    .send({ email, password: 'password123' })
    .expect(201);
  const { accessToken } = res.body as { accessToken: string };
  const me = await request(app.getHttpServer() as App)
    .get('/v1/me')
    .set('Authorization', `Bearer ${accessToken}`);
  return { token: accessToken, userId: (me.body as { id: string }).id };
}
