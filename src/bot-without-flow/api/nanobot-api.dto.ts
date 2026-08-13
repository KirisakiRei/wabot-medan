import { IsArray, IsNumber, IsOptional, IsString } from 'class-validator';

export class PreflightRequestDTO {
    @IsString()
    channel: string;

    @IsString()
    channel_user_id: string;

    @IsString()
    text: string;
}

export class LogTurnRequestDTO {
    @IsString()
    channel: string;

    @IsString()
    channel_user_id: string;

    @IsString()
    user_message: string;

    @IsString()
    bot_reply: string;

    @IsOptional()
    @IsString()
    route?: string;

    @IsOptional()
    @IsArray()
    tool_calls?: string[];
}

export class InformationSearchRequestDTO {
    @IsString()
    query: string;

    @IsString()
    wa_number: string;

    @IsOptional()
    @IsString()
    channel?: string;

    @IsOptional()
    @IsString()
    channel_user_id?: string;
}

export class ProposalServiceSearchRequestDTO {
    @IsString()
    query: string;

    @IsString()
    wa_number: string;
}

export class ProposalDraftCreateRequestDTO {
    @IsString()
    wa_number: string;

    @IsString()
    request_id: string;
}

export class ProposalFieldUpdateRequestDTO {
    @IsString()
    value: string;
}

export class ProposalStatusRequestDTO {
    @IsString()
    ticket: string;

    @IsString()
    wa_number: string;
}

export class ProposalDraftKeyParamDTO {
    @IsString()
    draft_key: string;
}

export class ProposalFormIdParamDTO {
    @IsString()
    form_id: string;
}

export class ProposalRequestIdParamDTO {
    @IsString()
    request_id: string;
}
