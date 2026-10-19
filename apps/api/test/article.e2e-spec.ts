import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp, makeAdmin, registerAndLogin, resetDb } from './helpers';

describe('articles', () => {
  let app: INestApplication;
  const http = () => request(app.getHttpServer());
  beforeAll(async () => (app = await createTestApp()));
  beforeEach(() => resetDb(app.get(PrismaService)));
  afterAll(() => app.close());

  const draft = {
    kind: 'ARTICLE',
    slug: 'starting-solids',
    title: 'Starting solids',
    summary: 'When and how to begin',
    body: '# Starting solids\n\nAround 6 months.',
    category: 'feeding',
    ageMinMonths: 6,
    ageMaxMonths: 12,
  };

  async function setup() {
    const admin = await makeAdmin(app);
    const parent = await registerAndLogin(app);
    return {
      a: { Authorization: `Bearer ${admin.token}` },
      p: { Authorization: `Bearer ${parent.token}` },
    };
  }

  it('hides drafts from parents until published', async () => {
    const { a, p } = await setup();
    const created = await http().post('/v1/admin/articles').set(a).send(draft).expect(201);
    expect(created.body.status).toBe('DRAFT');
    expect(created.body.publishedAt).toBeNull();

    let list = await http().get('/v1/articles').set(p).expect(200);
    expect(list.body.total).toBe(0);
    await http().get('/v1/articles/starting-solids').set(p).expect(404);

    const pub = await http()
      .patch(`/v1/admin/articles/${created.body.id}`)
      .set(a)
      .send({ status: 'PUBLISHED' })
      .expect(200);
    expect(pub.body.publishedAt).not.toBeNull();

    list = await http().get('/v1/articles').set(p).expect(200);
    expect(list.body.total).toBe(1);
    expect(list.body.items[0]).not.toHaveProperty('body');
    const one = await http().get('/v1/articles/starting-solids').set(p).expect(200);
    expect(one.body.body).toContain('Around 6 months');
  });

  it('filters by age, category, kind and text', async () => {
    const { a, p } = await setup();
    const make = (o: object) =>
      http()
        .post('/v1/admin/articles')
        .set(a)
        .send({ ...draft, status: 'PUBLISHED', ...o })
        .expect(201);
    await make({});
    await make({ slug: 'toddler-snacks', title: 'Toddler snacks', category: 'snacks', ageMinMonths: 12, ageMaxMonths: 36 });
    await make({ slug: 'terms', kind: 'PAGE', title: 'Terms', category: 'legal', ageMinMonths: null, ageMaxMonths: null });
    const ids = async (qs: string) =>
      (await http().get(`/v1/articles?${qs}`).set(p).expect(200)).body.items.map(
        (i: { slug: string }) => i.slug,
      );
    expect((await ids('ageMonths=8')).sort()).toEqual(['starting-solids', 'terms']);
    expect(await ids('ageMonths=24&kind=ARTICLE')).toEqual(['toddler-snacks']);
    expect(await ids('category=snacks')).toEqual(['toddler-snacks']);
    expect(await ids('q=solids')).toEqual(['starting-solids']);
    expect(await ids('kind=PAGE')).toEqual(['terms']);
  });

  it('validates slug, age range and uniqueness', async () => {
    const { a } = await setup();
    await http().post('/v1/admin/articles').set(a).send({ ...draft, slug: 'Bad Slug' }).expect(400);
    const bad = await http()
      .post('/v1/admin/articles')
      .set(a)
      .send({ ...draft, ageMinMonths: 24, ageMaxMonths: 12 })
      .expect(400);
    expect(bad.body.code).toBe('INVALID_AGE_RANGE');
    await http().post('/v1/admin/articles').set(a).send(draft).expect(201);
    const dup = await http().post('/v1/admin/articles').set(a).send(draft).expect(409);
    expect(dup.body.code).toBe('SLUG_TAKEN');
  });

  it('forbids parents from admin routes and supports delete', async () => {
    const { a, p } = await setup();
    await http().post('/v1/admin/articles').set(p).send(draft).expect(403);
    await http().get('/v1/admin/articles').set(p).expect(403);
    const c = await http().post('/v1/admin/articles').set(a).send(draft).expect(201);
    await http().delete(`/v1/admin/articles/${c.body.id}`).set(a).expect(204);
    await http().get(`/v1/admin/articles/${c.body.id}`).set(a).expect(404);
  });
});
