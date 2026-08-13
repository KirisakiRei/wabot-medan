import { Injectable } from '@nestjs/common';
import { complaint_templates } from 'generated/zona-parkir';
import * as fs from 'fs';
import * as path from 'path';
import { ActiveRequest } from 'src/active-request/active-request';
import { ZonaParkirPrismaService } from 'src/zona-parkir-prisma/zona-parkir-prisma.service';
import axios from 'axios';
import { PengaduanDTO } from 'src/bot-webhook/pengaduan/pengaduan.dto';

@Injectable()
export class ZonaParkirActionService {

    private readonly todayDateTime: string;

    constructor(
        private readonly prisma: ZonaParkirPrismaService,
        private readonly redisService: ActiveRequest
    ) {
        const formatter = new Intl.DateTimeFormat('id-ID', {
            timeZone: 'Asia/Jakarta',
            hour12: false,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });

        this.todayDateTime = formatter.format(new Date()).replace(/\//g, '-').replace(', ', 'T');

    }

    async getPengaduanTemplate(): Promise<complaint_templates> {
        console.info("Mulai mengambil template pengaduan dari database");

        const template = await this.prisma.complaint_templates.findFirst({
            where: {
                deleted_at: null,
            }
        });

        if (!template) {
            console.warn("Tidak ada template pengaduan yang ditemukan");
            return null;
        }

        console.info("Template pengaduan ditemukan:", template);
        return template;
    }

    async generateTicketToken(phone_number: string): Promise<string> {
        console.info("Mulai generate token tiket pengaduan untuk nomor:", phone_number);
        // Cek apakah token tiket pengaduan sudah ada di Redis
        const lateTokenExists = await this.redisService.exists(`token-zona-parkir:${phone_number}`);
        if (lateTokenExists) {
            console.info("Token tiket pengaduan sudah ada untuk nomor:", phone_number);
            return this.redisService.get(`token-zona-parkir:${phone_number}`);
        }

        // Generate random alphanumeric token with length between 6 and 10
        const length = Math.floor(Math.random() * 5) + 6; // 6-10
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let tokenString = '';
        for (let i = 0; i < length; i++) {
            tokenString += chars.charAt(Math.floor(Math.random() * chars.length));
        }

        // Simpan token ke Redis untuk validasi
        await this.redisService.set(`token-zona-parkir:${phone_number}`, tokenString, 60 * 60 * 24); // Simpan selama 24 jam
        console.info("Token tiket pengaduan disimpan di Redis");
        return tokenString;
    }

    async endPengaduanSession(phone_number: string): Promise<void> {
        console.info("Mulai mengakhiri sesi pengaduan untuk nomor:", phone_number);

        const pengaduanData = await this.redisService.get(`form-zona-parkir:${phone_number}`);
        const tokenPengaduan = await this.redisService.get(`token-zona-parkir:${phone_number}`);
        if (tokenPengaduan) {
            await this.redisService.del(`token-zona-parkir:${phone_number}`);
            console.info("Token tiket pengaduan dihapus dari Redis untuk nomor:", phone_number);
        }
        if (!pengaduanData) {
            console.info("Tidak ada data pengaduan yang ditemukan untuk nomor:", phone_number);
            return;
        }

        if (!pengaduanData) {
            console.warn("Tidak ada data pengaduan yang ditemukan untuk nomor:", phone_number);
            return;
        }

        await this.redisService.del(`form-zona-parkir:${phone_number}`);
        console.info("Data pengaduan dihapus dari Redis untuk nomor:", phone_number);
        console.info("Sesi pengaduan untuk nomor", phone_number, "telah diakhiri.");
        return;
    }

    async checkPengaduanDataExists(phone_number: string): Promise<boolean> {
        console.info("Mulai mengecek apakah data pengaduan sudah ada untuk nomor:", phone_number);

        // Cek apakah data pengaduan sudah ada di Redis
        const pengaduanExists = await this.redisService.exists(`form-zona-parkir:${phone_number}`);
        if (pengaduanExists) {
            console.info("Data pengaduan sudah ada untuk nomor:", phone_number);
            return true;
        }
        console.info("Data pengaduan belum ada untuk nomor:", phone_number);
        return false;
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
            const outputDIR = path.resolve(__dirname, `${process.env.FILE_FOLDER_ZONA_PARKIR}/${defaultFolder || `zonaparkir`}`);
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
                url: `/media/${defaultFolder || "zonaparkir"}/${tokenString}-${token}${fileExtension}`
            };
        }
        catch (error) {
            console.error("Error downloading file:", error);
            return {
                status: false
            };
        }
    }

    async setJSONDataPengaduan(phone_number: string, message?: string, filePath?: string, fileCaption?: string): Promise<PengaduanDTO> {
        console.info("Mulai menyimpan data pengaduan ke Redis untuk nomor:", phone_number);

        const complaintData: PengaduanDTO = {
            complaint: message || null,
            attachments: []
        };

        const existingData = await this.redisService.get(`form-zona-parkir:${phone_number}`);

        if (existingData) {
            console.info("Data pengaduan sudah ada di Redis, menggabungkan dengan data baru");
            const existingComplaintData: PengaduanDTO = JSON.parse(existingData);
            complaintData.complaint = existingComplaintData.complaint || complaintData.complaint;
            complaintData.attachments = [...existingComplaintData.attachments, ...complaintData.attachments];
        }

        if (message) {

            if (complaintData.complaint !== message) {
                console.info("Mengupdate pesan pengaduan");
                complaintData.complaint = `${complaintData.complaint || ''} ${message}`.trim();
                console.info("Pesan pengaduan diupdate:", complaintData.complaint);
            }
            else {
                console.info("Pesan pengaduan tidak berubah, tidak perlu update");
            }
        }

        if (filePath) {
            complaintData.attachments.push({
                file_name: path.basename(filePath),
                file_path: filePath,
                caption: fileCaption || null
            });
        }

        await this.redisService.set(`form-zona-parkir:${phone_number}`, JSON.stringify(complaintData), 60 * 60 * 24); // Simpan selama 24 jam
        console.info("Data pengaduan disimpan di Redis");
        return complaintData;
    }

    async savePengaduanToDatabase(phone_number: string, pengaduanData: PengaduanDTO, token: string, sender?: string): Promise<void> {
        console.info("Mulai menyimpan data pengaduan ke database untuk nomor:", phone_number);

        if (!pengaduanData) {
            console.warn("Tidak ada data pengaduan yang ditemukan untuk nomor:", phone_number);
            return;
        }

        const tokenPengaduan = await this.redisService.get(`token-zona-parkir:${phone_number}`);
        if (tokenPengaduan !== token) {
            console.error("Token tiket pengaduan tidak valid untuk nomor:", phone_number);
            throw new Error("Token tiket pengaduan tidak valid");
        }

        const existingPengaduan = await this.prisma.complaints.findFirst({
            where: {
                sender: phone_number,
                code: token,
                status: "waiting"
            }
        });

        if (existingPengaduan) {

            const updatedPengaduan = await this.prisma.complaints.update({
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
            console.info("Data pengaduan sudah ada, diupdate:", updatedPengaduan);
            return;
        }

        const newPengaduan = await this.prisma.complaints.create({
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

        console.info("Data pengaduan disimpan ke database:", newPengaduan);

        return;
    }

    async pengaduanCheck(phone_number: string, message: string): Promise<{
        status: boolean,
        data?: {
            status: "waiting" | "on process" | "rejected" | "completed",
            sender_name: string,
        }
    }> {

        try {
            const data = await this.prisma.complaints.findFirst({
                select: {
                    sender_name: true,
                    status: true
                },
                where: {
                    sender: phone_number,
                    AND: {
                        code: message
                    }
                }
            });

            if(!data) {
                return {
                    status : false
                }
            }

            // Map database status to expected string union type
            const statusMap: Record<string, "waiting" | "on process" | "rejected" | "completed"> = {
                waiting: "waiting",
                on_process: "on process",
                rejected: "rejected",
                completed: "completed"
            };

            return {
                status: true,
                data: {
                    status: statusMap[data.status] ?? "waiting",
                    sender_name: data.sender_name
                }
            }
        }
        catch (err) {
            return {
                status: false
            }
        }
    }
}


