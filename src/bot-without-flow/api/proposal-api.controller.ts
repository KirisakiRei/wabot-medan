import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { LoggerService } from 'src/logger/logger.service';
import { NanobotApiService } from './nanobot-api.service';
import { NanobotAuthGuard } from './nanobot-auth.guard';
import {
    ProposalDraftCreateRequestDTO,
    ProposalDraftKeyParamDTO,
    ProposalFieldUpdateRequestDTO,
    ProposalFormIdParamDTO,
    ProposalRequestIdParamDTO,
    ProposalServiceSearchRequestDTO,
    ProposalStatusRequestDTO
} from './nanobot-api.dto';
import { ResponseDTO } from '../types/common.types';

@UseGuards(NanobotAuthGuard)
@Controller("api/v1/proposals")
export class ProposalApiController {

    constructor(
        private readonly nanobotApiService: NanobotApiService,
        private readonly logger: LoggerService
    ) { }

    @Post("services/search")
    async searchServices(
        @Body() body: ProposalServiceSearchRequestDTO
    ): Promise<ResponseDTO> {
        this.logger.debug(`Proposal Service Search Request: ${JSON.stringify(body)}`, ProposalApiController.name);

        const result = await this.nanobotApiService.searchProposalServices(body.query, body.wa_number);

        return {
            status: "success",
            code: 200,
            message: "Pencarian layanan selesai",
            data: result
        } as ResponseDTO;
    }

    @Get("services/:request_id/schema")
    async getSchema(
        @Param() param: ProposalRequestIdParamDTO
    ): Promise<ResponseDTO> {
        const result = await this.nanobotApiService.getProposalSchema(param.request_id);

        return {
            status: result.success ? "success" : "error",
            code: result.success ? 200 : 404,
            message: result.success ? "Skema layanan ditemukan" : result.message || "Layanan tidak ditemukan",
            data: result
        } as ResponseDTO;
    }

    @Post("drafts")
    async createDraft(
        @Body() body: ProposalDraftCreateRequestDTO
    ): Promise<ResponseDTO> {
        const result = await this.nanobotApiService.createProposalDraft(body.wa_number, body.request_id);

        return {
            status: result.success ? "success" : "error",
            code: result.success ? 200 : 400,
            message: result.success ? "Draft permohonan dibuat" : result.message || "Gagal membuat draft",
            data: result
        } as ResponseDTO;
    }

    @Patch("drafts/:draft_key/fields/:form_id")
    async updateField(
        @Param() param: ProposalDraftKeyParamDTO & ProposalFormIdParamDTO,
        @Body() body: ProposalFieldUpdateRequestDTO
    ): Promise<ResponseDTO> {
        const result = await this.nanobotApiService.updateProposalField(param.draft_key, param.form_id, body.value);

        return {
            status: result.success ? "success" : "error",
            code: result.success ? 200 : 400,
            message: result.success ? "Isian form tersimpan" : result.message || "Gagal menyimpan isian form",
            data: result
        } as ResponseDTO;
    }

    @Post("drafts/:draft_key/validate")
    async validateDraft(
        @Param() param: ProposalDraftKeyParamDTO
    ): Promise<ResponseDTO> {
        const result = await this.nanobotApiService.validateProposalDraft(param.draft_key);

        return {
            status: "success",
            code: 200,
            message: "Validasi draft selesai",
            data: result
        } as ResponseDTO;
    }

    @Post("drafts/:draft_key/submit")
    async submitDraft(
        @Param() param: ProposalDraftKeyParamDTO
    ): Promise<ResponseDTO> {
        const result = await this.nanobotApiService.submitProposalDraft(param.draft_key);

        return {
            status: result.success ? "success" : "error",
            code: result.success ? 200 : 400,
            message: result.success ? "Permohonan berhasil dikirim" : result.message || "Gagal mengirim permohonan",
            data: result
        } as ResponseDTO;
    }

    @Post("drafts/:draft_key/cancel")
    async cancelDraft(
        @Param() param: ProposalDraftKeyParamDTO
    ): Promise<ResponseDTO> {
        const result = await this.nanobotApiService.cancelProposalDraft(param.draft_key);

        return {
            status: "success",
            code: 200,
            message: "Draft permohonan dibatalkan",
            data: result
        } as ResponseDTO;
    }

    @Post("status")
    async checkStatus(
        @Body() body: ProposalStatusRequestDTO
    ): Promise<ResponseDTO> {
        const result = await this.nanobotApiService.checkProposalTicket(body.ticket, body.wa_number);

        return {
            status: "success",
            code: 200,
            message: result.found ? "Tiket ditemukan" : "Tiket tidak ditemukan",
            data: result
        } as ResponseDTO;
    }
}
