import { Inject, Injectable } from '@nestjs/common';
import { LoggerService } from 'src/logger/logger.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { SessionService } from '../session/session.service';
import { FinalMessage } from '../types/common.types';
import { AiService } from '../ai/ai.service';
import { BotWebhookPayload } from 'src/bot-webhook/bot-webhook.dto';
import { request_forms, Variables } from 'generated/prisma';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { ActiveRequest } from 'src/active-request/active-request';
import { LayananPublikDTO } from 'src/bot-webhook/layanan-publik/layanan-publik.dto';
import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';

@Injectable()
export class UsulanService {

    constructor(
        private readonly prismaService: PrismaService,
        private readonly loggerService: LoggerService,
        private readonly sessionService: SessionService,
        private readonly aiService: AiService,
        @Inject(CACHE_MANAGER) private cacheManager: Cache,
        private readonly redisService: ActiveRequest,
    ) { }

    async getRequestForms(request_id: string): Promise<request_forms[]> {
        return await this.prismaService.request_forms.findMany({
            where: {
                request_id
            }
        });
    }

    async handleRequest(payload: BotWebhookPayload, variables: Variables[]): Promise<FinalMessage> {

        let finalMessage: FinalMessage = {
            message: "",
            message_type: "text",
            not_found : false,
            not_found_session : null
        }

        const responseAI = await this.aiService.matchRequestRAG({
            request: payload.message,
            wa_number: payload.phone_number,
            variables
        });

        if (responseAI === null) {
            finalMessage.message = "Maaf, saat ini saya tidak dapat menemukan layanan yang sesuai dengan permintaan Anda.";
            finalMessage.message_type = "text";
            finalMessage.not_found = true;
            finalMessage.not_found_session = "layanan-publik";
            return finalMessage;
        }

        const requestForms = await this.getRequestForms(responseAI.request_id);

        if (requestForms.length === 0) {
            finalMessage.message = "Maaf, saat ini saya tidak dapat menemukan formulir untuk layanan yang Anda minta.";
            finalMessage.message_type = "text";
            return finalMessage;
        }

        await this.cacheManager.set(`request_forms_${payload.phone_number}`, requestForms, 300000);
        await this.cacheManager.set(`index_proses_pengisian_memilih_layanan_publik_${payload.phone_number}`, 0, 300000);

        finalMessage.message = `Saya telah menemukan layanan yang sesuai untuk Anda: *${responseAI.request_name}*.\n\nSilahkan isi ${requestForms[0].form}`;
        finalMessage.message_type = "text";

        this.sessionService.setSession("mengisi-formulir", payload);

        return finalMessage;
    }


    async generateTicketToken(phone_number: string): Promise<string> {
        // Cek apakah token tiket pengaduan sudah ada di Redis
        const lateTokenExists = await this.redisService.exists(`token-pengaduan:${phone_number}`);
        if (lateTokenExists) {
            this.loggerService.debug(`Existing ticket token found for phone number: ${phone_number}`, UsulanService.name);
            return this.redisService.get(`token-pengaduan:${phone_number}`);
        }

        // Generate random alphanumeric token with length between 6 and 10
        const length = Math.floor(Math.random() * 5) + 6; // 6-10
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let tokenString = '';
        for (let i = 0; i < length; i++) {
            tokenString += chars.charAt(Math.floor(Math.random() * chars.length));
        }

        // Simpan token ke Redis untuk validasi
        await this.redisService.set(`token-pengaduan:${phone_number}`, tokenString, 60 * 60 * 24); // Simpan selama 24 jam
        this.loggerService.debug(`Generated ticket token: ${tokenString} for phone number: ${phone_number}`, UsulanService.name);
        return tokenString;
    }

