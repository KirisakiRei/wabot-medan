import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import { BotWebhookPayload } from 'src/bot-webhook/bot-webhook.dto';
import { GenerateBank, QuestionRagPayload, RequestRagPayload } from '../types/validation.types';
import { LoggerService } from 'src/logger/logger.service';
import { createHash } from 'crypto';

@Injectable()
export class QueueService {

    constructor(
        @InjectQueue('ai-chat') private aiChatQueue : Queue,
        @InjectQueue('generate-rag') private generateRagQueue : Queue,
        @InjectQueue('generate-question-request') private generateQuestionRequestQueue : Queue,
        private readonly loggerService : LoggerService
    ){}

    async addQueue(name: string, data: BotWebhookPayload) {
        const fallbackKey = `${data.phone_number}:${data.message}:${data.caption || ""}:${data.time || ""}`;
        const jobId = data.message_id || createHash('sha256').update(fallbackKey).digest('hex');

        await this.aiChatQueue.add(name, data, {
            jobId,
            removeOnComplete: 1000,
            removeOnFail: 1000
        }).catch((err) => {
            this.loggerService.error(`Error adding job to ai-chat queue: ${err}`, `QueueService/addQueue`);
        });
    }

    async addGenerateRagQueue(name: string, data: QuestionRagPayload | RequestRagPayload) {
        await this.generateRagQueue.add(name,data).catch((err) => {
            this.loggerService.error(`Error adding job to generate-rag queue: ${err}`, `QueueService/addGenerateRagQueue`);
        });
    }

    async addGenerateBanks(name : "generate-question" | "generate-request" , data : GenerateBank) {
        await this.generateQuestionRequestQueue.add(name, data).catch((err) => {
            this.loggerService.error(`Error adding job to generate-question-request queue: ${err}`, `QueueService/addGenerateBanks`);
        });
    }
}
