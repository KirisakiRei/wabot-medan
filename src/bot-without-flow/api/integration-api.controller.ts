import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { LoggerService } from 'src/logger/logger.service';
import { NanobotApiService } from './nanobot-api.service';
import { NanobotAuthGuard } from './nanobot-auth.guard';
import { LogTurnRequestDTO, PreflightRequestDTO } from './nanobot-api.dto';
import { ResponseDTO } from '../types/common.types';

@UseGuards(NanobotAuthGuard)
@Controller("api/v1/integration/chat")
export class IntegrationApiController {

    constructor(
        private readonly nanobotApiService: NanobotApiService,
        private readonly logger: LoggerService
    ) { }

    @Post("preflight")
    async preflight(
        @Body() body: PreflightRequestDTO
    ): Promise<ResponseDTO> {
        this.logger.debug(`Preflight Request: ${JSON.stringify(body)}`, IntegrationApiController.name);

        const result = await this.nanobotApiService.preflight(body.channel_user_id, body.text);

        return {
            status: "success",
            code: 200,
            message: "Preflight selesai",
            data: result
        } as ResponseDTO;
    }

    @Post("log")
    async log(
        @Body() body: LogTurnRequestDTO
    ): Promise<ResponseDTO> {
        const saved = await this.nanobotApiService.logTurn({
            channel_user_id: body.channel_user_id,
            user_message: body.user_message,
            bot_reply: body.bot_reply,
            route: body.route,
            tool_calls: body.tool_calls
        });

        return {
            status: saved ? "success" : "error",
            code: saved ? 200 : 500,
            message: saved ? "Log turn tersimpan" : "Gagal menyimpan log turn",
            data: { saved }
        } as ResponseDTO;
    }
}