    async checkChatType(chat: string): Promise<{ type: 'text' | 'file', content: string }> {

        console.info("Mulai mengecek tipe chat:", chat);
        // Jika chat memiliki extensi file, anggap sebagai file
        const fileExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.pdf', '.docx', '.xlsx', '.pptx', '.txt', '.zip', '.rar', '.mp3', '.mp4', '.avi', '.mov', '.mkv', '.doc', '.xls', '.ppt', '.csv', '.json', '.xml', '.html', '.css', '.js', '.ts', '.java', '.py', '.rb', '.go', '.php', '.c', '.cpp', '.h', '.sh', '.bat', '.exe', '.dll', '.so', '.dmg', '.iso', '.apk', '.ipa', '.exe', '.msi', '.tar', '.gz', '.bz2', '.7z', '.rar', '.tar.gz', '.tar.bz2', '.tar.xz', '.tgz', '.tbz2', '.txz'];

        const isFile = fileExtensions.some(ext => chat.toLowerCase().endsWith(ext));
        if (isFile) {
            return { type: 'file', content: chat };
        } else {
            return { type: 'text', content: chat };
        }
    }

    async downloadFile(url: string, token: string, defaultFolder?: string): Promise<{ status: boolean, url?: string }> {

        console.info("Mulai mendownload file dari URL:", url);

        try {
            const outputDIR = path.resolve(__dirname, `${process.env.FILE_FOLDER}/${defaultFolder || `pengaduan`}`);
            console.info("Output directory:", outputDIR);

            if (!fs.existsSync(outputDIR)) {
                console.info("Direktori output tidak ditemukan");

                fs.mkdirSync(outputDIR, { recursive: true });

                return {
                    status: false
                };
            }

            const length = Math.floor(Math.random() * 5) + 10; // 6-10
            const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
            let tokenString = '';
            for (let i = 0; i < length; i++) {
                tokenString += chars.charAt(Math.floor(Math.random() * chars.length));
            }

            const fileName = path.basename(url);
            const fileExtension = path.extname(fileName);

            const filePath = path.join(outputDIR, `${tokenString}-${token}${fileExtension}`);

            const response = await axios({
                method: 'get',
                url: url,
                responseType: 'stream',
                headers: {
                    'Content-Type': 'application/json',
                    "X-Api-Key": process.env.WA_GATE_WAY_API_KEY
                }
            });

            const writer = fs.createWriteStream(filePath);
            response.data.pipe(writer);

            await new Promise((resolve, reject) => {
                writer.on('finish', () => resolve(filePath));
                writer.on('error', reject);
            });

            return {
                status: true,
                url: `/media/${defaultFolder || "pengaduan"}/${tokenString}-${token}${fileExtension}`
            };
        }
        catch (error) {
            console.error("Error downloading file:", error);
            return {
                status: false
            };
        }
    }

    async saveUsulanForm(requestData: LayananPublikDTO) {
        try {
            return await this.prismaService.request_histories.create({
                data: {
                    request_id: requestData.request_bank_id,
                    submit_response: requestData.request_token,
                    status: "waiting",
                    sender: requestData.request_sender,
                    request_history_details: {
                        create: requestData.request_history.map((item) => ({
                            value: item.value,
                            type: item.type,
                            request_form_id: item.request_form_id
                        })),
                    },
                },
            });
        } catch (error) {
            this.loggerService.error(`Error saving usulan form: ${error}`, UsulanService.name);
            return null;
        }
    }

    // ========================================================================
    // API PROPOSAL - Dipakai oleh tool Nanobot (state tetap Redis/CacheManager)
    // ========================================================================

    async apiGetSchema(request_id: string): Promise<{
        request_id: string;
        request_name: string;
        forms: { id: string; form: string; type: "text" | "file"; order: number }[];
    } | null> {
        const requestBank = await this.prismaService.request_banks.findFirst({
            select: {
                id: true,
                request_name: true
            },
            where: {
                id: request_id,
                is_active: true
            }
        });

        if (!requestBank) {
            return null;
        }

        const forms = await this.getRequestForms(request_id);

        return {
            request_id: requestBank.id,
            request_name: requestBank.request_name || "Layanan",
            forms: forms.map((item) => ({
                id: item.id,
                form: item.form || "",
                type: item.type,
                order: item.order
            }))
        };
    }

