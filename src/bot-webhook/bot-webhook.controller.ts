import { Body, Controller, Injectable, Post, Req, Res, Session, Inject, UseInterceptors } from '@nestjs/common';
import { BotWebhookService } from './bot-webhook.service';
import { Response } from 'express';
import { AnswerData, BotWebhookPayload, ButtonData, IncomingWebhookDto } from './bot-webhook.dto';
import { SessionService } from './session/session.service';
import { isNumber } from 'util';
import { CreateEventDto } from './message.dto';
import { ResponseGeneratorService } from './response-generator/response-generator.service';
import { PollDTO, SendFileDTO, SendLocationDTO } from './wa-gate-way/wa-gate-way.dto';
import { WaGateWayService } from './wa-gate-way/wa-gate-way.service';
import { Cache, CACHE_MANAGER } from '@nestjs/cache-manager';
import { BannedWordsInterceptor } from 'src/common/interceptors/banned-words/banned-words.interceptor';
import { Variables } from 'generated/prisma';
import { PengaduanService } from './pengaduan/pengaduan.service';
import { PengaduanResponse } from './pengaduan/pengaduan.dto';
import { SistemInformasiService } from './sistem-informasi/sistem-informasi.service';
import * as path from 'path';
import { LayananPublikService } from './layanan-publik/layanan-publik.service';
import { ZonaParkirService } from './zona-parkir/zona-parkir.service';
import { LoggerService } from 'src/logger/logger.service';

@Controller('bot-webhook')
export class BotWebhookController {

    constructor(
        @Inject(CACHE_MANAGER) private cacheManager: Cache,
        private readonly service: SistemInformasiService,
        private readonly sessionService: SessionService,
        private readonly aiService: ResponseGeneratorService,
        private readonly wagateService: WaGateWayService,
        private readonly pengaduanService: PengaduanService,
        private readonly botService: BotWebhookService,
        private readonly layananPublikService: LayananPublikService,
        private readonly zonaParkirService: ZonaParkirService,
        private readonly consoleService : LoggerService
    ) { }

    private responseMessage: string;
    private nextProgress: "memulai-chat" | "memilih-kategori-kembali" | "memilih-kategori-pertanyaan" | "mengkonfirmasi-keaktifan" | "menjawab-pertanyaan" | "menanyakan-kepuasan-terhadap-jawaban" | "menanyakan-rating" | "mengakhiri-chat" | "mengisi-rating-sesi-sebelumnya";
    private answerType: "text" | "image" | "video" | "document" | "audio" | "location" | "buttons";
    private headerMessage: string;
    private bodyMessage: string;
    private footerMessage: string;
    private daftarButton: ButtonData[];
    private locationData: SendLocationDTO;
    private pollData: PollDTO;
    private fileData: SendFileDTO;
    private prosesChatIDLE: boolean = false;

    private async memulaiChat(idPhoneNumber: string, payload: BotWebhookPayload, checkSession: string, session: Record<string, any>, prompt?: string, configResponse?: string) {

        const ratingAbsence = await this.service.getRatingAbsence(payload);

        if (ratingAbsence !== null) {
            this.responseMessage = "Anda masih belum memberikan rating pada sesi percakapan sebelumnya. Silahkan untuk memberikan rating terlebih dahulu antara 1 - 10.";
            this.nextProgress = "mengisi-rating-sesi-sebelumnya";
        }
        else {

            const cacheData: Array<{ id: string, nomor: number, kategori: string }> = await this.cacheManager.get("question-category");
            if (!cacheData) {

                const questionCategories = await this.service.questionCategories();

                if (questionCategories.length > 0) {

                    const response = `${configResponse || "Halo. Selamat datang di Layanan Chat Bot PEMKO Medan.\n\nAnda dapat memilih opsi layanan yang dapat ditanyakan:"}\n\n${questionCategories.map((item, index) => (
                        `${index + 1}. ${item.name}`
                    )).join('\n\n')}`;

                    // this.responseMessage = await this.aiService.paraphraseText(response, prompt || "Parafrase jawaban berikut dengan bahasa yang lebih mudah dimengerti oleh masyarakat umum");

                    this.responseMessage = response;

                    this.pollData = {
                        ...this.pollData,
                        name: `${configResponse || "Halo. Selamat datang di Layanan Chat Bot PEMKO Medan.\n\nAnda dapat memilih opsi layanan yang dapat ditanyakan:"}`,
                        options: questionCategories.map((item) => (item.name)),
                        multipleAnswer: false
                    }

                    this.nextProgress = "memilih-kategori-pertanyaan";
                    this.answerType = "text";

                    await this.cacheManager.set("question-category", questionCategories.map((item, index) => (
                        {
                            id: item.id,
                            nomor: index + 1,
                            kategori: item.name
                        }
                    )), 300000)
                }
                else {
                    this.responseMessage = `Maaf layanan chat bot sedang dalam gangguan. Terimakasih.`;
                    this.nextProgress = "mengakhiri-chat";
                    this.answerType = "text";

                    this.mengakhiriChat(idPhoneNumber, payload, checkSession, session);
                }


            }
            else {
                this.responseMessage = `${configResponse || "Halo. Selamat datang di Layanan Chat Bot PEMKO Medan.\n\nAnda dapat memilih opsi layanan yang dapat ditanyakan:"}\n\n${cacheData.map((item, index) => (
                    `${item.nomor}. ${item.kategori}`
                )).join('\n\n')}`;

                this.nextProgress = "memilih-kategori-pertanyaan";
                this.answerType = "text";
            }

            await this.service.saveNormalMessage(idPhoneNumber, payload, this.responseMessage);
        }
    }

