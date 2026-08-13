import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Job } from "bullmq";
import { LayananPublikDTO } from "./layanan-publik.dto";
import { PrismaService } from "src/prisma/prisma.service";
import { SistemInformasiService } from "../sistem-informasi/sistem-informasi.service";

@Processor('layanan-publik')
export class LayananPublikProcessor extends WorkerHost {

    constructor(
        private readonly prisma: PrismaService,
        private readonly service: SistemInformasiService,
    ) {
        super();
    }

    async process(job: Job, token?: string): Promise<any> {
        console.info("Mulai Job Processor Chat");

        switch (job.name) {
            case "simpan-data":
                await this.saveAnswerLog(job.data);
                break;
            default:
                console.warn(`No handler for job: ${job.name}`);
        }

    }

    private async saveAnswerLog(payload: LayananPublikDTO) {

        const variables = await this.service.getVariables();

        const { request_bank_id, request_history, request_token, request_sender } = payload;

        if (!request_bank_id || !request_history || !request_token || !request_sender) {
            console.error("Data yang diperlukan tidak lengkap untuk menyimpan daftar request.");
            return;
        }

        try {
            const data = await this.prisma.request_histories.create({
                data: {
                    request_id : request_bank_id,  // asumsi kolom PK di request_histories adalah `id`
                    submit_response: request_token,
                    status: "waiting",
                    sender: request_sender,
                    request_history_details: {
                        create: request_history.map((item) => ({
                            value: item.value,
                            type: item.type,
                            request_form_id : item.request_form_id
                        })),
                    },
                },
            });

            if (!data) {
                console.error("Gagal menyimpan data request ke database.");
                
                await this.service.sendSeen(request_sender);
                await this.service.startTyping(request_sender);
                await this.service.sendChat(request_sender, variables.find((item) => item.name == "respon_processor_gagal_menyimpan_pengusulan").content || "Maaf, terjadi kesalahan saat menyimpan data request Anda. Silakan coba lagi nanti.");
                await this.service.stopTyping(request_sender);
                return;
            }

            await this.service.sendSeen(request_sender);
            await this.service.startTyping(request_sender);
            await this.service.sendChat(request_sender, variables.find((item)=> item.name == "respon_processor_berhasil_menyimpan_pengusulan").content.replace("REQUEST_TOKEN",request_token) || `Permintaan Anda telah berhasil disimpan. Berikut merupakan token antrian permintaan anda ${request_token}.`);
            await this.service.stopTyping(request_sender);

            console.info(`Request dari pengirim ${request_sender} berhasil disimpan ke database`);
        } catch (err) {
            console.error(`Request dari pengirim ${request_sender} gagal disimpan ke database: `, err);

            await this.service.sendSeen(request_sender);
            await this.service.startTyping(request_sender);
            await this.service.sendChat(request_sender, variables.find((item) => item.name == "respon_processor_gagal_menyimpan_pengusulan").content || "Maaf, terjadi kesalahan saat menyimpan data request Anda. Silakan coba lagi nanti.");
            await this.service.stopTyping(request_sender);
        }
    }

}