import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { LoggerService } from 'src/logger/logger.service';
import { AiService } from '../ai/ai.service';
import { SistemInformasiService } from '../sistem-informasi/sistem-informasi.service';
import { UsulanService } from '../usulan/usulan.service';
import { BotWithoutFlowService } from '../bot-without-flow.service';
import { SessionService } from '../session/session.service';
import { BotWebhookPayload } from 'src/bot-webhook/bot-webhook.dto';

@Injectable()
export class NanobotApiService {

    constructor(
        private readonly botService: BotWithoutFlowService,
        private readonly sistemInformasiService: SistemInformasiService,
        private readonly usulanService: UsulanService,
        private readonly aiService: AiService,
        private readonly sessionService: SessionService,
        private readonly prismaService: PrismaService,
        private readonly loggerService: LoggerService
    ) { }

    // ========================================================================
    // PREFLIGHT - Filter kata kasar + blokir kontak
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

        return {
            allowed: true,
            blocked: false,
            badword: false,
            rate_limited: false,
            action: "CONTINUE"
        };
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
    // LOG TURN - Catat percakapan dari Nanobot ke chat_logs
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
