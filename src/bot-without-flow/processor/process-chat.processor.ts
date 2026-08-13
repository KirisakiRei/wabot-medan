import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Job } from "bullmq";
import { BotWebhookPayload } from "src/bot-webhook/bot-webhook.dto";
import { BotWithoutFlowService } from "src/bot-without-flow/bot-without-flow.service";
import { LoggerService } from "src/logger/logger.service";

@Processor('ai-chat', { concurrency: 100 })
export class ProcessChatProcessor extends WorkerHost {

    constructor(
        private readonly botService: BotWithoutFlowService,
        private readonly loggerService: LoggerService
    ) {
        super();
    }

    async process(job: Job, token?: string): Promise<any> {
        const payload: BotWebhookPayload = job.data;
        await this.loggerService.log(`Memulai proses chat untuk nomor ${payload.phone_number}`);

        switch (job.name) {
            case "ai-chat":
                await this.botService.sendChatService(payload);
                break;
            default:
                this.loggerService.warn(`No handler for job: ${job.name}`, ProcessChatProcessor.name);
        }
    }
}