import { Injectable } from '@nestjs/common';
import axios, { AxiosInstance, AxiosError } from 'axios';
import FormData from 'form-data';
import { LoggerService } from 'src/logger/logger.service';
import { SendFileDTO, SendLocationDTO } from 'src/whatsapp/types/wa-gate-way.dto';
import { TelegramFileResult } from './telegram.types';

/**
 * Klien Telegram Bot API (token dari BotFather via env TELEGRAM_BOT_TOKEN).
 * Signature method disamakan dengan WhatsappService agar dialihkan lewat ChannelService.
 * Param `session` diabaikan (Telegram tidak punya konsep session).
 *
 * Media: Telegram hanya bisa fetch URL yang publik di internet. Storage lokal /
 * API_URL internal sering 400. Solusi: unduh file dulu, lalu upload multipart.
 */
@Injectable()
export class TelegramService {
    private readonly bot: AxiosInstance;
    private readonly fileBaseUrl: string;
    private readonly maxCaptionLen = 1024;

    constructor(
        private readonly logger: LoggerService,
    ) {
        const token = process.env.TELEGRAM_BOT_TOKEN || "";
        this.bot = axios.create({
            baseURL: `https://api.telegram.org/bot${token}`,
            timeout: 60000,
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
        }).catch((error) => this.logTelegramError(error, this.startTyping.name));
    }

    /** Telegram tidak punya "stop typing" — no-op. */
    async stopTyping(_chatId: string, _session?: string) {
        this.logger.debug("stopTyping diabaikan (tidak ada padanan di Telegram)", TelegramService.name);
    }

    async sendText(chatId: string, teks: string, _session?: string) {
        const text = this.sanitizeText(teks);
        if (!text) return;

        await this.bot.post("/sendMessage", {
            chat_id: chatId,
            text,
            // Tanpa parse_mode default: konten RAG sering berisi * _ < yang memecah HTML
            disable_web_page_preview: true,
        }).then(() => {
            this.logger.log("Request Sended", `${TelegramService.name}/${this.sendText.name}`);
        }).catch((error) => this.logTelegramError(error, this.sendText.name));
    }

    async sendImage({ phone_number, file, description }: SendFileDTO, _session?: string) {
        const caption = this.sanitizeCaption(description);
        const url = file?.url;

        if (!url) {
            this.logger.error("sendImage: file.url kosong", "TelegramService/sendImage");
            // Tanpa URL: kirim caption/teks jawaban saja (bukan pesan error)
            if (caption) await this.sendText(phone_number, caption);
            return;
        }

        // 1) Coba URL publik (cepat) bila kelihatan reachable dari internet
        if (this.isLikelyPublicUrl(url)) {
            try {
                await this.bot.post("/sendPhoto", {
                    chat_id: phone_number,
                    photo: url,
                    caption: caption || undefined,
                });
                this.logger.log("Request Sended (url)", `${TelegramService.name}/${this.sendImage.name}`);
                return;
            } catch (error) {
                this.logger.warn(
                    `sendPhoto via URL gagal, fallback upload multipart. url=${url.slice(0, 120)}`,
                    TelegramService.name
                );
                this.logTelegramError(error, "sendImage/url");
            }
        }

        // 2) Unduh file lalu upload multipart (wajib untuk storage internal / localhost)
        try {
            await this.uploadMediaMultipart({
                chatId: phone_number,
                method: "sendPhoto",
                fieldName: "photo",
                sourceUrl: url,
                filename: file.filename || "image.jpg",
                caption,
            });
            this.logger.log("Request Sended (upload)", `${TelegramService.name}/${this.sendImage.name}`);
        } catch (error) {
            this.logTelegramError(error, this.sendImage.name);
            // Gambar gagal: tampilkan caption/teks jawaban saja (tanpa pesan "gagal kirim")
            if (caption) {
                await this.sendText(phone_number, caption);
            }
        }
    }

    async sendLocation({ phone_number, title, latitude, longitude }: SendLocationDTO, _session?: string) {
        if (title) {
            await this.sendText(phone_number, title);
        }

        await this.bot.post("/sendLocation", {
            chat_id: phone_number,
            latitude: latitude,
            longitude: longitude
        }).then(() => {
            this.logger.log("Request Sended", `${TelegramService.name}/${this.sendLocation.name}`);
        }).catch((error) => this.logTelegramError(error, this.sendLocation.name));
    }

    async sendFile({ phone_number, file, description }: SendFileDTO, _session?: string) {
        const caption = this.sanitizeCaption(description);
        const url = file?.url;

        if (!url) {
            if (caption) await this.sendText(phone_number, caption);
            return;
        }

        if (this.isLikelyPublicUrl(url)) {
            try {
                await this.bot.post("/sendDocument", {
                    chat_id: phone_number,
                    document: url,
                    caption: caption || undefined,
                });
                this.logger.log("Request Sended (url)", `${TelegramService.name}/${this.sendFile.name}`);
                return;
            } catch (error) {
                this.logTelegramError(error, "sendFile/url");
            }
        }

        try {
            await this.uploadMediaMultipart({
                chatId: phone_number,
                method: "sendDocument",
                fieldName: "document",
                sourceUrl: url,
                filename: file.filename || "file.bin",
                caption,
            });
            this.logger.log("Request Sended (upload)", `${TelegramService.name}/${this.sendFile.name}`);
        } catch (error) {
            this.logTelegramError(error, this.sendFile.name);
            // File gagal: caption/teks saja
            if (caption) await this.sendText(phone_number, caption);
        }
    }

