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
        @InjectQueue('ai-chat') private aiChatQueue: Queue,
        @InjectQueue('generate-rag') private generateRagQueue: Queue,
        @InjectQueue('generate-question-request') private generateQuestionRequestQueue: Queue,
        private readonly loggerService: LoggerService,
        private readonly redis: Redis
    ) {}

    /**
     * Debounce per nomor: buffer pesan di Redis, jadwalkan 1 job delayed.
     * Token debounce di Redis memastikan hanya "gelombang" terakhir yang dieksekusi,
     * tanpa jobId BullMQ tetap (yang sering stuck setelah complete/fail).
     */
    async addQueue(name: string, data: BotWebhookPayload) {
        if (!data.phone_number) return;

        const phone = data.phone_number;
        const bufferKey = `chat-buffer:${phone}`;
        const debounceKey = `chat-debounce:${phone}`;
        const debounceMs = parseInt(process.env.CHAT_DEBOUNCE_MS || "2000", 10);
        // TTL token sedikit lebih panjang dari delay agar race kecil tetap aman
        const tokenTtlSec = Math.max(10, Math.ceil(debounceMs / 1000) + 8);

        try {
            // 1. Buffer pesan
            await this.redis.rpush(bufferKey, JSON.stringify(data));
            await this.redis.expire(bufferKey, 120);

            // 2. Token debounce: setiap pesan baru "memenangkan" gelombang
            const token = `${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
            await this.redis.set(debounceKey, token, "EX", tokenTtlSec);

            // 3. Selalu jadwalkan job dengan jobId UNIK (hindari konflik BullMQ)
            await this.aiChatQueue.add(
                name,
                { ...data, debounceToken: token },
                {
                    jobId: `chat:${phone}:${token}`,
                    delay: debounceMs,
                    attempts: 5,
                    backoff: { type: "fixed", delay: 2000 },
                    removeOnComplete: true,
                    removeOnFail: true,
                }
            );

            this.loggerService.log(
                `Job ai-chat dijadwalkan untuk ${phone} (delay ${debounceMs}ms, token=${token})`,
                `QueueService/addQueue`
            );
        } catch (err) {
            this.loggerService.error(
                `Error adding job to ai-chat queue: ${err}`,
                `QueueService/addQueue`
            );
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

    async addGenerateBanks(name: "generate-question" | "generate-request", data: GenerateBank) {
        await this.generateQuestionRequestQueue.add(name, data).catch((err) => {
            this.loggerService.error(`Error adding job to generate-question-request queue: ${err}`, `QueueService/addGenerateBanks`);
        });
    }
}
