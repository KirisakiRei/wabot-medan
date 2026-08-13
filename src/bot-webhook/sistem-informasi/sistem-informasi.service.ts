import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import Redis from 'ioredis';
import { PrismaService } from 'src/prisma/prisma.service';
import { BotWebhookPayload, ButtonData, QueueData } from '../bot-webhook.dto';
import { GreetiingFiles, QuestionBank, QuestionCategory, Variables } from 'generated/prisma';
import { AnswerDTO } from '../message.dto';
import { FileInfo } from '../wa-gate-way/wa-gate-way.dto';
import * as path from 'path';
import * as mime from 'mime-types';

@Injectable()
export class SistemInformasiService {
    private readonly redis: Redis;
    private readonly thisYear: number;

    constructor(
        @InjectQueue('chat') private readonly queue: Queue,
        private readonly prisma: PrismaService
    ) {
        this.redis = new Redis({
            host: "localhost",
            port: 6379
        });

        this.thisYear = new Date().getFullYear();
    }

    /**
     * @description Fungsi untuk mengecek progres chat yang sedang berlangsung
     * @param phone_number 
     * @param room 
     * @returns 
     */
    async checkChatProgress(phone_number: string, room: string): Promise<"memulai-chat" | "memilih-kategori-layanan" | "mengisi-pengaduan" |"memilih_kategori_usulan" | "memilih_layanan_usulan" | "memilih-kategori-kembali" | "memilih-kategori-pertanyaan" | "mengkonfirmasi-keaktifan" | "menjawab-pertanyaan" | "menanyakan-kepuasan-terhadap-jawaban" | "menanyakan-rating" | "mengakhiri-chat" | "mengisi-rating-sesi-sebelumnya" | "mengisi_syarat_layanan_publik" | "memilih-jenis-layanan-usulan" | "memilih-cek-tiket-usulan"> {

        const progress = (await this.redis.lrange(`nextprogress:seesion:${phone_number}:room:${room}`, 0, -1)) as Array<"memulai-chat" | "memilih-kategori-layanan" |"memilih_kategori_usulan" | "memilih_layanan_usulan" | "mengisi-pengaduan"  | "memilih-kategori-kembali" | "memilih-kategori-pertanyaan" | "mengkonfirmasi-keaktifan" | "menjawab-pertanyaan" | "menanyakan-kepuasan-terhadap-jawaban" | "menanyakan-rating" | "mengakhiri-chat" | "mengisi_syarat_layanan_publik" | "memilih-jenis-layanan-usulan" | "memilih-cek-tiket-usulan">;

        const totalProgressRecord = progress.length;

        console.log(totalProgressRecord)

        if (totalProgressRecord < 1) {
            await this.redis.rpush(`nextprogress:seesion:${phone_number}:room:${room}`, 'memulai-chat');

            return 'memulai-chat';
        }

        return progress[totalProgressRecord - 1];

    }

    /**
     * @description Fungsi untuk update next progress bot
     * @param phone_number 
     * @param room 
     * @param progress 
     */
    async updateCheckProgress(phone_number: string, room: string, progress: "memulai-chat" | "memilih-kategori-layanan" | "mengisi-pengaduan" | "memilih_kategori_usulan" | "memilih_layanan_usulan" |"memilih-kategori-kembali" | "memilih-kategori-pertanyaan" | "mengkonfirmasi-keaktifan" | "menjawab-pertanyaan" | "menanyakan-kepuasan-terhadap-jawaban" | "menanyakan-rating" | "mengakhiri-chat" | "mengisi-rating-sesi-sebelumnya" | "mengisi_syarat_layanan_publik" | "memilih-jenis-layanan-usulan" | "memilih-cek-tiket-usulan") {
        await this.redis.rpush(`nextprogress:seesion:${phone_number}:room:${room}`, progress);
    }

    /**
     * @description Fungsi untuk menghapus cache next progress
     * @param phone_number 
     * @param room 
     */
    async deleteCheckProgress(phone_number: string, room: string) {
        await this.redis.del(`nextprogress:seesion:${phone_number}:room:${room}`);
    }

    /**
     * @description Fungsi untuk mengecek tahapan chat pengguna bot
     * @param phoneNumber 
     * @returns 
     */
    async checkChatList(phoneNumber: string): Promise<string | null> {
        try {
            const query = await this.prisma.chatList.findFirst({
                select: {
                    id: true
                },
                where: {
                    phone_number: phoneNumber,
                    deleted_at: null,
                    year: this.thisYear
                }
            });

            if (!query?.id) return null;

            return query.id;
        }
        catch (err) {
            console.log('Terjadi error pencarian session');

            return null;
        }
    }

