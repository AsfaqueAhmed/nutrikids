import { Injectable } from '@nestjs/common';
import { Article, ArticleKind, ArticleStatus, Prisma } from '@prisma/client';
import { ApiError, conflict, notFound } from '../common/api-error';
import { PrismaService } from '../prisma/prisma.service';

export type ArticleInput = {
  kind?: ArticleKind;
  slug?: string;
  title?: string;
  summary?: string;
  body?: string;
  category?: string;
  ageMinMonths?: number | null;
  ageMaxMonths?: number | null;
  coverUrl?: string | null;
  status?: ArticleStatus;
};

const summary = (a: Article) => ({
  id: a.id,
  kind: a.kind,
  slug: a.slug,
  title: a.title,
  summary: a.summary,
  category: a.category,
  ageMinMonths: a.ageMinMonths,
  ageMaxMonths: a.ageMaxMonths,
  coverUrl: a.coverUrl,
  status: a.status,
  publishedAt: a.publishedAt,
});
const detail = (a: Article) => ({ ...summary(a), body: a.body });

function assertAgeRange(min?: number | null, max?: number | null) {
  if (min != null && max != null && min > max)
    throw new ApiError(
      400,
      'INVALID_AGE_RANGE',
      'The minimum age must not exceed the maximum age',
    );
}

@Injectable()
export class ArticleService {
  constructor(private readonly prisma: PrismaService) {}

  async listPublic(q: {
    kind?: ArticleKind;
    category?: string;
    ageMonths?: number;
    q?: string;
    page: number;
    limit: number;
  }) {
    const and: Prisma.ArticleWhereInput[] = [];
    if (q.ageMonths !== undefined)
      and.push(
        {
          OR: [{ ageMinMonths: null }, { ageMinMonths: { lte: q.ageMonths } }],
        },
        {
          OR: [{ ageMaxMonths: null }, { ageMaxMonths: { gte: q.ageMonths } }],
        },
      );
    if (q.q)
      and.push({
        OR: [
          { title: { contains: q.q, mode: 'insensitive' } },
          { summary: { contains: q.q, mode: 'insensitive' } },
        ],
      });
    const where: Prisma.ArticleWhereInput = {
      status: 'PUBLISHED',
      ...(q.kind ? { kind: q.kind } : {}),
      ...(q.category ? { category: q.category } : {}),
      AND: and,
    };
    const [items, total] = await Promise.all([
      this.prisma.article.findMany({
        where,
        orderBy: { publishedAt: 'desc' },
        skip: (q.page - 1) * q.limit,
        take: q.limit,
      }),
      this.prisma.article.count({ where }),
    ]);
    return { items: items.map(summary), total, page: q.page, limit: q.limit };
  }

  async getPublished(slug: string) {
    const a = await this.prisma.article.findFirst({
      where: { slug, status: 'PUBLISHED' },
    });
    if (!a) throw notFound('Article');
    return detail(a);
  }

  async listAdmin(q: {
    status?: ArticleStatus;
    kind?: ArticleKind;
    page: number;
    limit: number;
  }) {
    const where: Prisma.ArticleWhereInput = {
      ...(q.status ? { status: q.status } : {}),
      ...(q.kind ? { kind: q.kind } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.article.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip: (q.page - 1) * q.limit,
        take: q.limit,
      }),
      this.prisma.article.count({ where }),
    ]);
    return { items: items.map(summary), total, page: q.page, limit: q.limit };
  }

  async getAdmin(id: string) {
    const a = await this.prisma.article.findUnique({ where: { id } });
    if (!a) throw notFound('Article');
    return detail(a);
  }

  async create(
    authorId: string,
    dto: Required<
      Pick<ArticleInput, 'slug' | 'title' | 'summary' | 'body' | 'category'>
    > &
      ArticleInput,
  ) {
    assertAgeRange(dto.ageMinMonths, dto.ageMaxMonths);
    if (await this.prisma.article.findUnique({ where: { slug: dto.slug } }))
      throw conflict('SLUG_TAKEN', 'An article with this slug already exists');
    const status = dto.status ?? 'DRAFT';
    const a = await this.prisma.article.create({
      data: {
        kind: dto.kind ?? 'ARTICLE',
        slug: dto.slug,
        title: dto.title,
        summary: dto.summary,
        body: dto.body,
        category: dto.category,
        ageMinMonths: dto.ageMinMonths ?? null,
        ageMaxMonths: dto.ageMaxMonths ?? null,
        coverUrl: dto.coverUrl ?? null,
        status,
        publishedAt: status === 'PUBLISHED' ? new Date() : null,
        authorId,
      },
    });
    return detail(a);
  }

  async update(id: string, dto: ArticleInput) {
    const existing = await this.prisma.article.findUnique({ where: { id } });
    if (!existing) throw notFound('Article');
    assertAgeRange(
      dto.ageMinMonths === undefined ? existing.ageMinMonths : dto.ageMinMonths,
      dto.ageMaxMonths === undefined ? existing.ageMaxMonths : dto.ageMaxMonths,
    );
    if (dto.slug && dto.slug !== existing.slug) {
      if (await this.prisma.article.findUnique({ where: { slug: dto.slug } }))
        throw conflict(
          'SLUG_TAKEN',
          'An article with this slug already exists',
        );
    }
    let publishedAt: Date | null | undefined;
    if (dto.status === 'PUBLISHED' && !existing.publishedAt)
      publishedAt = new Date();
    if (dto.status === 'DRAFT') publishedAt = null;
    const a = await this.prisma.article.update({
      where: { id },
      data: { ...dto, ...(publishedAt !== undefined ? { publishedAt } : {}) },
    });
    return detail(a);
  }

  async remove(id: string) {
    await this.prisma.article.deleteMany({ where: { id } });
  }
}