    async sendVideo({ phone_number, file, description }: SendFileDTO, _session?: string) {
        const caption = this.sanitizeCaption(description);
        const url = file?.url;

        if (!url) {
            if (caption) await this.sendText(phone_number, caption);
            return;
        }

        if (this.isLikelyPublicUrl(url)) {
            try {
                await this.bot.post("/sendVideo", {
                    chat_id: phone_number,
                    video: url,
                    caption: caption || undefined,
                });
                this.logger.log("Request Sended (url)", `${TelegramService.name}/${this.sendVideo.name}`);
                return;
            } catch (error) {
                this.logTelegramError(error, "sendVideo/url");
            }
        }

        try {
            await this.uploadMediaMultipart({
                chatId: phone_number,
                method: "sendVideo",
                fieldName: "video",
                sourceUrl: url,
                filename: file.filename || "video.mp4",
                caption,
            });
            this.logger.log("Request Sended (upload)", `${TelegramService.name}/${this.sendVideo.name}`);
        } catch (error) {
            this.logTelegramError(error, this.sendVideo.name);
            // Video gagal: caption/teks saja
            if (caption) await this.sendText(phone_number, caption);
        }
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
            this.logTelegramError(error, this.getFileUrl.name);
            return null;
        }
    }

    // ========================================================================
    // INTERNAL
    // ========================================================================

    /**
     * Unduh media dari URL backend/storage, unggah ke Telegram sebagai multipart.
     * Telegram server tidak perlu bisa mengakses URL sumber.
     */
    private async uploadMediaMultipart(opts: {
        chatId: string;
        method: "sendPhoto" | "sendDocument" | "sendVideo";
        fieldName: "photo" | "document" | "video";
        sourceUrl: string;
        filename: string;
        caption?: string;
    }): Promise<void> {
        const downloadUrl = this.resolveDownloadUrl(opts.sourceUrl);
        this.logger.debug(
            `Download media untuk Telegram: ${downloadUrl.slice(0, 160)}`,
            TelegramService.name
        );

        const fileRes = await axios.get<ArrayBuffer>(downloadUrl, {
            responseType: "arraybuffer",
            timeout: 45000,
            maxContentLength: 20 * 1024 * 1024,
            validateStatus: (s) => s >= 200 && s < 300,
        });

        const buffer = Buffer.from(fileRes.data);
        if (buffer.length === 0) {
            throw new Error(`File media kosong dari ${downloadUrl}`);
        }

        const form = new FormData();
        form.append("chat_id", opts.chatId);
        form.append(opts.fieldName, buffer, {
            filename: opts.filename,
            contentType: fileRes.headers["content-type"] || this.guessMime(opts.filename),
        });
        if (opts.caption) {
            form.append("caption", opts.caption);
        }

        await this.bot.post(`/${opts.method}`, form, {
            headers: form.getHeaders(),
            maxBodyLength: 20 * 1024 * 1024,
            maxContentLength: 20 * 1024 * 1024,
        });
    }

    /**
     * URL relatif/storage → absolut memakai API_URL.
     * localhost di env server diganti ke 127.0.0.1 agar unduh dari proses backend tetap jalan.
     */
    private resolveDownloadUrl(url: string): string {
        let resolved = (url || "").trim();
        if (!resolved) return resolved;

        if (resolved.startsWith("/")) {
            const base = (process.env.API_URL || "http://127.0.0.1:8001").replace(/\/$/, "");
            resolved = `${base}${resolved}`;
        }

        // Backend sering expose API_URL=http://localhost:... — dari container yang sama OK
        return resolved;
    }

    /** URL yang kemungkinan bisa di-fetch Telegram (bukan private/local). */
    private isLikelyPublicUrl(url: string): boolean {
        try {
            const u = new URL(url);
            if (u.protocol !== "https:" && u.protocol !== "http:") return false;
            const host = u.hostname.toLowerCase();
            if (
                host === "localhost" ||
                host === "127.0.0.1" ||
                host === "0.0.0.0" ||
                host.endsWith(".local") ||
                host.startsWith("10.") ||
                host.startsWith("192.168.") ||
                host.startsWith("172.16.") ||
                host.startsWith("172.17.") ||
                host.startsWith("172.18.") ||
                host.startsWith("172.19.") ||
                host.startsWith("172.2") ||
                host.startsWith("172.3")
            ) {
                return false;
            }
            return u.protocol === "https:" || u.protocol === "http:";
        } catch {
            return false;
        }
    }

    private sanitizeCaption(text?: string): string {
        if (!text) return "";
        // Caption Telegram max 1024; strip tag HTML kasar
        const plain = text.replace(/<[^>]+>/g, "").trim();
        if (plain.length <= this.maxCaptionLen) return plain;
        return plain.slice(0, this.maxCaptionLen - 1) + "…";
    }

    private sanitizeText(text?: string): string {
        if (!text) return "";
        // Telegram message max ~4096
        const plain = text.trim();
        if (plain.length <= 4000) return plain;
        return plain.slice(0, 3999) + "…";
    }

    private guessMime(filename: string): string {
        const lower = (filename || "").toLowerCase();
        if (lower.endsWith(".png")) return "image/png";
        if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
        if (lower.endsWith(".gif")) return "image/gif";
        if (lower.endsWith(".webp")) return "image/webp";
        if (lower.endsWith(".pdf")) return "application/pdf";
        if (lower.endsWith(".mp4")) return "video/mp4";
        return "application/octet-stream";
    }

    private logTelegramError(error: unknown, context: string) {
        const ax = error as AxiosError;
        const body = ax?.response?.data
            ? JSON.stringify(ax.response.data).slice(0, 500)
            : "";
        const status = ax?.response?.status;
        this.logger.error(
            `Error Telegram [${context}] status=${status || "-"} body=${body || ax?.message || error}`,
            ax?.name || "Error",
            `${TelegramService.name}/${context}`
        );
    }
}
