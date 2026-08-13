import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { LoggerService } from 'src/logger/logger.service';
import { NanobotApiService } from './nanobot-api.service';
import { NanobotAuthGuard } from './nanobot-auth.guard';
import { InformationSearchRequestDTO } from './nanobot-api.dto';
import { ResponseDTO } from '../types/common.types';

@UseGuards(NanobotAuthGuard)
@Controller("api/v1/information")
export class InformationApiController {

    constructor(
        private readonly nanobotApiService: NanobotApiService,
        private readonly logger: LoggerService
    ) { }

    @Post("search")
    async search(
        @Body() body: InformationSearchRequestDTO
    ): Promise<ResponseDTO> {
        this.logger.debug(`Information Search Request: ${JSON.stringify(body)}`, InformationApiController.name);

        const result = await this.nanobotApiService.searchInformation(body.query, body.wa_number);

        return {
            status: "success",
            code: 200,
            message: "Pencarian informasi selesai",
            data: result
        } as ResponseDTO;
    }
}
