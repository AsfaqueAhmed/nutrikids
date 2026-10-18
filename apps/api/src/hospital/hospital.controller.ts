import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { Type } from 'class-transformer';
import {
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  IsInt,
} from 'class-validator';
import { ApiError } from '../common/api-error';
import { Roles } from '../common/roles.decorator';
import { parseHospitalCsv } from './hospital-csv';
import { HospitalService } from './hospital.service';

class NearbyQuery {
  @Type(() => Number) @IsNumber() @Min(-90) @Max(90) lat!: number;
  @Type(() => Number) @IsNumber() @Min(-180) @Max(180) lng!: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0.1) @Max(500) radiusKm =
    10;
  @IsOptional() @IsString() service?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 20;
}

@Controller()
export class HospitalController {
  constructor(private readonly hospitals: HospitalService) {}

  @Get('hospitals/nearby') nearby(@Query() q: NearbyQuery) {
    return this.hospitals.nearby(q);
  }

  @Roles('ADMIN')
  @Post('admin/hospitals/import')
  async import(@Body() body: unknown) {
    const text = typeof body === 'string' ? body : '';
    if (!text.trim())
      throw new ApiError(
        400,
        'EMPTY_BODY',
        'Send the CSV as the request body with Content-Type: text/csv',
      );
    const { rows, errors } = parseHospitalCsv(text);
    const result = await this.hospitals.import(rows);
    return { ...result, errors };
  }
}