    private async memilihKategoriKembali(variables: Variables[], idPhoneNumber: string, payload: BotWebhookPayload, checkSession: string, session: Record<string, any>, prompt?: string, configResponse?: string) {

        const cacheData: Array<{ id: string, nomor: number, kategori: string }> = await this.cacheManager.get("question-category");
        if (!cacheData) {

            const questionCategories = await this.service.questionCategories();

            if (questionCategories.length > 0) {

                const response = `${configResponse || "Halo. Selamat datang di Layanan Chat Bot PEMKO Medan.\n\nAnda dapat memilih opsi layanan yang dapat ditanyakan:"}\n\n${questionCategories.map((item, index) => (
                    `${index + 1}. ${item.name}`
                )).join('\n\n')}`;

                // this.responseMessage = await this.aiService.paraphraseText(response, prompt || "Parafrase jawaban berikut dengan bahasa yang lebih mudah dimengerti oleh masyarakat umum");

                this.responseMessage = response;

                this.pollData = {
                    ...this.pollData,
                    name: `${configResponse || "Halo. Selamat datang di Layanan Chat Bot PEMKO Medan.\n\nAnda dapat memilih opsi layanan yang dapat ditanyakan:"}`,
                    options: questionCategories.map((item) => (item.name)),
                    multipleAnswer: false
                }

                this.nextProgress = "memilih-kategori-pertanyaan";
                this.answerType = "text";

                await this.cacheManager.set("question-category", questionCategories.map((item, index) => (
                    {
                        id: item.id,
                        nomor: index + 1,
                        kategori: item.name
                    }
                )), 300000)
            }
            else {
                this.responseMessage = variables.find((item) => item.name == "respon_error_system").content || `Maaf layanan chat bot sedang dalam gangguan. Terimakasih.`;
                this.nextProgress = "mengakhiri-chat";
                this.answerType = "text";

                this.mengakhiriChat(idPhoneNumber, payload, checkSession, session);
            }


        }
        else {
            this.responseMessage = `${configResponse || "Halo. Selamat datang di Layanan Chat Bot PEMKO Medan.\n\nAnda dapat memilih opsi layanan yang dapat ditanyakan:"}\n\n${cacheData.map((item, index) => (
                `${item.nomor}. ${item.kategori}`
            )).join('\n\n')}`;

            this.nextProgress = "memilih-kategori-pertanyaan";
            this.answerType = "text";
        }

        await this.service.saveNormalMessage(idPhoneNumber, payload, this.responseMessage);
    }

