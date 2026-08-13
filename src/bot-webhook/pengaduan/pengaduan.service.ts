import { Injectable } from '@nestjs/common';
import { BotWebhookPayload, ProgressDTO } from '../bot-webhook.dto';
import { PengaduanActionService } from './pengaduan-action/pengaduan-action.service';
import { PengaduanResponse } from './pengaduan.dto';
import { ActiveRequest } from 'src/active-request/active-request';
import { SistemInformasiService } from '../sistem-informasi/sistem-informasi.service';
import { Variables } from 'generated/prisma';

@Injectable()
export class PengaduanService {

    constructor(
        private readonly action: PengaduanActionService,
        private readonly redisService: ActiveRequest,
        private readonly SistemInformasiSerivce: SistemInformasiService
    ) { }

    /**
     * @description checkSesiPengaduan adalah fungsi untuk mengecek sesi layanan pengaduan
     * @param phone_number berisi nomor pengirim chat
     * @returns {Promise<"buat-pengaduan" | "check-tiket" | "memilih-jenis-layanan" | "belum-memiliki-sesi">} fungsi mengembalikan 4 string yang menandai sesi yang sedang berlangsung
     */
    async checkSesiPengaduan(phone_number: string): Promise<"buat-pengaduan" | "check-tiket" | "memilih-jenis-layanan" | "belum-memiliki-sesi"> {
        const checkSesi = await this.redisService.exists(`sesi-pengaduan:${phone_number}`);

        if (!checkSesi) {
            return "belum-memiliki-sesi"
        }

        const sesi = await this.redisService.get(`sesi-pengaduan:${phone_number}`) as 'buat-pengaduan' | 'check-tiket' | "memilih-jenis-layanan";

        return sesi
    }

    /**
     * 
     */
    async memulaiSesi(phone_number: string, variabels: Variables[]): Promise<ProgressDTO> {
        await this.redisService.set(`sesi-pengaduan:${phone_number}`, "memilih-jenis-layanan", 60 * 60);

        const response = variabels.find((item) => item.name == "response_memulai_sesi_pengaduan").content;

        return {
            responseMessage: response || "Selamat datang di layanan pengaduan pemko medan. Silahkan untuk memilih kategori layanan pengaduan yang anda inginkan seperti kategori berikut : \n1. Membuat pengaduan\n2. Mengecek status pengaduan yang telah dilaporkan sebelumnya.\n\nUntuk memilih kategori anda dapat mengetikkan angka atau mengetikkan ulang kategorinya.",
            nextProgress: "mengisi-pengaduan"
        }
    }

    /**
     * 
     */
    async checkKategoriLayanan({ phone_number, message }: BotWebhookPayload, variabels: Variables[]): Promise<ProgressDTO> {

        if (message.includes("1") || message.toLowerCase().includes("Membuat pengaduan".toLowerCase())) {

            const templatePengaduan = await this.action.getPengaduanTemplate();

            const response = variabels.find((item) => item.name == "response_membuat_pengaduan").content;

            await this.action.generateTicketToken(phone_number);
            await this.redisService.set(`sesi-pengaduan:${phone_number}`, "buat-pengaduan", 60 * 60);

            return {
                responseMessage: response.replace("TEMPLATE_PENGADUAN", templatePengaduan.content) || `Untuk membuat pengaduan, silahkan untuk mengirimkan data sesuai format data berikut. \n\n ${templatePengaduan.content}`,
                nextProgress: "mengisi-pengaduan"
            }
        }
        else if (message.includes("2") || message.toLocaleLowerCase().includes("Mengecek status pengaduan".toLowerCase())) {
            await this.redisService.set(`sesi-pengaduan:${phone_number}`, "check-tiket", 60 * 60);

            const response = variabels.find((item) => item.name == "response_cek_status_pengaduan").content;

            return {
                responseMessage: response || "Untuk mengecek status pengaduan anda, silahkan untuk mengirimkan nomor tiket pengaduan anda sesuai dengan pengaduan yang sudah pernah anda ajukan.",
                nextProgress: "mengisi-pengaduan"
            }
        }

        const response = variabels.find((item) => item.name == "response_salah_memilih_layanan_pengaduan").content;

        return {
            responseMessage: response || "Mohon maaf sebelumnya, jawaban anda tidak sesuai dengan kategori layanan yang ada. Untuk memilih kategori anda dapat mengetikkan angka atau mengetikkan ulang kategorinya.",
            nextProgress: "mengisi-pengaduan"
        }
    }

