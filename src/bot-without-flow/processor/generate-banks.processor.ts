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
        this.prismaService.variables.findMany().then((data) => {
            this.variabels = data || [];
        }).catch((err) => {
            this.loggerService.error(`Error fetching variables: ${err}`, `GenerateBanksProcessor/constructor`);
        });
    }

    async process(job: Job, token?: string) {
        await this.loggerService.log(`Processing job ${job.name} in generate-question-request queue`, `GenerateBanksProcessor/process`);
        const data: GenerateBank = job.data;

        switch (job.name) {
            case "generate-question":
                await this.generateBank(this.variabels.find(v => v.name === "AI_GENERATE_BANK_QUESTION").content, data, "question");
                break;
            case "generate-request":
                await this.generateBank(this.variabels.find(v => v.name === "AI_GENERATE_BANK_REQUEST").content, data, "request");
                break;
        }
    }

    async generateBank(prompt: string, data: GenerateBank, type: "question" | "request") {

        let categories: {
            id: string;
            name: string;
            description?: string;
        }[] = [];

        if (type === "question") {
            await this.prismaService.questionCategory.findMany().then((data) => {
                categories = data.map((item) => ({ id: item.id, name: item.name, description: item.description }));
            })
        } else if (type === "request") {
            await this.prismaService.request_categories.findMany().then((data) => {
                categories = data.map((item) => ({ id: item.id, name: item.name, description: item.description }));
            })
        }

        const aiResponse: { generated: string, category_id: string } | null = await this.aiService.geminiGenrateText({
            parts: [
                {
                    text: prompt,
                },
                {
                    text: JSON.stringify({
                        userMessage: data.user_message,
                        categories: categories,
                        unique_id: hash("sha256", data.organization_id + data.user_message + Date.now().toString())
                    })
                }
            ],
            temperature: 0.2,
            maxOutputTokens: 1500,
            topP: 0.8,
            variables: this.variabels
        }).then((res) => {
            try {
                return JSON.parse(res) as { generated: string, category_id: string };
            } catch {
                try {
                    const fixed = res
                        .replace(/'/g, '"')
                        .replace(/\bTrue\b/g, 'true')
                        .replace(/\bFalse\b/g, 'false')
                        .replace(/\bNone\b/g, 'null');
                    return JSON.parse(fixed) as { generated: string, category_id: string };
                }
                catch (err) {
                    this.loggerService.error("Failed to parse AI response", err, `GenerateBanksProcessor/generateBank`);
                    return null;
                }
            }
        });

        if (aiResponse !== null) {
            if (type === "question") {
                await this.prismaService.questionBank.create({
                    data: {
                        organization_id: data.organization_id,
                        category_id: aiResponse.category_id,
                        question: aiResponse.generated,
                        generated_by: GeneratedBy.AI
                    }
                }).catch((err) => {
                    this.loggerService.error("Error creating question bank", err, `GenerateBanksProcessor/generateBank`);
                });
            }
            else if (type === "request") {
                await this.prismaService.request_banks.create({
                    data: {
                        organization_id: data.organization_id,
                        category_id: aiResponse.category_id,
                        request_name: aiResponse.generated,
                        generated_by: GeneratedBy.AI,
                        keyword_submit: "SUBMIT",
                    }
                }).catch((err) => {
                    this.loggerService.error("Error creating request bank", err, `GenerateBanksProcessor/generateBank`);
                });
            }
        }

    }
}