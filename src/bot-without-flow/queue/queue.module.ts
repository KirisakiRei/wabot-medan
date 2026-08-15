import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { QueueService } from './queue.service';
import Redis from 'ioredis';

/**
 * Queue ai-chat / generate-* memakai connection default BullModule.forRoot
 * (satu Redis DB dengan worker) agar job tidak "nyangkut" di DB terpisah
 * yang tidak di-listen worker.
 *
 * Isolasi db 5/6/7 sebelumnya bisa membuat producer menulis ke db 5
 * sementara worker ikut forRoot (db 0) → job tertunda lama / tidak diproses.
 */
@Module({
    imports: [
        BullModule.registerQueue({ name: "ai-chat" }),
        BullModule.registerQueue({ name: "generate-rag" }),
        BullModule.registerQueue({ name: "generate-question-request" }),
    ],
    providers: [
        QueueService,
        {
            provide: Redis,
            useFactory: () => {
                return new Redis({
                    host: process.env.REDIS_HOST || "localhost",
                    port: parseInt(process.env.REDIS_PORT || "6379", 10),
                    maxRetriesPerRequest: null,
                    enableReadyCheck: false,
                });
            },
        },
    ],
    exports: [QueueService, BullModule, Redis],
})
export class QueueModule {}
