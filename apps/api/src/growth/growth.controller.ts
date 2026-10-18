import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Put,
  Query,
  StreamableFile,
} from '@nestjs/common';
import { IsDateString, IsNumber, IsOptional, Max, Min } from 'class-validator';
import { type AuthUser, CurrentUser } from '../common/current-user';
import { GrowthService } from './growth.service';
import { renderGrowthPdf } from './growth-pdf';

class GrowthDto {
  @IsDateString() date!: string;
  @IsOptional() @IsNumber() @Min(20) @Max(250) heightCm?: number;
  @IsOptional() @IsNumber() @Min(0.5) @Max(200) weightKg?: number;
  @IsOptional() @IsNumber() @Min(20) @Max(70) headCircumferenceCm?: number;
  @IsDateString() clientUpdatedAt!: string;
}
class SinceQuery {
  @IsOptional() @IsDateString() updatedSince?: string;
}

@Controller('children/:childId')
export class GrowthController {
  constructor(private readonly growth: GrowthService) {}

  @Put('growth-records/:recId') put(
    @CurrentUser() u: AuthUser,
    @Param('childId', ParseUUIDPipe) c: string,
    @Param('recId', ParseUUIDPipe) r: string,
    @Body() b: GrowthDto,
  ) {
    return this.growth.upsert(u.id, c, r, b);
  }
  @Get('growth-records') list(
    @CurrentUser() u: AuthUser,
    @Param('childId', ParseUUIDPipe) c: string,
    @Query() q: SinceQuery,
  ) {
    return this.growth.list(u.id, c, q.updatedSince);
  }
  @Delete('growth-records/:recId') @HttpCode(204) del(
    @CurrentUser() u: AuthUser,
    @Param('childId', ParseUUIDPipe) c: string,
    @Param('recId', ParseUUIDPipe) r: string,
  ) {
    return this.growth.remove(u.id, c, r);
  }
  @Get('growth/chart') chart(
    @CurrentUser() u: AuthUser,
    @Param('childId', ParseUUIDPipe) c: string,
  ) {
    return this.growth.chart(u.id, c);
  }

  @Get('growth/export.pdf')
  @Header('Content-Type', 'application/pdf')
  @Header('Content-Disposition', 'attachment; filename="growth-summary.pdf"')
  async pdf(
    @CurrentUser() u: AuthUser,
    @Param('childId', ParseUUIDPipe) c: string,
  ) {
    const s = await this.growth.summary(u.id, c);
    const buf = await renderGrowthPdf({
      childName: s.child.name,
      dateOfBirth: s.child.dateOfBirth.toISOString().slice(0, 10),
      gender: s.child.gender,
      ageMonths: Math.floor(
        (Date.now() - s.child.dateOfBirth.getTime()) / (30.4375 * 86_400_000),
      ),
      rows: s.rows.map((r) => ({
        date: r.date.toISOString().slice(0, 10),
        heightCm: r.heightCm ? Number(r.heightCm) : null,
        weightKg: r.weightKg ? Number(r.weightKg) : null,
        headCircumferenceCm: r.headCircumferenceCm
          ? Number(r.headCircumferenceCm)
          : null,
      })),
      latest: s.latest && {
        weightPercentile: s.latest.measures.weight?.percentile,
        heightPercentile: s.latest.measures.height?.percentile,
        bmiPercentile: s.latest.measures.bmi?.percentile,
        bmiStatus: s.latest.measures.bmiStatus,
      },
    });
    return new StreamableFile(buf);
  }
}
