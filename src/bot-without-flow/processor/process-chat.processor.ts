import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Job } from "bullmq";
import { BotWebhookPayload } from "src/bot-webhook/bot-webhook.dto";
import { BotWithoutFlowService } from "src/bot-without-flow/bot-without-flow.service";
import { LoggerService } from "src/logger/logger.service";
import Redis from "ioredis";

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
        const payload: BotWebhookPayload = job.data;
        const phoneNumber = payload.phone_number;

        if (!phoneNumber) {
            return;
        }

        const lockKey = `lock:user:${phoneNumber}`;

        // 1. Per-User Mutex Lock (TTL 60 detik) untuk mencegah race condition
        // jika 2 pesan dari user yang sama diproses secara paralel
        const acquired = await this.redis.set(lockKey, "locked", "EX", 60, "NX");

        if (!acquired) {
            this.loggerService.log(`User ${phoneNumber} sedang aktif diproses LLM. Menunda eksekusi pesan berikutnya 2 detik...`);
            if (token) {
                await job.moveToDelayed(Date.now() + 2000, token);
                return;
            } else {
                throw new Error(`Lock untuk ${phoneNumber} sedang sibuk, menjadwalkan ulang...`);
            }
        }

        try {
            await this.loggerService.log(`Memulai proses chat untuk nomor ${phoneNumber}`);

            // 2. Ambil dan agregasikan seluruh pesan dalam buffer debounce
            const bufferKey = `chat-buffer:${phoneNumber}`;
            const rawMessages = await this.redis.lrange(bufferKey, 0, -1);
            await this.redis.del(bufferKey);

            const mergedPayload = this.aggregateBufferedMessages(payload, rawMessages);

            switch (job.name) {
                case "ai-chat":
                    await this.botService.sendChatService(mergedPayload);
                    break;
                default:
                    this.loggerService.warn(`No handler for job: ${job.name}`, ProcessChatProcessor.name);
            }
        } finally {
            // Lepaskan lock setelah proses selesai
            await this.redis.del(lockKey);
        }
    }

    /**
     * Menggabungkan rentetan pesan chat yang dikirim cepat dalam rentang debounce window.
     */
    private aggregateBufferedMessages(initialPayload: BotWebhookPayload, rawMessages: string[]): BotWebhookPayload {
        if (!rawMessages || rawMessages.length <= 1) {
            return initialPayload;
        }

        const parsedList: BotWebhookPayload[] = [];
        for (const raw of rawMessages) {
            try {
                parsedList.push(JSON.parse(raw));
            } catch {
                // Abaikan jika ada item rusak
            }
        }

        if (parsedList.length === 0) {
            return initialPayload;
        }

        // Ambil pesan terakhir sebagai base (author, timestamp terbaru)
        const lastPayload = parsedList[parsedList.length - 1];

        // Kumpulkan seluruh teks chat / caption yang masuk
        const textParts: string[] = [];
        let mediaPayload: BotWebhookPayload | null = null;

        for (const item of parsedList) {
            const isMedia = item.message && (item.message.startsWith("http://") || item.message.startsWith("https://"));
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
