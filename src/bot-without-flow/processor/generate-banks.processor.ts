import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Job } from "bullmq";
import { GeneratedBy, request_banks_status, Variables } from "generated/prisma";
import { LoggerService } from "src/logger/logger.service";
import { PrismaService } from "src/prisma/prisma.service";
import { GenerateBank } from "../types/validation.types";
import { AiService } from "../ai/ai.service";
import { hash } from "crypto";

@Processor('generate-question-request', { concurrency: 2 })
export class GenerateBanksProcessor extends WorkerHost {
    private variabels: Variables[] = [];

    constructor(
        private readonly prismaService: PrismaService,
        private readonly loggerService: LoggerService,
        private readonly aiService: AiService
    ) {
        super();
        this.refreshVariables();
    }

    private async refreshVariables() {
        try {
            this.variabels = await this.prismaService.variables.findMany() || [];
        } catch (err) {
            this.loggerService.error(`Error fetching variables: ${err}`, `GenerateBanksProcessor/refreshVariables`);
        }
    }

    async process(job: Job, token?: string) {
        await this.loggerService.log(`Processing job ${job.name} in generate-question-request queue`, `GenerateBanksProcessor/process`);
        const data: GenerateBank = job.data;

        if (this.variabels.length === 0) {
            await this.refreshVariables();
        }

        switch (job.name) {
            case "generate-question": {
                const prompt = this.variabels.find(v => v.name === "AI_GENERATE_BANK_QUESTION")?.content || "";
                await this.generateBank(prompt, data, "question");
                break;
            }
            case "generate-request": {
                const prompt = this.variabels.find(v => v.name === "AI_GENERATE_BANK_REQUEST")?.content || "";
                await this.generateBank(prompt, data, "request");
                break;
            }
        }
    }

    async generateBank(prompt: string, data: GenerateBank, type: "question" | "request") {
        let categories: {
            id: string;
            name: string;
            description?: string;
        }[] = [];

        if (type === "question") {
            const list = await this.prismaService.questionCategory.findMany();
            categories = list.map((item) => ({ id: item.id, name: item.name, description: item.description || undefined }));
        } else if (type === "request") {
            const list = await this.prismaService.request_categories.findMany();
            categories = list.map((item) => ({ id: item.id, name: item.name, description: item.description || undefined }));
        }

        const userPayload = JSON.stringify({
            userMessage: data.user_message,
            categories: categories,
            unique_id: hash("sha256", data.organization_id + data.user_message + Date.now().toString())
        });

        const rawResponse = await this.aiService.generateLLMText({
            system: prompt,
            user: userPayload,
            temperature: 0.2,
            maxTokens: 1500,
            topP: 0.8
        });

        if (!rawResponse) {
            this.loggerService.error("Respon LLM kosong untuk generate bank", "", `GenerateBanksProcessor/generateBank`);
            return;
        }

        const parsed = this.parseBankResponse(rawResponse);
        if (!parsed || !parsed.generated || !parsed.category_id) {
            this.loggerService.error(`Gagal mem-parsing hasil AI generate bank: ${rawResponse.slice(0, 300)}`, "", `GenerateBanksProcessor/generateBank`);
            return;
        }

        if (type === "question") {
            await this.prismaService.questionBank.create({
                data: {
                    organization_id: data.organization_id,
                    category_id: parsed.category_id,
                    question: parsed.generated,
                    generated_by: GeneratedBy.AI
                }
            }).catch((err) => {
                this.loggerService.error("Error creating question bank", err, `GenerateBanksProcessor/generateBank`);
            });
        } else if (type === "request") {
            await this.prismaService.request_banks.create({
                data: {
                    organization_id: data.organization_id,
                    category_id: parsed.category_id,
                    request_name: parsed.generated,
                    generated_by: GeneratedBy.AI,
                    keyword_submit: "SUBMIT",
                }
            }).catch((err) => {
                this.loggerService.error("Error creating request bank", err, `GenerateBanksProcessor/generateBank`);
            });
        }
    }

    private parseBankResponse(text: string): { generated: string, category_id: string } | null {
        let cleaned = text.trim();
        cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");

        try {
            return JSON.parse(cleaned) as { generated: string, category_id: string };
        } catch {
            try {
                const fixed = cleaned
                    .replace(/'/g, '"')
                    .replace(/\bTrue\b/g, 'true')
                    .replace(/\bFalse\b/g, 'false')
                    .replace(/\bNone\b/g, 'null');
                return JSON.parse(fixed) as { generated: string, category_id: string };
            } catch {
                return null;
            }
        }
    }
}
