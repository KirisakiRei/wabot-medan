import { Module } from '@nestjs/common';
import { WhatsappService } from './whatsapp.service';
import { LoggerService } from 'src/logger/logger.service';

@Module({
  providers: [WhatsappService, LoggerService]
})
export class WhatsappModule {}
