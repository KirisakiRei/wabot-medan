import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable } from '@nestjs/common';
import { SistemInformasiService } from './sistem-informasi/sistem-informasi.service';
import { SessionService } from './session/session.service';
import { ResponseGeneratorService } from './response-generator/response-generator.service';
import { WaGateWayService } from './wa-gate-way/wa-gate-way.service';
import { PengaduanService } from './pengaduan/pengaduan.service';
import { BotWebhookPayload, ProgressDTO } from './bot-webhook.dto';
import { Cache } from 'cache-manager';
import { ActiveRequest } from 'src/active-request/active-request';
import { PengaduanResponse } from './pengaduan/pengaduan.dto';
import { Variables } from 'generated/prisma';
import { LayananPublikActionService } from './layanan-publik/layanan-publik-action/layanan-publik-action.service';

@Injectable()
export class BotWebhookService {

    constructor(
        @Inject(CACHE_MANAGER) private cacheManager: Cache,
        private readonly service: SistemInformasiService,
        private readonly sessionService: SessionService,
        private readonly aiService: ResponseGeneratorService,
        private readonly wagateService: WaGateWayService,
        private readonly pengaduanService: PengaduanService,
        private readonly redisService: ActiveRequest,
        private readonly lpService: LayananPublikActionService
    ) { }

    /**
     * Fungsi memulai progress chat
     * @param idPhoneNumber 
     * @param payload 
     * @param checkSession 
     * @param session 
     * @param prompt 
     * @param configResponse 
     * @returns 
     */
    async memulaiChat(idPhoneNumber: string, payload: BotWebhookPayload, checkSession: string, session: Record<string, any>, prompt?: string, configResponse?: string): Promise<ProgressDTO> {

        const ratingAbsence = await this.service.getRatingAbsence(payload);

        let respon: ProgressDTO = {
            responseMessage: "",
            nextProgress: "memilih-kategori-layanan",
        };

        if (ratingAbsence !== null) {

            respon = {
                ...respon,
                responseMessage: "Anda masih belum memberikan rating pada sesi percakapan sebelumnya. Silahkan untuk memberikan rating terlebih dahulu antara 1 - 10.",
                nextProgress: "mengisi-rating-sesi-sebelumnya"
            }
        }
        else {

            respon = {
                ...respon,
                responseMessage: configResponse || "Selamat datang di layanan Tanya Medan. Anda dapat memilih layanan kami dengan cara mengetikkan angka pilihan atau mengetikkan nama kategori layanan. Layanan yang tersedia adalah \n 1. Layanan Pengaduan. \n 2. Layanan Sistem Informasi",
                nextProgress: "memilih-kategori-layanan"
            }
        }
        await this.service.saveNormalMessage(idPhoneNumber, payload, respon.responseMessage);

        return respon
    }

