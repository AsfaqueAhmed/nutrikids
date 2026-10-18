import { Module } from '@nestjs/common';
import { ChildModule } from '../child/child.module';
import { PlanController } from './plan.controller';
import { PlanService } from './plan.service';
import { RecipeController } from './recipe.controller';

@Module({
  imports: [ChildModule],
  controllers: [PlanController, RecipeController],
  providers: [PlanService],
  exports: [PlanService],
})
export class MealModule {}
