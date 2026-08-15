import { BadRequestException, Injectable } from '@nestjs/common';
import axios, { AxiosError, AxiosInstance } from 'axios';
import { LoggerService } from 'src/logger/logger.service';
import { sessionMessageParse, sessionResponse } from './types/response.type';
import { Variables } from 'generated/prisma';
import { payloadLintas, RAGRequestParam } from './types/param.type';
import { RAGRequestResponse, RAGResponse } from 'src/bot-webhook/response-generator/types/aiDemo';
import { ErrorParameter } from '../types/common.types';
import { isNotEmpty } from 'class-validator';
import { QuestionRagPayload } from '../types/validation.types';

@Injectable()
export class AiService {
    private RAG: AxiosInstance;

    constructor(
        private readonly logger: LoggerService
    ) {
        this.RAG = axios.create({
            baseURL: process.env.RAG_URL || "http://172.22.0.20:5000",
            timeout: 600000
        });
    }

    /**
     * Klien LLM Utama terpadu (OpenAI-compatible / 9router).
     * Membaca konfigurasi router aktif dari environment variables.
     */
    async generateLLMText({ system, user, temperature = 0.2, maxTokens = 1500, topP = 0.8 }: {
        system: string;
        user: string;
        temperature?: number;
        maxTokens?: number;
        topP?: number;
    }): Promise<string | null> {
        // Prioritaskan router LLM aktif (AI_LLM_*), fallback ke konfigurasi AI_DEMO_*
        const baseURL = process.env.AI_LLM_BASE_URL || process.env.AI_DEMO_BASE_URL;
        const model = process.env.AI_LLM_MODEL || process.env.AI_DEMO_MODEL || "meta/llama-4-maverick-instruct";
        const apiKey = process.env.AI_LLM_API_KEY || process.env.AI_DEMO_API_KEY;

        if (!baseURL || !model) {
            this.logger.error("AI_LLM_BASE_URL atau AI_LLM_MODEL belum diatur di .env", `${AiService.name}/${this.generateLLMText.name}`);
            return null;
        }

        const api = axios.create({
            baseURL,
            timeout: 600000,
            headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {}
        });

        const payload: payloadLintas = {
            model,
            messages: [
                {
                    role: "system",
                    content: system
                },
                {
                    role: "user",
                    content: user
                }
            ],
            stream: false,
            temperature,
            max_tokens: maxTokens,
            top_p: topP
        };

        return await api.post<sessionResponse>("chat/completions", payload).then((response) => {
            this.logger.debug(`GENERATE LLM TEXT RESPONSE : ${JSON.stringify(response.data.choices[0].message.content)}`, `${AiService.name}/${this.generateLLMText.name}`);

            return response.data.choices[0].message.content;
        }).catch((error) => {
            this.logger.error("Error Generate LLM Text", error, `${AiService.name}/${this.generateLLMText.name}`);
            return null;
        });
    }

