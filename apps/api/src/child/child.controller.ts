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
  Put,
  Query,
} from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsArray, ValidateNested } from 'class-validator';
import { type AuthUser, CurrentUser } from '../common/current-user';
import { ChildService } from './child.service';
import {
  AllergyDto,
  ConditionsDto,
  CreateChildDto,
  DislikesDto,
  FeedingLogDto,
  FeedingQuery,
  FoodIntroductionDto,
  UpdateChildDto,
} from './dto';

class AllergiesBody {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AllergyDto)
  items!: AllergyDto[];
}

@Controller('children')
export class ChildController {
  constructor(private readonly children: ChildService) {}

  @Get() list(@CurrentUser() u: AuthUser) {
    return this.children.list(u.id);
  }
  @Post() create(@CurrentUser() u: AuthUser, @Body() b: CreateChildDto) {
    return this.children.create(u.id, b);
  }
  @Get(':id') get(
    @CurrentUser() u: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.children.get(u.id, id);
  }
  @Patch(':id') update(
    @CurrentUser() u: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() b: UpdateChildDto,
  ) {
    return this.children.update(u.id, id, b);
  }
  @Delete(':id') @HttpCode(204) remove(
    @CurrentUser() u: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.children.remove(u.id, id);
  }

  @Put(':id/allergies') setAllergies(
    @CurrentUser() u: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() b: AllergiesBody,
  ) {
    return this.children.setAllergies(u.id, id, b.items);
  }
  @Put(':id/conditions') setConditions(
    @CurrentUser() u: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() b: ConditionsDto,
  ) {
    return this.children.setConditions(u.id, id, b.names);
  }
  @Put(':id/dislikes') setDislikes(
    @CurrentUser() u: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() b: DislikesDto,
  ) {
    return this.children.setDislikes(u.id, id, b.foodIds);
  }

  @Put(':id/feeding-logs/:logId') putLog(
    @CurrentUser() u: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('logId', ParseUUIDPipe) logId: string,
    @Body() b: FeedingLogDto,
  ) {
    return this.children.upsertFeedingLog(u.id, id, logId, b);
  }
  @Get(':id/feeding-logs') logs(
    @CurrentUser() u: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() q: FeedingQuery,
  ) {
    return this.children.listFeedingLogs(u.id, id, q);
  }
  @Delete(':id/feeding-logs/:logId') @HttpCode(204) delLog(
    @CurrentUser() u: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('logId', ParseUUIDPipe) logId: string,
  ) {
    return this.children.deleteFeedingLog(u.id, id, logId);
  }

  @Put(':id/food-introductions/:introId') putIntro(
    @CurrentUser() u: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('introId', ParseUUIDPipe) introId: string,
    @Body() b: FoodIntroductionDto,
  ) {
    return this.children.upsertIntroduction(u.id, id, introId, b);
  }
  @Get(':id/food-introductions') intros(
    @CurrentUser() u: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.children.listIntroductions(u.id, id);
  }
}