    /**
     * 
     * @param phoneNumber 
     * @returns 
     */
    async generateChatList(phoneNumber: string, authorName: string): Promise<string | null> {
        try {
            const query = await this.prisma.chatList.create({
                data: {
                    phone_number: phoneNumber,
                    year: this.thisYear,
                    account_name : authorName,
                    status: "ongoing"
                }
            });

            if (!query?.id) return null;

            return query.id;
        }
        catch (err) {
            console.log('Terjadi error saat pembuatan session');
            return null;
        }
    }

    async updateChatList(id: string, status: "ongoing" | "finished", author? : string): Promise<string | null> {
        try {
            const query = await this.prisma.chatList.update({
                data: {
                    status: status,
                    account_name : author
                },
                where: {
                    id: id
                }
            });

            if (!query?.id) return null;

            return query.id;
        }
        catch (err) {
            console.log('Terjadi error saat update session');
            return null;
        }
    }

    async findCategory(data: BotWebhookPayload): Promise<QuestionCategory | null> {
        try {
            const keywords = data.message && data.message.includes(" ") ? data.message.split(" ").slice(0, Math.min(10, data.message.split(" ").length)) : data.message ? [data.message] : [];

            if (keywords.length == 0) return null;

            const query = await this.prisma.questionCategory.findMany({
                where: {
                    deleted_at: null,
                    is_active: 1,
                    OR: keywords.map((word) => ({
                        name: {
                            contains: word
                        }
                    }))
                },
                take: 50
            });

            const scored = query.map((q) => ({
                ...q,
                matchCount: keywords.filter((word) =>
                    q.name.toLowerCase().includes(word.toLowerCase())
                ).length,
            })).sort((a, b) => b.matchCount - a.matchCount);

            const bestMatch = scored[0];

            return bestMatch;
        }
        catch (err) {
            console.log(err);
            console.log("Error mencari kategori");
            return null;
        }
    }

    async answerQuestion(data: BotWebhookPayload, category: string): Promise<AnswerDTO | null> {
        try {

            const keywords = data.message && data.message.includes(" ") ? data.message.split(" ").slice(0, Math.min(10, data.message.split(" ").length)) : data.message ? [data.message] : [];

            console.log(`Kategori pertanyaan : ${category}`);

            const query = await this.prisma.questionBank.findMany({
                where: {
                    category_id: category,
                    deleted_at: null,
                    is_active: 1,
                    // status: "approved",
                    OR: keywords.map((word) => ({
                        question: {
                            contains: word
                        }
                    }
                    )),
                },
                take: 50
            });

            if (!query) {
                console.log('query error mencari');
                return null;
            }

            console.info("Daftar pertanyaan yang ditemukan : ", query);

            const scored = query.map((q) => ({
                ...q,
                matchCount: keywords.filter((word) =>
                    q.question.toLowerCase().includes(word.toLowerCase())
                ).length,
            })).sort((a, b) => b.matchCount - a.matchCount);

            const bestMatch = scored[0];

            if (!bestMatch) {
                console.log("Tidak ada pertanyaan yang cocok");
                return null;
            }

            const totalAnswer = await this.prisma.questionAnswer.count(
                {
                    where: {
                        question_id: bestMatch.id
                    }
                }
            );

            console.info("Total jawaban: ", totalAnswer)

            const randomIndex = Math.floor(Math.random() * totalAnswer);

            const answer = await this.prisma.questionAnswer.findFirst({
                select: {
                    id: true,
                    order: true,
                    is_active: true,
                    created_at: true,
                    updated_at: true,
                    deleted_at: true,
                    question_id: true,
                    answer: true,
                    answer_type: true,
                    Questions: {
                        select: {
                            question: true,
                            organization_id : true
                        }
                    }
                },
                where: {
                    question_id: bestMatch.id,
                },
                skip: randomIndex
            });

            if (!answer) {
                console.log("Tidak ada jawaban yang cocok");
                return null;
            }

            await this.redis.set(`question-suggestion-id-${data.phone_number}`, bestMatch.id);

            return answer;
        }
        catch (err) {
            console.log(err);
            console.log("error menjawab pertanyaan");
            return null;
        }
    }