    private async menjawabPertanyaan(
        idPhoneNumber: string,
        payload: BotWebhookPayload,
        sessionData: { phone: string; room: string; question_category: string },
        variables: Variables[]
    ): Promise<void> {

        let botReply = "";

        await this.service.startTyping(payload.phone_number);
        await this.service.sendChat(payload.phone_number, variables.find(item => item.name === "respon_menunggu_jawaban_pertanyaan")?.content || "Mohon tunggu, kami sedang mencari jawaban untuk pertanyaan anda...");
        await this.service.stopTyping(payload.phone_number);

        // const questions = await this.service.findQuestions(payload, sessionData.question_category);

        const responseNotFound = variables.find(item => item.name === "respon_jawaban_belum_ditemukan")?.content || "Mohon maaf. Kami belum dapat menjawab pertanyaan anda. Mohon untuk kembali memberikan pertanyaan yang tepat agar dapat dicek oleh sistem kami.";

        // if (questions.length === 0) {
        //     return this.handleUnansweredQuestion(idPhoneNumber, payload, responseNotFound, sessionData.question_category);
        // }

        // const aiQuestionFormat = questions.map((item) => (
        //     `${item.question} (ID: ${item.id})`
        // ));

        // const responseAI = await this.aiService.(aiQuestionFormat, payload.message, variables);
        const responseAI = await this.aiService.metchQuestionRAG({
            question : payload.message,
            wa_number : payload.phone_number,
            category : sessionData.question_category,
            variables
        });
        
        // const checkID = await this.service.extractMatchingID(responseAI, questions.map((item) => item.id));

        // console.info("ID Pertanyaan yang ditemukan : ", checkID);

        // if (checkID === null) {
        //     return this.handleUnansweredQuestion(idPhoneNumber, payload, responseNotFound, sessionData.question_category);
        // }

        // const checkPercentage = await this.service.countPercentage(responseAI);

        // if (!checkPercentage) {
        //     return this.handleUnansweredQuestion(idPhoneNumber, payload, responseNotFound, sessionData.question_category);
        // }

        // const organizationID = questions.find((item) => item.id === checkID)?.organization_id;

        // const answerQuestion = await this.service.findQuestionAnswer(checkID, payload);

        if(responseAI === null){
            return this.handleUnansweredQuestion(idPhoneNumber, payload, responseNotFound, sessionData.question_category);
        }

        const answerQuestion = await this.service.findAnswer(responseAI, payload);
        const organizationID = answerQuestion.Questions.organization_id;

        // Jika jawaban tersedia
        if (answerQuestion !== null && answerQuestion.answer_type && typeof answerQuestion.answer !== 'undefined') {
            let answer: AnswerData;

            // Parsing jawaban dengan aman
            try {
                answer = typeof answerQuestion.answer === 'string'
                    ? JSON.parse(answerQuestion.answer)
                    : answerQuestion.answer;
            } catch (error) {
                console.error("Gagal parse jawaban JSON", error);
                return this.handleUnansweredQuestion(idPhoneNumber, payload, responseNotFound, sessionData.question_category, organizationID);
            }

            const responAI = await this.aiService.generateAnswer("", payload.message, variables);

            await this.service.startTyping(payload.phone_number);
            await this.service.sendChat(payload.phone_number, responAI);
            await this.service.stopTyping(payload.phone_number);

            switch (answerQuestion.answer_type) {
                case "text":
                    // const jawaban = await this.aiService.generateAnswer(answer.value, payload.message, variables);
                    const jawaban = answer.value;
                    botReply = jawaban;
                    this.responseMessage = `${jawaban}`;
                    break;

                case "audio":
                    this.responseMessage = answer.file;

                    if (answer.description && answer.file) {
                        // const jawaban = await this.aiService.generateAnswer(answer.description, payload.message, variables);
                        const jawaban = answer.description;
                        botReply = jawaban;
                        const fileInfo = await this.service.getFileInfoFromPath(`${process.env.API_URL}/storage/${answer.file}`);
                        this.fileData = {
                            ...this.fileData,
                            description: jawaban,
                            file: fileInfo,
                            phone_number: payload.phone_number
                        }
                    }
                    else {
                        return this.handleUnansweredQuestion(idPhoneNumber, payload, responseNotFound, sessionData.question_category, organizationID);
                    }

                    break;
                case "image":
                    this.responseMessage = answer.file;

                    if (answer.description && answer.file) {
                        // const jawaban = await this.aiService.generateAnswer(answer.description, payload.message, variables);
                        const jawaban = answer.description;
                        botReply = jawaban;
                        const fileInfo = await this.service.getFileInfoFromPath(`${process.env.API_URL}/storage/${answer.file}`);
                        this.fileData = {
                            ...this.fileData,
                            description: jawaban,
                            file: fileInfo,
                            phone_number: payload.phone_number
                        }
                    }
                    else {
                        return this.handleUnansweredQuestion(idPhoneNumber, payload, responseNotFound, sessionData.question_category, organizationID);
                    }

                    break;
                case "document":
                    this.responseMessage = answer.file;

                    if (answer.description && answer.file) {
                        // const jawaban = await this.aiService.generateAnswer(answer.description, payload.message, variables);
                        const jawaban = answer.description;
                        botReply = jawaban;
                        const fileInfo = await this.service.getFileInfoFromPath(`${process.env.API_URL}/storage/${answer.file}`);
                        this.fileData = {
                            ...this.fileData,
                            description: jawaban,
                            file: fileInfo,
                            phone_number: payload.phone_number
                        }
                    }
                    else {
                        return this.handleUnansweredQuestion(idPhoneNumber, payload, responseNotFound, sessionData.question_category, organizationID);
                    }

                    break;
                case "video":
                    this.responseMessage = answer.file;

                    if (answer.description && answer.file) {
                        // const jawaban = await this.aiService.generateAnswer(answer.description, payload.message, variables);
                        const jawaban = answer.description;
                        botReply = jawaban;
                        const fileInfo = await this.service.getFileInfoFromPath(`${process.env.API_URL}/storage/${answer.file}`);
                        this.fileData = {
                            ...this.fileData,
                            description: jawaban,
                            file: fileInfo,
                            phone_number: payload.phone_number
                        }
                    }
                    else {
                        return this.handleUnansweredQuestion(idPhoneNumber, payload, responseNotFound, sessionData.question_category, organizationID);
                    }

                    break;

                case "location":
                    if (answer.latitude && answer.longitude && answer.description) {
                        // const jawaban = await this.aiService.generateAnswer(answer.description, payload.message, variables);
                        const jawaban = answer.description;
                        botReply = jawaban;
                        this.locationData = {
                            ...this.locationData,
                            phone_number: payload.phone_number,
                            latitude: parseFloat(answer.latitude),
                            longitude: parseFloat(answer.longitude),
                            title: jawaban,
                        };
                    } else {
                        return this.handleUnansweredQuestion(idPhoneNumber, payload, responseNotFound, sessionData.question_category, organizationID);
                    }
                    break;

                default:
                    return this.handleUnansweredQuestion(idPhoneNumber, payload, responseNotFound, sessionData.question_category, organizationID);
            }

            // Simpan jawaban
            await this.service.saveAnweredQuestiontoRedis(idPhoneNumber, payload, answerQuestion, botReply);
            this.answerType = answerQuestion.answer_type;
            this.nextProgress = "menanyakan-kepuasan-terhadap-jawaban";

        } else {
            return this.handleUnansweredQuestion(idPhoneNumber, payload, responseNotFound, sessionData.question_category, organizationID);
        }
    }

    // Fungsi bantuan untuk fallback saat tidak ada jawaban
    private async handleUnansweredQuestion(idPhoneNumber: string, payload: BotWebhookPayload, customMessage?: string, categoryID?: string, organizationID?: string) {
        this.responseMessage = customMessage || 'Kami belum dapat menjawab pertanyaan anda. Mohon untuk kembali memberikan pertanyaan yang tepat agar dapat dicek oleh sistem kami.';
        await this.service.saveChatWithoutAnswertoRedis(idPhoneNumber, payload, this.responseMessage, categoryID, organizationID);
        this.nextProgress = "menanyakan-kepuasan-terhadap-jawaban";
        this.answerType = "text";
    }

