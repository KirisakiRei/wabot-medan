import { Injectable } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import { LoggerService } from 'src/logger/logger.service';
import { SendFileDTO, SendLocationDTO } from 'src/whatsapp/types/wa-gate-way.dto';
import { TelegramFileResult } from './telegram.types';

/**
 * Klien Telegram Bot API (token dari BotFather via env TELEGRAM_BOT_TOKEN).
 * Signature method sengaja disamakan dengan WhatsappService agar mudah
 * dialihkan lewat ChannelService. Param `session` dipertahankan hanya demi
 * kompatibilitas signature dan diabaikan (Telegram tidak punya konsep session).
 */
@Injectable()
export class TelegramService {
    private readonly bot: AxiosInstance;
    private readonly fileBaseUrl: string;

    constructor(
        private readonly logger: LoggerService,
    ) {
        const token = process.env.TELEGRAM_BOT_TOKEN || "";
        this.bot = axios.create({
            baseURL: `https://api.telegram.org/bot${token}`,
            timeout: 30000,
            headers: {
                "Content-Type": "application/json"
            }
        });
        this.fileBaseUrl = `https://api.telegram.org/file/bot${token}`;
    }

    /** Telegram tidak punya padanan "seen" — no-op. */
    async sendSeen(_chatId: string, _session?: string) {
        this.logger.debug("sendSeen diabaikan (tidak ada padanan di Telegram)", TelegramService.name);
    }

    async startTyping(chatId: string, _session?: string) {
        await this.bot.post("/sendChatAction", {
            chat_id: chatId,
            action: "typing"
        }).then(() => {
            this.logger.log("Request Sended", `${TelegramService.name}/${this.startTyping.name}`);
        }).catch((error) => this.logger.error(`Error Telegram : ${error}`, error.name, `${TelegramService.name}/${this.startTyping.name}`));
    }

    /** Telegram tidak punya "stop typing" — no-op. */
    async stopTyping(_chatId: string, _session?: string) {
        this.logger.debug("stopTyping diabaikan (tidak ada padanan di Telegram)", TelegramService.name);
    }

    async sendText(chatId: string, teks: string, _session?: string) {
        await this.bot.post("/sendMessage", {
            chat_id: chatId,
            text: teks,
            parse_mode: "HTML"
        }).then(() => {
            this.logger.log("Request Sended", `${TelegramService.name}/${this.sendText.name}`);
        }).catch((error) => this.logger.error(`Error Telegram : ${error}`, error.name, `${TelegramService.name}/${this.sendText.name}`));
    }

    async sendImage({ phone_number, file, description }: SendFileDTO, _session?: string) {
        await this.bot.post("/sendPhoto", {
            chat_id: phone_number,
            photo: file.url,
            caption: description
        }).then(() => {
            this.logger.log("Request Sended", `${TelegramService.name}/${this.sendImage.name}`);
        }).catch((error) => this.logger.error(`Error Telegram : ${error}`, error.name, `${TelegramService.name}/${this.sendImage.name}`));
    }

    async sendLocation({ phone_number, title, latitude, longitude }: SendLocationDTO, _session?: string) {
        // ponytail: Telegram sendLocation tidak mendukung judul; judul dikirim sebagai
        // pesan teks terpisah bila tersedia. Hapus blok title bila tak dibutuhkan.
        if (title) {
            await this.sendText(phone_number, title);
        }

        await this.bot.post("/sendLocation", {
            chat_id: phone_number,
            latitude: latitude,
            longitude: longitude
        }).then(() => {
            this.logger.log("Request Sended", `${TelegramService.name}/${this.sendLocation.name}`);
        }).catch((error) => this.logger.error(`Error Telegram : ${error}`, error.name, `${TelegramService.name}/${this.sendLocation.name}`));
    }

    async sendFile({ phone_number, file, description }: SendFileDTO, _session?: string) {
        await this.bot.post("/sendDocument", {
            chat_id: phone_number,
            document: file.url,
            caption: description
        }).then(() => {
            this.logger.log("Request Sended", `${TelegramService.name}/${this.sendFile.name}`);
        }).catch((error) => this.logger.error(`Error Telegram : ${error}`, error.name, `${TelegramService.name}/${this.sendFile.name}`));
    }

    async sendVideo({ phone_number, file, description }: SendFileDTO, _session?: string) {
        await this.bot.post("/sendVideo", {
            chat_id: phone_number,
            video: file.url,
            caption: description
        }).then(() => {
            this.logger.log("Request Sended", `${TelegramService.name}/${this.sendVideo.name}`);
        }).catch((error) => this.logger.error(`Error Telegram : ${error}`, error.name, `${TelegramService.name}/${this.sendVideo.name}`));
    }

    /** Konversi file_id Telegram menjadi URL publik (untuk diunduh backend). */
    async getFileUrl(fileId: string): Promise<string | null> {
        try {
            const { data } = await this.bot.get<TelegramFileResult>("/getFile", {
                params: { file_id: fileId }
            });

            if (data.ok && data.result?.file_path) {
                return `${this.fileBaseUrl}/${data.result.file_path}`;
            }

            return null;
        } catch (error) {
            this.logger.error(`Error getFile Telegram : ${error}`, error.name, `${TelegramService.name}/${this.getFileUrl.name}`);
            return null;
        }
    }
}