    async findQuestions(data: BotWebhookPayload, category: string): Promise<QuestionBank[]> {
        try {

            const keywords = data.message && data.message.includes(" ") ? data.message.split(" ").slice(0, Math.min(10, data.message.split(" ").length)) : data.message ? [data.message] : [];

            console.info("Keywords yang digunakan untuk pencarian: ", keywords);

            const query = await this.prisma.questionBank.findMany({
                where: {
                    category_id: category,
                    deleted_at: null,
                    is_active: 1,
                    // status: "approved",
                    OR: keywords.map((word) => ({
                        question: {
                            contains: word
                        }
                    }
                    )),
                },
                take: 50
            });

            const scored = query.map((q) => ({
                ...q,
                matchCount: keywords.filter((word) =>
                    q.question.toLowerCase().includes(word.toLowerCase())
                ).length,
            })).sort((a, b) => b.matchCount - a.matchCount);

            const theBestOfTen = scored.slice(0, 10);

            return theBestOfTen;
        }
        catch (err) {
            console.error(`Error saat mencari pertanyaan: ${err}`);
            return [];
        }
    }

    async findQuestionAnswer(questionID: string, data: BotWebhookPayload): Promise<AnswerDTO | null> {
        try {

            const totalAnswer = await this.prisma.questionAnswer.count(
                {
                    where: {
                        question_id: questionID
                    }
                }
            );

            const randomIndex = Math.floor(Math.random() * totalAnswer);

            const query = await this.prisma.questionAnswer.findFirst({
                select: {
                    id: true,
                    order: true,
                    is_active: true,
                    created_at: true,
                    updated_at: true,
                    deleted_at: true,
                    question_id: true,
                    answer: true,
                    answer_type: true,
                    Questions: {
                        select: {
                            question: true,
                            organization_id : true
                        }
                    }
                },
                where: {
                    question_id: questionID,
                },
                skip: randomIndex
            });

            if (!query) {
                console.error("Tidak ada jawaban yang cocok");
                return null;
            }

            await this.redis.set(`question-suggestion-id-${data.phone_number}`, questionID);

            return query;
        }
        catch (err) {
            console.error(`Error saat mencari jawaban pertanyaan: ${err}`);
            return null;
        }
    }

    async findAnswer(answerID : string, data: BotWebhookPayload) : Promise<AnswerDTO | null> {
        try {
            const query = await this.prisma.questionAnswer.findFirst({
                select: {
                    id: true,
                    order: true,
                    is_active: true,
                    created_at: true,
                    updated_at: true,
                    deleted_at: true,
                    question_id: true,
                    answer: true,
                    answer_type: true,
                    Questions: {
                        select: {
                            question: true,
                            organization_id : true
                        }
                    }
                },
                where: {
                    id : answerID,
                },
            });

            if (!query) {
                console.error("Tidak ada jawaban yang cocok");
                return null;
            }

            await this.redis.set(`question-suggestion-id-${data.phone_number}`, query.question_id);

            return query;
        }
        catch (err) {
            console.error(`Error saat mencari jawaban pertanyaan: ${err}`);
            return null;
        }
    }

    /**
     * saveAnweredQuestiontoRedis merupakan fungsi untuk menyimpan chat yang memiliki jawaban ke Redis.
     * @param id
     * @param chat
     * @param question
     * @param botReply
     * @return Promise<void>
     * */
    async saveAnweredQuestiontoRedis(id: string, chat: BotWebhookPayload, question: AnswerDTO, botReply?: string) {
        const queueData: QueueData = {
            id: id,
            questionID: question.question_id,
            ...chat,
            year: this.thisYear,
            type: "answered",
            botReply: botReply
        }

        await this.redis.rpush(`chat:session:${id}:room:${chat.webhook_room}`, JSON.stringify(queueData));

        // await this.redis.expire(`chat:session:${id}:room:${chat.webhook_room}`, 30);
    }

    /**
     * saveChatWithoutAnswertoRedis merupakan fungsi untuk menyimpan chat yang tidak memiliki jawaban ke Redis.
     * @param id 
     * @param chat 
     * @param botReply 
     */
    async saveChatWithoutAnswertoRedis(id: string, chat: BotWebhookPayload, botReply?: string, categoryID?: string, organizationID?: string) {
        const queueData: QueueData = {
            id: id,
            ...chat,
            year: this.thisYear,
            type: "without-answer",
            botReply: botReply,
            categoryID: categoryID,
            organizationID: organizationID
        };

        await this.redis.rpush(`chat:session:${id}:room:${chat.webhook_room}`, JSON.stringify(queueData));

        // await this.redis.expire(`chat:session:${id}:room:${chat.webhook_room}`, 30);
    }