    private async memilihKategoriPertanyaan(idPhoneNumber: string, payload: BotWebhookPayload, session: Record<string, any>) {

        console.log("Kategori pertanyaan dipilih : ", payload.message)
        const checkIfNumber = await this.service.checkIfInteger(payload.message);

        if (checkIfNumber) {

            const cacheData: Array<{ id: string, nomor: number, kategori: string }> = await this.cacheManager.get("question-category");
            console.log("Cache Data", cacheData);

            let categoryName: string;

            if (cacheData) {
                categoryName = cacheData.find(item => item.nomor == parseInt(payload.message)).kategori;
            }
            else {
                const questionCategories = await this.service.questionCategories();

                categoryName = questionCategories[parseInt(payload.message) - 1].name;
            }

            payload = {
                ...payload,
                message: categoryName
            }

            const category = await this.service.findCategory(payload);

            if (category !== null && category.id && idPhoneNumber) {

                await this.sessionService.updateSession(session, category.id, payload.phone_number);

                this.responseMessage = `Anda memilih kategori ${category.name} untuk pertanyaan anda. Silahkan balas pesan ini dengan pertanyaan anda.`;

                this.nextProgress = "menjawab-pertanyaan";
            }
            else {
                this.responseMessage = `Kami tidak menemukan kategori yang sesuai dengan pesan anda. Silahkan balas pesan ini dengan kategori yang sesuai daftar pilihan diatas.`;

                this.nextProgress = "memilih-kategori-pertanyaan";
            }
        }
        else {
            const category = await this.service.findCategory(payload);
            // this.responseMessage = `Silahkan memilih kategori dengan angka yang sesuai dengan jenis kategori diatas.`;

            // this.nextProgress = "memilih-kategori-pertanyaan";

            if (category && category.id && idPhoneNumber) {

                await this.sessionService.updateSession(session, category.id, payload.phone_number);

                this.responseMessage = `Anda memilih kategori ${category.name} untuk pertanyaan anda. Silahkan balas pesan ini dengan pertanyaan anda.`;

                this.nextProgress = "menjawab-pertanyaan";
            }
            else {
                this.responseMessage = `Kami tidak menemukan kategori yang sesuai dengan pesan anda. Silahkan balas pesan ini dengan kategori yang sesuai daftar pilihan diatas.`;

                this.nextProgress = "memilih-kategori-pertanyaan";
            }
        }


        await this.service.saveNormalMessage(idPhoneNumber, payload, this.responseMessage);
    }

    private async mengakhiriChat(idPhoneNumber: string, payload: BotWebhookPayload, checkSession: string, session: Record<string, any>) {

        this.responseMessage = "Terima kasih sudah mengakses layanan Chatbot Kami. Semoga bisa bermanfaat.";
        await this.service.saveNormalMessage(idPhoneNumber, payload, this.responseMessage);

        await this.service.finalizeSession(idPhoneNumber, payload.webhook_room);
        await this.service.updateChatList(checkSession, "finished");
        await this.service.deleteCheckProgress(payload.phone_number, payload.webhook_room);
        await this.sessionService.destroySession(session, payload.phone_number);

    }

    private async menanyakanKepuasanJawaban(idPhoneNumber: string, payload: BotWebhookPayload, sessionData: { phone: string, room: string, question_category: string }, checkSession: string, session: Record<string, any>, variables?: Variables[]) {
        if (payload.message.toLowerCase() == "ya") {
            await this.service.setRatingAbsence(payload);

            this.responseMessage = variables?.find(item => item.name === "respon_ya_untuk_kepuasan_jawaban")?.content || "Terimakasih sudah memberikan reaksi. Silahkan berikan rating antara 1 - 10 untuk jawaban yang telah diberikan. (1 = sangat tidak puas, 10 = sangat puas)";
            this.nextProgress = "menanyakan-rating";

        }
        else if (payload.message.toLowerCase() == "tidak") {
            this.responseMessage = `${(variables?.find(item => item.name === "respon_tidak_untuk_kepuasan_jawaban")?.content || "Terimakasih sudah memberikan reaksi. Agar kami dapat memberikan jawaban yang lebih akurat coba berikan pertanyaan dengan struktur kata yang berbeda dari sebelumnya.")}`;
            this.nextProgress = "menjawab-pertanyaan";
        }
        else if (payload.message.toLowerCase() == "kategori-lain") {
            // this.responseMessage = `Terimakasih sudah memberikan reaksi. Anda dapat memilih kategori lain untuk jenis pertanyaan berbeda.`;
            // this.nextProgress = "memilih-kategori-kembali";

            await this.memilihKategoriKembali(variables, idPhoneNumber, payload, checkSession, session, variables?.find(item => item.name === "prompt_paraphrase_answer")?.content, variables?.find(item => item.name === "respon_memilih_kategori_kembali")?.content);

        }
        else {
            this.responseMessage = "Mohon maaf sebelumnya anda harus memilih jawaban antara ya, tidak, dan kategori-lain";
            this.nextProgress = "menanyakan-kepuasan-terhadap-jawaban";
        }

        await this.service.saveNormalMessage(idPhoneNumber, payload, this.responseMessage);
    }

