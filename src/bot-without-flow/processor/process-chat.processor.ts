import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Job } from "bullmq";
import { BotWebhookPayload } from "src/bot-webhook/bot-webhook.dto";
import { BotWithoutFlowService } from "src/bot-without-flow/bot-without-flow.service";
import { LoggerService } from "src/logger/logger.service";
import Redis from "ioredis";

type ChatJobPayload = BotWebhookPayload & {
    debounceToken?: string;
};

@Processor('ai-chat', { concurrency: 100 })
export class ProcessChatProcessor extends WorkerHost {

    constructor(
        private readonly botService: BotWithoutFlowService,
        private readonly loggerService: LoggerService,
        private readonly redis: Redis
    ) {
        super();
    }

    async process(job: Job, token?: string): Promise<any> {
        const payload: ChatJobPayload = job.data;
        const phoneNumber = payload.phone_number;

        if (!phoneNumber) {
            return;
        }

        // 0. Debounce gate: hanya job dengan token terbaru yang boleh jalan.
        // Job lama (dari pesan cepat sebelumnya) di-skip tanpa error.
        const debounceKey = `chat-debounce:${phoneNumber}`;
        if (payload.debounceToken) {
            const currentToken = await this.redis.get(debounceKey);
            if (currentToken && currentToken !== payload.debounceToken) {
                this.loggerService.log(
                    `Skip job stale untuk ${phoneNumber} (token lama, ada pesan lebih baru)`,
                    ProcessChatProcessor.name
                );
                return;
            }
        }

        const lockKey = `lock:user:${phoneNumber}`;

        // 1. Per-User Mutex Lock (TTL 90 detik) — LLM + typing bisa > 60 detik
        const acquired = await this.redis.set(lockKey, "locked", "EX", 90, "NX");

        if (!acquired) {
            this.loggerService.log(
                `User ${phoneNumber} sedang diproses. Menunda 3 detik...`,
                ProcessChatProcessor.name
            );
            if (token) {
                await job.moveToDelayed(Date.now() + 3000, token);
                return;
            }
            throw new Error(`Lock untuk ${phoneNumber} sedang sibuk, retry...`);
        }

        try {
            this.loggerService.log(
                `Memulai proses chat untuk nomor ${phoneNumber}`,
                ProcessChatProcessor.name
            );

            // 2. Ambil dan agregasikan seluruh pesan dalam buffer debounce
            const bufferKey = `chat-buffer:${phoneNumber}`;
            const rawMessages = await this.redis.lrange(bufferKey, 0, -1);
            await this.redis.del(bufferKey);

            // Bersihkan token debounce agar job follow-up berikutnya tidak tertahan
            await this.redis.del(debounceKey);

            const { debounceToken: _token, ...cleanPayload } = payload;
            const mergedPayload = this.aggregateBufferedMessages(cleanPayload, rawMessages);

            switch (job.name) {
                case "ai-chat":
                    await this.botService.sendChatService(mergedPayload);
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
            await this.redis.del(lockKey);
        }
    }

    /**
     * Menggabungkan rentetan pesan chat yang dikirim cepat dalam rentang debounce window.
     */
    private aggregateBufferedMessages(
        initialPayload: BotWebhookPayload,
        rawMessages: string[]
    ): BotWebhookPayload {
        if (!rawMessages || rawMessages.length === 0) {
            return initialPayload;
        }

        if (rawMessages.length === 1) {
            try {
                return JSON.parse(rawMessages[0]) as BotWebhookPayload;
            } catch {
                return initialPayload;
            }
        }

        const parsedList: BotWebhookPayload[] = [];
        for (const raw of rawMessages) {
            try {
                parsedList.push(JSON.parse(raw));
            } catch {
                // Abaikan item rusak
            }
        }

        if (parsedList.length === 0) {
            return initialPayload;
        }

        const lastPayload = parsedList[parsedList.length - 1];
        const textParts: string[] = [];
        let mediaPayload: BotWebhookPayload | null = null;

        for (const item of parsedList) {
            const isMedia =
                item.message &&
                (item.message.startsWith("http://") || item.message.startsWith("https://"));
            if (isMedia) {
                mediaPayload = item;
                if (item.caption && item.caption.trim()) {
                    textParts.push(item.caption.trim());
                }
            } else if (item.message && item.message.trim()) {
                textParts.push(item.message.trim());
            }
        }

        const combinedText = textParts.join("\n");

        if (mediaPayload) {
            return {
                ...lastPayload,
                message: mediaPayload.message,
                caption: combinedText || mediaPayload.caption,
            };
        }

        return {
            ...lastPayload,
            message: combinedText || lastPayload.message,
            caption: combinedText || lastPayload.caption,
        };
    }
}
