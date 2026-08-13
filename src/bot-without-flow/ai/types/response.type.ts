import type { ChatCompletionResponse, Choice } from "src/bot-webhook/response-generator/types/aiDemo";

export type sessionMessageParse = {
    layanan: 'lainnya' | 'sistem-informasi' | 'layanan-publik' | 'cek-pengaduan',
    respon_ai: string,
    need_confirmation: boolean,
    context_query: string | null
}

export type sessionMessage = {
    content: string;
    role: string;
}

type sessionChoice = Omit<Choice, 'message'> & {
    message: sessionMessage;
};

export type sessionResponse = Omit<ChatCompletionResponse, 'choices'> & {
    choices: sessionChoice[];
}
