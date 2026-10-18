import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { DietType, MealSlot } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { notFound } from '../common/api-error';
import { Roles } from '../common/roles.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { recipeInclude, recipeView } from './plan.service';

class RecipeFoodDto {
  @IsUUID() foodId!: string;
  @IsNumber() @Min(1) quantityG!: number;
}
class RecipeDto {
  @IsString() @IsNotEmpty() name!: string;
  @IsString() @IsNotEmpty() instructions!: string;
  @IsInt() @Min(0) prepMinutes!: number;
  @IsInt() @Min(0) ageMinMonths!: number;
  @IsInt() @Min(0) ageMaxMonths!: number;
  @IsArray()
  @ArrayMinSize(1)
  @IsEnum(MealSlot, { each: true })
  slots!: MealSlot[];
  @IsArray()
  @ArrayMinSize(1)
  @IsEnum(DietType, { each: true })
  suitableDiets!: DietType[];
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => RecipeFoodDto)
  foods!: RecipeFoodDto[];
}
class UpdateRecipeDto extends RecipeDto {}
class RecipeQuery {
  @IsOptional() @IsEnum(MealSlot) slot?: MealSlot;
  @IsOptional() @Type(() => Number) @IsInt() maxAgeMonths?: number;
}

@Controller('recipes')
export class RecipeController {
  constructor(private readonly prisma: PrismaService) {}

  @Get() async list(@Query() q: RecipeQuery) {
    const rows = await this.prisma.recipe.findMany({
      where: {
        ...(q.slot ? { slots: { has: q.slot } } : {}),
        ...(q.maxAgeMonths !== undefined
          ? {
              ageMinMonths: { lte: q.maxAgeMonths },
              ageMaxMonths: { gte: q.maxAgeMonths },
            }
          : {}),
      },
      include: recipeInclude,
      orderBy: { name: 'asc' },
    });
    return rows.map((r) => recipeView(r));
  }

  @Get(':id') async get(@Param('id', ParseUUIDPipe) id: string) {
    const r = await this.prisma.recipe.findUnique({
      where: { id },
      include: recipeInclude,
    });
    if (!r) throw notFound('Recipe');
    return recipeView(r);
  }

  @Roles('ADMIN') @Post() async create(@Body() b: RecipeDto) {
    const { foods, ...rest } = b;
    const r = await this.prisma.recipe.create({
      data: { ...rest, foods: { create: foods } },
      include: recipeInclude,
    });
    return recipeView(r);
  }

  @Roles('ADMIN') @Patch(':id') async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() b: UpdateRecipeDto,
  ) {
    const { foods, ...rest } = b;
    await this.get(id);
    const r = await this.prisma.recipe.update({
      where: { id },
      data: { ...rest, foods: { deleteMany: {}, create: foods } },
      include: recipeInclude,
    });
    return recipeView(r);
  }

  @Roles('ADMIN') @Delete(':id') @HttpCode(204) async remove(
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.get(id);
    await this.prisma.recipe.delete({ where: { id } });
  }
}