    async apiCreateDraft(wa_number: string, request_id: string): Promise<{
        success: boolean;
        draft_key: string;
        token?: string;
        request_name?: string;
        next_form?: string | null;
        forms?: { id: string; form: string; type: "text" | "file"; order: number }[];
        message?: string;
    }> {
        const schema = await this.apiGetSchema(request_id);

        if (!schema || schema.forms.length === 0) {
            return {
                success: false,
                draft_key: wa_number,
                message: "Maaf, saat ini saya tidak dapat menemukan formulir untuk layanan yang Anda minta."
            };
        }

        await this.cacheManager.set(`request_forms_${wa_number}`, schema.forms, 300000);
        await this.cacheManager.set(`index_proses_pengisian_memilih_layanan_publik_${wa_number}`, 0, 300000);
        await this.redisService.set(`request_histories_${wa_number}`, JSON.stringify({
            request_history: [],
            request_bank_id: request_id,
            request_sender: wa_number
        }), 300000);

        const token = await this.generateTicketToken(wa_number);

        return {
            success: true,
            draft_key: wa_number,
            token,
            request_name: schema.request_name,
            next_form: schema.forms[0].form,
            forms: schema.forms
        };
    }

    async apiUpdateField(wa_number: string, form_id: string, value: string): Promise<{
        success: boolean;
        saved?: boolean;
        done?: boolean;
        token?: string;
        next_form?: string | null;
        message?: string;
    }> {
        const nowIndex: number = await this.cacheManager.get(`index_proses_pengisian_memilih_layanan_publik_${wa_number}`);
        const requestForms: { id: string; form: string; type: "text" | "file"; order: number }[] = await this.cacheManager.get(`request_forms_${wa_number}`);

        if (nowIndex === null || nowIndex === undefined || !requestForms || nowIndex >= requestForms.length) {
            return {
                success: false,
                message: "Mohon maaf sedang terjadi kesalahan. Silahkan ulangi proses dari awal."
            };
        }

        const currentForm = requestForms[nowIndex];

        if (currentForm.id !== form_id) {
            return {
                success: false,
                message: "Mohon maaf, isian form tidak sesuai urutan. Silahkan ikuti instruksi form yang diberikan."
            };
        }

        const { type, content } = await this.checkChatType(value);

        let storedValue = value;

        if (currentForm.type === "file") {
            if (type !== "file") {
                return {
                    success: false,
                    message: "Mohon maaf, anda harus mengirimkan file untuk mengisi form ini."
                };
            }

            const ticketToken = await this.generateTicketToken(wa_number);
            const urlPath = content.replace('http://localhost:3000', process.env.WA_GATE_WAY);
            const { status, url } = await this.downloadFile(urlPath, ticketToken, "layanan-publik");

            if (status === false || !url) {
                return {
                    success: false,
                    message: "Mohon maaf terjadi kesalahan saat mengunggah file. Silahkan coba lagi."
                };
            }

            storedValue = url;
        } else {
            if (type !== "text") {
                return {
                    success: false,
                    message: "Mohon maaf, anda harus mengirimkan teks untuk mengisi form ini."
                };
            }
        }

        const requestData: LayananPublikDTO = JSON.parse(await this.redisService.get(`request_histories_${wa_number}`) || "{}");

        requestData.request_history = requestData.request_history || [];
        requestData.request_bank_id = requestData.request_bank_id || "";
        requestData.request_token = requestData.request_token || (await this.generateTicketToken(wa_number));
        requestData.request_sender = requestData.request_sender || wa_number;

        requestData.request_history.push({
            request_form_id: currentForm.id,
            value: storedValue,
            type: currentForm.type
        });

        await this.redisService.set(`request_histories_${wa_number}`, JSON.stringify(requestData), 300000);

        if (nowIndex === requestForms.length - 1) {
            return {
                success: true,
                saved: true,
                done: true,
                token: requestData.request_token
            };
        }

        await this.cacheManager.set(`index_proses_pengisian_memilih_layanan_publik_${wa_number}`, nowIndex + 1, 300000);

        return {
            success: true,
            saved: true,
            done: false,
            token: requestData.request_token,
            next_form: requestForms[nowIndex + 1].form
        };
    }

    async apiValidateDraft(wa_number: string): Promise<{
        valid: boolean;
        missing_fields: { id: string; form: string; type: string }[];
    }> {
        const requestForms: { id: string; form: string; type: "text" | "file"; order: number }[] = await this.cacheManager.get(`request_forms_${wa_number}`);

        if (!requestForms || requestForms.length === 0) {
            return {
                valid: false,
                missing_fields: []
            };
        }

        const requestData: LayananPublikDTO = JSON.parse(await this.redisService.get(`request_histories_${wa_number}`) || "{}");
        const filledFormIds = (requestData.request_history || []).map((item) => item.request_form_id);

        const missingFields = requestForms
            .filter((item) => !filledFormIds.includes(item.id))
            .map((item) => ({
            id: item.id,
            form: item.form,
            type: item.type
        }));

        return {
            valid: missingFields.length === 0,
            missing_fields: missingFields
        };
    }

