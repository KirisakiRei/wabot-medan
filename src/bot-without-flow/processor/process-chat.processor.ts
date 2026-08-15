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
        const lockTtlSec = 120;
        // Requeue cepat agar pesan berikutnya langsung diproses setelah turn aktif selesai
        const requeueMs = 400;
        const workerToken = token || (job as Job & { token?: string }).token;

        // Satu turn aktif per user (hindari race konteks). Pesan lain di-requeue tanpa
        // mengonsumsi attempts (DelayedError), bukan di-delay 2s debounce buatan.
        const acquired = await this.redis.set(lockKey, "locked", "EX", lockTtlSec, "NX");

        if (!acquired) {
            this.loggerService.log(
                `User ${phoneNumber} sedang aktif. Requeue pesan dalam ${requeueMs}ms (tanpa consume attempt)`,
                ProcessChatProcessor.name
            );
            if (workerToken) {
                try {
                    await job.moveToDelayed(Date.now() + requeueMs, workerToken);
                    throw new DelayedError();
                } catch (err: any) {
                    if (err?.name === "DelayedError" || err instanceof DelayedError) {
                        throw err;
                    }
                    // Fallback: retry via attempts (lock BullMQ hilang / token mismatch)
                    this.loggerService.warn(
                        `moveToDelayed gagal untuk ${phoneNumber}: ${err?.message || err}. Fallback retry.`,
                        ProcessChatProcessor.name
                    );
                }
            }
            throw new Error(`Lock untuk ${phoneNumber} sedang sibuk, retry...`);
        }

        const heartbeat = setInterval(() => {
            this.redis.expire(lockKey, lockTtlSec).catch(() => undefined);
        }, 25_000);

        try {
            this.loggerService.log(
                `Memulai proses chat untuk ${phoneNumber}: "${(payload.message || "").slice(0, 80)}"`,
                ProcessChatProcessor.name
            );

            switch (job.name) {
                case "ai-chat":
                    await this.botService.sendChatService(payload);
                    this.loggerService.log(
                        `Selesai proses chat untuk ${phoneNumber}`,
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
