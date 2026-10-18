import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp, makeAdmin, registerAndLogin, resetDb } from './helpers';

const csv = [
  'name,type,address,district,lat,lng,phone,services,source',
  'Near Hospital,Hospital,1 Rd,Dhaka,23.8110,90.4130,0171,Vaccination;Pediatrics,OSM',
  'Far Hospital,Hospital,2 Rd,Chattogram,22.3569,91.7832,,Pediatrics,OSM',
  'Bad Row,Hospital,3 Rd,Dhaka,999,90,,,OSM',
].join('\n');

describe('hospitals', () => {
  let app: INestApplication;
  const http = () => request(app.getHttpServer());
  beforeAll(async () => (app = await createTestApp()));
  beforeEach(() => resetDb(app.get(PrismaService)));
  afterAll(() => app.close());

  it('imports CSV (admin only), reports row errors, and is idempotent', async () => {
    const parent = await registerAndLogin(app);
    await http()
      .post('/v1/admin/hospitals/import')
      .set('Authorization', `Bearer ${parent.token}`)
      .set('Content-Type', 'text/csv')
      .send(csv)
      .expect(403);
    const admin = await makeAdmin(app);
    const auth = { Authorization: `Bearer ${admin.token}` };
    const first = await http()
      .post('/v1/admin/hospitals/import')
      .set(auth)
      .set('Content-Type', 'text/csv')
      .send(csv)
      .expect(201);
    expect(first.body).toMatchObject({ imported: 2, updated: 0 });
    expect(first.body.errors).toHaveLength(1);
    const second = await http()
      .post('/v1/admin/hospitals/import')
      .set(auth)
      .set('Content-Type', 'text/csv')
      .send(csv)
      .expect(201);
    expect(second.body).toMatchObject({ imported: 0, updated: 2 });
  });

  it('finds nearby hospitals sorted by distance and filters by service and radius', async () => {
    const admin = await makeAdmin(app);
    await http()
      .post('/v1/admin/hospitals/import')
      .set('Authorization', `Bearer ${admin.token}`)
      .set('Content-Type', 'text/csv')
      .send(csv);
    const parent = await registerAndLogin(app);
    const auth = { Authorization: `Bearer ${parent.token}` };
    const near = await http()
      .get('/v1/hospitals/nearby?lat=23.8103&lng=90.4125&radiusKm=10')
      .set(auth)
      .expect(200);
    expect(near.body.map((h: any) => h.name)).toEqual(['Near Hospital']);
    expect(near.body[0].distanceKm).toBeLessThan(1);
    const wide = await http()
      .get('/v1/hospitals/nearby?lat=23.8103&lng=90.4125&radiusKm=300')
      .set(auth);
    expect(wide.body.map((h: any) => h.name)).toEqual([
      'Near Hospital',
      'Far Hospital',
    ]);
    const svc = await http()
      .get(
        '/v1/hospitals/nearby?lat=23.8103&lng=90.4125&radiusKm=300&service=Vaccination',
      )
      .set(auth);
    expect(svc.body.map((h: any) => h.name)).toEqual(['Near Hospital']);
    await http()
      .get('/v1/hospitals/nearby?lat=abc&lng=90')
      .set(auth)
      .expect(400);
  });
});