    private async mengisiRating(payload: BotWebhookPayload, idPhoneNumber: string, checkSession: string, session: Record<string, any>, variables?: Variables[]) {

        const checkIfNumber = isNumber(parseInt(payload.message));

        if (checkIfNumber && parseInt(payload.message) > 0 && parseInt(payload.message) < 11) {
            // let formatHuruf: "satu" | "dua" | "tiga" | "empat" | "lima" | "enam" | "tujuh" | "delapan" | "sembilan" | "sepuluh";
            // switch (parseInt(payload.message)) {
            //     case 1:
            //         // formatHuruf = "satu";
            //         this.responseMessage = "Wah ratingnya 1 ya. Maaf ya belum bisa memberikan jawaban sesuai ekspetasi. Kami pasti akan tetap meningkatkan pelayanan kami.";
            //         break;
            //     case 2:
            //         // formatHuruf = "dua";
            //         this.responseMessage = "Terima kasih atas ratingnya 2. Kami akan terus berusaha meningkatkan kualitas layanan kami.";
            //         break;
            //     case 3:
            //         // formatHuruf = "tiga";
            //         this.responseMessage = "Terima kasih atas ratingnya 3. Kami akan terus berusaha meningkatkan kualitas layanan kami.";
            //         break;
            //     case 4:
            //         // formatHuruf = "empat";
            //         this.responseMessage = "Terima kasih atas ratingnya 4. Kami akan terus berusaha meningkatkan kualitas layanan kami.";
            //         break;
            //     case 5:
            //         // formatHuruf = "lima";
            //         this.responseMessage = "Terima kasih atas ratingnya 5. Kami senang bisa membantu Anda.";
            //         break;
            //     case 6:
            //         // formatHuruf = "enam";
            //         this.responseMessage = "Terima kasih atas ratingnya 6. Kami senang bisa membantu Anda.";
            //         break;
            //     case 7:
            //         // formatHuruf = "tujuh";
            //         this.responseMessage = "Terima kasih atas ratingnya 7. Kami senang bisa membantu Anda.";
            //         break;
            //     case 8:
            //         // formatHuruf = "delapan";
            //         this.responseMessage = "Terima kasih atas ratingnya 8. Kami sangat senang Anda puas dengan layanan kami.";
            //         break;
            //     case 9:
            //         // formatHuruf = "sembilan";
            //         this.responseMessage = "Terima kasih atas ratingnya 9. Kami sangat senang Anda puas dengan layanan kami.";
            //         break;
            //     case 10:
            //         // formatHuruf = "sepuluh";
            //         this.responseMessage = "Terima kasih atas ratingnya 10. Kami sangat senang Anda puas dengan layanan kami. Semoga hari Anda menyenangkan!";
            //         break;
            // }
            this.responseMessage = variables.find(item => item.name === "after_give_rating_response")?.content || `Terima kasih atas ratingnya ${payload.message}. Kami sangat senang Anda puas dengan layanan kami. Semoga hari Anda menyenangkan!`;

            await this.sessionService.addRating(payload.webhook_room, parseInt(payload.message));
            await this.service.deleteRatingAbsence(payload);
            await this.service.finalizeSession(idPhoneNumber, payload.webhook_room);
            await this.service.updateChatList(checkSession, "finished");
            await this.service.deleteCheckProgress(payload.phone_number, payload.webhook_room);
            await this.sessionService.destroySession(session, payload.phone_number);

            this.nextProgress = "memulai-chat";
        }
        else {
            this.responseMessage = "Rating harus berupa angka antara 1 sampai 10.";
            this.nextProgress = "menanyakan-rating";
        }

        await this.service.saveNormalMessage(idPhoneNumber, payload, this.responseMessage);

    }

    private async mengisiRatingSebelumnya(payload: BotWebhookPayload, variables?: Variables[]) {

        const checkIfNumber = isNumber(parseInt(payload.message));

        const ratingAbsence = await this.service.getRatingAbsence(payload);

        if (checkIfNumber && parseInt(payload.message) > 0 && parseInt(payload.message) < 11) {
            // let formatHuruf: "satu" | "dua" | "tiga" | "empat" | "lima" | "enam" | "tujuh" | "delapan" | "sembilan" | "sepuluh";
            // switch (parseInt(payload.message)) {
            //     case 1:
            //         // formatHuruf = "satu";
            //         this.responseMessage = "Wah ratingnya 1 ya. Maaf ya belum bisa memberikan jawaban sesuai ekspetasi. Kami pasti akan tetap meningkatkan pelayanan kami. Untuk memulai percakapan kembali, Anda dapat dengan menyapa Bot ini.";
            //         break;
            //     case 2:
            //         // formatHuruf = "dua";
            //         this.responseMessage = "Terima kasih atas ratingnya 2. Kami akan terus berusaha meningkatkan kualitas layanan kami. Untuk memulai percakapan kembali, Anda dapat dengan menyapa Bot ini.";
            //         break;
            //     case 3:
            //         // formatHuruf = "tiga";
            //         this.responseMessage = "Terima kasih atas ratingnya 3. Kami akan terus berusaha meningkatkan kualitas layanan kami. Untuk memulai percakapan kembali, Anda dapat dengan menyapa Bot ini.";
            //         break;
            //     case 4:
            //         // formatHuruf = "empat";
            //         this.responseMessage = "Terima kasih atas ratingnya 4. Kami akan terus berusaha meningkatkan kualitas layanan kami. Untuk memulai percakapan kembali, Anda dapat dengan menyapa Bot ini.";
            //         break;
            //     case 5:
            //         // formatHuruf = "lima";
            //         this.responseMessage = "Terima kasih atas ratingnya 5. Kami senang bisa membantu Anda. Untuk memulai percakapan kembali, Anda dapat dengan menyapa Bot ini.";
            //         break;
            //     case 6:
            //         // formatHuruf = "enam";
            //         this.responseMessage = "Terima kasih atas ratingnya 6. Kami senang bisa membantu Anda. Untuk memulai percakapan kembali, Anda dapat dengan menyapa Bot ini.";
            //         break;
            //     case 7:
            //         // formatHuruf = "tujuh";
            //         this.responseMessage = "Terima kasih atas ratingnya 7. Kami senang bisa membantu Anda. Untuk memulai percakapan kembali, Anda dapat dengan menyapa Bot ini.";
            //         break;
            //     case 8:
            //         // formatHuruf = "delapan";
            //         this.responseMessage = "Terima kasih atas ratingnya 8. Kami sangat senang Anda puas dengan layanan kami. Untuk memulai percakapan kembali, Anda dapat dengan menyapa Bot ini.";
            //         break;
            //     case 9:
            //         // formatHuruf = "sembilan";
            //         this.responseMessage = "Terima kasih atas ratingnya 9. Kami sangat senang Anda puas dengan layanan kami. Untuk memulai percakapan kembali, Anda dapat dengan menyapa Bot ini.";
            //         break;
            //     case 10:
            //         // formatHuruf = "sepuluh";
            //         this.responseMessage = "Terima kasih atas ratingnya 10. Kami sangat senang Anda puas dengan layanan kami. Semoga hari Anda menyenangkan! Untuk memulai percakapan kembali, Anda dapat dengan menyapa Bot ini.";
            //         break;
            // }

            this.responseMessage = variables.find(item => item.name === "after_give_rating_response")?.content || `Terima kasih atas ratingnya ${payload.message}. Kami sangat senang Anda puas dengan layanan kami. Semoga hari Anda menyenangkan!`;

            await this.sessionService.addRating(ratingAbsence, parseInt(payload.message));
            await this.service.deleteRatingAbsence(payload);
            // await this.service.finalizeSession(idPhoneNumber, payload.webhook_room);
            // await this.service.updateChatList(checkSession, "finished");
            // await this.service.deleteCheckProgress(payload.phone_number, payload.webhook_room);
            // await this.sessionService.destroySession(session, payload.phone_number);

            this.nextProgress = "memulai-chat";
        }
        else {
            this.responseMessage = "Rating harus berupa angka antara 1 sampai 10.";
            this.nextProgress = "menanyakan-rating";
        }

        await this.service.saveNormalMessage(ratingAbsence, payload, this.responseMessage);

    }

