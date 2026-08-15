import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import { BotWebhookPayload } from 'src/bot-webhook/bot-webhook.dto';
import { GenerateBank, QuestionRagPayload, RequestRagPayload } from '../types/validation.types';
import { LoggerService } from 'src/logger/logger.service';
import Redis from 'ioredis';

@Injectable()
export class QueueService {

    constructor(
        @InjectQueue('ai-chat') private aiChatQueue : Queue,
        @InjectQueue('generate-rag') private generateRagQueue : Queue,
        @InjectQueue('generate-question-request') private generateQuestionRequestQueue : Queue,
        private readonly loggerService : LoggerService,
        private readonly redis: Redis
    ){}

    async addQueue(name: string, data: BotWebhookPayload) {
        if (!data.phone_number) return;

        const bufferKey = `chat-buffer:${data.phone_number}`;
        const debounceMs = parseInt(process.env.CHAT_DEBOUNCE_MS || "2000", 10);

        try {
            // 1. Simpan pesan masuk ke antrean buffer Redis per nomor
            await this.redis.rpush(bufferKey, JSON.stringify(data));
            await this.redis.expire(bufferKey, 60);

            // 2. Jadwalkan job dengan delay debounce window (default 2 detik).
            // jobId deterministik per nomor HP mencegah pembuatan multi-job saat user mengetik beruntun.
            await this.aiChatQueue.add(name, data, {
                jobId: `debounce:${data.phone_number}`,
                delay: debounceMs,
                attempts: 5,
                backoff: { type: 'fixed', delay: 2000 },
                removeOnComplete: 1000,
                removeOnFail: 1000
            });
        } catch (err) {
            this.loggerService.error(`Error adding job to ai-chat queue: ${err}`, `QueueService/addQueue`);
        }
    }

    async addGenerateRagQueue(name: string, data: QuestionRagPayload | RequestRagPayload) {
        await this.generateRagQueue.add(name, data, {
            // Retry sinkronisasi RAG service yang sempat down; idempoten berkat
            // dedup cek existing di processor (variasi yang sudah masuk di-skip).
            attempts: 3,
            backoff: { type: "exponential", delay: 5000 },
            removeOnComplete: 1000,
            removeOnFail: 1000
        }).catch((err) => {
            this.loggerService.error(`Error adding job to generate-rag queue: ${err}`, `QueueService/addGenerateRagQueue`);
        });
    }

    async addGenerateBanks(name : "generate-question" | "generate-request" , data : GenerateBank) {
        await this.generateQuestionRequestQueue.add(name, data).catch((err) => {
            this.loggerService.error(`Error adding job to generate-question-request queue: ${err}`, `QueueService/addGenerateBanks`);
        });
    }
}
