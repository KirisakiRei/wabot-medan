import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Job } from "bullmq";
import { BotWebhookPayload } from "src/bot-webhook/bot-webhook.dto";
import { BotWithoutFlowService } from "src/bot-without-flow/bot-without-flow.service";
import {
    chatDrainKey,
    chatPendingKey,
} from "src/bot-without-flow/queue/queue.service";
import { LoggerService } from "src/logger/logger.service";
import Redis from "ioredis";

type DrainJobData = {
    phone_number: string;
};

@Processor("ai-chat", { concurrency: 50 })
export class ProcessChatProcessor extends WorkerHost {

    constructor(
        private readonly botService: BotWithoutFlowService,
        private readonly loggerService: LoggerService,
        private readonly redis: Redis
    ) {
        super();
    }

    async process(job: Job): Promise<any> {
        const phoneNumber = (job.data as DrainJobData | BotWebhookPayload)?.phone_number;

        if (!phoneNumber) {
            return;
        }

        const pendingKey = chatPendingKey(phoneNumber);
        const drainKey = chatDrainKey(phoneNumber);

        const heartbeat = setInterval(() => {
            this.redis.expire(drainKey, 180).catch(() => undefined);
        }, 30_000);

        try {
            this.loggerService.log(
                `Drain mulai untuk ${phoneNumber}`,
                ProcessChatProcessor.name
            );

            let processed = 0;

            // Loop hingga antrian user benar-benar kosong (termasuk race pesan masuk di akhir)
            for (;;) {
                const raw = await this.redis.lpop(pendingKey);

                if (!raw) {
                    // Lepas marker drain, lalu cek race: pesan baru antara lpop kosong dan del
                    await this.redis.del(drainKey);
                    const leftover = await this.redis.llen(pendingKey);
                    if (leftover > 0) {
                        const claimed = await this.redis.set(drainKey, "1", "EX", 180, "NX");
                        if (claimed) {
                            this.loggerService.log(
                                `Sisa ${leftover} pesan untuk ${phoneNumber}, lanjut drain`,
                                ProcessChatProcessor.name
                            );
                            continue;
                        }
                    }
                    break;
                }

                let payload: BotWebhookPayload;
                try {
                    payload = JSON.parse(raw) as BotWebhookPayload;
                } catch {
                    this.loggerService.warn(
                        `Payload rusak di antrian ${phoneNumber}, dilewati`,
                        ProcessChatProcessor.name
                    );
                    continue;
                }

                if (!payload.phone_number) {
                    payload.phone_number = phoneNumber;
                }

                processed += 1;
                this.loggerService.log(
                    `Proses #${processed} untuk ${phoneNumber}: "${(payload.message || "").slice(0, 80)}"`,
                    ProcessChatProcessor.name
                );

                try {
                    await this.botService.sendChatService(payload);
                } catch (error: any) {
                    this.loggerService.error(
                        `Gagal proses pesan untuk ${phoneNumber}: ${error?.message || error}`,
                        error?.stack,
                        ProcessChatProcessor.name
                    );
                }

                await this.redis.expire(pendingKey, 600).catch(() => undefined);
            }

            this.loggerService.log(
                `Drain selesai untuk ${phoneNumber} (diproses=${processed})`,
                ProcessChatProcessor.name
            );
        } finally {
            clearInterval(heartbeat);
            // Pastikan marker tidak nyangkut bila error di luar loop
            await this.redis.del(drainKey).catch(() => undefined);
        }
    }
}
