import { BadRequestException, Injectable } from '@nestjs/common';
import { AiService } from '../ai/ai.service';
import { AnswerData, BotWebhookPayload } from 'src/bot-webhook/bot-webhook.dto';
import { Variables } from 'generated/prisma';
import { FinalMessage } from '../types/common.types';
import { LoggerService } from 'src/logger/logger.service';
import { AnswerDTO } from 'src/bot-webhook/message.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import * as path from 'path';
import * as mime from 'mime-types';
import { FileInfo } from 'src/whatsapp/types/wa-gate-way.dto';

@Injectable()
export class SistemInformasiService {

    constructor(
        private readonly aiService: AiService,
        private readonly logger: LoggerService,
        private readonly prisma: PrismaService,
    ) { }

    async findAnswer(answerID: string, data: BotWebhookPayload): Promise<AnswerDTO | null> {
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
                            organization_id: true
                        }
                    }
                },
                where: {
                    id: answerID,
                },
            });

            if (!query) {
                console.error("Tidak ada jawaban yang cocok");
                return null;
            }

            // await this.redis.set(`question-suggestion-id-${data.phone_number}`, query.question_id);

            return query;
        }
        catch (err) {
            console.error(`Error saat mencari jawaban pertanyaan: ${err}`);
            return null;
        }
    }

    async getFileInfoFromPath(filePath: string): Promise<FileInfo> {
        console.info("File path : ", filePath);
        const filename = path.basename(filePath);
        const mimetype = mime.lookup(filePath);
        return { mimetype: mimetype, filename: filename, url: filePath }
    }

    // ========================================================================
    // API SEARCH - Dipakai oleh tool search_information pada Nanobot
    // ========================================================================
    async apiSearchAnswer(query: string, wa_number: string, variables: Variables[]): Promise<{
        found: boolean;
        type?: string;
        text?: string;
        file_url?: string | null;
        latitude?: number | null;
        longitude?: number | null;
        not_found_session?: string | null;
    } | null> {

        const matchQuestion = await this.aiService.matchQuestionRAG({
            question: query,
            wa_number,
            variables
        });

        if (!matchQuestion || !matchQuestion.answer_id) {
            return {
                found: false,
                type: "text",
                text: matchQuestion?.answer_doc ?? "Mohon maaf saya belum bisa menjawab pertanyaanmu. Bisa kamu ulangi lagi ?",
                file_url: null,
                latitude: null,
                longitude: null,
                not_found_session: "sistem-informasi"
            };
        }

        const payload: BotWebhookPayload = {
            phone_number: wa_number,
            message: query,
            webhook_room: ""
        };

        const answerQuestion = await this.findAnswer(matchQuestion.answer_id, payload);

        if (!answerQuestion || !answerQuestion.answer_type || typeof answerQuestion.answer === 'undefined') {
            return {
                found: false,
                type: "text",
                text: "Mohon maaf saya belum bisa menjawab pertanyaanmu. Bisa kamu ulangi lagi ?",
                file_url: null,
                latitude: null,
                longitude: null,
                not_found_session: "sistem-informasi"
            };
        }

        let answer: AnswerData;

        try {
            answer = typeof answerQuestion.answer === 'string'
                ? JSON.parse(answerQuestion.answer)
                : answerQuestion.answer;
        } catch (error) {
            this.logger.error("Gagal parse jawaban JSON", error);
            return {
                found: false,
                type: "text",
                text: "Mohon maaf saya belum bisa menjawab pertanyaanmu. Bisa kamu ulangi lagi ?",
                file_url: null,
                latitude: null,
                longitude: null,
                not_found_session: "sistem-informasi"
            };
        }

        let result: {
            found: boolean;
            type?: string;
            text?: string;
            file_url?: string | null;
            latitude?: number | null;
            longitude?: number | null;
            not_found_session?: string | null;
        } = {
            found: true,
            file_url: null,
            latitude: null,
            longitude: null,
            not_found_session: null
        };

        switch (answerQuestion.answer_type) {
            case "text":
                result.type = "text";
                result.text = answer.value;
                break;
            case "image":
                result.type = "image";
                result.text = answer.description;
                result.file_url = `${process.env.API_URL}/storage/${answer.file}`;
                break;
            case "video":
                result.type = "video";
                result.text = answer.description;
                result.file_url = `${process.env.API_URL}/storage/${answer.file}`;
                break;
            case "audio":
                result.type = "audio";
                result.text = answer.description;
                result.file_url = `${process.env.API_URL}/storage/${answer.file}`;
                break;
            case "location":
                result.type = "location";
                result.text = answer.description;
                result.latitude = parseFloat(answer.latitude);
                result.longitude = parseFloat(answer.longitude);
                break;
            case "document":
                result.type = "document";
                result.text = answer.description;
                result.file_url = `${process.env.API_URL}/storage/${answer.file}`;
                break;
            default:
                result.type = "text";
                result.text = answer.value;
                break;
        }

        return result;
    }

    async answerQuestion(payload: BotWebhookPayload, variables: Variables[]): Promise<FinalMessage> {

        this.logger.debug("Payload Sistem Informasi : " + JSON.stringify(payload), SistemInformasiService.name);

        const matchQuestion = await this.aiService.matchQuestionRAG({
            question: payload.message,
            wa_number: payload.phone_number,
            variables
        });

        if (!matchQuestion.answer_id) {
            
            return {
                message: matchQuestion.answer_doc ?? "Mohon maaf saya belum bisa menjawab pertanyaanmu. Bisa kamu ulangi lagi ?",
                message_type: "text",
                not_found : true,
                not_found_session : "sistem-informasi"
            }
        }

        let finalMessage: FinalMessage = {
            message: "",
            message_type: "text",
            not_found : false,
            not_found_session : null
        };

        const answerQuestion = await this.findAnswer(matchQuestion.answer_id, payload);
        const organizationID = answerQuestion.Questions.organization_id;

        if (answerQuestion !== null && answerQuestion.answer_type && typeof answerQuestion.answer !== 'undefined') {
            let answer: AnswerData;

            try {
                answer = typeof answerQuestion.answer === 'string'
                    ? JSON.parse(answerQuestion.answer)
                    : answerQuestion.answer;
            } catch (error) {
                this.logger.error("Gagal parse jawaban JSON", error);
                // throw new BadRequestException("Mohon maaf saya belum bisa menjawab pertanyaanmu. Bisa kamu ulangi lagi ?");
                return {
                    message : "Mohon maaf saya belum bisa menjawab pertanyaanmu. Bisa kamu ulangi lagi ?",
                    message_type : "text",
                    not_found : true,
                    not_found_session : "sistem-informasi"
                }
            }

            
            switch (answerQuestion.answer_type) {
                case "text":
                    finalMessage.message = answer.value;
                    finalMessage.message_type = "text";
                    break;
                case "image":
                    finalMessage.message = answer.description;
                    finalMessage.message_type = "image";
                    break;
                case "video":
                    finalMessage.message = answer.description;
                    finalMessage.message_type = "video";
                    break;
                case "audio":
                    finalMessage.message = answer.description;
                    finalMessage.message_type = "audio";
                    break;
                case "location":
                    finalMessage.message = answer.description;
                    finalMessage.message_type = "location";
                    finalMessage.latitude = parseFloat(answer.latitude);
                    finalMessage.longitude = parseFloat(answer.longitude);
                    break;
                case "document":
                    finalMessage.message = answer.description;
                    finalMessage.message_type = "document";
                    break;
                default:
                    finalMessage.message = answer.value;
                    finalMessage.message_type = "text";

            }

            if (!["text", "location"].find((item) => item.toLowerCase() === answerQuestion.answer_type.toLowerCase())) {
                finalMessage.file_path = (await this.getFileInfoFromPath(`${process.env.API_URL}/storage/${answer.file}`));
            }

            this.logger.debug(JSON.stringify(finalMessage), SistemInformasiService.name)

            return finalMessage;

        }
    }
}
