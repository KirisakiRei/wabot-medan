import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { QueueService } from './queue.service';
import Redis from 'ioredis';

const redisHost = process.env.REDIS_HOST || 'localhost';
const redisPort = parseInt(process.env.REDIS_PORT || '6379', 10);

@Module({
    imports: [
        // Isolasi DB per queue (pola lama bot-webhook) agar job ai-chat
        // tidak bentrok dengan queue chat/session/layanan-publik di db 1-4.
        BullModule.registerQueueAsync({
            name: "ai-chat",
            useFactory: async () => ({
                connection: { host: redisHost, port: redisPort, db: 5 }
            })
        }),
        BullModule.registerQueueAsync({
            name: "generate-rag",
            useFactory: async () => ({
                connection: { host: redisHost, port: redisPort, db: 6 }
            })
        }),
        BullModule.registerQueueAsync({
            name: "generate-question-request",
            useFactory: async () => ({
                connection: { host: redisHost, port: redisPort, db: 7 }
            })
        })
    ],
    providers: [
        QueueService,
        {
            provide: Redis,
            useFactory: () => {
                return new Redis({
                    host: redisHost,
                    port: redisPort,
                    maxRetriesPerRequest: null,
                    enableReadyCheck: false
                });
            }
        }
    ],
    exports: [QueueService, BullModule, Redis]
})
export class QueueModule {
}