    async checkSession(variables: Variables[], userContent: string): Promise<sessionMessageParse> {
        const systemContent = variables.find((item) => item.name === "AI_SESSION_CHECK_CONTENT_SYSTEM")?.content || "Klasifikasikan percakapan user ke dalam jenis layanan yang sesuai dalam format JSON.";

        const content = await this.generateLLMText({
            system: systemContent,
            user: userContent,
            temperature: 0.2,
            maxTokens: 256,
            topP: 1
        });

        if (!content) {
            return {
                respon_ai: "Maaf terjadi kesalahan teknis silahkan coba kirim ulang pesan anda.",
                layanan: "lainnya",
                need_confirmation: true,
                context_query: null
            };
        }

        try {
            return JSON.parse(content);
        } catch {
            try {
                const fixed = content
                    .replace(/'/g, '"')
                    .replace(/\bTrue\b/g, 'true')
                    .replace(/\bFalse\b/g, 'false')
                    .replace(/\bNone\b/g, 'null');
                return JSON.parse(fixed);
            } catch (err) {
                this.logger.error("Error parsing session response", err, `${AiService.name}/${this.checkSession.name}`);
                return {
                    respon_ai: "Maaf terjadi kesalahan teknis silahkan coba kirim ulang pesan anda.",
                    layanan: "lainnya",
                    need_confirmation: true,
                    context_query: null
                };
            }
        }
    }

    async checkIfUserContinueFillForm(variables: Variables[], userContent: string): Promise<boolean> {
        const systemContent = variables.find((item) => item.name === "AI_CHECK_IF_USER_CONTINUE_FILL_FORM_SYSTEM_CONTENT")?.content || "Tentukan apakah user ingin melanjutkan pengisian formulir. Jawab hanya true atau false.";

        const content = await this.generateLLMText({
            system: systemContent,
            user: userContent,
            temperature: 0.1,
            maxTokens: 50,
            topP: 1
        });

        if (content && (content.toLowerCase() === "true" || content.toLowerCase().includes("true"))) {
            return true;
        }

        return false;
    }

    async generateResponse(variables: Variables[], userContent: { response_template: string; user_message: string; sender_name: string; message_time: string, unique_code: string }): Promise<string> {
        const systemContent = variables.find((item) => item.name === "AI_RESPONSE_GENERATOR_SYSTEM_CONTENT")?.content || "Parafrase respons template agar terdengar natural dan ramah.";

        const content = await this.generateLLMText({
            system: systemContent,
            user: JSON.stringify(userContent),
            temperature: 0.7,
            maxTokens: 500,
            topP: 1
        });

        return content || userContent.response_template;
    }

    async geminiGenrateText({parts, temperature, topP, maxOutputTokens, variables}:{parts: { text: string }[], temperature: number, topP: number, maxOutputTokens: number, variables?: Variables[]}) : Promise<string | null> {
        const system = parts[0]?.text || "Anda adalah asisten AI Pemerintah Kota Medan.";
        const user = parts.slice(1).map(p => p.text).join("\n");

        return await this.generateLLMText({
            system,
            user,
            temperature: temperature ?? 0.2,
            maxTokens: maxOutputTokens || 1000,
            topP: topP || 0.8
        });
    }

    async matchQuestionRAG({ question, wa_number = null, category = null, variables }: { question: string; wa_number?: string, category?: string, variables: Variables[] }): Promise<{answer_id : string | null, answer_doc : string } | null> {
        const baseURL = variables.find((item) => item.name === "RAG_BASE_URL")?.content || "";
        const searchPath = variables.find((item) => item.name === "RAG_SEARCH_PATH")?.content || process.env.RAG_SEARCH_PATH || "/api/search";

        const api = axios.create({
            baseURL: baseURL || process.env.RAG_URL || "http://172.22.0.20:5000",
            timeout: 600000
        });

        this.logger.debug(`RAG Search URL: ${api.defaults.baseURL}${searchPath}`, `${AiService.name}/${this.matchQuestionRAG.name}`);

        return api.post<RAGResponse>(searchPath, {
            question,
            wa_number,
            category
        }).then((response) => {
            this.logger.debug("Response RAG : ", JSON.stringify(response.data.data.similar_questions));

            if (Array.isArray(response.data.data.similar_questions[0].answer_id) === false) {
                return response.data.status === "success" ? {answer_id: response.data.data.similar_questions[0].answer_id, answer_doc: response.data.data.similar_questions[0].answer_doc} : null;
            }

            if (response.data.data.similar_questions[0].answer_id.length === 0) {
                return {answer_id: null, answer_doc: ""};
            }

            const randomIndex = Math.floor(Math.random() * response.data.data.similar_questions[0].answer_id.length);

            return response.data.status === "success" ? {answer_id: response.data.data.similar_questions[0].answer_id[randomIndex], answer_doc: response.data.data.similar_questions[0].answer_doc} : null;
        }).catch((error) => {
            this.logger.error("There is an error when send request to RAG", `${error}`);

            return {
                answer_id: null,
                answer_doc: "Mohon maaf saya belum bisa menjawab pertanyaanmu. Bisa kamu ulangi lagi ?"
            };
        });
    }

    async matchRequestRAG({ request, wa_number, variables }: RAGRequestParam): Promise<{
        request_id: string;
        request_name: string;
        organization_id: string;
    } | null> {
        const baseURL = variables.find((item) => item.name === "RAG_BASE_URL")?.content || "";
        const searchPath = variables.find((item) => item.name === "RAG_REQUEST_SEARCH_PATH")?.content || process.env.RAG_REQUEST_SEARCH_PATH || "/api/search-usulan";

        const api = axios.create({
            baseURL: baseURL || process.env.RAG_URL || "http://172.22.0.20:5000",
            timeout: 600000
        });

        this.logger.debug(`RAG Request Search URL: ${api.defaults.baseURL}${searchPath}`, `${AiService.name}/${this.matchRequestRAG.name}`);

        return api.post<RAGRequestResponse>(searchPath, {
            question: request,
            wa_number,
        }).then((response) => {
            this.logger.debug("Response RAG Request : ", JSON.stringify(response.data.data.similar_questions));
            return response.data.status === "success" ? {
                request_id: response.data.data.similar_questions[0].request_id,
                request_name: response.data.data.similar_questions[0].request_name,
                organization_id: response.data.data.similar_questions[0].organization_id
            } : null;
        }).catch((error) => {
            this.logger.error("There is an error when send request to RAG Request", `${error}`);
            return null;
        });
    }

    bracketToArrayOrString(text: string): string | string[] {
        const match = text.match(/\[(.*?)\]/);

        if (!match) return text;

        const inside = match[1].trim();
        if (inside === "") return [];

        if (inside.includes(",")) {
            return inside.split(",").map(i => i.trim());
        }

        return [inside];
    }

    async questionRAG({
        question,
        question_id,
        answer_id,
        category_id,
        question_rag_name,
        question_rag_id
    }: {
        question: string,
        question_id: string,
        answer_id: string,
        category_id: string,
        question_rag_name: string,
        question_rag_id: string
    }) {
        return await this.RAG.post("/api/sync", {
            action: "add",
            content: {
                question_id,
                question,
                answer_id: this.bracketToArrayOrString(answer_id),
                category_id,
                question_rag_name,
                question_rag_id
            }
        }, {
            headers: {
                "Content-Type": "application/json"
            }
        });
    }

    async requestRAG({ request_rag_id, request_id, request_name, request_rag_name, organization_id }: {
        request_rag_id: string,
        request_id: string,
        organization_id: string,
        request_name: string,
        request_rag_name: string
    }) {
        return await this.RAG.post("/api/sync-usulan", {
            action: "add",
            content: {
                request_rag_id,
                request_id,
                request_name,
                request_rag_name,
                organization_id
            }
        }, {
            headers: {
                "Content-Type": "application/json"
            }
        });
    }
}
