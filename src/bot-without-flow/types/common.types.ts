import { FileInfo } from "src/whatsapp/types/wa-gate-way.dto";

export type ResponseDTO = {
    status: "success" | "error" | "warning";
    code: number;
    message: string;
    data?: any;
    errors?: any;
};

export type ErrorParameter = {
    message?: string | string[];
    returnMessage?: string;
    error?: string;
    statusCode?: number;
    context?: string;
    trace? : any
};

export type FinalMessage = {
    message : string;
    message_type : "text" | "audio" | "image" | "document" | "video" | "location";
    not_found : boolean;
    not_found_session : "sistem-informasi" | "layanan-publik" | "cek-pengaduan" | null;
    file_path? : FileInfo;
    latitude? : number;
    longitude? : number;
}