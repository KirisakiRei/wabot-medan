import { forwardRef, Module } from '@nestjs/common';
import { SistemInformasiService } from './sistem-informasi.service';
import { WhatsappModule } from 'src/whatsapp/whatsapp.module';
import { LoggerService } from 'src/logger/logger.service';
import { AiModule } from '../ai/ai.module';
import { AiService } from '../ai/ai.service';
import { PrismaService } from 'src/prisma/prisma.service';

@Module({
  imports : [WhatsappModule, AiModule],
  providers: [SistemInformasiService, LoggerService, AiService, PrismaService],
  exports : [SistemInformasiService]
})
export class SistemInformasiModule {}
