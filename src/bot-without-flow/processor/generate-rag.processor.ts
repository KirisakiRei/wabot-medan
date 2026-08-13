import { Processor, WorkerHost } from "@nestjs/bullmq";
import axios, { AxiosInstance } from "axios";
import { Job } from "bullmq";
import { LoggerService } from "src/logger/logger.service";
import { PrismaService } from "src/prisma/prisma.service";
import { QuestionRagPayload, RequestRagPayload } from "../types/validation.types";
import { AiService } from "../ai/ai.service";
import { Variables } from "generated/prisma";

@Processor('generate-rag', { concurrency: 10 })
export class GenerateRagProcessor extends WorkerHost {

    private variables: Variables[] = [];

    constructor(
        private readonly prismaService: PrismaService,
        private readonly loggerService: LoggerService,
        private readonly aiService: AiService
    ) {
        super();

        this.prismaService.variables.findMany().then((data) => {
            this.variables = data || [];
        }).catch((err) => {
            this.loggerService.error(`Error fetching variables: ${err}`, `GenerateRagProcessor/constructor`);
        });
    }

    async process(job: Job, token?: string) {
        const data = job.data;
        switch (job.name) {
            case "question-rag":
                await this.syncQuertionRag(data as QuestionRagPayload, "sistem-informasi");
                break;
            case "request-rag":
                await this.syncQuertionRag(data as RequestRagPayload, "layanan-publik");
                break;
        }
    }