    @Post('send-message')
    @UseInterceptors(BannedWordsInterceptor(process.env.GATEWAY_SESSION))
    async receiveWebhook(
        @Body() body: CreateEventDto,
        @Res() res: Response,
        @Session() session: Record<string, any>
    ): Promise<Response> {

        // console.info("Bodies : ", body);
        this.consoleService.debug(`Bodies : ${JSON.stringify(body)}`, `${BotWebhookController.name}/${this.receiveWebhook.name}`);

        let payload: BotWebhookPayload = {
            phone_number: body.payload.vote ? body.payload.vote.from : body.payload.from,
            webhook_room: "",
            message: body.payload.hasMedia ? body.payload.media.url : body.payload.body,
            author: body.payload._data.pushName || "",
            caption: body.payload.body
        };

        let idPhoneNumber: string | null;
        this.responseMessage = "";

        await this.service.sendSeen(payload.phone_number);

        const sapaan = await this.service.cekSapaan(payload.message, payload.author);

        if (sapaan !== null) {

            const greetingFiles = await this.service.getGreetingFiles();
            const fileInfo = await this.service.getFileInfoFromPath(`${process.env.API_URL}/storage/${greetingFiles.file}`);

            // await this.service.startTyping(payload.phone_number);
            // await this.wagateService.sendImage({ phone_number: payload.phone_number, file: fileInfo, description: "" });
            // await this.service.stopTyping(payload.phone_number);

            await this.service.startTyping(payload.phone_number);
            await this.service.sendChat(payload.phone_number, sapaan);
            await this.service.stopTyping(payload.phone_number);

        }

        const sessionData = await this.sessionService.checkSession(session, payload.phone_number);

        payload = {
            ...payload,
            webhook_room: sessionData.room
        };

        const checkSession = await this.service.checkChatList(payload.phone_number);

        if (checkSession) {
            idPhoneNumber = await this.service.updateChatList(checkSession, "ongoing", payload.author);
        }
        else {
            idPhoneNumber = await this.service.generateChatList(payload.phone_number, payload.author);
        }

        const task = await this.service.checkChatProgress(payload.phone_number, payload.webhook_room);
        this.consoleService.debug(`Proses saat ini : ${task}`, `${BotWebhookController.name}/${this.receiveWebhook.name}`);

        const sessionMessages = await this.service.getSessionFromRedis(idPhoneNumber, payload.webhook_room);
        await this.service.sessionCheckQueue(idPhoneNumber, payload, sessionMessages.length);

        const variables = await this.service.getVariables();
        const footerData = await this.service.footerData();

        await this.sessionService.removeAbsensi(idPhoneNumber, payload.webhook_room);

        switch (task) {
            case "memulai-chat":

                const { responseMessage, nextProgress } = await this.botService.memulaiChat(idPhoneNumber, payload, checkSession, session, variables?.find(item => item.name === "prompt_paraphrase_answer")?.content, variables?.find(item => item.name === "kata_sambutan")?.content);

                if (nextProgress !== "mengakhiri-chat" && nextProgress !== "menanyakan-rating") {
                    await this.service.updateCheckProgress(payload.phone_number, payload.webhook_room, nextProgress);
                }

                await this.service.startTyping(payload.phone_number);
                await this.service.sendChat(payload.phone_number, responseMessage);
                await this.service.stopTyping(payload.phone_number);

                // if (footerData) {
                //     await this.service.startTyping(payload.phone_number);
                //     await this.service.sendChat(payload.phone_number, footerData);
                //     await this.service.stopTyping(payload.phone_number);
                // }

                break;
            case "memilih-kategori-layanan":

                const respon = await this.botService.memilihKategoriLayanan(idPhoneNumber, payload, checkSession, session, variables?.find(item => item.name === "prompt_paraphrase_answer")?.content, variables?.find(item => item.name === "kata_sambutan")?.content, variables);

                // if (respon.nextProgress !== "mengakhiri-chat" && respon.nextProgress !== "menanyakan-rating") {
                await this.service.updateCheckProgress(payload.phone_number, payload.webhook_room, respon.nextProgress);
                // }

                await this.service.startTyping(payload.phone_number);
                await this.service.sendChat(payload.phone_number, respon.responseMessage);
                await this.service.stopTyping(payload.phone_number);



                break;
            case "memilih-jenis-layanan-usulan":
                const { responseMessage: kategoriUsulanRespon, nextProgress: kategoriUsulanNextProgress } = await this.layananPublikService.memilihKategoriUsulan(idPhoneNumber, payload, checkSession, session, variables);

                await this.service.updateCheckProgress(payload.phone_number, payload.webhook_room, kategoriUsulanNextProgress);

                await this.service.startTyping(payload.phone_number);
                await this.service.sendChat(payload.phone_number, kategoriUsulanRespon);
                await this.service.stopTyping(payload.phone_number);



                break;
            case "memilih_kategori_usulan":
                const { responseMessage: layananResponseMessage, nextProgress: layananNextProgress } = await this.layananPublikService.memilihKategoriLayananPublik(payload, variables, session, idPhoneNumber);

                await this.service.updateCheckProgress(payload.phone_number, payload.webhook_room, layananNextProgress);

                await this.service.startTyping(payload.phone_number);
                await this.service.sendChat(payload.phone_number, layananResponseMessage);
                await this.service.stopTyping(payload.phone_number);



                break;
            case "memilih_layanan_usulan":
                const { responseMessage: responseMemilihLayananUsuslan, nextProgress: nextProgressMemilihLayananUsulan } = await this.layananPublikService.memilihLayananPublik(payload, variables);

                await this.service.updateCheckProgress(payload.phone_number, payload.webhook_room, nextProgressMemilihLayananUsulan);

                await this.service.startTyping(payload.phone_number);
                await this.service.sendChat(payload.phone_number, responseMemilihLayananUsuslan);
                await this.service.stopTyping(payload.phone_number);

                break;
            case "memilih-cek-tiket-usulan":
                const { responseMessage: responseCekTiketUsulan, nextProgress: nextProgressCekTiketUsulan } = await this.layananPublikService.mengecekTiketUsulan(payload, variables);

                await this.service.updateCheckProgress(payload.phone_number, payload.webhook_room, nextProgressCekTiketUsulan);

                await this.service.startTyping(payload.phone_number);
                await this.service.sendChat(payload.phone_number, responseCekTiketUsulan);
                await this.service.stopTyping(payload.phone_number);

                break;
            case "mengisi_syarat_layanan_publik":
                const { responseMessage: responseMengisiSyaratLayananPublik, nextProgress: nextProgressMengisiSyaratLayananPublik } = await this.layananPublikService.mengisiSyaratlayananPublik(payload, variables);

                await this.service.updateCheckProgress(payload.phone_number, payload.webhook_room, nextProgressMengisiSyaratLayananPublik);

                await this.service.startTyping(payload.phone_number);
                await this.service.sendChat(payload.phone_number, responseMengisiSyaratLayananPublik);
                await this.service.stopTyping(payload.phone_number);

                break;
            case "mengisi-pengaduan":
                const responMengisiPengaduan = await this.botService.mengisiPengaduan(payload, idPhoneNumber, variables);
                await this.service.updateCheckProgress(payload.phone_number, payload.webhook_room, responMengisiPengaduan.nextProgress);

                await this.service.startTyping(payload.phone_number);
                await this.service.sendChat(payload.phone_number, responMengisiPengaduan.responseMessage);
                await this.service.stopTyping(payload.phone_number);

                break;
            case "memilih-kategori-pertanyaan":
                await this.memilihKategoriPertanyaan(idPhoneNumber, payload, session);
                await this.service.updateCheckProgress(payload.phone_number, payload.webhook_room, this.nextProgress);

                await this.service.startTyping(payload.phone_number);
                await this.service.sendChat(payload.phone_number, this.responseMessage);
                await this.service.stopTyping(payload.phone_number);


                break;
            case "menjawab-pertanyaan":
                await this.menjawabPertanyaan(idPhoneNumber, payload, sessionData, variables).then(async () => {
                    await this.service.updateCheckProgress(payload.phone_number, payload.webhook_room, this.nextProgress);
                    switch (this.answerType) {
                        case "text":
                            await this.service.startTyping(payload.phone_number);
                            await this.service.sendChat(payload.phone_number, this.responseMessage);
                            await this.service.stopTyping(payload.phone_number);

                            break;
                        case "buttons":
                            await this.service.startTyping(payload.phone_number);
                            await this.service.sendButtons(payload.phone_number, this.daftarButton, this.headerMessage, this.bodyMessage, this.footerMessage);
                            await this.service.stopTyping(payload.phone_number);

                            break;
                        case "image":
                            // await this.service.sendChat(this.fileData.phone_number, this.fileData.description);
                            await this.service.startTyping(payload.phone_number);
                            await this.wagateService.sendImage(this.fileData);
                            await this.service.stopTyping(payload.phone_number);

                            break;
                        case "location":
                            await this.service.startTyping(payload.phone_number);
                            await this.service.sendChat(this.locationData.phone_number, this.locationData.title);
                            await this.service.stopTyping(payload.phone_number);

                            await this.service.startTyping(payload.phone_number);
                            await this.wagateService.sendLocation(this.locationData);
                            await this.service.stopTyping(payload.phone_number);

                            break;
                        default:
                            await this.service.startTyping(payload.phone_number);
                            await this.service.sendChat(payload.phone_number, this.responseMessage);
                            await this.service.stopTyping(payload.phone_number);
                    }

                    const questionSuggestion = await this.service.getQuestionSuggestions(payload);

                    if (questionSuggestion.length > 1) {
                        await this.service.startTyping(payload.phone_number);
                        await this.service.sendChat(payload.phone_number, `Anda juga dapat menanyakan tentang :\n${questionSuggestion.map((item, index) => (
                            `${index + 1}. ${item}`
                        )).join('\n')}`);
                        await this.service.stopTyping(payload.phone_number);
                    }

                    await this.service.startTyping(payload.phone_number);
                    await this.service.sendChat(payload.phone_number, variables.find(item => item.name === "response_menanyakan_kepuasan_jawaban")?.content || "Apakah anda sudah puas dengan jawaban ini ? Jika sudah silahkan jawab dengan ya. Sedangkan jika tidak ketikkan \"tidak\" untuk dapat bertanya lagi. Jika ingin bertanya dengan kategori yang berbeda silahkan jawab dengan \"kategori-lain\"");
                    await this.service.stopTyping(payload.phone_number);

                });
                break;
            case "menanyakan-kepuasan-terhadap-jawaban":
                await this.menanyakanKepuasanJawaban(idPhoneNumber, payload, sessionData, checkSession, session, variables);
                await this.service.updateCheckProgress(payload.phone_number, payload.webhook_room, this.nextProgress);

                await this.service.startTyping(payload.phone_number);
                await this.service.sendChat(payload.phone_number, this.responseMessage);
                await this.service.stopTyping(payload.phone_number);

                break;
            case "memilih-kategori-kembali":
                const { nextProgress: nextProgressMemilihKategoriKembali, responseMessage: responseMessageMemilihKategoriKembali } = await this.botService.memulaiChat(idPhoneNumber, payload, checkSession, session, variables?.find(item => item.name === "prompt_paraphrase_answer")?.content, variables?.find(item => item.name === "respon_memilih_kategori_kembali")?.content);

                if (nextProgressMemilihKategoriKembali !== "mengakhiri-chat" && nextProgressMemilihKategoriKembali !== "menanyakan-rating") {
                    await this.service.updateCheckProgress(payload.phone_number, payload.webhook_room, nextProgressMemilihKategoriKembali);
                }
                await this.service.startTyping(payload.phone_number);
                await this.service.sendChat(payload.phone_number, responseMessageMemilihKategoriKembali);
                await this.service.stopTyping(payload.phone_number);



                // await this.wagateService.sendPoll(payload.phone_number, this.pollData);
                break;
            case "menanyakan-rating":
                await this.mengisiRating(payload, idPhoneNumber, checkSession, session, variables);
                await this.service.updateCheckProgress(payload.phone_number, payload.webhook_room, this.nextProgress);

                await this.service.startTyping(payload.phone_number);
                await this.service.sendChat(payload.phone_number, this.responseMessage);
                await this.service.stopTyping(payload.phone_number);

                // if (footerData) {
                //     await this.service.startTyping(payload.phone_number);
                //     await this.service.sendChat(payload.phone_number, footerData);
                //     await this.service.stopTyping(payload.phone_number);
                // }

                break;
            case "mengisi-rating-sesi-sebelumnya":
                await this.mengisiRatingSebelumnya(payload, variables);
                await this.service.updateCheckProgress(payload.phone_number, payload.webhook_room, this.nextProgress);

                await this.service.startTyping(payload.phone_number);
                await this.service.sendChat(payload.phone_number, this.responseMessage);
                await this.service.stopTyping(payload.phone_number);

                break;
            case "mengakhiri-chat":
                await this.mengakhiriChat(idPhoneNumber, payload, checkSession, session);

                await this.service.startTyping(payload.phone_number);
                await this.service.sendChat(payload.phone_number, this.responseMessage);
                await this.service.stopTyping(payload.phone_number);

                break;
        }

        if (task !== "mengisi-rating-sesi-sebelumnya" && task !== "menanyakan-rating") {
            await this.sessionService.addCheckAbsensi(
                idPhoneNumber,
                payload.webhook_room,
                sessionMessages.length + 1,
                payload.phone_number
            );
        }

        // if (footerData) {
        //     await this.service.startTyping(payload.phone_number);
        //     await this.service.sendChat(payload.phone_number, footerData.replace("SESSION_ID", idPhoneNumber));
        //     await this.service.stopTyping(payload.phone_number);
        // }

        return res.status(200).send({
            status: "Success",
            code: 200,
            message: 'Message Received'
        });

    }

