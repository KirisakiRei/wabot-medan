import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { LoggerService } from 'src/logger/logger.service';
import { AiService } from '../ai/ai.service';
import { SistemInformasiService } from '../sistem-informasi/sistem-informasi.service';
import { UsulanService } from '../usulan/usulan.service';
import { PengaduanService } from '../pengaduan/pengaduan.service';
import { BotWithoutFlowService } from '../bot-without-flow.service';
import { SessionService } from '../session/session.service';
import { ActiveRequest } from 'src/active-request/active-request';
import { BotWebhookPayload } from 'src/bot-webhook/bot-webhook.dto';
import { NanobotTurnContext } from '../nanobot/types/nanobot.types';

@Injectable()
export class NanobotApiService {

    constructor(
        private readonly botService: BotWithoutFlowService,
        private readonly sistemInformasiService: SistemInformasiService,
        private readonly usulanService: UsulanService,
        private readonly pengaduanService: PengaduanService,
        private readonly aiService: AiService,
        private readonly sessionService: SessionService,
        private readonly prismaService: PrismaService,
        private readonly loggerService: LoggerService,
        private readonly redisService: ActiveRequest
    ) { }

    // ========================================================================
    // PREFLIGHT - Filter kata kasar + blokir kontak + rate limit + injeksi prompt
    // ========================================================================
    async preflight(phone_number: string, text: string): Promise<{
        allowed: boolean;
        blocked: boolean;
        badword: boolean;
        rate_limited: boolean;
        action: "CONTINUE" | "WARN" | "REJECT" | "BLOCKED" | "RATE_LIMITED";
        message?: string;
    }> {
        const result = await this.botService.preflight(phone_number, text);

        if (!result.allowed && result.blocked) {
            return {
                allowed: false,
                blocked: true,
                badword: false,
                rate_limited: false,
                action: "BLOCKED",
                message: "Maaf, Anda telah diblokir dari menggunakan layanan ini."
            };
        }

        if (!result.allowed && result.badword) {
            return {
                allowed: false,
                blocked: false,
                badword: true,
                rate_limited: false,
                action: "REJECT",
                message: result.message
            };
        }

        // Batas panjang pesan agar tidak membebani LLM (token-wasting)
        const maxLength = Number(process.env.NANOBOT_MAX_MESSAGE_LENGTH || "1500");
        if (text.length > maxLength) {
            return {
                allowed: false,
                blocked: false,
                badword: false,
                rate_limited: false,
                action: "REJECT",
                message: "Maaf, pesan terlalu panjang. Silakan pecah menjadi beberapa pesan yang lebih pendek."
            };
        }

        // Deteksi pola injeksi prompt (deterministik, sebelum masuk LLM)
        if (this.detectPromptInjection(text)) {
            return {
                allowed: false,
                blocked: false,
                badword: false,
                rate_limited: false,
                action: "REJECT",
                message: "Maaf, pesan Anda tidak dapat diproses."
            };
        }

        // Rate limit per pengguna (turn per menit)
        const maxTurns = Number(process.env.NANOBOT_RATE_LIMIT_TURNS || "60");
        const turnCount = await this.redisService.incr(`ratelimit-turn-${phone_number}`, 60);
        if (turnCount > maxTurns) {
            return {
                allowed: false,
                blocked: false,
                badword: false,
                rate_limited: true,
                action: "RATE_LIMITED",
                message: "Maaf, Anda mengirim pesan terlalu cepat. Silakan tunggu sebentar sebelum melanjutkan."
            };
        }

        return {
            allowed: true,
            blocked: false,
            badword: false,
            rate_limited: false,
            action: "CONTINUE"
        };
    }

