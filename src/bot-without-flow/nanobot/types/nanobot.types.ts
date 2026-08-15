export type NanobotRoute =
    | "NONE"
    | "INFORMATION"
    | "PROPOSAL"
    | "REPORT"
    | "TICKET"
    | "ASSISTANT"
    | "IRRELEVANT";

export type NanobotReplyType =
    | "text"
    | "image"
    | "video"
    | "audio"
    | "document"
    | "location";

export type NanobotMedia = {
    url: string;
    mimetype?: string;
    filename?: string;
} | null;

export type NanobotService = {
    request_id: string;
    request_name: string;
} | null;

export type NanobotTurnContext = {
    active_route: NanobotRoute;
    current_step: number;
    last_response: string;
    request_id?: string | null;
    service?: NanobotService;
    forms?: { id: string; form: string; type: string; order: number }[] | null;
    pending_form_id?: string | null;
    ticket?: string | null;
};

export type NanobotTurnRequest = {
    message_id?: string;
    channel: "whatsapp";
    channel_user_id: string;
    text: string;
    media: NanobotMedia;
    sender_name: string;
    message_time: string;
    session_key: string;
    context: NanobotTurnContext;
    /** False = backend NestJS menyimpan chat_logs sendiri (hindari double insert). */
    persist_log?: boolean;
};

export type NanobotReply = {
    type: NanobotReplyType;
    text: string;
    file_url?: string | null;
    latitude?: number | null;
    longitude?: number | null;
};

export type NanobotTurnResponse = {
    route: NanobotRoute;
    reply: NanobotReply;
    tool_calls: string[];
    not_found: boolean;
    not_found_session?: "sistem-informasi" | "layanan-publik" | null;
    context: NanobotTurnContext;
};

export const NANOBOT_CONTEXT_KEY = (phone_number: string) => `nanobot-context-${phone_number}`;
