import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Job } from "bullmq";
import { PrismaService } from "src/prisma/prisma.service";
import { BotWebhookService } from "../bot-webhook.service";
import { SessionService } from "./session.service";
import { Variables } from "generated/prisma";
import { ActiveRequest } from "src/active-request/active-request";
import { SistemInformasiService } from "../sistem-informasi/sistem-informasi.service";

@Processor('session')
export class SessionProcessor extends WorkerHost {

    constructor(
        private readonly prisma: PrismaService,
        private readonly service: SistemInformasiService,
        private readonly sessionService: SessionService,
        private readonly redisService: ActiveRequest
    ) {
        super();
    }

    async process(job: Job, token?: string): Promise<any> {
        console.log("Mulai Job Session");
        console.log(job.name);


        const variables = await this.service.getVariables();

        switch (job.name) {
            case "proses-rating":
                await this.saveChatExperinceRating(job.data);
                break;
            case "check-kehadiran":
                await this.checkKeaktifanUser(job.data, variables);
                break;
            default:
                console.warn(`No handler for job: ${job.name}`);
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

    private async checksatumenit(idPhoneNumber: string, webhook_room: string, total_chat: number, phone_number: string, variables: Variables[]) {
        try {

            console.info("Mengecek 30 detik kedua");
            console.info(`IDPhoneNumber : ${idPhoneNumber}, webhook_room : ${webhook_room}, total_chat : ${total_chat}, phone_number : ${phone_number}`);

            const isLocked = await this.redisService.get(`lock:${phone_number}`);
            if (isLocked === "locked") {
                console.info("Chat sedang diproses, tidak perlu melakukan pengecekan jumlah chat");
                return;
            }

            const footerData = await this.service.footerData();

            const sessionMessages = await this.service.getSessionFromRedis(idPhoneNumber, webhook_room);

            const checkSession = await this.service.checkChatList(phone_number);

            const session: Record<string, any> = {};

            if (total_chat == sessionMessages.length) {

                const responseMessage = variables.find(item => item.name == "respon_penutup_chat_setelah_tidak_aktif_selama_1_menit")?.content;

                await this.service.finalizeSession(idPhoneNumber, webhook_room);
                await this.service.updateChatList(checkSession, "finished");
                await this.service.deleteCheckProgress(phone_number, webhook_room);
                await this.sessionService.destroySession(session, phone_number);

                await this.service.startTyping(phone_number);
                await this.service.sendChat(phone_number, responseMessage);
                await this.service.stopTyping(phone_number);

                // if (footerData) {
                //     await this.service.startTyping(phone_number);
                //     await this.service.sendChat(phone_number, footerData.replace("SESSION_ID", idPhoneNumber));
                //     await this.service.stopTyping(phone_number);
                // }

            }
        }
        catch (err) {
            console.error(err);
        }
    }

    private async checkJumlahChatRedis(idPhoneNumber: string, webhook_room: string, total_chat: number, phone_number: string, variables: Variables[]) {
        try {

            const isLocked = await this.redisService.get(`lock:${phone_number}`);
            if (isLocked === "locked") {
                console.info("Chat sedang diproses, tidak perlu melakukan pengecekan jumlah chat");
                return;
            }

            const sessionMessages = await this.service.getSessionFromRedis(idPhoneNumber, webhook_room);

            console.info(`Jumlah chat : ${sessionMessages.length}`)

            if (total_chat == sessionMessages.length) {

                const responseMessage = variables.find(item => item.name == "chat_reminder")?.content || "Apakah anda masih bersama kami ?";

                await this.service.startTyping(phone_number);
                await this.service.sendChat(phone_number, responseMessage);
                await this.service.stopTyping(phone_number);

                setTimeout(async () => {
                    await this.checksatumenit(idPhoneNumber, webhook_room, total_chat, phone_number, variables);
                }, 60000);
            }
        }
        catch (err) {
            console.error(err);
        }
    }

    private async checkKeaktifanUser({ idPhoneNumber, webhook_room, total_chat, phone_number }: { idPhoneNumber: string, webhook_room: string, total_chat: number, phone_number: string }, variables: Variables[]) {

        console.info("Mengecek 30 detik pertama");
        console.info(`IDPhoneNumber : ${idPhoneNumber}, webhook_room : ${webhook_room}, total_chat : ${total_chat}, phone_number : ${phone_number}`);

        try {
            const isLocked = await this.redisService.get(`lock:${phone_number}`);
            if (isLocked === "locked") {
                console.info("Chat sedang diproses, tidak perlu melakukan pengecekan jumlah chat");
                return;
            }

            await this.checkJumlahChatRedis(idPhoneNumber, webhook_room, total_chat, phone_number, variables).catch(err => console.error(err));
        }
        catch (err) {
            console.error(err);
        }
    }
}