    cleanRagJsonString(input: string): string {
        let text = input.trim();

        // 1. Normalisasi kutip tunggal → kutip ganda
        text = text.replace(/'/g, '"');

        // 2. Tambah kutip pada key yang tidak punya
        text = text.replace(/([{,\s])(\w+)\s*:/g, '$1"$2":');

        // 3. Hapus newline / karakter aneh
        text = text.replace(/\r?\n|\t/g, ' ');

        // 4. Hilangkan koma sebelum penutup } atau ]
        text = text.replace(/,\s*}/g, '}');
        text = text.replace(/,\s*]/g, ']');

        // 5. Perbaiki array variations yang mungkin tidak lengkap
        text = text.replace(/"variations"\s*:\s*\[(.*)$/s, (match, arr) => {
            // Split per koma
            let items = arr
                .split(',')
                .map(s => s.trim())
                .filter(Boolean)
                .map(s => s.replace(/^"|"$/g, '').replace(/"/g, '\\"'));

            // Pastikan semua item punya kutip
            items = items.map(i => `"${i}"`);

            return `"variations": [${items.join(', ')}]`;
        });

        // 6. Tambal kurung buka/tutup jika hilang
        if (!text.startsWith('{')) text = '{' + text;
        if (!text.endsWith('}')) text = text + '}';

        // 7. Hitung kekurangan bracket array
        const openArr = (text.match(/\[/g) || []).length;
        const closeArr = (text.match(/]/g) || []).length;
        if (openArr > closeArr) {
            text += ']'.repeat(openArr - closeArr);
        }

        // 8. Jika setelah perbaikan masih tidak bisa diparse,
        //    coba bersihkan koma ganda
        text = text.replace(/,,+/g, ',');
        text = text.replace(/:\s*,/g, ': "" ,');
        text = text.replace(/:\s*}/g, ': "" }');

        try {
            JSON.parse(text);
        } catch (error) {
            this.loggerService.error(`Final JSON parse error: ${error}`, `GenerateRagProcessor/cleanRagJsonString`);
        }

        return text;
    }

    async syncQuertionRag(data: QuestionRagPayload | RequestRagPayload, layanan: "sistem-informasi" | "layanan-publik") {
        const original = layanan === "sistem-informasi"
            ? (data as QuestionRagPayload).question
            : (data as RequestRagPayload).request;

        const questionJSON = JSON.stringify({
            jenis_layanan: layanan,
            original,
        });

        // const RAGResponse = await this.aiService.generateRAGText(questionJSON, this.variables);

        const RAGResponse = await this.aiService.geminiGenrateText({
            parts: [
                {
                    text : this.variables.find((item) => item.name === "AI_RAG_TEXT_GENERATOR").content
                },
                {
                    text : questionJSON
                }
            ],
            temperature: 0.2,
            maxOutputTokens: 1500,
            topP: 0.8,
            variables: this.variables
        }).then((res) => res).catch((err) => {
            this.loggerService.error(`Error generating RAG text: ${err}`, `GenerateRagProcessor/syncQuertionRag`);
            return null;
        });

        this.loggerService.debug(`RAG RESPONSE RAW : ${RAGResponse}`, `GenerateRagProcessor/syncQuertionRag`);

        if (!RAGResponse) {
            this.loggerService.error(`RAG response is null or empty`, `GenerateRagProcessor/syncQuertionRag`);
            return;
        }

        try {
            // const cleaned = this.cleanRagJsonString(RAGResponse);

            const cleaned = RAGResponse;

            this.loggerService.debug(`RAG RESPONSE CLEAN TEXT : ${cleaned}`, `GenerateRagProcessor/syncQuertionRag`);

            try {
                // const responseJSON: { original: string; jenis_layanan: "sistem-informasi" | "layanan-publik"; variations: string[] } = JSON.parse(cleaned);

                const responseJSON = cleaned.split(";");

                this.loggerService.debug(`RAG RESPONSE PARSED JSON : ${JSON.stringify(responseJSON)}`, `GenerateRagProcessor/syncQuertionRag`);

                responseJSON.push(original); // Tambahkan original sebagai variasi terakhir

                for (const variation of responseJSON) {

                    if (variation.length === 0) continue;

                    if (layanan === "sistem-informasi") {

                        await this.prismaService.questionRAG.create({
                            data: {
                                question_rag: variation,
                                question_id: (data as QuestionRagPayload).question_id,
                            }
                        }).then(async (result) => {
                            this.loggerService.debug(`Saved RAG question variation with ID: ${result.id}`, `GenerateRagProcessor/syncQuertionRag`);

                            const answerID = (data as QuestionRagPayload).answer_id;

                            await this.aiService.questionRAG({
                                question_id: (data as QuestionRagPayload).question_id,
                                question_rag_name: variation,
                                category_id: (data as QuestionRagPayload).category_id,
                                question: original,
                                question_rag_id: result.id,
                                answer_id: answerID
                            }).catch((err) => {
                                this.loggerService.error(`Error sending question RAG to AI service: ${err}`, `GenerateRagProcessor/syncQuertionRag`);
                            });

                        }).catch((err) => {
                            this.loggerService.error(`Error saving RAG question variation to database: ${err}`, `GenerateRagProcessor/syncQuertionRag`);
                        });
                    }
                    else if (layanan === "layanan-publik") {
                        await this.prismaService.requestRAG.create({
                            data: {
                                request_rag: variation,
                                request_id: (data as RequestRagPayload).request_id,
                            }
                        }).then(async (result) => {
                            this.loggerService.debug(`Saved RAG request variation with ID: ${result.id}`, `GenerateRagProcessor/syncQuertionRag`);

                            await this.aiService.requestRAG({
                                request_id: (data as RequestRagPayload).request_id,
                                request_rag_name: variation,
                                organization_id: (data as RequestRagPayload).organization_id,
                                request_name: original,
                                request_rag_id: result.id
                            }).catch((err) => {
                                this.loggerService.error(`Error sending request RAG to AI service: ${err}`, `GenerateRagProcessor/syncQuertionRag`);
                            });

                        }).catch((err) => {
                            this.loggerService.error(`Error saving RAG request variation to database: ${err}`, `GenerateRagProcessor/syncQuertionRag`);
                        });
                    }
                }
            }
            catch (error) {
                this.loggerService.error(`Error parsing RAG response JSON structure: ${error}`, `GenerateRagProcessor/syncQuertionRag`);
                return;
            }


        }
        catch (error) {
            this.loggerService.error(`Error parsing RAG response: ${error}`, `GenerateRagProcessor/syncQuertionRag`);
            return;
        }
    }
}