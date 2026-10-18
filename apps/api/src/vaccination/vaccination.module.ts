import { Module } from '@nestjs/common';
import { ChildModule } from '../child/child.module';
import { VaccinationController } from './vaccination.controller';
import { VaccinationService } from './vaccination.service';

@Module({
  imports: [ChildModule],
  controllers: [VaccinationController],
  providers: [VaccinationService],
  exports: [VaccinationService],
})
export class VaccinationModule {}