    // ========================================================================
    // PROMPT INJECTION DETECTION - Pola serangan umum (deterministik)
    // ========================================================================
    private detectPromptInjection(text: string): boolean {
        // Normalisasi leetspeak sederhana + huruf kecil + rapikan spasi ganda
        const normalized = text
            .toLowerCase()
            .replace(/0/g, "o")
            .replace(/1/g, "i")
            .replace(/3/g, "e")
            .replace(/4/g, "a")
            .replace(/5/g, "s")
            .replace(/7/g, "t")
            .replace(/@/g, "a")
            .replace(/\$/g, "s")
            .replace(/\s+/g, " ")
            .trim();

        const patterns: RegExp[] = [
            // Override instruksi
            /ignore (all|any|every)? ?(previous|prior|above|earlier|old).{0,20}(instruction|prompt|message|rule|guideline|order)/,
            /disregard.{0,20}(above|previous|earlier|instructions|prompt)/,
            /abaikan (semua |seluruh |setiap )?(instruksi|perintah|aturan|prompt|pesan) (sebelumnya|diatas|sebelum)/,
            /lupakan (semua |seluruh )?(aturan|instruksi|perintah)/,
            /jangan (patuh|ikuti|taati) (aturan|instruksi|perintah|sistem)/,
            /mulai (ulang|dari awal).{0,20}(aturan|instruksi|perintah)/,
            // Hijack persona
            /you are now.{0,30}(dan|jailbreak|unrestricted|unlimited|free|no rules)/,
            /act as (an? )?(unrestricted|jailbroken|unlimited|omniscient|god|dan)/,
            /do anything now/,
            /developer mode|jailbreak mode/,
            /kamu sekarang (menjadi|adalah).{0,30}(asisten|bot|sistem) (tanpa|bebas)/,
            /keluar dari peran|leave (the )?role/,
            /simulasi.{0,20}(asisten|bot|sistem).{0,20}(tanpa aturan|bebas)/,
            // Exfiltrasi prompt
            /(print|show|reveal|display|repeat|copy|read back|echo).{0,20}(system|secret|internal|full|exact).{0,20}(prompt|instruction|message|config|rules)/,
            /tampilkan.{0,20}(prompt|instruksi|aturan).{0,20}(sistem|system|awal|rahasia)/,
            /apa (saja )?(instruksi|perintah|prompt|aturan)(mu| kamu| anda)?( yang)?/,
            /ulangi (teks|pesan|instruksi) (di )?atas/,
            /repeat the (text|words|message) above/,
            /system prompt (adalah|berisi|memuat)/,
            // Fraud identitas
            /i am (the |an? |your )?(admin|developer|owner|creator|author|master)/,
            /saya (developer|admin|pembuat|pencipta|owner) (dari )?(bot|sistem|aplikasi)/,
            /as a developer.{0,20}(you|kamu|anda)/,
            /sebagai (developer|admin|sistem).{0,20}(kamu|anda) (harus|wajib)/,
            // Umum
            /ignore previous instructions/i,
            /system prompt/i,
        ];

        return patterns.some((pattern) => pattern.test(normalized));
    }

    // ========================================================================
    // INFORMATION - Tool search_information
    // ========================================================================
    async searchInformation(query: string, wa_number: string) {
        const variables = await this.botService.getVariables();

        const result = await this.sistemInformasiService.apiSearchAnswer(query, wa_number, variables);

        if (!result) {
            return {
                success: false,
                status: "ERROR",
                answer: null,
                sources: [],
                confidence: "low"
            };
        }

        const attachments = result.file_url
            ? [{ type: result.type, url: result.file_url }]
            : [];

        const location = result.type === "location"
            ? {
                latitude: result.latitude,
                longitude: result.longitude,
                label: result.text
            }
            : null;

        return {
            success: true,
            status: result.found ? "ANSWERED" : "NOT_FOUND",
            answer: {
                text: result.text,
                attachments,
                location
            },
            sources: [],
            confidence: result.found ? "high" : "low"
        };
    }

    // ========================================================================
    // PROPOSAL - Tool find_proposal_service
    // ========================================================================
    async searchProposalServices(query: string, wa_number: string) {
        const variables = await this.botService.getVariables();

        const result = await this.aiService.matchRequestRAG({
            request: query,
            wa_number,
            variables
        });

        if (!result) {
            return {
                success: false,
                matches: []
            };
        }

        return {
            success: true,
            matches: [
                {
                    request_id: result.request_id,
                    request_name: result.request_name,
                    organization_id: result.organization_id,
                    confidence: 1
                }
            ]
        };
    }

