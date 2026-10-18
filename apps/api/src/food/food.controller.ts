import { ApiPropertyOptional } from '@nestjs/swagger';
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
import { Allergen } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { Roles } from '../common/roles.decorator';
import { FoodService } from './food.service';

class ListFoodsQuery {
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsString() category?: string;
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.split(',') : value,
  )
  @IsArray()
  @IsEnum(Allergen, { each: true })
  excludeAllergens?: Allergen[];
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize: number = 20;
}

class CreateFoodDto {
  @IsString() @IsNotEmpty() name!: string;
  @IsString() @IsNotEmpty() category!: string;
  @IsOptional()
  @IsArray()
  @IsEnum(Allergen, { each: true })
  allergens?: Allergen[];
  @IsObject() nutrition!: Record<string, number>;
  @IsOptional() @IsInt() @Min(0) ageMinMonths?: number;
  @IsOptional() @IsInt() @Min(0) ageMaxMonths?: number;
}

class UpdateFoodDto {
  @IsOptional() @IsString() @IsNotEmpty() name?: string;
  @IsOptional() @IsString() @IsNotEmpty() category?: string;
  @IsOptional()
  @IsArray()
  @IsEnum(Allergen, { each: true })
  allergens?: Allergen[];
  @IsOptional() @IsObject() nutrition?: Record<string, number>;
  @IsOptional() @IsInt() @Min(0) ageMinMonths?: number;
  @IsOptional() @IsInt() @Min(0) ageMaxMonths?: number;
}

@Controller('foods')
export class FoodController {
  constructor(private readonly foods: FoodService) {}

  @Get() list(@Query() q: ListFoodsQuery) {
    return this.foods.list(q);
  }
  @Get('categories') categories() {
    return this.foods.categories();
  }
  @Get(':id') get(@Param('id', ParseUUIDPipe) id: string) {
    return this.foods.get(id);
  }

  @Roles('ADMIN') @Post() create(@Body() b: CreateFoodDto) {
    return this.foods.create(b);
  }
  @Roles('ADMIN') @Patch(':id') update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() b: UpdateFoodDto,
  ) {
    return this.foods.update(id, b);
  }
  @Roles('ADMIN') @Delete(':id') @HttpCode(204) remove(
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.foods.remove(id);
  }
}
