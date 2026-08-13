import { Body, Controller, Post, Res, UseFilters, UseGuards, UseInterceptors } from '@nestjs/common';
import { BotWithoutFlowService } from './bot-without-flow.service';
import { Response } from 'express';
import { CreateEventDto } from 'src/bot-webhook/message.dto';
import { BotWebhookPayload } from 'src/bot-webhook/bot-webhook.dto';
import { BadRequestFilter } from './filter/bad-request/bad-request.filter';
import { PrismaFilter } from './filter/prisma/prisma.filter';
import { UnauthorizedFilter } from './filter/unauthorized/unauthorized.filter';
import { LoggerService } from 'src/logger/logger.service';
import { BannedWordsInterceptor } from './interceptor/bad-words/bad-words.interceptor';
import { QueueService } from './queue/queue.service';
import { ResponseDTO } from './types/common.types';
import { QuestionRagPayload, RequestRagPayload } from './types/validation.types';

// @UseFilters(BadRequestFilter, PrismaFilter, UnauthorizedFilter)
@Controller('bot-without-flow')
export class BotWithoutFlowController {
    constructor(
        private readonly service: BotWithoutFlowService,
        private readonly logger: LoggerService,
        private readonly queueService : QueueService
    ) { }
    
    @UseInterceptors(BannedWordsInterceptor(process.env.WA_BOT_GATEWAY_SESSION))
    @Post("send-chat")
    async postChat(
        @Body() body: CreateEventDto,
        @Res() res: Response
    ): Promise<Response> {

        this.logger.debug("Message Body Received:", JSON.stringify(body));

        if (body.payload.fromMe) {
            this.logger.debug(`Skip pesan outbound dari bot. payload.id=${body.payload.id || "-"}`, BotWithoutFlowController.name);

            return res.status(200).send({
                status : "success",
                message : "Pesan dari bot diabaikan",
                code : 200
            } as ResponseDTO);
        }

        const formatWIB = (timestampSec?: number) => {
            const date = timestampSec ? new Date(timestampSec * 1000) : new Date();
            const opts: Intl.DateTimeFormatOptions = {
            timeZone: 'Asia/Jakarta',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
            };
            const parts = new Intl.DateTimeFormat('en-GB', opts).formatToParts(date);
            const map = Object.fromEntries(parts.map(p => [p.type, p.value]));
            return `${map.hour}:${map.minute} WIB`;
        };

        let payload: BotWebhookPayload = {
            message_id: body.payload.id,
            phone_number: body.payload.vote ? body.payload.vote.from : body.payload.from,
            webhook_room: "",
            message: body.payload.hasMedia ? body.payload.media.url : body.payload.body,
            author: body.payload._data.pushName || "",
            caption: body.payload.body,
            time: formatWIB(body.payload.timestamp)
        };

        // const sendChat = await this.service.sendChatService(payload);

        await this.queueService.addQueue("ai-chat", payload);

        return res.status(200).send({
            status : "success",
            message : "Pesan didfaftarkan ke antrian",
            code : 200
        } as ResponseDTO);
    }

    @UseFilters(BadRequestFilter, PrismaFilter)
    @Post("generate-question-rag")
    async postQuestionRAG(
        @Body() body : QuestionRagPayload,
        @Res() res : Response
    ){
        await this.queueService.addGenerateRagQueue("question-rag", body);

        return res.status(200).send({
            status : "success",
            message : "Question RAG didaftarkan ke antrian",
            code : 200
        } as ResponseDTO);
    }

    @UseFilters(BadRequestFilter, PrismaFilter)
    @Post("generate-request-rag")
    async postRequestRAG(
        @Body() body : RequestRagPayload,
        @Res() res : Response
    ){
        await this.queueService.addGenerateRagQueue("request-rag", body);

        return res.status(200).send({
            status : "success",
            message : "Request RAG didaftarkan ke antrian",
            code : 200
        } as ResponseDTO);
    }
}
