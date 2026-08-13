import { Injectable } from '@nestjs/common';
import { LoggerService } from 'src/logger/logger.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { ActiveRequest } from 'src/active-request/active-request';
import { PengaduanDTO } from 'src/bot-webhook/pengaduan/pengaduan.dto';
import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';

@Injectable()
export class PengaduanService {

    constructor(
        private readonly prismaService: PrismaService,
        private readonly loggerService: LoggerService,
        private readonly redisService: ActiveRequest
    ) { }

    // ========================================================================
    // API COMPLAINT - Dipakai oleh tool Nanobot (state tetap Redis, mengikuti
    // pola form-pengaduan / token-pengaduan pada flow lama)
    // ========================================================================

    async apiGetTemplate(): Promise<{
        success: boolean;
        content?: string;
        keyword_submit?: string;
        message?: string;
    }> {
        const template = await this.prismaService.complaintTemplates.findFirst({
            where: {
                deleted_at: null
            }
        });

        if (!template) {
            return {
                success: false,
                message: "Maaf, saat ini template pengaduan belum tersedia. Silakan coba lagi nanti."
            };
        }

        return {
            success: true,
            content: template.content,
            keyword_submit: template.keyword_submit
        };
    }

    async apiCreateDraft(wa_number: string): Promise<{
        success: boolean;
        ticket?: string;
        content?: string;
        keyword_submit?: string;
        existing_draft?: {
            complaint: string | null;
            attachments_count: number;
        } | null;
        message?: string;
    }> {
        const template = await this.apiGetTemplate();

        if (!template.success) {
            return {
                success: false,
                message: template.message
            };
        }

        const ticket = await this.generateTicketToken(wa_number);

        // Deteksi draft lama yang menggantung (misal dari sesi sebelumnya) agar
        // engine bisa menawarkan lanjutkan / mulai baru (mendukung resume flow).
        let existingDraft: PengaduanDTO | null = null;
        const raw = await this.redisService.get(`form-pengaduan:${wa_number}`);
        if (raw) {
            try {
                existingDraft = JSON.parse(raw) as PengaduanDTO;
            } catch (error) {
                this.loggerService.error(`Gagal parse draft pengaduan: ${error}`, PengaduanService.name);
                existingDraft = null;
            }
        }

        const hasExisting = !!(existingDraft && (existingDraft.complaint || existingDraft.attachments.length > 0));

        if (!raw) {
            const emptyDraft: PengaduanDTO = {
                complaint: null,
                attachments: []
            };
            await this.redisService.set(`form-pengaduan:${wa_number}`, JSON.stringify(emptyDraft), 60 * 60 * 24);
        }

        return {
            success: true,
            ticket,
            content: template.content,
            keyword_submit: template.keyword_submit,
            existing_draft: hasExisting
                ? {
                    complaint: existingDraft.complaint,
                    attachments_count: existingDraft.attachments.length
                }
                : null
        };
    }

    async apiAppendDraft(wa_number: string, value?: string, mediaUrl?: string, mediaCaption?: string): Promise<{
        success: boolean;
        complaint?: string | null;
        attachments?: PengaduanDTO["attachments"];
        message?: string;
    }> {
        const draftKey = `form-pengaduan:${wa_number}`;
        const raw = await this.redisService.get(draftKey);

        if (!raw) {
            return {
                success: false,
                message: "Mohon maaf, tidak ada pengaduan yang sedang berjalan. Silakan mulai pengaduan terlebih dahulu."
            };
        }

        let draft: PengaduanDTO;
        try {
            draft = JSON.parse(raw) as PengaduanDTO;
        } catch (error) {
            this.loggerService.error(`Gagal parse draft pengaduan: ${error}`, PengaduanService.name);
            draft = { complaint: null, attachments: [] };
        }

        const text = (value || "").trim();
        if (text) {
            draft.complaint = `${draft.complaint || ""} ${text}`.trim();
        }

        if (mediaUrl) {
            const ticket = await this.generateTicketToken(wa_number);
            const urlPath = mediaUrl.replace("http://localhost:3000", process.env.WA_GATE_WAY);
            const { status, url } = await this.downloadFile(urlPath, ticket, "pengaduan");

            if (status === false || !url) {
                return {
                    success: false,
                    message: "Mohon maaf terjadi kesalahan saat mengunggah file. Silakan coba lagi.",
                    complaint: draft.complaint,
                    attachments: draft.attachments
                };
            }

            draft.attachments.push({
                file_name: path.basename(url),
                file_path: url,
                caption: mediaCaption || null
            });
        }

        await this.redisService.set(draftKey, JSON.stringify(draft), 60 * 60 * 24);

        return {
            success: true,
            complaint: draft.complaint,
            attachments: draft.attachments
        };
    }

