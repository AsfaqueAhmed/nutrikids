import { Module } from '@nestjs/common';
import { ChildModule } from '../child/child.module';
import { AdminVaccineController } from './admin-vaccine.controller';
import { AdminVaccineService } from './admin-vaccine.service';
import { VaccinationController } from './vaccination.controller';
import { VaccinationService } from './vaccination.service';

@Module({
  imports: [ChildModule],
  controllers: [VaccinationController, AdminVaccineController],
  providers: [VaccinationService, AdminVaccineService],
  exports: [VaccinationService],
})
export class VaccinationModule {}
