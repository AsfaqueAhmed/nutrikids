import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
} from '@nestjs/common';
import { VaccineAvailability } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { Roles } from '../common/roles.decorator';
import { AdminVaccineService } from './admin-vaccine.service';

class UpdateVaccineDto {
  @IsOptional() @IsString() @MaxLength(120) name?: string;
  @IsOptional() @IsString() @MaxLength(120) disease?: string;
  @IsOptional() @IsString() @MaxLength(2000) description?: string;
  @IsOptional() @IsEnum(VaccineAvailability) availability?: VaccineAvailability;
  @IsOptional() @IsBoolean() isMandatory?: boolean;
  @IsOptional() @IsInt() @Min(0) priceMinBdt?: number | null;
  @IsOptional() @IsInt() @Min(0) priceMaxBdt?: number | null;
  @IsOptional() @IsString() @MaxLength(500) priceNote?: string | null;
  @IsOptional() @IsString() @MaxLength(500) sourceNote?: string;
  @IsOptional() @IsBoolean() verified?: boolean;
}
class UpdateScheduleItemDto {
  @IsOptional() @IsInt() @Min(0) suggestedAgeDays?: number;
  @IsOptional() @IsInt() @Min(0) minAgeDays?: number;
  @IsOptional() @IsInt() @Min(0) maxAgeDays?: number | null;
  @IsOptional() @IsInt() @Min(0) intervalFromPreviousDays?: number | null;
  @IsOptional() @IsString() @MaxLength(500) notes?: string | null;
}

@Roles('ADMIN')
@Controller('admin')
export class AdminVaccineController {
  constructor(private readonly vaccines: AdminVaccineService) {}
  @Get('vaccines') list() {
    return this.vaccines.list();
  }
  @Patch('vaccines/:id') update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() b: UpdateVaccineDto,
  ) {
    return this.vaccines.updateVaccine(id, b);
  }
  @Patch('vaccine-schedule-items/:id') updateItem(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() b: UpdateScheduleItemDto,
  ) {
    return this.vaccines.updateItem(id, b);
  }
}