    /**
     * saveNormalMessage merupakan fungsi untuk menyimpan pesan normal (tanpa pertanyaan) ke Redis.
     * @param id 
     * @param chat 
     * @param botReply 
     */
    async saveNormalMessage(id: string, chat: BotWebhookPayload, botReply?: string) {
        const queueData: QueueData = {
            id: id,
            ...chat,
            year: this.thisYear,
            type: "message-without-question",
            botReply: botReply
        };

        await this.redis.rpush(`chat:session:${id}:room:${chat.webhook_room}`, JSON.stringify(queueData));

        // await this.redis.expire(`chat:session:${id}:room:${chat.webhook_room}`, 30);
    }

    async getSessionFromRedis(id: string, webhook_room: string): Promise<QueueData[]> {
        const messages = await this.redis.lrange(`chat:session:${id}:room:${webhook_room}`, 0, -1);
        const queueData: QueueData[] = messages.map((msg) => JSON.parse(msg));

        return queueData;
    }

    async finalizeSession(id: string, webhook_room: string) {
        // Ambil semua pesan yang ada di Redis
        const messages = await this.redis.lrange(`chat:session:${id}:room:${webhook_room}`, 0, -1);

        if (messages.length > 0) {
            // Simpan pesan-pesan ini ke DB
            const messagesToSave: QueueData[] = messages.map((msg) => JSON.parse(msg));

            await this.queue.add(`proses-chat`, messagesToSave, {
                removeOnComplete: true,
                removeOnFail: true
            });

            // Hapus chat session di Redis setelah selesai
            await this.redis.del(`chat:session:${id}:room:${webhook_room}`);
        }
    }

