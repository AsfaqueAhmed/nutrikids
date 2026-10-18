import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Put,
  Query,
} from '@nestjs/common';
import { PaidType } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsIn,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { type AuthUser, CurrentUser } from '../common/current-user';
import { VaccinationService } from './vaccination.service';
import type { VaccineStatus } from './status';

class UpdateDto {
  @ValidateIf((_, v) => v !== null) @IsDateString() givenDate!: string | null;
  @IsOptional() @IsString() @MaxLength(200) facilityName?: string;
  @IsOptional() @IsEnum(PaidType) paidType?: PaidType;
  @IsOptional() @IsInt() @Min(0) @Max(1_000_000) amountPaidBdt?: number;
  @IsOptional() @IsString() @MaxLength(100) batchNo?: string;
  @IsOptional() @IsString() @MaxLength(500) notes?: string;
  @IsOptional() @IsString() cardPhotoUrl?: string;
  @IsDateString() clientUpdatedAt!: string;
}
class ListQuery {
  @IsOptional()
  @IsIn(['UPCOMING', 'DUE', 'OVERDUE', 'GIVEN', 'GIVEN_LATE'])
  status?: VaccineStatus;
}

@Controller()
export class VaccinationController {
  constructor(private readonly vaccines: VaccinationService) {}

  @Get('vaccines') catalogue() {
    return this.vaccines.catalogue();
  }
  @Get('children/:childId/vaccinations') list(
    @CurrentUser() u: AuthUser,
    @Param('childId', ParseUUIDPipe) c: string,
    @Query() q: ListQuery,
  ) {
    return this.vaccines.list(u.id, c, q.status);
  }
  @Get('children/:childId/vaccinations/summary') summary(
    @CurrentUser() u: AuthUser,
    @Param('childId', ParseUUIDPipe) c: string,
  ) {
    return this.vaccines.summary(u.id, c);
  }
  @Put('children/:childId/vaccinations/:id') update(
    @CurrentUser() u: AuthUser,
    @Param('childId', ParseUUIDPipe) c: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() b: UpdateDto,
  ) {
    return this.vaccines.update(u.id, c, id, b);
  }
}
