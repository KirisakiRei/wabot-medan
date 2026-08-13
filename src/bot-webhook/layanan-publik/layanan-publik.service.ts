import { Inject, Injectable } from '@nestjs/common';
import { Cache, CACHE_MANAGER } from '@nestjs/cache-manager';
import { SistemInformasiService } from '../sistem-informasi/sistem-informasi.service';
import { SessionService } from '../session/session.service';
import { ResponseGeneratorService } from '../response-generator/response-generator.service';
import { WaGateWayService } from '../wa-gate-way/wa-gate-way.service';
import { BotWebhookPayload, ProgressDTO } from '../bot-webhook.dto';
import { request_forms, Variables } from 'generated/prisma';
import { PengaduanService } from '../pengaduan/pengaduan.service';
import { ActiveRequest } from 'src/active-request/active-request';
import { LayananPublikActionService } from './layanan-publik-action/layanan-publik-action.service';
import { PengaduanActionService } from '../pengaduan/pengaduan-action/pengaduan-action.service';
import { LayananPublikDTO } from './layanan-publik.dto';

@Injectable()
export class LayananPublikService {
    constructor(
        @Inject(CACHE_MANAGER) private cacheManager: Cache,
        private readonly lpservice: LayananPublikActionService,
        private readonly service: SistemInformasiService,
        private readonly sessionService: SessionService,
        private readonly aiService: ResponseGeneratorService,
        private readonly wagateService: WaGateWayService,
        private readonly redisService: ActiveRequest,
        private readonly pengaduanActionService: PengaduanActionService
    ) { }

    async memilihKategoriUsulan(
        idPhoneNumber: string, payload: BotWebhookPayload, checkSession: string, session: Record<string, any>, variabels?: Variables[]
    ): Promise<ProgressDTO> {

        const { phone_number, message, webhook_room } = payload;

        if (message.includes("1") || message.toLowerCase().includes("Buat Pengusulan".toLowerCase())) {
            const cacheData: Array<{ id: string, nomor: number, kategori: string }> = await this.cacheManager.get("request-category");

            if (!cacheData) {
                const requestCategories = await this.lpservice.getRequestCategories();

                if (requestCategories.length > 0) {

                    const response = variabels.find((item) => item.name == "response_memilih_layanan_pengusulan") ? `${variabels.find((item) => item.name == "response_memilih_layanan_pengusulan").content}\n\n${requestCategories.map((item, index) => (
                        `${index + 1}. ${item.name}`)).join('\n')}` : `Halo. Selamat datang di Layanan Chat Bot PEMKO Medan.\n\nAnda dapat memilih opsi layanan yang dapat digunakan :\n\n${requestCategories.map((item, index) => (
                            `${index + 1}. ${item.name}`
                        )).join('\n')}`;

                    await this.cacheManager.set("request-category", requestCategories.map((item, index) => (
                        {
                            id: item.id,
                            nomor: index + 1,
                            kategori: item.name
                        }
                    )), 300000);

                    return {
                        responseMessage: response,
                        pollData: {
                            name: `${variabels.find((item) => item.name == "response_memilih_layanan_pengusulan").content || "Halo. Selamat datang di Layanan Chat Bot PEMKO Medan.\n\nAnda dapat memilih opsi layanan yang dapat digunakan :"}`,
                            options: requestCategories.map((item) => (item.name)),
                            multipleAnswer: false
                        },
                        nextProgress: "memilih_kategori_usulan",
                        answerType: "text"
                    };

                }
                else {
                    await this.service.finalizeSession(idPhoneNumber, webhook_room);
                    await this.service.updateChatList(checkSession, "finished");
                    await this.service.deleteCheckProgress(phone_number, webhook_room);
                    await this.sessionService.destroySession(session, phone_number);

                    return {
                        responseMessage: variabels.find((item) => item.name == "respon_error_system").content || `Maaf layanan chat bot sedang dalam gangguan. Terimakasih.`,
                        nextProgress: "mengakhiri-chat",
                        answerType: 'text'
                    }
                }
            }
            else {
                return {
                    responseMessage: variabels.find((item) => item.name == "response_memilih_layanan_pengusulan").content ? `${variabels.find((item) => item.name == "response_memilih_layanan_pengusulan").content}\n\n${cacheData.map((item) => (
                        `${item.nomor}. ${item.kategori}`)).join('\n')}` : `Halo. Selamat datang di Layanan Chat Bot PEMKO Medan.\n\nAnda dapat memilih opsi layanan yang dapat digunakan: \n\n${cacheData.map((item) => (
                            `${item.nomor}. ${item.kategori}`
                        )).join('\n')}`,
                    nextProgress: "memilih_kategori_usulan",
                    answerType: "text"
                }
            }
        }
        else if (message.includes("2") || message.toLowerCase().includes("Cek".toLowerCase())) {
            return {
                responseMessage: variabels.find((item) => item.name == "respon_memilih_cek_ticket_usulan").content,
                nextProgress: "memilih-cek-tiket-usulan"
            }
        }
        else {
            return {
                responseMessage: variabels.find((item) => item.name == "response_pilihan_kategori_usulan_tidak_seusai").content,
                nextProgress: "memilih-jenis-layanan-usulan"
            }
        }
    }

