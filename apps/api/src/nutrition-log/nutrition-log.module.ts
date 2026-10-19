import { Module } from '@nestjs/common';
import { ChildModule } from '../child/child.module';
import { NutritionLogController } from './nutrition-log.controller';
import { NutritionLogService } from './nutrition-log.service';

@Module({
  imports: [ChildModule],
  controllers: [NutritionLogController],
  providers: [NutritionLogService],
})
export class NutritionLogModule {}
