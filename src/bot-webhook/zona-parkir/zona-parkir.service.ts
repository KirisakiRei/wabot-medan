import { Injectable } from '@nestjs/common';
import { variables } from 'generated/zona-parkir';
import { ActiveRequest } from 'src/active-request/active-request';
import { ZonaParkirPrismaService } from 'src/zona-parkir-prisma/zona-parkir-prisma.service';
import { BotWebhookPayload, ProgressDTO } from '../bot-webhook.dto';
import { PengaduanDTO, PengaduanResponse } from '../pengaduan/pengaduan.dto';
import { ZonaParkirActionService } from 'src/bot-webhook/zona-parkir/zona-parkir-action/zona-parkir-action.service';
import { ZonaParkir } from 'src/active-request/zona-parkir/zona-parkir';

@Injectable()
export class ZonaParkirService {
    constructor(
        private readonly prisma: ZonaParkirPrismaService,
        private readonly redisService: ZonaParkir,
        private readonly action: ZonaParkirActionService
    ) { }

    async checkSesiPengaduan(phone_number: string): Promise<"buat-pengaduan" | "check-tiket" | "memilih-jenis-layanan" | "belum-memiliki-sesi"> {
        const checkSesi = await this.redisService.exists(`sesi-zona-parkir:${phone_number}`);

        if (!checkSesi) {
            return "belum-memiliki-sesi"
        }

        const sesi = await this.redisService.get(`sesi-zona-parkir:${phone_number}`) as 'buat-pengaduan' | 'check-tiket' | "memilih-jenis-layanan";

        return sesi
    }

    async memulaiSesi(phone_number: string): Promise<PengaduanResponse> {
        await this.redisService.set(`sesi-zona-parkir:${phone_number}`, "memilih-jenis-layanan", 60 * 60);

        return {
            message: "Selamat datang di layanan pengaduan Dinas Perhubungan Kota Medan. Silahkan untuk memilih kategori layanan pengaduan yang anda inginkan seperti kategori berikut : \n1. Membuat pengaduan\n2. Mengecek status pengaduan yang telah dilaporkan sebelumnya.\n\nUntuk memilih kategori anda dapat mengetikkan angka atau mengetikkan ulang kategorinya.",
            status: "success",
            statusCode: 200
        }
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

            if (!data) {
                return {
                    status: false
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

    async checkKategoriLayanan({ phone_number, message }: BotWebhookPayload): Promise<PengaduanResponse> {

        if (message.includes("1") || message.toLowerCase().includes("Membuat pengaduan".toLowerCase())) {

            const templatePengaduan = await this.action.getPengaduanTemplate();

            await this.action.generateTicketToken(phone_number);
            await this.redisService.set(`sesi-zona-parkir:${phone_number}`, "buat-pengaduan", 60 * 60);

            return {
                message: `Untuk membuat pengaduan, silahkan untuk mengirimkan data sesuai format data berikut. \n\n ${templatePengaduan.content}`,
                statusCode: 200,
                status: "success"
            }
        }
        else if (message.includes("2") || message.toLocaleLowerCase().includes("Mengecek status pengaduan".toLowerCase())) {
            await this.redisService.set(`sesi-zona-parkir:${phone_number}`, "check-tiket", 60 * 60);

            return {
                message: "Untuk mengecek status pengaduan anda, silahkan untuk mengirimkan nomor tiket pengaduan anda sesuai dengan pengaduan yang sudah pernah anda ajukan.",
                statusCode: 200,
                status: "success"
            }
        }

        return {
            message: "Mohon maaf sebelumnya, jawaban anda tidak sesuai dengan kategori layanan yang ada. Untuk memilih kategori anda dapat mengetikkan angka atau mengetikkan ulang kategorinya.",
            status: "success",
            statusCode: 400
        }
    }

    async createPengaduan(payload: BotWebhookPayload, authormessage?: string, authorName?: string): Promise<PengaduanResponse> {

        const { phone_number, message } = payload;

        const templatePengaduan = await this.action.getPengaduanTemplate();

        // const checkSesi = await this.action.isTicketTokenExists(phone_number);

        // if (!checkSesi) {
        // }

        const ticketPengaduan = await this.action.generateTicketToken(phone_number);

        if (message.toLowerCase() === templatePengaduan.keyword_submit.toLowerCase()) {

            const checkPengaduanData = await this.action.checkPengaduanDataExists(phone_number);
            await this.action.endPengaduanSession(phone_number);
            await this.redisService.del(`sesi-zona-parkir:${phone_number}`);

            return {
                message: checkPengaduanData ? `Terima kasih telah mengirimkan pengaduan anda. Silakan tunggu proses verifikasi dari tim kami. Nomor Tiket Pengaduan Anda adalah *${ticketPengaduan}*.` : "Terimakasih sudah menggunakan layanan pengaduan. Kami tidak menemukan data pengaduan yang valid sehingga aduan anda tidak dapat diproses.",
                status: checkPengaduanData ? "success" : "error",
                statusCode: checkPengaduanData ? 200 : 400
            }
        }

        const { type, content } = await this.action.checkChatType(message);

        if (type === "file") {
            const urlPath = content.replace('http://localhost:3000', process.env.WA_GATE_WAY);
            const { status, url } = await this.action.downloadFile(urlPath, ticketPengaduan);

            if (!status) {

                return {
                    message: `Gagal mengunduh file. Silakan coba lagi atau hubungi tim kami untuk bantuan lebih lanjut.`,
                    statusCode: 500,
                    status: "error"
                }
            }

            const dataPengaduan = await this.action.setJSONDataPengaduan(phone_number, undefined, url, authormessage || null);
            await this.action.savePengaduanToDatabase(phone_number, dataPengaduan, ticketPengaduan, authormessage);
        }

        else {
            const dataPengaduan = await this.action.setJSONDataPengaduan(phone_number, content, undefined);
            await this.action.savePengaduanToDatabase(phone_number, dataPengaduan, ticketPengaduan, authorName);
        }

        return {
            status: "success",
            statusCode: 200,
            message: `Terima kasih telah mengirimkan pengaduan anda. Silakan lengkapi data sesuai format yang telah kami berikan. Jika sudah selesai, silakan balas dengan kata kunci *${templatePengaduan.keyword_submit}*.`
        };
    }

    async checkStatusPengaduan(payload: BotWebhookPayload, author?: string): Promise<PengaduanResponse> {
        const { phone_number, message } = payload;
        const checkTicket = await this.action.pengaduanCheck(phone_number, message);

        await this.redisService.del(`sesi-zona-parkir:${phone_number}`);

        if (!checkTicket.status) {

            return {
                message: `Mohon maaf kami tidak menemukan pengaduan dengan kode ${message}${author ? ` dengan akun pendaftar bernama ${author}.` : "."}`,
                status: author ? "success" : "error",
                statusCode: author ? 200 : 404
            }
        }

        let pesanStatus: string = "";

        switch (checkTicket.data.status) {
            case "waiting":
                pesanStatus = "masih menunggu untuk diproses"
                break;
            case "rejected":
                pesanStatus = "ditolak"
                break;
            case "on process":
                pesanStatus = "sedang diproses"
                break;
            case "completed":
                pesanStatus = "sudah selesai diproses"
                break;
            default:
                pesanStatus = "masih menunggu untuk diproses"
                break;
        }

        return {
            message: `Pengaduan dengan kode ${message}${author ? ` atas nama ${author} ditemukan.` : "ditemukan."} Status pengaduan saat ini adalah ${pesanStatus}.`,
            status: author ? "success" : "error",
            statusCode: author ? 200 : 404
        }
    }
}
