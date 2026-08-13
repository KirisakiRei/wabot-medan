import { Module } from '@nestjs/common';
import { NanobotClientService } from './nanobot-client.service';

@Module({
  providers: [NanobotClientService],
  exports: [NanobotClientService]
})
export class NanobotModule {}