    async sendSeen(phone_number: string, session?: string) {
        try {
            const url = new URL('/api/sendSeen', process.env.WA_GATE_WAY);

            await fetch(url, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-Api-Key": process.env.WA_GATE_WAY_API_KEY
                },
                body: JSON.stringify({
                    chatId: `${phone_number}`,
                    messageIds: [
                        `false_${phone_number}_AAAAAAAAAAAAAAAAAAAA`
                    ],
                    participant: null,
                    session: session || `${process.env.GATEWAY_SESSION}`
                })
            });
        }
        catch (err) {
            console.error(err);
        }
    }

    async startTyping(phone_number: string, session?: string) {
        try {
            const url = new URL('/api/startTyping', process.env.WA_GATE_WAY);

            await fetch(url, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-Api-Key": process.env.WA_GATE_WAY_API_KEY
                },
                body: JSON.stringify({
                    chatId: `${phone_number}`,
                    session: session || `${process.env.GATEWAY_SESSION}`
                })
            });
        }
        catch (err) {
            console.error(err);
        }
    }

    async stopTyping(phone_number: string, session?: string) {
        try {
            const url = new URL('/api/stopTyping', process.env.WA_GATE_WAY);

            await fetch(url, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-Api-Key": process.env.WA_GATE_WAY_API_KEY
                },
                body: JSON.stringify({
                    chatId: `${phone_number}`,
                    session: session || `${process.env.GATEWAY_SESSION}`
                })
            });
        }
        catch (err) {
            console.error(err);
        }
    }

    async sendChat(phone_number: string, teks: string, session?: string) {

        try {
            console.info("Mulai mengirim pertanyaan");
            const url = new URL('/api/sendText', process.env.WA_GATE_WAY);

            const payload = {
                chatId: `${phone_number}`,
                reply_to: null,
                text: teks,
                linkPreview: true,
                linkPreviewHighQuality: false,
                session: session || `${process.env.GATEWAY_SESSION}`
            };

            await fetch(url.toString(), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    "X-Api-Key": process.env.WA_GATE_WAY_API_KEY
                },
                body: JSON.stringify(payload)
            }).then(res => {
                // console.log(res)
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                return res.json();
            })
                .then(data => console.log('Success mengirimkan pesan.'))
                .catch(err => console.error('Error:', err));
        }
        catch (err) {
            console.error(err);
        }
    }

    async sendImage(phone_number: string, teks: string) {

        console.info("File path : ", teks);

        try {
            const url = new URL('/api/sendImage', process.env.WA_GATE_WAY);

            const payload = {
                chatId: `${phone_number}`,
                file: {
                    mimetype: "image/jpeg",
                    filename: "filename.jpg",
                    url: teks
                },
                reply_to: null,
                caption: "string",
                session: `${process.env.GATEWAY_SESSION}`
            };

            await fetch(url.toString(), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    "X-Api-Key": process.env.WA_GATE_WAY_API_KEY
                },
                body: JSON.stringify(payload)
            }).then(res => {
                // console.log(res)
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                return res.json();
            })
                .then(data => console.log('Success mengirimkan gambar.'))
                .catch(err => console.error('Error pengiriman gambar : ', err));
        }
        catch (err) {
            console.error(err);
        }
    }

    async sendButtons(phone_number: string, buttons: ButtonData[], header?: string, body?: string, footer?: string) {
        try {
            const url = new URL('/api/sendButtons', process.env.WA_GATE_WAY);

            const payload = {
                chatId: `${phone_number}`,
                header: header || undefined,
                body: body || undefined,
                footer: footer || undefined,
                buttons: buttons,
                session: `${process.env.GATEWAY_SESSION}`
            };

            await fetch(url.toString(), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    "X-Api-Key": process.env.WA_GATE_WAY_API_KEY
                },
                body: JSON.stringify(payload)
            }).then(res => {
                // console.log(res)
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                return res.json();
            })
                .then(data => console.log('Success mengirimkan pesan.'))
                .catch(err => console.error('Error:', err));
        }
        catch (err) {
            console.error(err);
        }
    }

    async questionCategories(): Promise<{ id: string, name: string }[]> {
        try {
            const query = await this.prisma.questionCategory.findMany({
                select: {
                    id: true,
                    name: true
                },
                orderBy: {
                    name: "asc"
                },
                where: {
                    is_active: 1,
                    deleted_at: null
                }
            });

            return query;
        }
        catch (err) {
            console.error(err);
            return [];
        }
    }

    async ratingQueue(rating: string, payload: BotWebhookPayload) {
        await this.queue.add('proses-rating', {
            chatRoom: payload.webhook_room,
            rating: rating
        }, {
            removeOnComplete: true,
            removeOnFail: true,
        });
    }

    async sessionCheckQueue(idPhoneNumber: string, { webhook_room, phone_number }: BotWebhookPayload, totalChat: number) {
        await this.queue.add('check-kehadiran', {
            idPhoneNumber,
            webhook_room,
            totalChat,
            phone_number
        }, {
            removeOnComplete: true,
            removeOnFail: true,
        });
    }
    async checkIfInteger(message: string): Promise<boolean> {
        // Remove spaces and check if the string is a valid number
        const trimmed = message.trim();
        // Check if it's a valid integer or float
        return /^-?\d+$/.test(trimmed);
    }

    /**
 * Mengambil nama file dan MIME type dari path atau URL.
 * @param filePath Path lokal atau URL string.
 * @returns Object berisi filename dan mimetype.
 */

    async getFileInfoFromPath(filePath: string): Promise<FileInfo> {
        console.info("File path : ", filePath);
        const filename = path.basename(filePath);
        const mimetype = mime.lookup(filePath);
        return { mimetype: mimetype, filename: filename, url: filePath }
    }

    async getVariables(): Promise<Variables[]> {

        const query = await this.prisma.variables.findMany({
            where: {
                deleted_at: null,
            },
        });

        return query;
    }

    async getQuestionSuggestions({ phone_number }: BotWebhookPayload): Promise<string[]> {
        try {
            const questionID = await this.redis.get(`question-suggestion-id-${phone_number}`);

            const query = await this.prisma.questionSugestion.findMany({
                select: {
                    questionSugestionList: {
                        select: {
                            question: true
                        }
                    }
                },
                where: {
                    question_base_id: questionID
                }
            });

            return query.map((item) => (
                item.questionSugestionList.question
            ));
        }
        catch (err) {
            console.error(err);
            return [];
        }
    }

    async setRatingAbsence({ phone_number, webhook_room }: BotWebhookPayload) {
        await this.redis.set(`rating-absence-${phone_number}`, webhook_room);
    }

    async getRatingAbsence({ phone_number }: BotWebhookPayload): Promise<string | null> {

        try {
            const data = await this.redis.get(`rating-absence-${phone_number}`);

            console.info(`peringatan mengisi rating : ${data}`);

            if (data !== null && typeof data === 'string') {
                return data;
            }
            return null;
        }
        catch (err) {
            console.error(err);
            return null
        }
    }

    async deleteRatingAbsence({ phone_number }: BotWebhookPayload) {
        await this.redis.del(`rating-absence-${phone_number}`);
    }

    async cekSapaan(message: string, authorName : string): Promise<string | null> {

        let sapaanMap: { [key: string]: string } = {};

        try {
            const sapaan = await this.prisma.greetings.findMany();
            sapaanMap = sapaan.length > 0 ? sapaan.reduce((acc, item) => {
                acc[item.keyword.toLowerCase()] = item.response;
                return acc;
            }, {}) : {
                "hai": "Hai juga! Ada yang bisa saya bantu?",
                "halo": "Halo! Apa kabar?",
                "selamat pagi": "Selamat pagi! Semoga harimu menyenangkan!",
                "selamat siang": "Selamat siang! Ada yang bisa dibantu?",
                "selamat sore": "Selamat sore! Bagaimana kabarmu?",
                "selamat malam": "Selamat malam! Waktunya istirahat?",
                "assalamualaikum": "Waalaikumsalam! Semoga harimu diberkahi.",
                "hi": "Hi! Senang bertemu denganmu!"
            };;
        }
        catch (err) {
            console.error("Error fetching greetings from database: ", err);
            sapaanMap = {
                "hai": "Hai juga! Ada yang bisa saya bantu?",
                "halo": "Halo! Apa kabar?",
                "selamat pagi": "Selamat pagi! Semoga harimu menyenangkan!",
                "selamat siang": "Selamat siang! Ada yang bisa dibantu?",
                "selamat sore": "Selamat sore! Bagaimana kabarmu?",
                "selamat malam": "Selamat malam! Waktunya istirahat?",
                "assalamualaikum": "Waalaikumsalam! Semoga harimu diberkahi.",
                "hi": "Hi! Senang bertemu denganmu!"
            };
        }


        const pesanLower = message.toLowerCase();

        for (const sapaan in sapaanMap) {
            if (pesanLower.includes(sapaan)) {
                return sapaanMap[sapaan].replace("AUTHOR_NAME", authorName);
            }
        }

        return null;
    }

    async getGreetingFiles() : Promise<GreetiingFiles | null> {
        try {
            const data = await this.prisma.greetiingFiles.findFirst();

            return data;
        }
        catch (err) {
            console.error("Error mengambil file greeting : ",err);
            return null;
        }
    }

    extractMatchingID(responseText: string, validIDs: string[]): string | null {
        for (const id of validIDs) {
            if (responseText.includes(id)) {
                return id;
            }
        }
        return null;
    }

    async footerData(): Promise<string> {
        try {
            const query = await this.prisma.footerChats.findFirst();
            if (query && query.content) {
                return query.content;
            }

            return "🤖 Tanya Medan – Informasi Medan dalam Genggaman Anda \n Terima kasih telah menggunakan layanan Tanya Medan. Untuk pertanyaan atau informasi lebih lanjut, silakan hubungi nomor resmi WhatsApp kami di:\n 📱 0812-8888-0001\n 📱 0812-8888-0002\nKami siap membantu Anda dengan ramah dan cepat."
        }
        catch (err) {
            console.error("Error fetching footer data: ", err);
            return "🤖 Tanya Medan – Informasi Medan dalam Genggaman Anda \n Terima kasih telah menggunakan layanan Tanya Medan. Untuk pertanyaan atau informasi lebih lanjut, silakan hubungi nomor resmi WhatsApp kami di:\n 📱 0812-8888-0001\n 📱 0812-8888-0002\nKami siap membantu Anda dengan ramah dan cepat.";
        }
    }

    async countPercentage(aiAnswer: string): Promise<boolean> {
        const regex = /\d+(\.\d+)?%/;

        const containsPercentage = regex.test(aiAnswer);

        if (!containsPercentage) {
            console.error("Jawaban tidak mengandung persentase.");
            return false;
        }

        const matches = aiAnswer.match(regex);
        if (!matches || matches.length === 0) {
            console.error("Tidak ada persentase yang ditemukan dalam jawaban.");
            return false;
        }

        const percentage = parseFloat(matches[0].replace('%', ''));
        if (isNaN(percentage) || percentage < 0 || percentage > 100) {
            console.error("Persentase tidak valid.");
            return false;
        }

        console.info(`Persentase yang ditemukan: ${percentage}%`);

        if (percentage < 50) {
            console.error("Persentase kurang dari 50%. Tidak dapat melanjutkan.");
            return false;
        }

        return true;
    }
}
