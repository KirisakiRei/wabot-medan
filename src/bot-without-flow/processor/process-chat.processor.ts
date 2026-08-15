import { Processor, WorkerHost } from "@nestjs/bullmq";
import { DelayedError, Job } from "bullmq";
import { BotWebhookPayload } from "src/bot-webhook/bot-webhook.dto";
import { BotWithoutFlowService } from "src/bot-without-flow/bot-without-flow.service";
import { LoggerService } from "src/logger/logger.service";
import Redis from "ioredis";

@Processor('ai-chat', { concurrency: 50 })
export class ProcessChatProcessor extends WorkerHost {

    constructor(
        private readonly botService: BotWithoutFlowService,
        private readonly loggerService: LoggerService,
        private readonly redis: Redis
    ) {
        super();
    }

    async process(job: Job, token?: string): Promise<any> {
        const payload: BotWebhookPayload = job.data;
        const phoneNumber = payload.phone_number;

        if (!phoneNumber) {
            return;
        }

        const lockKey = `lock:user:${phoneNumber}`;
        const lockTtlSec = 90;
        const requeueMs = 2000;

        // Per-user mutex: satu turn aktif per nomor agar konteks & balasan berurutan.
        // Bila lock sibuk, job di-delay ulang TANPA mengonsumsi attempts (DelayedError).
        const acquired = await this.redis.set(lockKey, "locked", "EX", lockTtlSec, "NX");

        if (!acquired) {
            this.loggerService.log(
                `User ${phoneNumber} sedang aktif pada turn lain. Menunda eksekusi pesan...`,
                ProcessChatProcessor.name
            );
            if (token) {
                await job.moveToDelayed(Date.now() + requeueMs, token);
                throw new DelayedError();
            }
            // Fallback bila token worker tidak tersedia (seharusnya jarang)
            throw new Error(`Lock untuk ${phoneNumber} sedang sibuk, retry...`);
        }

        // Heartbeat: perpanjang TTL lock selama turn masih berjalan (LLM/typing bisa lama)
        const heartbeat = setInterval(() => {
            this.redis.expire(lockKey, lockTtlSec).catch(() => undefined);
        }, 30_000);

        try {
            this.loggerService.log(
                `Memulai proses chat untuk nomor ${phoneNumber}: "${(payload.message || "").slice(0, 80)}"`,
                ProcessChatProcessor.name
            );

            switch (job.name) {
                case "ai-chat":
                    await this.botService.sendChatService(payload);
                    this.loggerService.log(
                        `Selesai proses chat untuk nomor ${phoneNumber}`,
                        ProcessChatProcessor.name
                    );
                    break;
                default:
                    this.loggerService.warn(
                        `No handler for job: ${job.name}`,
                        ProcessChatProcessor.name
                    );
            }
        } catch (error: any) {
            this.loggerService.error(
                `Gagal proses chat untuk ${phoneNumber}: ${error?.message || error}`,
                error?.stack,
                ProcessChatProcessor.name
            );
            throw error;
        } finally {
            clearInterval(heartbeat);
            await this.redis.del(lockKey);
        }
    }
}