    /**
     * 
     */
    async checkStatusPengaduan(payload: BotWebhookPayload, variabels: Variables[], author?: string): Promise<ProgressDTO> {
        const { phone_number, message } = payload;
        const checkTicket = await this.action.pengaduanCheck(phone_number, message);

        await this.redisService.del(`sesi-pengaduan:${phone_number}`);

        if (!checkTicket.status) {
            const response = variabels.find((item) => item.name == "response_kode_pengaduan_tidak_ditemukan").content;

            return {
                responseMessage: response.replace("KODE_PENGADUAN", message).replace("AUTHOR", author || null) || `Mohon maaf kami tidak menemukan pengaduan dengan kode ${message}${author ? ` dengan akun pendaftar bernama ${author}.` : "."} Untuk mendukung perkembangan bot ini, kami mengharapkan penilaian anda terhadap layanan ini. Anda dapat mengetikkan angka dengan rentang 1 - 10 sebagai penilaian anda.`,
                nextProgress: "menanyakan-rating"
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

        await this.SistemInformasiSerivce.setRatingAbsence(payload);

        const response = variabels.find((item) => item.name == "response_kode_pengaduan_ditemukan").content;

        return {
            responseMessage: response.replace("KODE_PENGADUAN", message).replace("PESAN_STATUS", pesanStatus).replace("AUTHOR", author || null) || `Pengaduan dengan kode ${message}${author ? ` atas nama ${author} ditemukan.` : "ditemukan."} Status pengaduan saat ini adalah ${pesanStatus}. Untuk mendukung perkembangan bot ini, kami mengharapkan penilaian anda terhadap layanan ini. Anda dapat mengetikkan angka dengan rentang 1 - 10 sebagai penilaian anda.`,
            nextProgress: "menanyakan-rating"
        }
    }

    /**
     * @description
     * createPengaduan merupaka fungsi untuk mengembalikan response ketika membuat pengaduan
     * @param payload berisi nomor pengirim dan pesan dalam payload yang dapat berupa pesan user ataupun url file
     * @param authormessage  berisi caption file user
     * @param authorName  berisikan nama pengirim pengaduan
     * @returns {Promise<PengaduanResponse>} berisikan objek PengaduanResponse
     */
    async createPengaduan(payload: BotWebhookPayload, authormessage?: string, authorName?: string, variables? : Variables[]): Promise<ProgressDTO> {

        const { phone_number, message } = payload;

        const templatePengaduan = await this.action.getPengaduanTemplate();

        // const checkSesi = await this.action.isTicketTokenExists(phone_number);

        // if (!checkSesi) {
        // }

        const ticketPengaduan = await this.action.generateTicketToken(phone_number);

        if (message.toLowerCase() === templatePengaduan.keyword_submit.toLowerCase()) {

            const checkPengaduanData = await this.action.checkPengaduanDataExists(phone_number);
            await this.action.endPengaduanSession(phone_number);
            await this.redisService.del(`sesi-pengaduan:${phone_number}`);

            await this.SistemInformasiSerivce.setRatingAbsence(payload);

            return {
                responseMessage: checkPengaduanData ? `Terima kasih telah mengirimkan pengaduan anda. Silakan tunggu proses verifikasi dari tim kami. Nomor Tiket Pengaduan Anda adalah *${ticketPengaduan}*. Untuk mendukung perkembangan bot ini, kami mengharapkan penilaian anda terhadap layanan ini. Anda dapat mengetikkan angka dengan rentang 1 - 10 sebagai penilaian anda.` : "Terimakasih sudah menggunakan layanan pengaduan. Kami tidak menemukan data pengaduan yang valid sehingga aduan anda tidak dapat diproses. Untuk mendukung perkembangan bot ini, kami mengharapkan penilaian anda terhadap layanan ini. Anda dapat mengetikkan angka dengan rentang 1 - 10 sebagai penilaian anda.",
                nextProgress: "menanyakan-rating"
            }
        }

        const { type, content } = await this.action.checkChatType(message);

        if (type === "file") {
            const urlPath = content.replace('http://localhost:3000', process.env.WA_GATE_WAY);
            const { status, url } = await this.action.downloadFile(urlPath, ticketPengaduan);

            if (!status) {

                return {
                    responseMessage: `Gagal mengunduh file. Silakan coba lagi atau hubungi tim kami untuk bantuan lebih lanjut.`,
                    nextProgress: "mengisi-pengaduan"
                }
            }

            const dataPengaduan = await this.action.setJSONDataPengaduan(phone_number, undefined, url, authormessage || null);
            await this.action.savePengaduanToDatabase(phone_number, dataPengaduan, ticketPengaduan, authormessage);
        }

        else {
            const dataPengaduan = await this.action.setJSONDataPengaduan(phone_number, content, undefined);
            await this.action.savePengaduanToDatabase(phone_number, dataPengaduan, ticketPengaduan, authorName);
        }

        // return {
        //     status: "success",
        //     statusCode: 200,
        //     message: `Terima kasih telah mengirimkan pengaduan anda. Silakan lengkapi data sesuai format yang telah kami berikan. Jika sudah selesai, silakan balas dengan kata kunci *${templatePengaduan.keyword_submit}*.`
        // };

        const response = variables.find((item) => item.name == "response_kode_pengaduan_ditemukan").content

        return {
            responseMessage: `Terima kasih telah mengirimkan pengaduan anda. Silakan lengkapi data sesuai format yang telah kami berikan. Jika sudah selesai, silakan balas dengan kata kunci *${templatePengaduan.keyword_submit}*.`,
            nextProgress: "mengisi-pengaduan"
        }
    }
}