    async memilihKategoriLayananPublik(payload: BotWebhookPayload, variabels: Variables[], session: Record<string, any>, idPhoneNumber: string,): Promise<ProgressDTO> {
        const checkIfNumber = await this.service.checkIfInteger(payload.message);

        if (checkIfNumber) {

            const cacheData: Array<{ id: string, nomor: number, kategori: string }> = await this.cacheManager.get("request-category");

            let categoryName: string;

            if (cacheData) {
                categoryName = cacheData.find(item => item.nomor == parseInt(payload.message)).kategori;
            }
            else {
                const requestCategories = await this.lpservice.getRequestCategories();
                categoryName = requestCategories[parseInt(payload.message) - 1].name;
            }

            payload = {
                ...payload,
                message: categoryName
            }

            const category = await this.lpservice.findCategory(payload);
            if (category !== null && category.id && idPhoneNumber) {

                await this.sessionService.updateSession(session, category.id, payload.phone_number);

                await this.redisService.set(`id_layanan_publik_${payload.phone_number}`, category.id, 300000);

                const request_banks = await this.lpservice.getRequestBanks(category.id);

                await this.cacheManager.set(`request_banks_${payload.phone_number}`, request_banks.map((item, index) => (
                    {
                        id: item.id,
                        nomor: index + 1,
                        kategori: item.name
                    }
                ), 300000));

                return {
                    responseMessage: `Anda memilih kategori layanan ${category.name}. Silahkan pilih layanan berikut. \n ${request_banks.map((item, index) => (
                        `${index + 1}. ${item.name}`
                    )).join("\n")}`,
                    nextProgress: "memilih_layanan_usulan"
                }
            }
            else {
                return {
                    responseMessage: `Kami tidak menemukan kategori yang sesuai dengan pesan anda. Silahkan balas pesan ini dengan kategori yang sesuai daftar pilihan diatas.`,
                    nextProgress: "memilih_kategori_usulan"
                }
            }

        }
        else {
            const category = await this.lpservice.findCategory(payload);

            if (category && category.id && idPhoneNumber) {

                await this.sessionService.updateSession(session, category.id, payload.phone_number);

                return {
                    responseMessage: `Anda memilih kategori ${category.name}. Silahkan pilih layanan berikut.`,
                    nextProgress: "memilih_layanan_usulan"
                }
            }
            else {
                return {
                    responseMessage: `Kami tidak menemukan kategori yang sesuai dengan pesan anda. Silahkan balas pesan ini dengan kategori yang sesuai daftar pilihan diatas.`,
                    nextProgress: "memilih_kategori_usulan"
                }
            }
        }
    }