    async apiSubmitDraft(wa_number: string): Promise<{
        success: boolean;
        ticket?: string;
        status?: string;
        message?: string;
    }> {
        const requestData: LayananPublikDTO = JSON.parse(await this.redisService.get(`request_histories_${wa_number}`) || "{}");

        if (!requestData.request_bank_id || !requestData.request_token || !requestData.request_history || requestData.request_history.length === 0) {
            return {
                success: false,
                message: "Mohon maaf, draft permohonan tidak ditemukan. Silahkan ulangi proses dari awal."
            };
        }

        const saved = await this.saveUsulanForm(requestData);

        if (!saved) {
            return {
                success: false,
                message: "Mohon maaf, terjadi kesalahan saat menyimpan permohonan Anda. Silakan coba lagi."
            };
        }

        const ticket = requestData.request_token;

        await this.endFillingForm(wa_number);

        return {
            success: true,
            ticket,
            status: "waiting"
        };
    }

    async apiCancelDraft(wa_number: string): Promise<{
        success: boolean;
        cancelled: boolean;
    }> {
        await this.endFillingForm(wa_number);

        return {
            success: true,
            cancelled: true
        };
    }

    async apiCheckTicket(ticket: string, wa_number: string): Promise<{
        found: boolean;
        ticket?: string;
        request_name?: string;
        status?: string;
        status_label?: string;
    }> {
        try {
            const response = await this.prismaService.request_histories.findFirst({
                select: {
                    status: true,
                    requestBank: {
                        select: {
                            request_name: true
                        }
                    }
                },
                where: {
                    submit_response: ticket,
                    sender: wa_number
                }
            });

            if (!response) {
                return {
                    found: false
                };
            }

            return {
                found: true,
                ticket,
                request_name: response.requestBank.request_name || "Layanan",
                status: response.status,
                status_label: response.status === "approved" ? "sudah diproses" : response.status === "rejected" ? "ditolak" : "sedang dalam proses"
            };
        } catch (error) {
            this.loggerService.error(`Error checking usulan ticket: ${error}`, UsulanService.name);

            return {
                found: false
            };
        }
    }

