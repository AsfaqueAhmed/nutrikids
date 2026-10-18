import { Injectable } from '@nestjs/common';
import { Child } from '@prisma/client';
import { notFound } from '../common/api-error';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ChildAccessService {
  constructor(private readonly prisma: PrismaService) {}

  async assertOwned(userId: string, childId: string): Promise<Child> {
    const child = await this.prisma.child.findFirst({
      where: { id: childId, userId },
    });
    if (!child) throw notFound('Child');
    return child;
  }
}