    async memilihLayananPublik(payload: BotWebhookPayload, variabels: Variables[]): Promise<ProgressDTO> {

        const checkIfNumber = await this.service.checkIfInteger(payload.message);
        const cacheData: { id: string, nomor: number, kategori: string }[] = await this.cacheManager.get(`request_banks_${payload.phone_number}`);

        if (checkIfNumber) {
            if (cacheData.length > 0) {
                const requestBank = cacheData.find(item => item.nomor == parseInt(payload.message));
                if (requestBank) {
                    const requestForms = await this.lpservice.getRequestForms(requestBank.id);

                    await this.cacheManager.set(`request_forms_${payload.phone_number}`, requestForms, 300000);
                    await this.cacheManager.set(`index_proses_pengisian_memilih_layanan_publik_${payload.phone_number}`, 0, 300000);

                    await this.service.startTyping(payload.phone_number);
                    await this.service.sendChat(payload.phone_number, `Anda memilih layanan ${requestBank.kategori}. Silahkan isi form berikut untuk melanjutkan proses pengajuan.`);
                    await this.service.stopTyping(payload.phone_number);

                    return {
                        responseMessage: `Silahkan untuk mengisi data ${requestForms[0].form}`,
                        nextProgress: "mengisi_syarat_layanan_publik",
                    }
                }
            }
            else {
                return {
                    responseMessage: `Kami tidak menemukan layanan yang sesuai dengan pesan anda. Silahkan balas pesan ini dengan layanan yang sesuai daftar pilihan diatas.`,
                    nextProgress: "memilih_layanan_usulan"
                }
            }
        }
        else {
            if (cacheData.length > 0) {
                const requestBank = cacheData.find(item => item.kategori.toLowerCase() === payload.message.toLowerCase());
                if (requestBank) {
                    const requestForms = await this.lpservice.getRequestForms(requestBank.id);

                    await this.cacheManager.set(`request_forms_${payload.phone_number}`, requestForms, 300000);
                    await this.cacheManager.set(`index_proses_pengisian_memilih_layanan_publik_${payload.phone_number}`, 0, 300000);

                    await this.service.startTyping(payload.phone_number);
                    await this.service.sendChat(payload.phone_number, `Anda memilih layanan ${requestBank.kategori}. Silahkan isi form berikut untuk melanjutkan proses pengajuan.`);
                    await this.service.stopTyping(payload.phone_number);

                    return {
                        responseMessage: `Silahkan untuk mengisi data ${requestForms[0].form}`,
                        nextProgress: "mengisi_syarat_layanan_publik",
                    }
                }
            }
            else {
                const categoryID = await this.redisService.get(`id_layanan_publik_${payload.phone_number}`);
                if (!categoryID) {
                    return {
                        responseMessage: `Mohon maaf sedang terjadi kesalahan. Silahkan ulangi proses dari awal.`,
                        nextProgress: "memilih_layanan_usulan"
                    }
                }
                const requestBanks = await this.lpservice.getRequestBanks(categoryID);

                const banksID = requestBanks.find((item) => item.name.toLowerCase().includes(payload.message.toLowerCase())).id;

                const requestForms = await this.lpservice.getRequestForms(banksID);

                await this.cacheManager.set(`request_forms_${payload.phone_number}`, requestForms, 300000);
                await this.cacheManager.set(`index_proses_pengisian_memilih_layanan_publik_${payload.phone_number}`, 0, 300000);

                await this.service.startTyping(payload.phone_number);
                await this.service.sendChat(payload.phone_number, `Anda memilih layanan ${payload.message}. Silahkan isi form berikut untuk melanjutkan proses pengajuan.`);
                await this.service.stopTyping(payload.phone_number);

                return {
                    responseMessage: `Silahkan untuk mengisi data ${requestForms[0].form}`,
                    nextProgress: "mengisi_syarat_layanan_publik",
                }

            }
        }
    }