    async memilihKategoriLayanan(idPhoneNumber: string, payload: BotWebhookPayload, checkSession: string, session: Record<string, any>, prompt?: string, configResponse?: string, variabels?: Variables[]): Promise<ProgressDTO> {

        const { phone_number, message, webhook_room } = payload;

        let respon: ProgressDTO;

        // Kondisi Memilih layanan pengaduan
        if (message.includes("1") || message.toLowerCase().includes("Layanan Pengaduan".toLowerCase())) {
            await this.redisService.set(`sesi-pengaduan:${phone_number}`, "memilih-jenis-layanan", 60 * 60);
            respon = {
                ...respon,
                responseMessage: variabels.find((item) => item.name == "response_memilih_pengaduan").content || "Selamat datang di layanan pengaduan pemko medan. Silahkan untuk memilih kategori layanan pengaduan yang anda inginkan seperti kategori berikut : \n1. Membuat pengaduan\n2. Mengecek status pengaduan yang telah dilaporkan sebelumnya.\n\nUntuk memilih kategori anda dapat mengetikkan angka atau mengetikkan ulang kategorinya.",
                nextProgress: "mengisi-pengaduan"
            }
        }

        // Kondisi memilih layanan sistem informasi
        else if (message.includes("2") || message.toLowerCase().includes("Sistem Informasi".toLowerCase())) {

            const cacheData: Array<{ id: string, nomor: number, kategori: string }> = await this.cacheManager.get("question-category");

            if (!cacheData) {
                // Mengambil kategori-kategori pertanyaan yang bisa ditanyakan
                const questionCategories = await this.service.questionCategories();

                // Kondisi ketika kategori pertanyaan ditemukan didatabase
                if (questionCategories.length > 0) {

                    const response = variabels.find((item) => item.name == "response_memilih_sitem_informasi") ? `${variabels.find((item) => item.name == "response_memilih_sitem_informasi").content}\n\n${questionCategories.map((item, index) => (
                        `${index + 1}. ${item.name}`
                    )).join('\n\n')}` : `Halo. Selamat datang di Layanan Chat Bot PEMKO Medan.\n\nAnda dapat memilih opsi layanan yang dapat ditanyakan:\n\n${questionCategories.map((item, index) => (
                        `${index + 1}. ${item.name}`
                    )).join('\n\n')}`;

                    await this.cacheManager.set("question-category", questionCategories.map((item, index) => (
                        {
                            id: item.id,
                            nomor: index + 1,
                            kategori: item.name
                        }
                    )), 300000);

                    respon = {
                        ...respon,
                        responseMessage: response,
                        pollData: {
                            name: `${variabels.find((item) => item.name == "response_memilih_sitem_informasi").content || "Halo. Selamat datang di Layanan Chat Bot PEMKO Medan.\n\nAnda dapat memilih opsi layanan yang dapat ditanyakan:"}`,
                            options: questionCategories.map((item) => (item.name)),
                            multipleAnswer: false
                        },
                        nextProgress: "memilih-kategori-pertanyaan",
                        answerType: "text"
                    }
                }
                else {

                    await this.service.finalizeSession(idPhoneNumber, webhook_room);
                    await this.service.updateChatList(checkSession, "finished");
                    await this.service.deleteCheckProgress(phone_number, webhook_room);
                    await this.sessionService.destroySession(session, phone_number);

                    respon = {
                        ...respon,
                        responseMessage: variabels.find((item) => item.name == "respon_error_system").content || `Maaf layanan chat bot sedang dalam gangguan. Terimakasih.`,
                        nextProgress: "mengakhiri-chat",
                        answerType: 'text'
                    }

                }
            }
            else {
                respon = {
                    ...respon,
                    responseMessage: `${configResponse || "Halo. Selamat datang di Layanan Chat Bot PEMKO Medan.\n\nAnda dapat memilih opsi layanan yang dapat ditanyakan:"}\n\n${cacheData.map((item) => (
                        `${item.nomor}. ${item.kategori}`
                    )).join('\n\n')}`,
                    nextProgress: "memilih-kategori-pertanyaan",
                    answerType: "text"
                }
            }
        }

        else if (message.includes("3") || message.toLowerCase().includes("Layanan Pengusulan".toLowerCase())) {

            respon = {
                ...respon,
                responseMessage: variabels.find((item) => item.name == "response_memilih-jenis-layanan-usulan") ? variabels.find((item) => item.name == "response_memilih-jenis-layanan-usulan").content : "Halo. Selamat datang di Layanan Chat Bot PEMKO Medan.\n\nAnda dapat memilih opsi layanan yang dapat digunakan :\n\n1. Layanan Pengusulan",
                nextProgress : "memilih-jenis-layanan-usulan"
            }

            
        }

        // Kondisi ketika jawaban partisipan tidak sesusai dengan pilihan jawaban
        else {
            respon = {
                ...respon,
                responseMessage: "Mohon maaf. Anda tidak menuliskan jawaban dengan tepat silahkan untuk mengisi jawaban dengan pilihan angka maupun mengetikkan jenis layanan yang diinginkan",
                nextProgress: "memilih-kategori-layanan"
            }
        }

        await this.service.saveNormalMessage(idPhoneNumber, payload, respon.responseMessage);

        return respon;
    }

    async mengisiPengaduan(payload: BotWebhookPayload, idPhoneNumber: string, variabels: Variables[]): Promise<ProgressDTO> {
        let response: ProgressDTO;

        const sesiSaatIni = await this.pengaduanService.checkSesiPengaduan(payload.phone_number);

        console.info(`Sesi pengaduan : ${sesiSaatIni}`);

        switch (sesiSaatIni) {
            case "belum-memiliki-sesi":
                response = await this.pengaduanService.memulaiSesi(payload.phone_number, variabels);
                break;
            case "memilih-jenis-layanan":
                response = await this.pengaduanService.checkKategoriLayanan(payload, variabels);
                break;
            case "buat-pengaduan":
                response = await this.pengaduanService.createPengaduan(payload, payload.caption, payload.author, variabels);
                break;
            case "check-tiket":
                response = await this.pengaduanService.checkStatusPengaduan(payload, variabels, payload.author);
                break;
            default:
                response = await this.pengaduanService.memulaiSesi(payload.phone_number, variabels);
                break;
        }

        await this.service.saveNormalMessage(idPhoneNumber, payload, response.responseMessage);

        return response;
    }
}
