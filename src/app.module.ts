import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { BotWebhookModule } from './bot-webhook/bot-webhook.module';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { ActiveRequest } from './active-request/active-request';
import { ZonaParkirPrismaModule } from './zona-parkir-prisma/zona-parkir-prisma.module';
import { ZonaParkir } from './active-request/zona-parkir/zona-parkir';
import { BotWithoutFlowModule } from './bot-without-flow/bot-without-flow.module';
import { LoggerModule } from './logger/logger.module';
import { WhatsappModule } from './whatsapp/whatsapp.module';
import { AiModule } from './ai/ai.module';
import { TelegramModule } from './telegram/telegram.module';

@Module({
  imports: [
    PrismaModule, 
    BotWebhookModule,
    // Config dulu agar REDIS_* terbaca sebelum BullMQ connect
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST || "localhost",
        port: parseInt(process.env.REDIS_PORT || "6379", 10),
        maxRetriesPerRequest: null,
      },
    }),
    ThrottlerModule.forRoot({
      throttlers: [
        {
          ttl: 60000,
          limit: 10,
        },
      ],
    }),
    ZonaParkirPrismaModule,
    BotWithoutFlowModule,
    LoggerModule,
    WhatsappModule,
    AiModule,
    TelegramModule,
  ],
  controllers: [AppController],
  providers: [AppService, ActiveRequest, ZonaParkir],
})
export class AppModule { }