    @Post('end-session')
    async endSession(@Body() payload: BotWebhookPayload,) {
        // Finalize sesi dan simpan ke database jika belum ada aktivitas
        let idPhoneNumber: string | null;
        const checkSession = await this.service.checkChatList(payload.phone_number);
        if (checkSession) {
            idPhoneNumber = await this.service.updateChatList(checkSession, "finished");
        }
        await this.service.finalizeSession(idPhoneNumber, payload.webhook_room);

        return { status: 'success', message: 'Session ended and saved to DB' };
    }

    @Post('send-message-test')
    async receiveWebhookTest(
        @Body() body: any,
        @Res() res: Response,
    ): Promise<Response> {

        console.log(body);

        return res.status(200).send({
            status: "Success",
            code: 200,
            message: 'Message Received'
        });
    }

    @Post("zona-parkir")
    async receivePengaduanZonaParkir(
        @Body() body: CreateEventDto,
        @Res() res: Response) {

            this.consoleService.debug(`Bodies : ${JSON.stringify(body)}`, `${BotWebhookController.name}/${this.receivePengaduanZonaParkir.name}`);

        let payload: BotWebhookPayload = {
            phone_number: body.payload.vote ? body.payload.vote.from : body.payload.from,
            webhook_room: "",
            message: body.payload.hasMedia ? body.payload.media.url : body.payload.body,
            author: body.payload._data.pushName || "",
            caption: body.payload.body
        };
        let response: PengaduanResponse;

        await this.service.sendSeen(payload.phone_number, "zonaparkir");

        const sesiSaatIni = await this.zonaParkirService.checkSesiPengaduan(payload.phone_number);

        switch (sesiSaatIni) {
            case "belum-memiliki-sesi":
                response = await this.zonaParkirService.memulaiSesi(payload.phone_number);
                break;
            case "memilih-jenis-layanan":
                response = await this.zonaParkirService.checkKategoriLayanan(payload);
                break;
            case "buat-pengaduan":
                response = await this.zonaParkirService.createPengaduan(payload, payload.caption, payload.author);
                break;
            case "check-tiket":
                response = await this.zonaParkirService.checkStatusPengaduan(payload, body.payload._data.pushName);
                break;
            default:
                response = await this.zonaParkirService.memulaiSesi(payload.phone_number);
                break;
        }

        await this.service.startTyping(payload.phone_number, "zonaparkir");
        await this.service.sendChat(payload.phone_number, response.message, "zonaparkir");
        await this.service.stopTyping(payload.phone_number, "zonaparkir");

        return res.status(response.statusCode).send(response);
    }
}
