import { Module } from '@nestjs/common';
import { ChildModule } from '../child/child.module';
import { NutritionController } from './nutrition.controller';

@Module({ imports: [ChildModule], controllers: [NutritionController] })
export class NutritionModule {}
