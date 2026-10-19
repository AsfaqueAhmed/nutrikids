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
import { PartialType } from '@nestjs/swagger';
import { ArticleKind, ArticleStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { type AuthUser, CurrentUser } from '../common/current-user';
import { PageQuery } from '../common/page-query';
import { Roles } from '../common/roles.decorator';
import { ArticleService } from './article.service';

class ListArticlesQuery extends PageQuery {
  @IsOptional() @IsEnum(ArticleKind) kind?: ArticleKind;
  @IsOptional() @IsString() @MaxLength(60) category?: string;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(240)
  ageMonths?: number;
  @IsOptional() @IsString() @MaxLength(100) q?: string;
}
class AdminListQuery extends PageQuery {
  @IsOptional() @IsEnum(ArticleStatus) status?: ArticleStatus;
  @IsOptional() @IsEnum(ArticleKind) kind?: ArticleKind;
}
class CreateArticleDto {
  @IsOptional() @IsEnum(ArticleKind) kind?: ArticleKind;
  @Matches(/^[a-z0-9]+(-[a-z0-9]+)*$/) @MaxLength(100) slug!: string;
  @IsString() @MinLength(1) @MaxLength(200) title!: string;
  @IsString() @MinLength(1) @MaxLength(500) summary!: string;
  @IsString() @MinLength(1) @MaxLength(50_000) body!: string;
  @IsString() @MinLength(1) @MaxLength(60) category!: string;
  @IsOptional() @IsInt() @Min(0) @Max(240) ageMinMonths?: number | null;
  @IsOptional() @IsInt() @Min(0) @Max(240) ageMaxMonths?: number | null;
  @IsOptional()
  @IsUrl({ protocols: ['https'], require_protocol: true })
  coverUrl?: string | null;
  @IsOptional() @IsEnum(ArticleStatus) status?: ArticleStatus;
}
class UpdateArticleDto extends PartialType(CreateArticleDto) {}

@Controller('articles')
export class ArticleController {
  constructor(private readonly articles: ArticleService) {}
  @Get() list(@Query() q: ListArticlesQuery) {
    return this.articles.listPublic(q);
  }
  @Get(':slug') one(@Param('slug') slug: string) {
    return this.articles.getPublished(slug);
  }
}

@Roles('ADMIN')
@Controller('admin/articles')
export class AdminArticleController {
  constructor(private readonly articles: ArticleService) {}
  @Get() list(@Query() q: AdminListQuery) {
    return this.articles.listAdmin(q);
  }
  @Get(':id') one(@Param('id', ParseUUIDPipe) id: string) {
    return this.articles.getAdmin(id);
  }
  @Post() create(@CurrentUser() u: AuthUser, @Body() b: CreateArticleDto) {
    return this.articles.create(u.id, b);
  }
  @Patch(':id') update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() b: UpdateArticleDto,
  ) {
    return this.articles.update(id, b);
  }
  @Delete(':id') @HttpCode(204) remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.articles.remove(id);
  }
}
