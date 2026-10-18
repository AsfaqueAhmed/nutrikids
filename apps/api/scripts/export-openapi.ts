import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { mkdirSync, writeFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/configure-app';

async function main() {
  process.env.DATABASE_URL ??= 'postgresql://nutrikids:nutrikids@localhost:5433/nutrikids';
  process.env.JWT_ACCESS_SECRET ??= 'x'.repeat(32);
  const app = await NestFactory.create(AppModule, { logger: false });
  configureApp(app);
  const config = new DocumentBuilder().setTitle('NutriKids API').setVersion('1').addBearerAuth().build();
  const doc = SwaggerModule.createDocument(app, config);
  const out = resolve(__dirname, '../../../packages/contracts/openapi.json');
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify(doc, null, 2) + '\n');
  await app.close();
}
void main();
