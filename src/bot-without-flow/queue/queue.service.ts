import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import Redis from 'ioredis';
import { BotWebhookPayload } from 'src/bot-webhook/bot-webhook.dto';
import { GenerateBank, QuestionRagPayload, RequestRagPayload } from '../types/validation.types';
import { LoggerService } from 'src/logger/logger.service';

/** Pending messages per user (FIFO, satu pesan = satu balasan). */
export const chatPendingKey = (phone: string) => `chat-pending:${phone}`;
/** Marker: ada worker drain aktif untuk user ini. */
export const chatDrainKey = (phone: string) => `chat-drain:${phone}`;

@Injectable()
export class QueueService {

    constructor(
        @InjectQueue('ai-chat') private aiChatQueue: Queue,
        @InjectQueue('generate-rag') private generateRagQueue: Queue,
        @InjectQueue('generate-question-request') private generateQuestionRequestQueue: Queue,
        private readonly loggerService: LoggerService,
        private readonly redis: Redis,
    ) {}

    /**
     * Ingress chat: push pesan ke list per-user, lalu pastikan ada 1 job drain.
     * Tidak ada delay debounce — worker memproses FIFO secepat mungkin.
     */
    async addQueue(name: string, data: BotWebhookPayload) {
        if (!data.phone_number) return;

        const phone = data.phone_number;
        const pendingKey = chatPendingKey(phone);
        const drainKey = chatDrainKey(phone);

        try {
            await this.redis.rpush(pendingKey, JSON.stringify(data));
            await this.redis.expire(pendingKey, 600);

            const depth = await this.redis.llen(pendingKey);
            this.loggerService.log(
                `Pesan masuk antrian user ${phone} (depth=${depth}): "${(data.message || "").slice(0, 80)}"`,
                `QueueService/addQueue`
            );

            // Coba mulai drain. Jika sudah ada drain aktif, pesan akan diambil di loop berikutnya.
            const started = await this.redis.set(drainKey, "1", "EX", 180, "NX");
            if (!started) {
                return;
            }

            await this.aiChatQueue.add(
                name,
                { phone_number: phone },
                {
                    attempts: 3,
                    backoff: { type: "fixed", delay: 1000 },
                    removeOnComplete: true,
                    removeOnFail: 100,
                }
            );

            this.loggerService.log(
                `Drain job dijalankan untuk ${phone}`,
                `QueueService/addQueue`
            );
        } catch (err) {
            // Jangan biarkan pesan tertahan di list tanpa drain
            await this.redis.del(drainKey).catch(() => undefined);
            this.loggerService.error(
                `Error addQueue untuk ${phone}: ${err}`,
                `QueueService/addQueue`
            );
        }
    }

    async addGenerateRagQueue(name: string, data: QuestionRagPayload | RequestRagPayload) {
        await this.generateRagQueue.add(name, data, {
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
