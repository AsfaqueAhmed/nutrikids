import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { Public } from '../common/public.decorator';
import { AuthService } from './auth.service';
import {
  ForgotDto,
  LoginDto,
  RefreshDto,
  RegisterDto,
  ResetDto,
  SocialDto,
  TokenDto,
} from './dto';

@Public()
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register') register(@Body() b: RegisterDto) {
    return this.auth.register(b.email, b.password);
  }
  @Post('login') @HttpCode(200) login(@Body() b: LoginDto) {
    return this.auth.login(b.email, b.password);
  }
  @Post('refresh') @HttpCode(200) refresh(@Body() b: RefreshDto) {
    return this.auth.refresh(b.refreshToken);
  }
  @Post('logout') @HttpCode(204) async logout(@Body() b: RefreshDto) {
    await this.auth.logout(b.refreshToken);
  }
  @Post('verify-email') @HttpCode(204) async verify(@Body() b: TokenDto) {
    await this.auth.verifyEmail(b.token);
  }
  @Post('forgot-password') @HttpCode(204) async forgot(@Body() b: ForgotDto) {
    await this.auth.forgotPassword(b.email);
  }
  @Post('reset-password') @HttpCode(204) async reset(@Body() b: ResetDto) {
    await this.auth.resetPassword(b.token, b.password);
  }
  @Post('social') @HttpCode(200) social(@Body() b: SocialDto) {
    return this.auth.social(b.provider, b.idToken);
  }
}
