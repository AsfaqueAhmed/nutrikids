import {
  ActivityLevel,
  Allergen,
  DietType,
  FeedingType,
  Gender,
  Severity,
} from '@prisma/client';
import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  registerDecorator,
  ValidationOptions,
} from 'class-validator';

function NotFuture(opts?: ValidationOptions) {
  return (obj: object, prop: string) =>
    registerDecorator({
      name: 'notFuture',
      target: obj.constructor,
      propertyName: prop,
      options: opts,
      validator: {
        validate: (v: string) => new Date(v).getTime() <= Date.now(),
        defaultMessage: () => '$property cannot be in the future',
      },
    });
}

export class CreateChildDto {
  @IsString() @MinLength(1) @MaxLength(80) name!: string;
  @IsDateString() @NotFuture() dateOfBirth!: string;
  @IsEnum(Gender) gender!: Gender;
  @IsOptional() @IsNumber() @Min(20) @Max(250) heightCm?: number;
  @IsOptional() @IsNumber() @Min(0.5) @Max(200) weightKg?: number;
  @IsOptional() @IsEnum(ActivityLevel) activityLevel?: ActivityLevel;
  @IsOptional() @IsEnum(DietType) dietType?: DietType;
  @IsOptional() @IsString() photoUrl?: string;
}

export class UpdateChildDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(80) name?: string;
  @IsOptional() @IsDateString() @NotFuture() dateOfBirth?: string;
  @IsOptional() @IsEnum(Gender) gender?: Gender;
  @IsOptional() @IsNumber() @Min(20) @Max(250) heightCm?: number;
  @IsOptional() @IsNumber() @Min(0.5) @Max(200) weightKg?: number;
  @IsOptional() @IsEnum(ActivityLevel) activityLevel?: ActivityLevel;
  @IsOptional() @IsEnum(DietType) dietType?: DietType;
  @IsOptional() @IsString() photoUrl?: string;
}

export class AllergyDto {
  @IsEnum(Allergen) allergen!: Allergen;
  @IsEnum(Severity) severity!: Severity;
}
export class ConditionsDto {
  @IsArray() @ArrayMaxSize(30) @IsString({ each: true }) names!: string[];
}
export class DislikesDto {
  @IsArray()
  @ArrayMaxSize(100)
  @IsUUID('all', { each: true })
  foodIds!: string[];
}

export class FeedingLogDto {
  @IsEnum(FeedingType) type!: FeedingType;
  @IsDateString() at!: string;
  @IsOptional() @IsInt() @Min(0) @Max(600) durationMinutes?: number;
  @IsOptional() @IsString() @MaxLength(500) notes?: string;
  @IsDateString() clientUpdatedAt!: string;
}

export class FoodIntroductionDto {
  @IsUUID() foodId!: string;
  @IsDateString() introducedOn!: string;
  @IsOptional() @IsString() @MaxLength(300) reaction?: string;
  @IsOptional() @IsString() @MaxLength(500) notes?: string;
  @IsDateString() clientUpdatedAt!: string;
}

export class FeedingQuery {
  @IsOptional() @IsDateString() from?: string;
  @IsOptional() @IsDateString() to?: string;
  @IsOptional() @IsDateString() updatedSince?: string;
}
