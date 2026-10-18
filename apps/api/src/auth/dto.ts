import { IsEmail, IsIn, IsString, MaxLength, MinLength } from 'class-validator';

export class RegisterDto {
  @IsEmail() email!: string;
  @IsString() @MinLength(8) @MaxLength(128) password!: string;
}
export class LoginDto {
  @IsEmail() email!: string;
  @IsString() password!: string;
}
export class RefreshDto {
  @IsString() refreshToken!: string;
}
export class TokenDto {
  @IsString() token!: string;
}
export class ForgotDto {
  @IsEmail() email!: string;
}
export class ResetDto {
  @IsString() token!: string;
  @IsString() @MinLength(8) @MaxLength(128) password!: string;
}
export class SocialDto {
  @IsIn(['google', 'apple']) provider!: 'google' | 'apple';
  @IsString() idToken!: string;
}