    async continueFillingForm(payload: BotWebhookPayload, variables: Variables[]): Promise<FinalMessage> {
        let finalMessage: FinalMessage = {
            message: "",
            message_type: "text",
            not_found : false,
            not_found_session : null
        }

        const nowIndex: number = await this.cacheManager.get(`index_proses_pengisian_memilih_layanan_publik_${payload.phone_number}`);
        const requestForms: request_forms[] = await this.cacheManager.get(`request_forms_${payload.phone_number}`);

        if (nowIndex === null || nowIndex === undefined || !requestForms || nowIndex >= requestForms.length) {
            finalMessage.message = `Mohon maaf sedang terjadi kesalahan. Silahkan ulangi proses dari awal.`;
            finalMessage.message_type = "text";
            await this.sessionService.setSession("sesi-percakapan", payload);
            return finalMessage;
        }

        await this.redisService.set(`request_histories_${payload.phone_number}`, JSON.stringify({
            request_history: []
        }), 300000);

        const ticketPengaduan = await this.generateTicketToken(payload.phone_number);

        let requestData: LayananPublikDTO = JSON.parse(await this.redisService.get(`request_histories_${payload.phone_number}`) || "{}");

        requestData.request_history = requestData.request_history || [];
        requestData.request_bank_id = requestData.request_bank_id || requestForms[nowIndex].request_id;
        requestData.request_token = requestData.request_token || ticketPengaduan;
        requestData.request_sender = requestData.request_sender || payload.phone_number;

        const currentForm = requestForms[nowIndex];
        const { type, content } = await this.checkChatType(payload.message);

        if (currentForm.type === "file") {
            if (type !== "file") {

                finalMessage.message = `Mohon maaf, anda harus mengirimkan file untuk mengisi form ini. Silahkan kirimkan file yang sesuai dengan form ini.`;
                finalMessage.message_type = "text";
                return finalMessage;
            }

            const urlPath = content.replace('http://localhost:3000', process.env.WA_GATE_WAY);
            const { status, url } = await this.downloadFile(urlPath, ticketPengaduan, "layanan-publik");

            if (status === false) {

                finalMessage.message = `Mohon maaf terjadi kesalahan saat mengunggah file. Silahkan coba lagi.`;
                finalMessage.message_type = "text";
                return finalMessage;
            }

            requestData.request_history.push({
                request_form_id: currentForm.id,
                value: url,
                type: currentForm.type
            });
        } else {
            if (type !== "text") {

                finalMessage.message = `Mohon maaf, anda harus mengirimkan teks untuk mengisi form ini. Silahkan kirimkan teks yang sesuai dengan form ini.`;
                finalMessage.message_type = "text";
                return finalMessage;
            }

            requestData.request_history.push({
                request_form_id: currentForm.id,
                value: payload.message,
                type: currentForm.type
            });
        }

        await this.redisService.set(`request_histories_${payload.phone_number}`, JSON.stringify(requestData), 300000);

        if (nowIndex == requestForms.length - 1) {
            await this.cacheManager.del(`index_proses_pengisian_memilih_layanan_publik_${payload.phone_number}`);
            await this.cacheManager.del(`request_forms_${payload.phone_number}`);
            await this.redisService.del(`token-pengaduan:${payload.phone_number}`);

            await this.saveUsulanForm(requestData);

            finalMessage.message = `Terima kasih telah mengisi formulir ${requestForms[0].form}. Permintaan Anda telah kami terima dan akan diproses lebih lanjut dengan kode tiket ${ticketPengaduan}.`;
            finalMessage.message_type = "text";

            await this.sessionService.setSession("sesi-percakapan", payload);

            return finalMessage;
        }
        else {
            await this.cacheManager.set(`index_proses_pengisian_memilih_layanan_publik_${payload.phone_number}`, nowIndex + 1, 300000);

            finalMessage.message = `Selanjutnya, silahkan isi ${requestForms[nowIndex + 1].form}`;
            finalMessage.message_type = "text";
            return finalMessage;
        }
    }

    async endFillingForm(phone_number: string) {
        await this.cacheManager.del(`index_proses_pengisian_memilih_layanan_publik_${phone_number}`);
        await this.cacheManager.del(`request_forms_${phone_number}`);
        await this.redisService.del(`token-pengaduan:${phone_number}`);
        await this.redisService.del(`request_histories_${phone_number}`);
    }

    async cekTiketUsulan(tiket: string, phone_number: string): Promise<FinalMessage> {
        let finalMessage: FinalMessage = {
            message: "",
            message_type: "text",
            not_found : false,
            not_found_session : null
        }

        await this.prismaService.request_histories.findFirst({
            select: {
                status: true,
                requestBank: {
                    select: {
                        request_name: true
                    }
                }
            },
            where: {
                submit_response: tiket,
                sender: phone_number
            }
        }).then(
            (response) => {

                this.loggerService.debug(`Cek tiket usulan response: ${JSON.stringify(response)}`, UsulanService.name);

                if (!response) {
                    finalMessage.message = `Maaf, tiket dengan kode *${tiket}* tidak ditemukan untuk nomor Anda. Silakan periksa kembali kode tiket Anda.`;
                    finalMessage.message_type = "text";                    
                }
                else{
                    finalMessage.message = `Status layanan ${response.requestBank.request_name} dengan kode tiket ${tiket} adalah: *${response.status === "approved" ? "sudah diproses" : response.status === "rejected" ? "ditolak" : "sedang dialam proses"}*. Terima kasih telah menggunakan layanan kami.`;
                    finalMessage.message_type = "text";
                }
            }
        ).catch((error) => {
            this.loggerService.error(`Error checking usulan ticket: ${error}`, UsulanService.name);

            finalMessage.message = `Maaf, terjadi kesalahan saat memeriksa tiket Anda. Silakan coba lagi nanti.`;
            finalMessage.message_type = "text";
        });

        return finalMessage;
    }
}
