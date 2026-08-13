import { Module } from '@nestjs/common';
import { SessionService } from './session.service';
import Redis from 'ioredis';

@Module({
  providers: [SessionService, Redis],
  exports : [SessionService]
})
export class SessionModule {}