    async getProposalSchema(request_id: string) {
        const schema = await this.usulanService.apiGetSchema(request_id);

        if (!schema) {
            return {
                success: false,
                message: "Layanan tidak ditemukan."
            };
        }

        return {
            success: true,
            ...schema
        };
    }

    async createProposalDraft(wa_number: string, request_id: string) {
        return await this.usulanService.apiCreateDraft(wa_number, request_id);
    }

    async updateProposalField(wa_number: string, form_id: string, value: string) {
        return await this.usulanService.apiUpdateField(wa_number, form_id, value);
    }

    async validateProposalDraft(wa_number: string) {
        return await this.usulanService.apiValidateDraft(wa_number);
    }

    async submitProposalDraft(wa_number: string) {
        return await this.usulanService.apiSubmitDraft(wa_number);
    }

    async cancelProposalDraft(wa_number: string) {
        return await this.usulanService.apiCancelDraft(wa_number);
    }

    async checkProposalTicket(ticket: string, wa_number: string) {
        return await this.usulanService.apiCheckTicket(ticket, wa_number);
    }

    // ========================================================================
    // COMPLAINT - Tool pengaduan Nanobot
    // ========================================================================
    async getComplaintTemplate() {
        return await this.pengaduanService.apiGetTemplate();
    }

    async createComplaintDraft(wa_number: string) {
        return await this.pengaduanService.apiCreateDraft(wa_number);
    }

    async appendComplaintDraft(wa_number: string, value?: string, mediaUrl?: string, mediaCaption?: string) {
        return await this.pengaduanService.apiAppendDraft(wa_number, value, mediaUrl, mediaCaption);
    }

    async submitComplaintDraft(wa_number: string) {
        return await this.pengaduanService.apiSubmitDraft(wa_number);
    }

    async cancelComplaintDraft(wa_number: string) {
        return await this.pengaduanService.apiCancelDraft(wa_number);
    }

    async checkComplaintStatus(ticket: string, wa_number: string) {
        return await this.pengaduanService.apiCheckStatus(ticket, wa_number);
    }

    // ========================================================================
    // CONVERSATION STATE - Sinkronisasi state, riwayat & memory ringkas Nanobot
    // (mengikuti pola key `nanobot-context-<phone>` pada flow existing)
    // ========================================================================
    private resolveConversationKey(session_key: string): string {
        // `wa:628123...` → `628123...` (konsisten dengan key existing);
        // session lain (terminal, dll) dipakai apa adanya.
        const normalized = session_key.startsWith("wa:") ? session_key.slice(3) : session_key;
        return normalized.replace(/[^a-zA-Z0-9._-]/g, "_");
    }

    private memoryTtlSeconds(): number {
        return Number(process.env.NANOBOT_MEMORY_TTL_DAYS || "30") * 24 * 60 * 60;
    }

    async getConversation(session_key: string): Promise<{
        context: NanobotTurnContext | null;
        history: { role: string; content: string }[];
        memory: any | null;
        last_activity_at: string | null;
    }> {
        const key = this.resolveConversationKey(session_key);

        let context: NanobotTurnContext | null = null;
        const contextRaw = await this.redisService.get(`nanobot-context-${key}`);
        if (contextRaw) {
            try {
                context = JSON.parse(contextRaw) as NanobotTurnContext;
            } catch (error) {
                this.loggerService.error("Gagal parse konteks percakapan", error, "NanobotApiService/getConversation");
            }
        }

        let history: { role: string; content: string }[] = [];
        const historyRaw = await this.redisService.get(`nanobot-history-${key}`);
        if (historyRaw) {
            try {
                history = JSON.parse(historyRaw) as { role: string; content: string }[];
            } catch (error) {
                this.loggerService.error("Gagal parse riwayat percakapan", error, "NanobotApiService/getConversation");
            }
        }

        // Memory ringkas: Redis dulu, fallback DB (cache-aside) bila Redis kosong
        let memory: any | null = null;
        const memoryRaw = await this.redisService.get(`nanobot-memory-${key}`);
        if (memoryRaw) {
            try {
                memory = JSON.parse(memoryRaw) as any;
            } catch (error) {
                this.loggerService.error("Gagal parse memory percakapan", error, "NanobotApiService/getConversation");
            }
        }
        if (!memory) {
            const dbMemory = await this.prismaService.conversationSummaries.findUnique({
                where: { session_key: key }
            });
            if (dbMemory) {
                memory = {
                    summary: dbMemory.summary,
                    message_count: dbMemory.message_count,
                    last_activity_at: dbMemory.last_activity_at
                };
                // Isi ulang cache Redis agar tidak query DB berulang kali
                await this.redisService.set(`nanobot-memory-${key}`, JSON.stringify(memory), this.memoryTtlSeconds());
            }
        }

        const lastActivity = await this.redisService.get(`nanobot-last-activity-${key}`);

        return { context, history, memory, last_activity_at: lastActivity };
    }

