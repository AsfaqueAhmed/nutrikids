import { Body, Controller, Delete, Get, HttpCode, Patch } from '@nestjs/common';
import { IsString } from 'class-validator';
import { type AuthUser, CurrentUser } from '../common/current-user';
import { UserService } from './user.service';

class UpdateMeDto {
  @IsString() timezone!: string;
}

@Controller('me')
export class UserController {
  constructor(private readonly users: UserService) {}
  @Get() me(@CurrentUser() u: AuthUser) {
    return this.users.me(u.id);
  }
  @Patch() update(@CurrentUser() u: AuthUser, @Body() b: UpdateMeDto) {
    return this.users.setTimezone(u.id, b.timezone);
  }
  @Get('export') export(@CurrentUser() u: AuthUser) {
    return this.users.export(u.id);
  }
  @Delete() @HttpCode(204) async remove(@CurrentUser() u: AuthUser) {
    await this.users.remove(u.id);
  }
}
