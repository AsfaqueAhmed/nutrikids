import { Module } from '@nestjs/common';
import { FoodModule } from '../food/food.module';
import { ChildAccessService } from './child-access.service';
import { ChildController } from './child.controller';
import { ChildService } from './child.service';

@Module({
  imports: [FoodModule],
  controllers: [ChildController],
  providers: [ChildService, ChildAccessService],
  exports: [ChildAccessService],
})
export class ChildModule {}
