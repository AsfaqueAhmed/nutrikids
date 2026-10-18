import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { MealSlot, PlanType } from '@prisma/client';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { type AuthUser, CurrentUser } from '../common/current-user';
import { PlanService } from './plan.service';

class GenerateDto {
  @IsDateString() startDate!: string;
  @IsDateString() endDate!: string;
  @IsEnum(PlanType) type!: PlanType;
}
class EntryDto {
  @IsDateString() date!: string;
  @IsEnum(MealSlot) slot!: MealSlot;
  @IsUUID() recipeId!: string;
  @IsOptional() @IsNumber() @Min(0.1) @Max(3) portion?: number;
  @IsOptional() @IsBoolean() confirmAllergen?: boolean;
  @IsDateString() clientUpdatedAt!: string;
}
class RangeQuery {
  @IsOptional() @IsDateString() from?: string;
  @IsOptional() @IsDateString() to?: string;
  @IsOptional() @IsDateString() updatedSince?: string;
}
class GroceryQuery {
  @IsDateString() from!: string;
  @IsDateString() to!: string;
}
class CheckDto {
  @IsDateString() weekStart!: string;
  @IsUUID() foodId!: string;
  @IsBoolean() checked!: boolean;
  @IsDateString() clientUpdatedAt!: string;
}

@Controller('children/:childId')
export class PlanController {
  constructor(private readonly plans: PlanService) {}

  @Post('meal-plans/generate') generate(
    @CurrentUser() u: AuthUser,
    @Param('childId', ParseUUIDPipe) c: string,
    @Body() b: GenerateDto,
  ) {
    return this.plans.generate(u.id, c, b);
  }
  @Get('meal-plans') list(
    @CurrentUser() u: AuthUser,
    @Param('childId', ParseUUIDPipe) c: string,
    @Query() q: RangeQuery,
  ) {
    return this.plans.list(u.id, c, q);
  }
  @Put('meal-entries/:entryId') put(
    @CurrentUser() u: AuthUser,
    @Param('childId', ParseUUIDPipe) c: string,
    @Param('entryId', ParseUUIDPipe) e: string,
    @Body() b: EntryDto,
  ) {
    return this.plans.putEntry(u.id, c, e, b);
  }
  @Delete('meal-entries/:entryId') @HttpCode(204) del(
    @CurrentUser() u: AuthUser,
    @Param('childId', ParseUUIDPipe) c: string,
    @Param('entryId', ParseUUIDPipe) e: string,
  ) {
    return this.plans.deleteEntry(u.id, c, e);
  }
  @Get('grocery-list') grocery(
    @CurrentUser() u: AuthUser,
    @Param('childId', ParseUUIDPipe) c: string,
    @Query() q: GroceryQuery,
  ) {
    return this.plans.groceryList(u.id, c, q.from, q.to);
  }
  @Put('grocery-list/checks') check(
    @CurrentUser() u: AuthUser,
    @Param('childId', ParseUUIDPipe) c: string,
    @Body() b: CheckDto,
  ) {
    return this.plans.setCheck(u.id, c, b);
  }
}
