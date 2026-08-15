import { Injectable } from '@nestjs/common';
import { UsulanService } from './usulan/usulan.service';
import { SistemInformasiService } from './sistem-informasi/sistem-informasi.service';
import { PengaduanService } from './pengaduan/pengaduan.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { Variables } from 'generated/prisma';
import { LoggerService } from 'src/logger/logger.service';
import Redis from 'ioredis';
import { BotWebhookPayload } from 'src/bot-webhook/bot-webhook.dto';
import { AiService } from './ai/ai.service';
import { SessionService } from './session/session.service';
import { FinalMessage, ResponseDTO } from './types/common.types';
import { ChannelService } from 'src/channel/channel.service';
import { hash } from 'crypto';
import { sessionMessageParse } from './ai/types/response.type';
import { QueueService } from './queue/queue.service';
import * as path from 'path';
import * as mime from 'mime-types';
import { NanobotClientService } from './nanobot/nanobot-client.service';
import { NanobotTurnContext, NanobotTurnRequest, NanobotTurnResponse, NANOBOT_CONTEXT_KEY } from './nanobot/types/nanobot.types';
import { FileInfo } from 'src/whatsapp/types/wa-gate-way.dto';

@Injectable()
export class BotWithoutFlowService {
    constructor(
        private readonly sistemInformasiService: SistemInformasiService,
        private readonly pengaduanService: PengaduanService,
        private readonly usulanService: UsulanService,
        private readonly prismaService: PrismaService,
        private readonly loggerService: LoggerService,
        private readonly redis: Redis,
        private readonly aiService: AiService,
        private readonly sessionService: SessionService,
        private readonly channelService: ChannelService,
        private readonly queueService: QueueService,
        private readonly nanobotClientService: NanobotClientService
    ) { }

    async getVariables(): Promise<Variables[]> {
        return await this.prismaService.variables.findMany();
    }

    async setLastResponse(phone_number: string, response: string) {
        await this.redis.set(`last-response-${phone_number}`, response);
    }

    async getLastResponse(phone_number: string): Promise<string> {
        return await this.redis.get(`last-response-${phone_number}`) || "";
    }

    async getRatingAbsence(phone_number: string): Promise<string | null> {
        const data = await this.redis.get(`rating-absence-${phone_number}`);

        if (data !== null && typeof data === 'string') {
            return data;
        }

        return null;
    }