    async setConversation(session_key: string, context: NanobotTurnContext, history: { role: string; content: string }[]): Promise<{
        saved: boolean;
    }> {
        const key = this.resolveConversationKey(session_key);

        await this.redisService.set(`nanobot-context-${key}`, JSON.stringify(context));
        await this.redisService.set(`nanobot-history-${key}`, JSON.stringify(history), 60 * 60 * 24);
        await this.redisService.set(`nanobot-last-activity-${key}`, new Date().toISOString());

        return { saved: true };
    }

    async compactConversation(session_key: string, summary: any, message_count?: number): Promise<{
        saved: boolean;
    }> {
        const key = this.resolveConversationKey(session_key);
        const count = message_count || 0;

        const memory = {
            summary,
            message_count: count,
            last_activity_at: new Date().toISOString()
        };

        await this.redisService.set(`nanobot-memory-${key}`, JSON.stringify(memory), this.memoryTtlSeconds());

        try {
            await this.prismaService.conversationSummaries.upsert({
                where: { session_key: key },
                create: {
                    session_key: key,
                    summary,
                    message_count: count
                },
                update: {
                    summary,
                    message_count: count
                }
            });
        } catch (error) {
            this.loggerService.error("Gagal simpan ringkasan ke database", error, "NanobotApiService/compactConversation");
            // Ringkasan tetap tersedia di Redis meskipun DB gagal
        }

        return { saved: true };
    }

    // ========================================================================
    // LOG TURN - Catat percakapan dari Nanobot ke chat_logs
    // Dipakai hanya bila Nanobot dipanggil langsung (terminal/client eksternal).
    // Jalur NestJS set persist_log=false di request turn, sehingga method ini
    // tidak dipanggil dan chat_logs disimpan lewat persistChatLog (dengan
    // enrichment not_found + generate banks).
    // ========================================================================
    async logTurn({
        channel_user_id,
        user_message,
        bot_reply,
        route,
        tool_calls
    }: {
        channel_user_id: string;
        user_message: string;
        bot_reply: string;
        route?: string;
        tool_calls?: string[];
    }): Promise<boolean> {
        try {
            const year = new Date().getFullYear();
            const contactId = await this.botService.getOrCreateContact(channel_user_id, null);

            if (!contactId) {
                return false;
            }

            const payload: BotWebhookPayload = {
                phone_number: channel_user_id,
                message: user_message,
                webhook_room: ""
            };

            const sessionRoom = await this.sessionService.getSessionRoom(payload);

            await this.prismaService.chatLog.create({
                data: {
                    chat_id: contactId,
                    chat_room: sessionRoom,
                    bot_reply,
                    message: user_message,
                    year,
                }
            });

            this.loggerService.debug(`Log turn tersimpan. route=${route || "-"} tools=${JSON.stringify(tool_calls || [])}`, `NanobotApiService/logTurn`);

            return true;
        } catch (error) {
            this.loggerService.error("Gagal simpan log turn", error, `NanobotApiService/logTurn`);
            return false;
        }
    }
}
