import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Put,
  Query,
} from '@nestjs/common';
import { EatenStatus, MealSlot } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { type AuthUser, CurrentUser } from '../common/current-user';
import { NutritionLogService } from './nutrition-log.service';

class NutritionLogDto {
  @IsDateString() date!: string;
  @IsEnum(MealSlot) slot!: MealSlot;
  @IsEnum(EatenStatus) eatenStatus!: EatenStatus;
  @IsOptional() @IsInt() @Min(1) @Max(99) percent?: number;
  @IsOptional() @IsString() @MaxLength(500) notes?: string;
  @IsDateString() clientUpdatedAt!: string;
}
class LogRangeQuery {
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) from?: string;
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) to?: string;
  @IsOptional() @IsDateString() updatedSince?: string;
}
class SummaryQuery {
  @Matches(/^\d{4}-\d{2}-\d{2}$/) from!: string;
  @Matches(/^\d{4}-\d{2}-\d{2}$/) to!: string;
}

@Controller('children/:childId/nutrition-logs')
export class NutritionLogController {
  constructor(private readonly logs: NutritionLogService) {}

  @Get('summary') summary(
    @CurrentUser() u: AuthUser,
    @Param('childId', ParseUUIDPipe) c: string,
    @Query() q: SummaryQuery,
  ) {
    return this.logs.summary(u.id, c, q.from, q.to);
  }

  @Put(':logId') put(
    @CurrentUser() u: AuthUser,
    @Param('childId', ParseUUIDPipe) c: string,
    @Param('logId', ParseUUIDPipe) l: string,
    @Body() b: NutritionLogDto,
  ) {
    return this.logs.upsert(u.id, c, l, b);
  }

  @Get() list(
    @CurrentUser() u: AuthUser,
    @Param('childId', ParseUUIDPipe) c: string,
    @Query() q: LogRangeQuery,
  ) {
    return this.logs.list(u.id, c, q);
  }

  @Delete(':logId') @HttpCode(204) del(
    @CurrentUser() u: AuthUser,
    @Param('childId', ParseUUIDPipe) c: string,
    @Param('logId', ParseUUIDPipe) l: string,
  ) {
    return this.logs.remove(u.id, c, l);
  }
}
