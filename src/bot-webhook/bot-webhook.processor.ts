import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Job } from "bullmq";
import { QueueData } from "./bot-webhook.dto";
import { PrismaService } from "src/prisma/prisma.service";
import { SistemInformasiService } from "./sistem-informasi/sistem-informasi.service";

@Processor('chat')
export class BotWebhookProcessor extends WorkerHost {

    // private readonly redis: Redis;

    constructor(
        private readonly prisma: PrismaService,
        private readonly service: SistemInformasiService,
    ) {
        super();
        // this.redis = new Redis({
        //     host: "localhost",
        //     port: 6379
        // });
    }

    async process(job: Job, token?: string): Promise<any> {
        console.info("Mulai Job Processor Chat");

        switch (job.name) {
            case "proses-chat":
                await this.saveAnswerLog(job.data);
                break;
            // case "proses-rating":
            //     await this.saveChatExperinceRating(job.data);
            //     break;
            // case "check-kehadiran":
            //     await this.checkKeaktifanUser(job.data);
            //     break;
            default:
                console.warn(`No handler for job: ${job.name}`);
        }

    }

    private async saveAnswerLog(payload: QueueData[]) {
        for (let i = 0; i < payload.length; i++) {
            try {

                if (payload[i].type == "answered") {
                    await this.prisma.chatLog.create({
                        data: {
                            chat_id: payload[i].id,
                            chat_room: payload[i].webhook_room,
                            year: payload[i].year,
                            message: payload[i].message,
                            bot_reply : payload[i].botReply,
                            answeredChats : {
                                create : {
                                    question_base_id : payload[i].questionID,
                                    year: payload[i].year
                                }
                            }
                        }
                    });

                    console.info("Menyimpan pertanyaan yang memiliki jawaban");
                }
                else if (payload[i].type == "without-answer") {
                    await this.prisma.chatLog.create({
                        data: {
                            chat_id: payload[i].id,
                            chat_room: payload[i].webhook_room,
                            year: payload[i].year,
                            message: payload[i].message,
                            bot_reply : payload[i].botReply,
                            chatWithoutAnswer : {
                                create : {
                                    year: payload[i].year,
                                    chat_room: payload[i].webhook_room,
                                    category_id: payload[i].categoryID,
                                    organization_id: payload[i].organizationID,
                                    status : "unverified"
                                }
                            }
                        }
                    });

                    console.info("Menyimpan pertanyaan yang tidak ditemukan jawabannya");
                }
                else {
                    await this.prisma.chatLog.create({
                        data: {
                            chat_id: payload[i].id,
                            chat_room: payload[i].webhook_room,
                            year: payload[i].year,
                            message: payload[i].message,
                            bot_reply : payload[i].botReply,
                        }
                    });

                    console.info("Menyimpan riwayat chat bukan pertanyaan");
                }

                console.info(`Pertanyaan ${payload[i].message} dari pengirim ${payload[i].phone_number} berhasil disimpan ke database`);
            }
            catch (err) {
                console.error(`Pertanyaan ${payload[i].message} dari pengirim ${payload[i].phone_number} gagal disimpan ke database : `, err);
            }
        }
    }

    private async saveChatExperinceRating({ chatRoom, rating }: { chatRoom: string, rating: number }) {
        try {
            await this.prisma.chattingExperienceRating.create({
                data: {
                    rate: rating,
                    chat_room: chatRoom
                }
            });

            console.log("Menyimpan rating ke database")
        }
        catch (err) {
            console.error(err);
        }
    }

    private async checksatumenit(idPhoneNumber: string, webhook_room: string, total_chat: number, phone_number: string) {
        try {
            const sessionMessages = await this.service.getSessionFromRedis(idPhoneNumber, webhook_room);

            if (total_chat == sessionMessages.length) {

                const responseMessage = "Anda tidak ada balasan 30 detik ini. Apakah anda masih bersama kami ?";

                await this.service.startTyping(phone_number);
                await this.service.sendChat(phone_number, responseMessage);
                await this.service.stopTyping(phone_number);
            }
        }
        catch (err) {
            console.error(err);
        }
    }

    private async checkJumlahChatRedis(idPhoneNumber: string, webhook_room: string, total_chat: number, phone_number: string) {
        try {
            const sessionMessages = await this.service.getSessionFromRedis(idPhoneNumber, webhook_room);

            if (total_chat == sessionMessages.length) {

                const responseMessage = "Anda tidak ada balasan 30 detik ini. Apakah anda masih bersama kami ?";

                await this.service.startTyping(phone_number);
                await this.service.sendChat(phone_number, responseMessage);
                await this.service.stopTyping(phone_number);
            }
        }
        catch (err) {
            console.error(err);
        }
    }

    private async checkKeaktifanUser({ idPhoneNumber, webhook_room, total_chat, phone_number }: { idPhoneNumber: string, webhook_room: string, total_chat: number, phone_number: string }) {
        try {
            setTimeout(() => {
                this.checkJumlahChatRedis(idPhoneNumber, webhook_room, total_chat, phone_number).catch(err => console.error(err));
            }, 30000);
        }
        catch (err) {
            console.error(err);
        }
    }
}