    async apiSubmitDraft(wa_number: string): Promise<{
        success: boolean;
        ticket?: string;
        status?: string;
        message?: string;
    }> {
        const raw = await this.redisService.get(`form-pengaduan:${wa_number}`);

        if (!raw) {
            return {
                success: false,
                message: "Mohon maaf, tidak ada pengaduan yang sedang berjalan. Silakan mulai pengaduan terlebih dahulu."
            };
        }

        let draft: PengaduanDTO | null;
        try {
            draft = JSON.parse(raw) as PengaduanDTO;
        } catch (error) {
            this.loggerService.error(`Gagal parse draft pengaduan: ${error}`, PengaduanService.name);
            draft = null;
        }

        if (!draft || (!draft.complaint && draft.attachments.length === 0)) {
            return {
                success: false,
                message: "Mohon maaf, pengaduan masih kosong. Silakan lengkapi deskripsi atau bukti pendukung terlebih dahulu."
            };
        }

        const ticket = await this.redisService.get(`token-pengaduan:${wa_number}`);
        if (!ticket) {
            return {
                success: false,
                message: "Mohon maaf, tiket pengaduan tidak ditemukan. Silakan mulai pengaduan dari awal."
            };
        }

        const saved = await this.saveComplaintToDatabase(wa_number, draft, ticket);

        if (!saved) {
            return {
                success: false,
                message: "Mohon maaf, terjadi kesalahan saat menyimpan pengaduan Anda. Silakan coba lagi."
            };
        }

        await this.endComplaintDraft(wa_number);

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
        await this.endComplaintDraft(wa_number);

        return {
            success: true,
            cancelled: true
        };
    }

    async apiCheckStatus(ticket: string, wa_number: string): Promise<{
        found: boolean;
        ticket?: string;
        status?: string;
        status_label?: string;
    }> {
        try {
            const complaint = await this.prismaService.complaints.findFirst({
                select: {
                    status: true
                },
                where: {
                    code: ticket,
                    sender: wa_number,
                    deleted_at: null
                }
            });

            if (!complaint) {
                return {
                    found: false
                };
            }

            const statusMap: Record<string, string> = {
                waiting: "sedang menunggu proses",
                on_process: "sedang diproses",
                rejected: "ditolak",
                completed: "selesai"
            };

            return {
                found: true,
                ticket,
                status: complaint.status,
                status_label: statusMap[complaint.status] ?? "sedang menunggu proses"
            };
        } catch (error) {
            this.loggerService.error(`Error checking complaint ticket: ${error}`, PengaduanService.name);

            return {
                found: false
            };
        }
    }

    // ========================================================================
    // HELPER - Mengikuti aturan dan logic penyimpanan flow pengaduan lama
    // ========================================================================

    async generateTicketToken(phone_number: string): Promise<string> {
        const lateTokenExists = await this.redisService.exists(`token-pengaduan:${phone_number}`);
        if (lateTokenExists) {
            this.loggerService.debug(`Existing ticket token found for phone number: ${phone_number}`, PengaduanService.name);
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
        this.loggerService.debug(`Generated ticket token: ${tokenString} for phone number: ${phone_number}`, PengaduanService.name);
        return tokenString;
    }

    async downloadFile(url: string, token: string, defaultFolder?: string): Promise<{ status: boolean, url?: string }> {
        try {
            const outputDIR = path.resolve(__dirname, `${process.env.FILE_FOLDER}/${defaultFolder || `pengaduan`}`);

            if (!fs.existsSync(outputDIR)) {
                fs.mkdirSync(outputDIR, { recursive: true });
            }

            const length = Math.floor(Math.random() * 5) + 10; // 10-14
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
            this.loggerService.error(`Error downloading complaint file: ${error}`, PengaduanService.name);
            return {
                status: false
            };
        }
    }

    async saveComplaintToDatabase(phone_number: string, pengaduanData: PengaduanDTO, token: string, sender?: string): Promise<boolean> {
        try {
            const existingPengaduan = await this.prismaService.complaints.findFirst({
                where: {
                    sender: phone_number,
                    code: token,
                    status: "waiting"
                }
            });

            if (existingPengaduan) {
                await this.prismaService.complaints.update({
                    where: {
                        id: existingPengaduan.id
                    },
                    data: {
                        submit_response: {
                            complaint: pengaduanData.complaint,
                            attachments: pengaduanData.attachments
                        },
                        status: "waiting"
                    }
                });

                this.loggerService.debug(`Data pengaduan sudah ada, diupdate: ${existingPengaduan.id}`, PengaduanService.name);
                return true;
            }

            await this.prismaService.complaints.create({
                data: {
                    code: token,
                    sender: phone_number,
                    submit_response: {
                        complaint: pengaduanData.complaint,
                        attachments: pengaduanData.attachments
                    },
                    sender_name: sender || null,
                    status: "waiting"
                }
            });

            this.loggerService.debug(`Data pengaduan disimpan ke database: ${token}`, PengaduanService.name);
            return true;
        } catch (error) {
            this.loggerService.error(`Error saving complaint form: ${error}`, PengaduanService.name);
            return false;
        }
    }

    async endComplaintDraft(phone_number: string): Promise<void> {
        await this.redisService.del(`token-pengaduan:${phone_number}`);
        await this.redisService.del(`form-pengaduan:${phone_number}`);
    }
}
