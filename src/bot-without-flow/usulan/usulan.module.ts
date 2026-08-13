import { Module } from '@nestjs/common';
import { UsulanService } from './usulan.service';
import { CacheModule } from '@nestjs/cache-manager';
import { AiModule } from '../ai/ai.module';
import { AiService } from '../ai/ai.service';
import { ActiveRequest } from 'src/active-request/active-request';
import Redis from 'ioredis';
import { SessionModule } from '../session/session.module';
import { SessionService } from '../session/session.service';

@Module({
  imports: [CacheModule.register(), AiModule, SessionModule],
  providers: [UsulanService, AiService, ActiveRequest, Redis, SessionService],
  exports : [UsulanService, ActiveRequest]
})
export class UsulanModule {}
