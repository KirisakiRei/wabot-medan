import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { QueueService } from './queue.service';
import Redis from 'ioredis';

@Module({
    imports: [
        BullModule.registerQueueAsync({
            name: "ai-chat",
            useFactory: async () => ({
                connection: { host: "localhost", port: 6379, db: 5 }
            })
        }),
        BullModule.registerQueueAsync({
            name: "generate-rag",
            useFactory: async () => ({
                connection: { host: "localhost", port: 6379, db: 6 }
            })
        }),
        BullModule.registerQueueAsync({
            name : "generate-question-request",
            useFactory: async () => ({
                connection: { host: "localhost", port: 6379, db: 7 }
            })
        })
    ],
    providers: [QueueService, Redis],
    exports: [QueueService, BullModule]
})
export class QueueModule {
}
