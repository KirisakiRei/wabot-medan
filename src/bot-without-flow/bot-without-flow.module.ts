import { forwardRef, Module } from '@nestjs/common';
import { BotWithoutFlowController } from './bot-without-flow.controller';
import { PengaduanModule } from './pengaduan/pengaduan.module';
import { SistemInformasiModule } from './sistem-informasi/sistem-informasi.module';
import { UsulanModule } from './usulan/usulan.module';
import { BotWithoutFlowService } from './bot-without-flow.service';
import { SistemInformasiService } from './sistem-informasi/sistem-informasi.service';
import { PengaduanService } from './pengaduan/pengaduan.service';
import { UsulanService } from './usulan/usulan.service';
import { CacheModule } from '@nestjs/cache-manager';
import { WhatsappModule } from 'src/whatsapp/whatsapp.module';
import { WhatsappService } from 'src/whatsapp/whatsapp.service';
import { SessionModule } from './session/session.module';
import { AiModule } from './ai/ai.module';
import { QueueModule } from './queue/queue.module';
import Redis from 'ioredis';
import { ProcessChatProcessor } from './processor/process-chat.processor';
import { GenerateRagProcessor } from './processor/generate-rag.processor';
import { GenerateBanksProcessor } from './processor/generate-banks.processor';
import { NanobotModule } from './nanobot/nanobot.module';
import { IntegrationApiController } from './api/integration-api.controller';
import { InformationApiController } from './api/information-api.controller';
import { ProposalApiController } from './api/proposal-api.controller';
import { NanobotAuthGuard } from './api/nanobot-auth.guard';
import { NanobotApiService } from './api/nanobot-api.service';
import { ChannelService } from 'src/channel/channel.service';
import { TelegramModule } from 'src/telegram/telegram.module';

@Module({
  controllers: [BotWithoutFlowController, IntegrationApiController, InformationApiController, ProposalApiController],
  imports: [PengaduanModule, SistemInformasiModule, UsulanModule, CacheModule.register(), WhatsappModule, SessionModule, AiModule, QueueModule, NanobotModule, TelegramModule],
  providers: [BotWithoutFlowService, SistemInformasiService, PengaduanService, UsulanService, WhatsappService, Redis, ProcessChatProcessor, GenerateRagProcessor, GenerateBanksProcessor, NanobotAuthGuard, NanobotApiService, ChannelService],
  exports: [BotWithoutFlowService, ProcessChatProcessor, GenerateRagProcessor, GenerateBanksProcessor]
})
export class BotWithoutFlowModule { }
