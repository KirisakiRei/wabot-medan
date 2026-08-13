import { Body, Controller, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { LoggerService } from 'src/logger/logger.service';
import { NanobotApiService } from './nanobot-api.service';
import { NanobotAuthGuard } from './nanobot-auth.guard';
import { ConversationCompactRequestDTO, ConversationKeyParamDTO, ConversationStateRequestDTO } from './nanobot-api.dto';
import { ResponseDTO } from '../types/common.types';

@UseGuards(NanobotAuthGuard)
@Controller("api/v1/conversations")
export class ConversationsApiController {

    constructor(
        private readonly nanobotApiService: NanobotApiService,
        private readonly logger: LoggerService
    ) { }

    @Get(":key")
    async getConversation(
        @Param() param: ConversationKeyParamDTO
    ): Promise<ResponseDTO> {
        const result = await this.nanobotApiService.getConversation(param.key);

        return {
            status: "success",
            code: 200,
            message: "State percakapan ditemukan",
            data: result
        } as ResponseDTO;
    }

    @Put(":key")
    async setConversation(
        @Param() param: ConversationKeyParamDTO,
        @Body() body: ConversationStateRequestDTO
    ): Promise<ResponseDTO> {
        this.logger.debug(`Conversation State Request: ${JSON.stringify({ key: param.key, history: (body.history || []).length })}`, ConversationsApiController.name);

        const result = await this.nanobotApiService.setConversation(
            param.key,
            body.context,
            body.history || []
        );

        return {
            status: "success",
            code: 200,
            message: "State percakapan tersimpan",
            data: result
        } as ResponseDTO;
    }

    @Post(":key/compact")
    async compactConversation(
        @Param() param: ConversationKeyParamDTO,
        @Body() body: ConversationCompactRequestDTO
    ): Promise<ResponseDTO> {
        const result = await this.nanobotApiService.compactConversation(
            param.key,
            body.summary,
            body.message_count
        );

        return {
            status: "success",
            code: 200,
            message: "Ringkasan percakapan tersimpan",
            data: result
        } as ResponseDTO;
    }
}
