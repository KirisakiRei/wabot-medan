import { Body, Controller, Post } from '@nestjs/common';
import { LoggerService } from 'src/logger/logger.service';
import { QueueService } from 'src/bot-without-flow/queue/queue.service';
import { BotWebhookPayload } from 'src/bot-webhook/bot-webhook.dto';
import { ResponseDTO } from 'src/bot-without-flow/types/common.types';
import { TelegramService } from './telegram.service';
import { TelegramUpdate } from './telegram.types';

/**
 * Inbound Telegram. Webhook diarahkan ke sini via BotFather/setWebhook:
 *   curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=<PUBLIC>/telegram/webhook"
 * Update dinormalisasi ke BotWebhookPayload lalu masuk ke antrian ai-chat yang
 * sama dengan jalur WhatsApp (session, engine nanobot, chat_logs ikut otomatis).
 * Identitas user memakai chat_id pada kolom phone_number.
 */
@Controller('telegram')
export class TelegramController {

    constructor(
        private readonly telegramService: TelegramService,
        private readonly queueService: QueueService,
        private readonly logger: LoggerService
    ) { }

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

    @Post("webhook")
    async webhook(
        @Body() update: TelegramUpdate
    ): Promise<ResponseDTO> {
        this.logger.debug(`Telegram Update Received: ${JSON.stringify(update).slice(0, 2000)}`, TelegramController.name);

        const message = update.message || update.edited_message;
        if (!message) {
            return {
                status: "success",
                code: 200,
                message: "Update tanpa pesan diabaikan"
            } as ResponseDTO;
        }

        const chatId = String(message.chat.id);
        const captionOrText = message.text || message.caption || "";

        let mediaUrl: string | null = null;
        if (message.photo && message.photo.length > 0) {
            // Ambil resolusi terbesar
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
            author: message.chat.first_name || "",
            caption: captionOrText,
            time: this.formatWIB(message.date)
        };

        if (!payload.message) {
            return {
                status: "success",
                code: 200,
                message: "Pesan tanpa teks/media diabaikan"
            } as ResponseDTO;
        }

        await this.queueService.addQueue("ai-chat", payload);

        return {
            status: "success",
            code: 200,
            message: "Pesan didaftarkan ke antrian"
        } as ResponseDTO;
    }
}
