import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import { BotWebhookPayload } from 'src/bot-webhook/bot-webhook.dto';
import { GenerateBank, QuestionRagPayload, RequestRagPayload } from '../types/validation.types';
import { LoggerService } from 'src/logger/logger.service';

@Injectable()
export class QueueService {

    constructor(
        @InjectQueue('ai-chat') private aiChatQueue: Queue,
        @InjectQueue('generate-rag') private generateRagQueue: Queue,
        @InjectQueue('generate-question-request') private generateQuestionRequestQueue: Queue,
        private readonly loggerService: LoggerService,
    ) {}

    /**
     * Mendaftarkan pesan chat masuk ke antrean BullMQ untuk diproses secara interaktif per turn.
     * Tidak menggunakan buffer/coalescing buatan agar setiap pesan pengguna dibalas langsung.
     */
    async addQueue(name: string, data: BotWebhookPayload) {
        if (!data.phone_number) return;

        const phone = data.phone_number;

        try {
            // Tanpa delay buatan — job langsung waiting agar worker memproses secepat mungkin
            await this.aiChatQueue.add(
                name,
                data,
                {
                    attempts: 5,
                    backoff: { type: "fixed", delay: 500 },
                    removeOnComplete: true,
                    removeOnFail: 200,
                }
            );

            this.loggerService.log(
                `Job ${name} masuk antrian segera untuk ${phone}: "${(data.message || "").slice(0, 80)}"`,
                `QueueService/addQueue`
            );
        } catch (err) {
            this.loggerService.error(
                `Error adding job to ${name} queue: ${err}`,
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

