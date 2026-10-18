import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { mkdirSync, writeFileSync } from 'fs';
import { dirname, resolve } from 'path';

async function main() {
  process.env.DATABASE_URL ??=
    'postgresql://nutrikids:nutrikids@localhost:5433/nutrikids';
  process.env.JWT_ACCESS_SECRET ??= 'x'.repeat(32);
  // import after the env defaults: ConfigModule validates the environment when AppModule loads
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { AppModule } =
    require('../src/app.module') as typeof import('../src/app.module');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { configureApp } =
    require('../src/configure-app') as typeof import('../src/configure-app');
  const app = await NestFactory.create(AppModule, {
    logger: false,
    abortOnError: false,
  });
  configureApp(app);
  const config = new DocumentBuilder()
    .setTitle('NutriKids API')
    .setVersion('1')
    .addBearerAuth()
    .build();
  const doc = SwaggerModule.createDocument(app, config);
  const out = resolve(__dirname, '../../../packages/contracts/openapi.json');
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify(doc, null, 2) + '\n');
  await app.close();
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
