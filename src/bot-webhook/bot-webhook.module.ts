import { forwardRef, MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { BotWebhookService } from './bot-webhook.service';
import { BotWebhookController } from './bot-webhook.controller';
import { BullModule } from '@nestjs/bullmq';
import { PrismaService } from 'src/prisma/prisma.service';
import { BotWebhookProcessor } from './bot-webhook.processor';
import { SessionService } from './session/session.service';
import { SessionProcessor } from './session/session.processor';
import { ResponseGeneratorService } from './response-generator/response-generator.service';
import { ActiveRequest } from 'src/active-request/active-request';
import { ActiveRequestMiddleware } from 'src/active-request/active-request.middleware';
import { WaGateWayService } from './wa-gate-way/wa-gate-way.service';
import { CacheModule } from "@nestjs/cache-manager"
import { BannedWordsMiddleware } from 'src/banned-words/banned-words.middleware';
import { PengaduanService } from './pengaduan/pengaduan.service';
import { PengaduanMiddleware } from './pengaduan/pengaduan.middleware';
import { PengaduanActionService } from './pengaduan/pengaduan-action/pengaduan-action.service';
import { SistemInformasiService } from './sistem-informasi/sistem-informasi.service';
import { LayananPublikService } from './layanan-publik/layanan-publik.service';
import { LayananPublikActionService } from './layanan-publik/layanan-publik-action/layanan-publik-action.service';
import { LayananPublikProcessor } from './layanan-publik/layanan-publik.processor';
import { ZonaParkirService } from './zona-parkir/zona-parkir.service';
import { ZonaParkirActionService } from './zona-parkir/zona-parkir-action/zona-parkir-action.service';
import { ZonaParkirProcessor } from './zona-parkir/zona-parkir.processor';
import { ZonaParkirPrismaService } from 'src/zona-parkir-prisma/zona-parkir-prisma.service';
import { ZonaParkir } from 'src/active-request/zona-parkir/zona-parkir';
import { SistemInformasiModule } from 'src/bot-without-flow/sistem-informasi/sistem-informasi.module';


@Module({
  imports: [
    BullModule.registerQueueAsync({
      name: 'chat',
      useFactory: async () => ({
        connection: { host: 'localhost', port: 6379, db: 1 },
      }),
    }),
    BullModule.registerQueueAsync({
      name: 'session',
      useFactory: async () => ({
        connection: { host: 'localhost', port: 6379, db: 2 },
      }),
    }),
    BullModule.registerQueueAsync({
      name: 'layanan-publik',
      useFactory: async () => ({
        connection: { host: 'localhost', port: 6379, db: 3 },
      }),
    }),
    BullModule.registerQueueAsync({
      name: 'zona-parkir',
      useFactory: async () => ({
        connection: { host: 'localhost', port: 6379, db: 4 },
      }),
    }),
    CacheModule.register(),
  ],
  providers: [
    BotWebhookService,
    PrismaService,
    BotWebhookProcessor,
    SessionService,
    SessionProcessor,
    ResponseGeneratorService,
    ActiveRequest,
    WaGateWayService,
    PengaduanService,
    PengaduanActionService,
    SistemInformasiService,
    LayananPublikService,
    LayananPublikActionService,
    LayananPublikProcessor,
    ZonaParkirService,
    ZonaParkirActionService,
    ZonaParkirProcessor,
    ZonaParkirPrismaService,
    ZonaParkir,
  ],
  controllers: [BotWebhookController],
  exports: [
    BotWebhookService,
    BotWebhookProcessor,
    SessionService,
    SessionProcessor,
    LayananPublikProcessor,
    ActiveRequest,
    ZonaParkirProcessor,
    SistemInformasiService,
    BullModule,
    CacheModule
  ],
})
export class BotWebhookModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // consumer.apply(BannedWordsMiddleware).forRoutes({
    //   path: "/bot-webhook/*",
    //   method: RequestMethod.ALL
    // }),
    consumer.apply(ActiveRequestMiddleware).forRoutes({
      path: "/bot-webhook/send-message",
      method: RequestMethod.ALL
    });

    // consumer.apply(PengaduanMiddleware).forRoutes({
    //   path : "/bot-webhook/send-pengaduan/*",
    //   method: RequestMethod.ALL
    // });
  }
}
