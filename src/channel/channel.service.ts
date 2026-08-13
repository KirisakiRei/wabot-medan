import { Injectable } from '@nestjs/common';
import { TelegramService } from 'src/telegram/telegram.service';
import { WhatsappService } from 'src/whatsapp/whatsapp.service';
import { SendFileDTO, SendLocationDTO } from 'src/whatsapp/types/wa-gate-way.dto';

/**
 * Facade pengirim pesan. Platform aktif ditentukan sekali saat startup dari
 * env BOT_PLATFORM: "telegram" -> Telegram Bot API, selain itu -> WA Gateway
 * (perilaku lama). Signature method identik dengan WhatsappService agar
 * callsite cukup mengganti nama service.
 */
@Injectable()
export class ChannelService {

    private readonly platform: "telegram" | "wagateway";

    constructor(
        private readonly telegramService: TelegramService,
        private readonly whatsappService: WhatsappService
    ) {
        this.platform = process.env.BOT_PLATFORM === "telegram" ? "telegram" : "wagateway";
    }

    isTelegram(): boolean {
        return this.platform === "telegram";
    }

    async sendSeen(recipient: string, session?: string) {
        if (this.isTelegram()) {
            return this.telegramService.sendSeen(recipient, session);
        }
        return this.whatsappService.sendSeen(recipient, session);
    }

    async startTyping(recipient: string, session?: string) {
        if (this.isTelegram()) {
            return this.telegramService.startTyping(recipient, session);
        }
        return this.whatsappService.startTyping(recipient, session);
    }

    async stopTyping(recipient: string, session?: string) {
        if (this.isTelegram()) {
            return this.telegramService.stopTyping(recipient, session);
        }
        return this.whatsappService.stopTyping(recipient, session);
    }

    async sendText(recipient: string, teks: string, session?: string) {
        if (this.isTelegram()) {
            return this.telegramService.sendText(recipient, teks, session);
        }
        return this.whatsappService.sendText(recipient, teks, session);
    }

    async sendImage(dto: SendFileDTO, session?: string) {
        if (this.isTelegram()) {
            return this.telegramService.sendImage(dto, session);
        }
        return this.whatsappService.sendImage(dto, session);
    }

    async sendLocation(dto: SendLocationDTO, session?: string) {
        if (this.isTelegram()) {
            return this.telegramService.sendLocation(dto, session);
        }
        return this.whatsappService.sendLocation(dto, session);
    }

    async sendFile(dto: SendFileDTO, session?: string) {
        if (this.isTelegram()) {
            return this.telegramService.sendFile(dto, session);
        }
        return this.whatsappService.sendFile(dto, session);
    }

    async sendVideo(dto: SendFileDTO, session?: string) {
        if (this.isTelegram()) {
            return this.telegramService.sendVideo(dto, session);
        }
        return this.whatsappService.sendVideo(dto, session);
    }
}
