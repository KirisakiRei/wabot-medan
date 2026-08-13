import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { LoggerService } from 'src/logger/logger.service';
import { NanobotApiService } from './nanobot-api.service';
import { NanobotAuthGuard } from './nanobot-auth.guard';
import {
    ComplaintAppendRequestDTO,
    ComplaintDraftCreateRequestDTO,
    ComplaintDraftKeyParamDTO,
    ComplaintStatusRequestDTO
} from './nanobot-api.dto';
import { ResponseDTO } from '../types/common.types';

@UseGuards(NanobotAuthGuard)
@Controller("api/v1/complaints")
export class ComplaintsApiController {

    constructor(
        private readonly nanobotApiService: NanobotApiService,
        private readonly logger: LoggerService
    ) { }

    @Post("template")
    async getTemplate(): Promise<ResponseDTO> {
        const result = await this.nanobotApiService.getComplaintTemplate();

        return {
            status: result.success ? "success" : "error",
            code: result.success ? 200 : 404,
            message: result.success ? "Template pengaduan ditemukan" : result.message || "Template pengaduan tidak ditemukan",
            data: result
        } as ResponseDTO;
    }

    @Post("drafts")
    async createDraft(
        @Body() body: ComplaintDraftCreateRequestDTO
    ): Promise<ResponseDTO> {
        this.logger.debug(`Complaint Draft Create Request: ${JSON.stringify(body)}`, ComplaintsApiController.name);

        const result = await this.nanobotApiService.createComplaintDraft(body.wa_number);

        return {
            status: result.success ? "success" : "error",
            code: result.success ? 200 : 400,
            message: result.success ? "Draft pengaduan dibuat" : result.message || "Gagal membuat draft pengaduan",
            data: result
        } as ResponseDTO;
    }

    @Post("drafts/:draft_key/append")
    async appendDraft(
        @Param() param: ComplaintDraftKeyParamDTO,
        @Body() body: ComplaintAppendRequestDTO
    ): Promise<ResponseDTO> {
        this.logger.debug(`Complaint Draft Append Request: ${JSON.stringify(body)}`, ComplaintsApiController.name);

        const result = await this.nanobotApiService.appendComplaintDraft(
            body.wa_number,
            body.value,
            body.media_url,
            body.media_caption
        );

        return {
            status: result.success ? "success" : "error",
            code: result.success ? 200 : 400,
            message: result.success ? "Isi pengaduan tersimpan" : result.message || "Gagal menyimpan isi pengaduan",
            data: result
        } as ResponseDTO;
    }

    @Post("drafts/:draft_key/submit")
    async submitDraft(
        @Param() param: ComplaintDraftKeyParamDTO
    ): Promise<ResponseDTO> {
        const result = await this.nanobotApiService.submitComplaintDraft(param.draft_key);

        return {
            status: result.success ? "success" : "error",
            code: result.success ? 200 : 400,
            message: result.success ? "Pengaduan berhasil dikirim" : result.message || "Gagal mengirim pengaduan",
            data: result
        } as ResponseDTO;
    }

    @Post("drafts/:draft_key/cancel")
    async cancelDraft(
        @Param() param: ComplaintDraftKeyParamDTO
    ): Promise<ResponseDTO> {
        const result = await this.nanobotApiService.cancelComplaintDraft(param.draft_key);

        return {
            status: "success",
            code: 200,
            message: "Draft pengaduan dibatalkan",
            data: result
        } as ResponseDTO;
    }

    @Post("status")
    async checkStatus(
        @Body() body: ComplaintStatusRequestDTO
    ): Promise<ResponseDTO> {
        const result = await this.nanobotApiService.checkComplaintStatus(body.ticket, body.wa_number);

        return {
            status: "success",
            code: 200,
            message: result.found ? "Tiket ditemukan" : "Tiket tidak ditemukan",
            data: result
        } as ResponseDTO;
    }
}
