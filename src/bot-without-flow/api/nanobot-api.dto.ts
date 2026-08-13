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

export class ComplaintDraftCreateRequestDTO {
    @IsString()
    wa_number: string;
}

export class ComplaintAppendRequestDTO {
    @IsString()
    wa_number: string;

    @IsOptional()
    @IsString()
    value?: string;

    @IsOptional()
    @IsString()
    media_url?: string;

    @IsOptional()
    @IsString()
    media_caption?: string;
}

export class ComplaintStatusRequestDTO {
    @IsString()
    ticket: string;

    @IsString()
    wa_number: string;
}

export class ComplaintDraftKeyParamDTO {
    @IsString()
    draft_key: string;
}

export class ConversationKeyParamDTO {
    @IsString()
    key: string;
}

export class ConversationStateRequestDTO {
    @IsOptional()
    context?: any;

    @IsOptional()
    @IsArray()
    history?: { role: string; content: string }[];
}

export class ConversationCompactRequestDTO {
    @IsOptional()
    summary?: any;

    @IsOptional()
    @IsNumber()
    message_count?: number;
}
