import { Injectable } from '@nestjs/common';
import { Allergen, Prisma } from '@prisma/client';
import { notFound } from '../common/api-error';
import { PrismaService } from '../prisma/prisma.service';
import { validateNutrition } from './nutrition';

export type FoodInput = {
  name: string;
  category: string;
  allergens?: Allergen[];
  nutrition: unknown;
  ageMinMonths?: number;
  ageMaxMonths?: number;
};

@Injectable()
export class FoodService {
  constructor(private readonly prisma: PrismaService) {}

  async list(q: {
    search?: string;
    category?: string;
    excludeAllergens?: Allergen[];
    page: number;
    pageSize: number;
  }) {
    const where: Prisma.FoodWhereInput = {
      ...(q.search
        ? { name: { contains: q.search, mode: 'insensitive' } }
        : {}),
      ...(q.category ? { category: q.category } : {}),
      ...(q.excludeAllergens?.length
        ? { NOT: { allergens: { hasSome: q.excludeAllergens } } }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.food.findMany({
        where,
        orderBy: { name: 'asc' },
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
      }),
      this.prisma.food.count({ where }),
    ]);
    return { items, total, page: q.page, pageSize: q.pageSize };
  }

  async categories() {
    const rows = await this.prisma.food.findMany({
      distinct: ['category'],
      select: { category: true },
      orderBy: { category: 'asc' },
    });
    return rows.map((r) => r.category);
  }

  async get(id: string) {
    const f = await this.prisma.food.findUnique({ where: { id } });
    if (!f) throw notFound('Food');
    return f;
  }

  findByIds(ids: string[]) {
    return this.prisma.food.findMany({ where: { id: { in: ids } } });
  }

  create(input: FoodInput) {
    return this.prisma.food.create({
      data: {
        ...input,
        allergens: input.allergens ?? [],
        nutrition: validateNutrition(input.nutrition),
      },
    });
  }

  async update(id: string, input: Partial<FoodInput>) {
    await this.get(id);
    return this.prisma.food.update({
      where: { id },
      data: {
        ...input,
        ...(input.nutrition
          ? {
              nutrition: validateNutrition(input.nutrition),
            }
          : {}),
      } as Prisma.FoodUpdateInput,
    });
  }

  async remove(id: string) {
    await this.get(id);
    await this.prisma.food.delete({ where: { id } });
  }
}