    sleep(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    /**
     * Simulasi ketik opsional. Default 0ms (langsung kirim) agar bot terasa responsif.
     * Set CHAT_TYPING_SIMULATION_MS di env bila ingin jeda artifisial (maks 2000ms).
     */
    async simulateTyping(_text: string): Promise<void> {
        const typingMs = parseInt(process.env.CHAT_TYPING_SIMULATION_MS || "0", 10);
        if (typingMs > 0) {
            await this.sleep(Math.min(typingMs, 2000));
        }
    }

    // ========================================================================
    // MAIN FUNCTION - Semua respons (sukses / error / blocked) lewat finalMessage
    // ========================================================================
    async sendChatService(payload: BotWebhookPayload) {
        if ((process.env.ENABLE_NANOBOT_ENGINE || "false") === "true") {
            return await this.sendChatServiceNanobot(payload);
        }

        let finalMessage: FinalMessage = {
            message: "",
            message_type: "text",
            not_found: false,
            not_found_session: null
        };
        let hasSentResponse = false;

        try {
            const year = new Date().getFullYear();
            const variabels = await this.getVariables();

            // --------------------------------------------------------------------
            // 1. Contact check
            // --------------------------------------------------------------------
            const contactId = await this.getOrCreateContact(payload.phone_number, payload.author);

            if (!contactId) {
                finalMessage.message = "Maaf terjadi kesalahan pada sistem kami. Silakan coba lagi nanti.";
                hasSentResponse = true;
                return await this.processFinalFlow(payload, finalMessage);
            }

            // --------------------------------------------------------------------
            // 2. Block check
            // --------------------------------------------------------------------
            if (await this.isBlocked(contactId)) {
                finalMessage.message = "Maaf, Anda telah diblokir dari menggunakan layanan ini.";
                hasSentResponse = true;
                return await this.processFinalFlow(payload, finalMessage);
            }

            // --------------------------------------------------------------------
            // 3. Session
            // --------------------------------------------------------------------
            const sessionRoom = await this.sessionService.getSessionRoom(payload);
            const nowSession = await this.sessionService.getSession(payload);

            this.loggerService.debug(`Current session : ${nowSession}`, `Bot/sendChatService`);

            // --------------------------------------------------------------------
            // 4. Handle conversation or form
            // --------------------------------------------------------------------
            if (nowSession === "sesi-percakapan") {
                finalMessage = await this.handleConversationSession(payload, variabels);
            }
            else if (nowSession === "mengisi-formulir") {
                const result = await this.handleFormSession(payload, variabels);
                if (!result) return; // recursive call already done
                finalMessage = result;
            }
            else {
                // Sesi tidak dikenali -> fallback aman
                this.loggerService.error(`Sesi tidak dikenali: ${nowSession}`, "Bot/sendChatService");
                finalMessage.message = "Maaf, terjadi kesalahan sesi. Silakan coba lagi nanti.";
            }

            // --------------------------------------------------------------------
            // 5. Final AI Template Output
            // --------------------------------------------------------------------
            await this.loggerService.debug(`Final message before template: ${finalMessage.message}`, `Bot/sendChatService`);

            try {
                const systemContent = variabels.find(v => v.name === "AI_RESPONSE_GENERATOR_SYSTEM_CONTENT")?.content;
                if (!systemContent) throw new Error("Variabel AI_RESPONSE_GENERATOR_SYSTEM_CONTENT tidak ditemukan");

                const generatedMessage = await this.aiService.geminiGenrateText({
                    parts: [
                        { text: systemContent },
                        {
                            text: JSON.stringify({
                                response_template: finalMessage.message,
                                user_message: payload.message,
                                sender_name: payload.author || "",
                                message_time: payload.time || "",
                                unique_code: hash("sha256", payload.phone_number)
                            })
                        }
                    ],
                    temperature: 0.5,
                    topP: 1,
                    maxOutputTokens: 256,
                    variables: variabels
                });

                if (generatedMessage) {
                    finalMessage.message = generatedMessage;
                }
            } catch (error) {
                this.loggerService.error("Gagal generate final response template", error);
                if (!finalMessage.message) {
                    finalMessage.message = "Maaf, terjadi kesalahan pada sistem kami. Silakan coba lagi nanti.";
                }
            }

            // finalMessage.message = await this.aiService.generateResponse(variabels, {
            //     response_template: finalMessage.message,
            //     user_message: payload.message,
            //     sender_name: payload.author || "",
            //     message_time: payload.time || "",
            //     unique_code: hash("sha256", payload.phone_number)
            // });

            // --------------------------------------------------------------------
            // 6. Log conversation
            // --------------------------------------------------------------------
            await this.prismaService.chatLog.create({
                data: {
                    chat_id: contactId,
                    chat_room: sessionRoom,
                    bot_reply: finalMessage.message,
                    message: payload.message,
                    year,
                }
            }).then(async (data) => {
                if (finalMessage.not_found) {

                    const organizationID = await this.findOrganizationID(payload.message, variabels);

                    await this.prismaService.chatWithoutAnwer.create({
                        data: {
                            year,
                            chat_room: data.chat_room,
                            chat_type: finalMessage.not_found_session ? finalMessage.not_found_session : "sistem-informasi",
                            organization_id: organizationID || undefined,
                            chat_log_id: data.id
                        }
                    }).then((data) => {
                        switch (finalMessage.not_found_session) {
                            case "sistem-informasi":
                                this.queueService.addGenerateBanks("generate-question", {
                                    organization_id: data.organization_id || "",
                                    user_message: payload.message
                                });
                                break;
                            case "layanan-publik":
                                this.queueService.addGenerateBanks("generate-request", {
                                    organization_id: data.organization_id || "",
                                    user_message: payload.message
                                });
                                break;
                        }
                    }).catch((err) => {
                        this.loggerService.error("Gagal simpan chatWithoutAnswer", err);
                    });
                }
            }).catch((err) => {
                this.loggerService.error("Gagal simpan chatLog", err);
            });

            // --------------------------------------------------------------------
            // 7. Finish & Send message
            // --------------------------------------------------------------------
            await this.sendFinalMessage(payload, finalMessage);
            hasSentResponse = true;

            // --------------------------------------------------------------------
            // 8. Save last response
            // --------------------------------------------------------------------
            await this.setLastResponse(payload.phone_number, finalMessage.message);
        } catch (error) {
            this.loggerService.error("Unexpected error di sendChatService", error, "Bot/sendChatService");

            if (hasSentResponse) {
                return;
            }

            await this.processFinalFlow(payload, {
                message: "Maaf, terjadi kesalahan pada sistem kami. Silakan coba lagi nanti.",
                message_type: "text",
                not_found: false,
                not_found_session: null
            });
        }
    }
    // ========================================================================
    // NANOBOT ENGINE - Pengganti conversation handling via Nanobot (flag aktif)
    // ========================================================================
    async sendChatServiceNanobot(payload: BotWebhookPayload) {
        let finalMessage: FinalMessage = {
            message: "",
            message_type: "text",
            not_found: false,
            not_found_session: null
        };
        let hasSentResponse = false;

        try {
            const year = new Date().getFullYear();
            const variabels = await this.getVariables();

            // Typing segera saat turn mulai (sebelum LLM) agar user tidak merasa bot diam
            void this.channelService.startTyping(
                payload.phone_number,
                process.env.WA_BOT_GATEWAY_SESSION || "wabot"
            ).catch(() => undefined);

            // --------------------------------------------------------------------
            // 1. Contact check
            // --------------------------------------------------------------------
            const contactId = await this.getOrCreateContact(payload.phone_number, payload.author);

            if (!contactId) {
                finalMessage.message = "Maaf terjadi kesalahan pada sistem kami. Silakan coba lagi nanti.";
                hasSentResponse = true;
                return await this.processFinalFlow(payload, finalMessage);
            }

            // --------------------------------------------------------------------
            // 2. Block check
            // --------------------------------------------------------------------
            if (await this.isBlocked(contactId)) {
                finalMessage.message = "Maaf, Anda telah diblokir dari menggunakan layanan ini.";
                hasSentResponse = true;
                return await this.processFinalFlow(payload, finalMessage);
            }

            // --------------------------------------------------------------------
            // 3. Session room & konteks Nanobot
            // --------------------------------------------------------------------
            const sessionRoom = await this.sessionService.getSessionRoom(payload);
            const context = await this.getNanobotContext(payload.phone_number);

            // --------------------------------------------------------------------
            // 4. Kirim turn ke Nanobot engine
            // --------------------------------------------------------------------
            const request: NanobotTurnRequest = {
                message_id: payload.message_id,
                channel: "whatsapp",
                channel_user_id: payload.phone_number,
                text: payload.message,
                media: payload.message && payload.message.startsWith("http") ? { url: payload.message } : null,
                sender_name: payload.author || "",
                message_time: payload.time || "",
                session_key: `wa:${payload.phone_number}`,
                context,
                // Backend menyimpan chat_logs via persistChatLog (+ not_found enrichment)
                persist_log: false
            };

            const response = await this.nanobotClientService.turn(request);

            if (!response) {
                finalMessage.message = "Maaf, terjadi kesalahan pada sistem kami. Silakan coba lagi nanti.";
                hasSentResponse = true;
                return await this.processFinalFlow(payload, finalMessage);
            }

            finalMessage = await this.mapNanobotResponse(response);

            await this.setNanobotContext(payload.phone_number, response.context);

            // --------------------------------------------------------------------
            // 5. Log conversation (termasuk not_found → generate banks)
            // --------------------------------------------------------------------
            await this.persistChatLog(payload, contactId, sessionRoom, finalMessage, variabels, year);

            // --------------------------------------------------------------------
            // 6. Finish & Send message
            // --------------------------------------------------------------------
            await this.sendFinalMessage(payload, finalMessage);
            hasSentResponse = true;

            await this.setLastResponse(payload.phone_number, finalMessage.message);
        } catch (error) {
            this.loggerService.error("Unexpected error di sendChatServiceNanobot", error, "Bot/sendChatServiceNanobot");

            if (hasSentResponse) {
                return;
            }

            await this.processFinalFlow(payload, {
                message: "Maaf, terjadi kesalahan pada sistem kami. Silakan coba lagi nanti.",
                message_type: "text",
                not_found: false,
                not_found_session: null
            });
        }
    }

    private async mapNanobotResponse(response: NanobotTurnResponse): Promise<FinalMessage> {
        const reply = response.reply;

        let finalMessage: FinalMessage = {
            message: reply.text || "",
            message_type: reply.type,
            not_found: response.not_found ?? false,
            not_found_session: response.not_found_session ?? null
        };

        if (["image", "video", "audio", "document"].includes(reply.type)) {
            if (reply.file_url) {
                finalMessage.file_path = await this.resolveFileInfo(reply.file_url);
            }
        }

        if (reply.type === "location") {
            finalMessage.latitude = reply.latitude ?? undefined;
            finalMessage.longitude = reply.longitude ?? undefined;
        }

        return finalMessage;
    }

    private async resolveFileInfo(fileUrl: string): Promise<FileInfo> {
        const filename = path.basename(fileUrl.split("?")[0]);
        const mimetype = mime.lookup(filename) || "application/octet-stream";

        return {
            mimetype: mimetype as string,
            filename,
            url: fileUrl
        };
    }

    private async getNanobotContext(phone_number: string): Promise<NanobotTurnContext> {
        const raw = await this.redis.get(NANOBOT_CONTEXT_KEY(phone_number));

        if (raw) {
            try {
                return JSON.parse(raw) as NanobotTurnContext;
            } catch (error) {
                this.loggerService.error("Gagal parse konteks Nanobot", error, "Bot/getNanobotContext");
            }
        }

        return {
            active_route: "NONE",
            current_step: 0,
            last_response: await this.getLastResponse(phone_number),
            request_id: null,
            service: null
        };
    }

    private async setNanobotContext(phone_number: string, context: NanobotTurnContext) {
        await this.redis.set(NANOBOT_CONTEXT_KEY(phone_number), JSON.stringify(context));
    }

    private async persistChatLog(
        payload: BotWebhookPayload,
        contactId: string,
        sessionRoom: string,
        finalMessage: FinalMessage,
        variabels: Variables[],
        year: number
    ) {
        await this.prismaService.chatLog.create({
            data: {
                chat_id: contactId,
                chat_room: sessionRoom,
                bot_reply: finalMessage.message,
                message: payload.message,
                year,
            }
        }).then(async (data) => {
            if (finalMessage.not_found) {

                const organizationID = await this.findOrganizationID(payload.message, variabels);

                await this.prismaService.chatWithoutAnwer.create({
                    data: {
                        year,
                        chat_room: data.chat_room,
                        chat_type: finalMessage.not_found_session ? finalMessage.not_found_session : "sistem-informasi",
                        organization_id: organizationID || undefined,
                        chat_log_id: data.id
                    }
                }).then((data) => {
                    switch (finalMessage.not_found_session) {
                        case "sistem-informasi":
                            this.queueService.addGenerateBanks("generate-question", {
                                organization_id: data.organization_id || "",
                                user_message: payload.message
                            });
                            break;
                        case "layanan-publik":
                            this.queueService.addGenerateBanks("generate-request", {
                                organization_id: data.organization_id || "",
                                user_message: payload.message
                            });
                            break;
                    }
                }).catch((err) => {
                    this.loggerService.error("Gagal simpan chatWithoutAnswer", err);
                });
            }
        }).catch((err) => {
            this.loggerService.error("Gagal simpan chatLog", err);
        });
    }

    async preflight(phone_number: string, text: string): Promise<{
        allowed: boolean;
        blocked: boolean;
        badword: boolean;
        message?: string;
    }> {
        try {
            const contactId = await this.getOrCreateContact(phone_number, null);

            if (!contactId) {
                return { allowed: false, blocked: false, badword: false };
            }

            if (await this.isBlocked(contactId)) {
                return { allowed: false, blocked: true, badword: false };
            }

            const wordFilters = await this.prismaService.wordFilters.findMany();
            const bannedWords = wordFilters
                .map((word) => (word.word || "").toLowerCase())
                .filter((word) => word.length > 0);

            if (bannedWords.some((word) => text.toLowerCase().includes(word))) {
                const variabels = await this.getVariables();
                const pesanError = variabels.find((item) => item.name == "respon_banned_words")?.content ?? "Pesan tidak dapat diproses karena mengandung kata-kata yang tidak diperbolehkan.";

                return { allowed: false, blocked: false, badword: true, message: pesanError };
            }

            return { allowed: true, blocked: false, badword: false };
        } catch (error) {
            this.loggerService.error("Gagal cek preflight", error, "Bot/preflight");
            return { allowed: false, blocked: false, badword: false };
        }
    }
    // ========================================================================
    // SUPPORT FUNCTIONS (Still inside the same file)
    // ========================================================================

    async getOrCreateContact(phone_number: string, author: string | null): Promise<string | null> {
        try {
            const existing = await this.prismaService.chatList.findFirst({
                where: { phone_number, year: new Date().getFullYear() },
                select: { id: true }
            });

            if (existing) return existing.id;

            const created = await this.prismaService.chatList.create({
                data: {
                    phone_number,
                    account_name: author || "Unknown",
                    year: new Date().getFullYear()
                }
            });

            return created.id;
        } catch (err) {
            this.loggerService.error("Gagal cek/tambah kontak chat list", err);
            return null;
        }
    }

    private async isBlocked(chat_list_id: string): Promise<boolean> {
        const record = await this.prismaService.blockedChatListHistory.findFirst({
            where: { chat_list_id },
            orderBy: { created_at: "desc" },
        });

        if (!record) return false;

        if (record.blocked_status === "permanent") return true;

        if (record.blocked_status === "temporary" && record.blocked_expired_at > new Date()) {
            return true;
        }

        return false;
    }

    private async findOrganizationID(userChat: string, variabels: Variables[]): Promise<string | null> {
        const org = await this.prismaService.organization.findMany({
            select: {
                id: true,
                name: true,
                description: true
            },
            where: {
                is_active: 1
            }
        });

        const prompt = variabels.find(v => v.name === "AI_ORGANIZATION_ID_CLASSIFICATION").content;

        const organizationID = await this.aiService.geminiGenrateText({
            parts: [
                {
                    text: prompt
                },
                {
                    text: JSON.stringify({
                        chat_user: userChat,
                        organizations: org.map(o => ({
                            id: o.id,
                            name: o.name,
                            description: o.description
                        }))
                    })
                }
            ],
            temperature: 0,
            topP: 1,
            maxOutputTokens: 256,
            variables: variabels
        });

        return organizationID;
    }

    // ========================================================================
    // Conversational session
    // ========================================================================
    private async handleConversationSession(payload: BotWebhookPayload, variabels: Variables[]): Promise<FinalMessage> {
        const lastResponse = await this.getLastResponse(payload.phone_number);

        const session = await this.aiService.geminiGenrateText({
            parts: [
                {
                    text: variabels.find(v => v.name === "AI_SESSION_CHECK_CONTENT_SYSTEM").content
                },
                {
                    text: JSON.stringify({
                        nama: payload.author || "",
                        pesan: payload.message,
                        last_response: lastResponse,
                        unique_code: hash("sha256", payload.phone_number),
                    })
                }
            ],
            temperature: 0,
            topP: 1,
            maxOutputTokens: 256,
            variables: variabels
        });

        if (session === null || session.trim() === "") {
            return {
                message: "Maaf, terjadi kesalahan pada sistem kami. Silakan coba lagi nanti.",
                message_type: "text",
                not_found: false,
                not_found_session: null,
            };
        }

        let checkService: sessionMessageParse;

        try {
            checkService = JSON.parse(session);
        } catch {
            try {
                const fixed = session
                    .replace(/'/g, '"')
                    .replace(/\bTrue\b/g, 'true')
                    .replace(/\bFalse\b/g, 'false')
                    .replace(/\bNone\b/g, 'null');
                checkService = JSON.parse(fixed);
            } catch (parseErr) {
                this.loggerService.error("Gagal parse session JSON dari AI", parseErr);
                return {
                    message: "Maaf, terjadi kesalahan pada sistem kami. Silakan coba lagi nanti.",
                    message_type: "text",
                    not_found: false,
                    not_found_session: null,
                };
            }
        }

        // const checkService = await this.aiService.checkSession(
        //     variabels,
        //     JSON.stringify({
        //         nama: payload.author || "",
        //         pesan: payload.message,
        //         last_response: lastResponse,
        //         unique_code: hash("sha256", payload.phone_number),
        //     })
        // );

        // Need confirmation -> balasan AI langsung
        if (checkService.need_confirmation ?? true) {
            return {
                message: checkService.respon_ai,
                message_type: "text",
                not_found: false,
                not_found_session: null,
            };
        }

        // Inject context
        let newPayload = payload;

        if (checkService.context_query) {
            newPayload = {
                ...payload,
                message: checkService.context_query,
                caption: checkService.context_query,
            };
        }

        // Routing layanan
        try {
            switch (checkService.layanan) {
                case "sistem-informasi":
                    return await this.sistemInformasiService.answerQuestion(newPayload, variabels);

                case "layanan-publik":
                    return await this.usulanService.handleRequest(newPayload, variabels);

                case "cek-pengaduan":
                    return await this.usulanService.cekTiketUsulan(
                        newPayload.message,
                        newPayload.phone_number
                    );

                default:
                    return {
                        message: checkService.respon_ai,
                        message_type: "text",
                        not_found: false,
                        not_found_session: null,
                    };
            }
        } catch (err) {
            this.loggerService.error(`Gagal proses layanan "${checkService.layanan}"`, err);
            return {
                message: "Maaf, terjadi kesalahan saat memproses permintaan Anda. Silakan coba lagi nanti.",
                message_type: "text",
                not_found: false,
                not_found_session: null,
            };
        }
    }

    // ========================================================================
    // Form session
    // ========================================================================
    private async handleFormSession(payload: BotWebhookPayload, variabels: Variables[]): Promise<FinalMessage | null> {
        // const shouldContinue = await this.aiService.checkIfUserContinueFillForm(
        //     variabels,
        //     JSON.stringify({
        //         last_bot_message: await this.getLastResponse(payload.phone_number),
        //         user_message: payload.message,
        //         unique_code: hash("sha256", payload.phone_number),
        //     })
        // );

        const shouldContinue = await this.aiService.geminiGenrateText({
            parts: [
                {
                    text: variabels.find(v => v.name === "AI_CHECK_IF_USER_CONTINUE_FILL_FORM_SYSTEM_CONTENT").content
                },
                {
                    text: JSON.stringify({
                        last_bot_message: await this.getLastResponse(payload.phone_number),
                        user_message: payload.message,
                        unique_code: hash("sha256", payload.phone_number),
                    })
                }
            ],
            temperature: 0,
            topP: 1,
            maxOutputTokens: 256,
            variables: variabels
        });

        if (shouldContinue !== null && shouldContinue.includes("true")) {
            return await this.usulanService.continueFillingForm(payload, variabels);
        }

        // User berhenti mengisi formulir
        await this.usulanService.endFillingForm(payload.phone_number);
        await this.sessionService.setSession("sesi-percakapan", payload);

        // Lanjut chat biasa
        await this.sendChatService(payload);
        return null;
    }

    // ========================================================================
    // FINAL FLOW WRAPPER (baru)
    // ========================================================================
    private async processFinalFlow(payload: BotWebhookPayload, finalMessage: FinalMessage): Promise<void> {
        await this.sendFinalMessage(payload, finalMessage);
        await this.setLastResponse(payload.phone_number, finalMessage.message);
    }

    // ========================================================================
    // SEND FINAL MESSAGE
    // ========================================================================
    private async sendFinalMessage(payload: BotWebhookPayload, finalMessage: FinalMessage): Promise<void> {
        try {
            // Guard: pastikan message tidak pernah null/undefined sebelum dikirim ke gateway
            if (!finalMessage.message) {
                this.loggerService.error("finalMessage.message kosong/null, menggunakan fallback", "sendFinalMessage");
                finalMessage.message = "Maaf, terjadi kesalahan pada sistem kami. Silakan coba lagi nanti.";
            }

            await this.channelService.sendSeen(payload.phone_number, process.env.WA_BOT_GATEWAY_SESSION || "wabot");
            // Typing indicator (ringan); jeda artifisial dinonaktifkan default (lihat simulateTyping)
            await this.channelService.startTyping(payload.phone_number, process.env.WA_BOT_GATEWAY_SESSION || "wabot");
            await this.simulateTyping(finalMessage.message);

            switch (finalMessage.message_type) {
                case "text":
                    await this.channelService.sendText(payload.phone_number, finalMessage.message, process.env.WA_BOT_GATEWAY_SESSION || "wabot");
                    break;

                case "image":
                    // Bila file tidak ada / kirim media gagal → caption/teks jawaban saja (tanpa pesan error)
                    if (!finalMessage.file_path?.url) {
                        this.loggerService.error("Jawaban image tanpa file_url, kirim caption saja", "sendFinalMessage");
                        if (finalMessage.message) {
                            await this.channelService.sendText(
                                payload.phone_number,
                                finalMessage.message,
                                process.env.WA_BOT_GATEWAY_SESSION || "wabot"
                            );
                        }
                        break;
                    }
                    try {
                        await this.channelService.sendImage({
                            phone_number: payload.phone_number,
                            file: finalMessage.file_path,
                            description: finalMessage.message
                        }, process.env.WA_BOT_GATEWAY_SESSION || "wabot");
                    } catch (imgErr) {
                        this.loggerService.error("Gagal kirim gambar, kirim caption saja", imgErr);
                        if (finalMessage.message) {
                            await this.channelService.sendText(
                                payload.phone_number,
                                finalMessage.message,
                                process.env.WA_BOT_GATEWAY_SESSION || "wabot"
                            );
                        }
                    }
                    break;

                case "location":
                    try {
                        await this.channelService.sendLocation({
                            phone_number: payload.phone_number,
                            title: finalMessage.message,
                            latitude: finalMessage.latitude,
                            longitude: finalMessage.longitude,
                        }, process.env.WA_BOT_GATEWAY_SESSION || "wabot");
                    } catch (locErr) {
                        this.loggerService.error("Gagal kirim lokasi, fallback ke teks", locErr);
                        await this.channelService.sendText(payload.phone_number, finalMessage.message || "Silakan lihat lokasi di atas.", process.env.WA_BOT_GATEWAY_SESSION || "wabot");
                    }
                    break;

                default:
                    try {
                        await this.channelService.sendFile({
                            phone_number: payload.phone_number,
                            file: finalMessage.file_path,
                            description: finalMessage.message
                        }, process.env.WA_BOT_GATEWAY_SESSION || "wabot");
                    } catch (fileErr) {
                        this.loggerService.error("Gagal kirim file, kirim caption saja", fileErr);
                        if (finalMessage.message) {
                            await this.channelService.sendText(
                                payload.phone_number,
                                finalMessage.message,
                                process.env.WA_BOT_GATEWAY_SESSION || "wabot"
                            );
                        }
                    }
            }

            await this.channelService.stopTyping(payload.phone_number, process.env.WA_BOT_GATEWAY_SESSION || "wabot");
        } catch (err) {
            this.loggerService.error("Gagal mengirim pesan akhir ke user", err);
            // Last-resort: kirim teks error langsung tanpa typing effect
            try {
                await this.channelService.sendText(
                    payload.phone_number,
                    "Maaf, terjadi kesalahan pada sistem kami. Silakan coba lagi nanti.",
                    process.env.WA_BOT_GATEWAY_SESSION || "wabot"
                );
            } catch (fallbackErr) {
                this.loggerService.error("Gagal mengirim pesan fallback", fallbackErr);
            }
        }
    }
}
