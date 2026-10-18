import { Controller, Get } from '@nestjs/common';
import { Public } from '../common/public.decorator';

@Public()
@Controller('health')
export class HealthController {
  @Get()
  get() {
    return { status: 'ok' };
  }
}
