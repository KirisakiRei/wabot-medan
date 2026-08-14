import { Processor, WorkerHost } from "@nestjs/bullmq";
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

        this.refreshVariables().catch((err) => {
            this.loggerService.error(`Error fetching variables: ${err}`, `GenerateRagProcessor/constructor`);
        });
    }

    private async refreshVariables() {
        this.variables = await this.prismaService.variables.findMany();
    }

    async process(job: Job) {
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

    async syncQuertionRag(data: QuestionRagPayload | RequestRagPayload, layanan: "sistem-informasi" | "layanan-publik") {
        const original = layanan === "sistem-informasi"
            ? (data as QuestionRagPayload).question
            : (data as RequestRagPayload).request;

        // Refresh sekali bila konstruktor belum selesai memuat (race saat boot).
        if (this.variables.length === 0) {
            await this.refreshVariables();
        }

        const template = this.variables.find((item) => item.name === "AI_RAG_TEXT_GENERATOR");
        if (!template) {
            throw new Error("Variabel AI_RAG_TEXT_GENERATOR tidak ditemukan di database.");
        }

        const questionJSON = JSON.stringify({
            jenis_layanan: layanan,
            original,
        });

        const RAGResponse = await this.aiService.generateLLMText({
            system: template.content,
            user: questionJSON,
            temperature: 0.2,
            maxTokens: 1500
        });

        this.loggerService.debug(`RAG RESPONSE RAW : ${RAGResponse}`, `GenerateRagProcessor/syncQuertionRag`);

        if (!RAGResponse) {
            throw new Error("Gagal memanggil LLM (AI_LLM_BASE_URL) untuk generate variasi RAG.");
        }

        const variations = this.parseVariations(RAGResponse, original);

        if (variations.length === 0) {
            this.loggerService.error(`Tidak ada variasi valid dari response LLM: ${RAGResponse.slice(0, 300)}`, `GenerateRagProcessor/syncQuertionRag`);
            return;
        }

        for (const variation of variations) {
            if (layanan === "sistem-informasi") {
                const questionData = data as QuestionRagPayload;

                const existing = await this.prismaService.questionRAG.findFirst({
                    where: { question_id: questionData.question_id, question_rag: variation }
                });
                if (existing) continue;

                const result = await this.prismaService.questionRAG.create({
                    data: { question_rag: variation, question_id: questionData.question_id }
                });

                await this.aiService.questionRAG({
                    question_id: questionData.question_id,
                    question_rag_name: variation,
                    category_id: questionData.category_id,
                    question: questionData.question,
                    question_rag_id: result.id,
                    answer_id: questionData.answer_id
                });
            }
            else {
                const requestData = data as RequestRagPayload;

                const existing = await this.prismaService.requestRAG.findFirst({
                    where: { request_id: requestData.request_id, request_rag: variation }
                });
                if (existing) continue;

                const result = await this.prismaService.requestRAG.create({
                    data: { request_rag: variation, request_id: requestData.request_id }
                });

                await this.aiService.requestRAG({
                    request_id: requestData.request_id,
                    request_rag_name: variation,
                    organization_id: requestData.organization_id,
                    request_name: requestData.request,
                    request_rag_id: result.id
                });
            }

            this.loggerService.debug(`Saved RAG variation: ${variation}`, `GenerateRagProcessor/syncQuertionRag`);
        }
    }

    /**
     * Parse output LLM menjadi daftar variasi (toleran, pola dari engine nanobot):
     * 1. JSON penuh: array langsung atau `{ "variations": [...] }`.
     * 2. JSON seimbang di dalam teks bebas (model suka menambah prosa).
     * 3. Fallback lama: format `variasi1;variasi2;...` sesuai prompt AI_RAG_TEXT_GENERATOR.
     * Original selalu disertakan sebagai variasi terakhir bila belum ada.
     */
    parseVariations(text: string, original: string): string[] {
        let cleaned = text.trim();
        cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");

        let list: string[] | null = null;

        const toList = (parsed: unknown): string[] | null => {
            if (Array.isArray(parsed)) return parsed.map((item) => String(item));
            if (parsed && typeof parsed === "object" && Array.isArray((parsed as { variations?: unknown }).variations)) {
                return (parsed as { variations: unknown[] }).variations.map((item) => String(item));
            }
            return null;
        };

        try {
            list = toList(JSON.parse(cleaned));
        } catch {
            list = null;
        }

        if (!list) {
            const balanced = this.extractBalanced(cleaned, "{", "}") || this.extractBalanced(cleaned, "[", "]");
            if (balanced) {
                try {
                    list = toList(JSON.parse(balanced));
                } catch {
                    list = null;
                }
            }
        }

        if (!list) {
            list = cleaned.split(";");
        }

        const normalized = list
            .map((item) => item.trim().replace(/^"|"$/g, "").replace(/\\"/g, '"').replace(/\s+/g, " "))
            .filter((item) => item.length >= 3);

        const unique = Array.from(new Set(normalized));
        if (!unique.includes(original)) {
            unique.push(original);
        }

        return unique.slice(0, 12);
    }

    private extractBalanced(text: string, open: string, close: string): string | null {
        const start = text.indexOf(open);
        if (start === -1) return null;

        let depth = 0;
        let inString = false;
        let escape = false;

        for (let index = start; index < text.length; index++) {
            const char = text[index];

            if (escape) { escape = false; continue; }
            if (char === "\\" && inString) { escape = true; continue; }
            if (char === '"') { inString = !inString; continue; }
            if (inString) continue;

            if (char === open) depth++;
            else if (char === close) {
                depth--;
                if (depth === 0) return text.slice(start, index + 1);
            }
        }

        return null;
    }
}