    async mengisiSyaratlayananPublik(payload: BotWebhookPayload, variables: Variables[]): Promise<ProgressDTO> {
        try {
            const nowIndex: number = await this.cacheManager.get(`index_proses_pengisian_memilih_layanan_publik_${payload.phone_number}`);
            const requestForms: request_forms[] = await this.cacheManager.get(`request_forms_${payload.phone_number}`);

            if (nowIndex === null || nowIndex === undefined || !requestForms || nowIndex >= requestForms.length) {
                return {
                    responseMessage: `Mohon maaf sedang terjadi kesalahan. Silahkan ulangi proses dari awal.`,
                    nextProgress: "memilih_layanan_usulan"
                };
            }

            if (nowIndex === 0) {
                await this.redisService.set(`request_histories_${payload.phone_number}`, JSON.stringify({
                    request_history: []
                }), 300000);
            }

            const ticketPengaduan = await this.pengaduanActionService.generateTicketToken(payload.phone_number);

            let requestData: LayananPublikDTO = JSON.parse(await this.redisService.get(`request_histories_${payload.phone_number}`) || "{}");

            // Pastikan requestData punya default
            requestData.request_history = requestData.request_history || [];
            requestData.request_bank_id = requestData.request_bank_id || requestForms[nowIndex].request_id;
            requestData.request_token = requestData.request_token || ticketPengaduan;
            requestData.request_sender = requestData.request_sender || payload.phone_number;

            const currentForm = requestForms[nowIndex];
            const { type, content } = await this.pengaduanActionService.checkChatType(payload.message);

            if (currentForm.type === "file") {
                if (type !== "file") {
                    return {
                        responseMessage: `Mohon maaf, anda harus mengirimkan file untuk mengisi form ini. Silahkan kirimkan file yang sesuai dengan form ini.`,
                        nextProgress: "mengisi_syarat_layanan_publik"
                    };
                }

                const urlPath = content.replace('http://localhost:3000', process.env.WA_GATE_WAY);
                const { status, url } = await this.pengaduanActionService.downloadFile(urlPath, ticketPengaduan, "layanan-publik");

                if (status === false) {
                    return {
                        responseMessage: `Mohon maaf terjadi kesalahan saat mengunggah file. Silahkan coba lagi.`,
                        nextProgress: "mengisi_syarat_layanan_publik"
                    };
                }

                requestData.request_history.push({
                    request_form_id: currentForm.id,
                    value: url,
                    type: currentForm.type
                });
            } else {
                if (type !== "text") {
                    return {
                        responseMessage: `Mohon maaf, anda harus mengirimkan teks untuk mengisi form ini. Silahkan kirimkan teks yang sesuai dengan form ini.`,
                        nextProgress: "mengisi_syarat_layanan_publik"
                    };
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

                await this.lpservice.addJobToQueue(requestData);

                await this.redisService.del(`token-pengaduan:${payload.phone_number}`)

                return {
                    responseMessage: variables.find((item) => item.name == "respon_setelah_mengisi_semua_syarat_pengusulan").content.replace("REQUEST_TOKEN",requestData.request_token) ||`Permintaan anda sudah tersimpan anda dengan tiket ${requestData.request_token}. Silahkan tunggu proses selanjutnya. Untuk mendukung sistem layanan publik ini, silahkan berikan rating anda terhadap layanan ini dengan mengirimkan rating dengan angka 1-10.`,
                    nextProgress: "menanyakan-rating"
                };
            } else {
                await this.cacheManager.set(`index_proses_pengisian_memilih_layanan_publik_${payload.phone_number}`, nowIndex + 1, 300000);

                return {
                    responseMessage: `Silahkan untuk mengisi data ${requestForms[nowIndex + 1].form}`,
                    nextProgress: "mengisi_syarat_layanan_publik",
                };
            }
        } catch (error) {
            console.error(`Error saat proses mengisi syarat layanan publik:`, error);
            return {
                responseMessage: `Terjadi kesalahan tak terduga. Silahkan ulangi proses dari awal.`,
                nextProgress: "mengisi_syarat_layanan_publik"
            };
        }
    }

    async mengecekTiketUsulan(payload: BotWebhookPayload, variabels: Variables[]): Promise<ProgressDTO> {
        const checkTicket = await this.lpservice.checkRequestStatus(payload.phone_number, payload.message);
        if (!checkTicket.status) {
            return {
                responseMessage: variabels.find((item) => item.name == "response_kode_usulan_tidak_ditemukan").content.replace("TICKET",payload.message),
                nextProgress: "memilih-cek-tiket-usulan"
            }
        }

        let pesanStatus = "";
        switch (checkTicket.status) {
            case "waiting":
                pesanStatus = "menunggu verifikasi";
                break;
            case "approved":
                pesanStatus = "disetujui";
                break;
            case "rejected":
                pesanStatus = "ditolak";
                break;
            default:
                pesanStatus = "status tidak diketahui";
                break;
        }

        const response = variabels.find((item) => item.name == "response_kode_usulan_ditemukan").content.replace("TICKET",payload.message).replace("PESAN_STATUS", pesanStatus).replace("NAMA_LAYANAN",checkTicket.requestBank.request_name) || `Pengajuan dengan kode ${payload.message} ditemukan. Status pengajuan saat ini adalah ${pesanStatus}.`;

        return {
            responseMessage: response,
            nextProgress: "menanyakan-rating"
        };

    }
}