import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import { LoggerService } from 'src/logger/logger.service';
import { QueueService } from 'src/bot-without-flow/queue/queue.service';
import { BotWebhookPayload } from 'src/bot-webhook/bot-webhook.dto';
import { TelegramService } from './telegram.service';
import { TelegramUpdate } from './telegram.types';

@Injectable()
export class TelegramPollingService implements OnModuleInit, OnModuleDestroy {
    private readonly bot: AxiosInstance;
    private readonly token: string;
    private readonly isPollingEnabled: boolean;
    private isRunning: boolean = false;
    private offset: number = 0;

    constructor(
        private readonly logger: LoggerService,
        private readonly queueService: QueueService,
        private readonly telegramService: TelegramService
    ) {
        this.token = process.env.TELEGRAM_BOT_TOKEN || "";
        this.isPollingEnabled = (process.env.TELEGRAM_POLLING_MODE || "false").toLowerCase() === "true" ||
            process.env.BOT_PLATFORM === "telegram-polling";

        this.bot = axios.create({
            baseURL: `https://api.telegram.org/bot${this.token}`,
            timeout: 35000,
            headers: {
                "Content-Type": "application/json"
            }
        });
    }

    async onModuleInit() {
        if (!this.token) {
            this.logger.log("TELEGRAM_BOT_TOKEN tidak diatur. Telegram polling dilewati.", TelegramPollingService.name);
            return;
        }

        if (!this.isPollingEnabled) {
            this.logger.log("Telegram Polling Mode non-aktif (menggunakan mode Webhook bawaan).", TelegramPollingService.name);
            return;
        }

        this.logger.log("Memulai Telegram Long Polling (Development Mode)...", TelegramPollingService.name);
        this.isRunning = true;

        // 1. Hapus webhook aktif (jika ada) agar Telegram mengizinkan getUpdates
        await this.deleteWebhookSafe();

        // 2. Jalankan polling loop di background tanpa memblokir startup NestJS
        this.startPollingLoop().catch((err) => {
            this.logger.error(`Fatal error pada loop Telegram polling: ${err}`, err?.stack, TelegramPollingService.name);
        });
    }

    onModuleDestroy() {
        this.isRunning = false;
        this.logger.log("Menghentikan Telegram Long Polling...", TelegramPollingService.name);
    }

    private async deleteWebhookSafe(): Promise<void> {
        try {
            await this.bot.post("/deleteWebhook", { drop_pending_updates: true });
            this.logger.log("Webhook Telegram berhasil di-clear untuk mode Polling.", TelegramPollingService.name);
        } catch (error: any) {
            this.logger.warn(`Gagal menghapus webhook Telegram: ${error?.message || error}`, TelegramPollingService.name);
        }
    }

    private formatWIB(timestampSec?: number): string {
        const date = timestampSec ? new Date(timestampSec * 1000) : new Date();
        const opts: Intl.DateTimeFormatOptions = {
            timeZone: 'Asia/Jakarta',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
        };
        const parts = new Intl.DateTimeFormat('en-GB', opts).formatToParts(date);
        const map = Object.fromEntries(parts.map(p => [p.type, p.value]));
        return `${map.hour}:${map.minute} WIB`;
    }

    private async startPollingLoop(): Promise<void> {
        while (this.isRunning) {
            try {
                const response = await this.bot.get<{ ok: boolean; result: TelegramUpdate[] }>("/getUpdates", {
                    params: {
                        offset: this.offset,
                        timeout: 25,
                    }
                });

                const count = response.data?.result?.length || 0;
                if (count > 0) {
                    this.logger.log(`[Polling] Menerima ${count} update dari Telegram (offset=${this.offset})`, TelegramPollingService.name);
                }

                if (response.data && response.data.ok && Array.isArray(response.data.result)) {
                    for (const update of response.data.result) {
                        // Geser offset agar update yang sama tidak diambil berulang
                        this.offset = update.update_id + 1;
                        await this.handleIncomingUpdate(update);
                    }
                }
            } catch (error: any) {
                if (!this.isRunning) break;

                // Tangani error jaringan / 409 Conflict dengan jeda backoff
                const statusCode = error?.response?.status;
                if (statusCode === 409) {
                    this.logger.error("Conflict 409: Ada instance lain yang sedang melakukan polling ke token ini. Menunggu 10 detik...", TelegramPollingService.name);
                    await this.sleep(10000);
                } else {
                    this.logger.warn(`Koneksi Telegram polling terputus: ${error?.message || error}. Mencoba ulang dalam 3 detik...`, TelegramPollingService.name);
                    await this.sleep(3000);
                }
            }
        }
    }

    private async handleIncomingUpdate(update: TelegramUpdate): Promise<void> {
        const message = update.message || update.edited_message;
        if (!message) return;

        const chatId = String(message.chat.id);
        const captionOrText = message.text || message.caption || "";

        let mediaUrl: string | null = null;
        if (message.photo && message.photo.length > 0) {
            const largest = message.photo[message.photo.length - 1];
            mediaUrl = await this.telegramService.getFileUrl(largest.file_id);
        } else if (message.document) {
            mediaUrl = await this.telegramService.getFileUrl(message.document.file_id);
        }

        let messageText = captionOrText;
        if (message.location) {
            messageText = `${message.location.latitude}, ${message.location.longitude}`;
        } else if (mediaUrl) {
            messageText = mediaUrl;
        }

        const payload: BotWebhookPayload = {
            message_id: String(update.update_id),
            phone_number: chatId,
            message: messageText,
            webhook_room: "",
            author: message.chat.first_name || message.from?.first_name || "",
            caption: captionOrText,
            time: this.formatWIB(message.date)
        };

        if (!payload.message) return;

        this.logger.log(
            `[Polling] Pesan masuk dari Telegram user ${chatId}: ${payload.message.slice(0, 100)}`,
            TelegramPollingService.name
        );
        await this.queueService.addQueue("ai-chat", payload);
    }

    private sleep(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
}
