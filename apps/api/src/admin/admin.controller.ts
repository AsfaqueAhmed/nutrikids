import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { type AuthUser, CurrentUser } from '../common/current-user';
import { PageQuery } from '../common/page-query';
import { Roles } from '../common/roles.decorator';
import { AdminService } from './admin.service';

class UserListQuery extends PageQuery {
  @IsOptional() @IsString() @MaxLength(100) q?: string;
  @IsOptional() @IsEnum(Role) role?: Role;
  @IsOptional()
  @Transform(({ value }) => (value === 'true' ? true : value === 'false' ? false : value))
  @IsBoolean()
  disabled?: boolean;
}
class UpdateUserDto {
  @IsOptional() @IsBoolean() disabled?: boolean;
  @IsOptional() @IsEnum(Role) role?: Role;
}

@Roles('ADMIN')
@Controller('admin')
export class AdminController {
  constructor(private readonly admin: AdminService) {}
  @Get('stats') stats() {
    return this.admin.stats();
  }
  @Get('users') users(@Query() q: UserListQuery) {
    return this.admin.listUsers(q);
  }
  @Patch('users/:id') update(
    @CurrentUser() u: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() b: UpdateUserDto,
  ) {
    return this.admin.updateUser(u.id, id, b);
  }
}
