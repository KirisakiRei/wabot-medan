import { Variables } from "generated/prisma";
import { sessionMessage } from "./response.type";

export type payloadLintas = {
    model : string;
    messages : sessionMessage[];
    stream : boolean;
    temperature : number;
    max_tokens : number;
    top_p : number;
}

export type RAGRequestParam = {
    request: string;
    wa_number?: string;
    variables: Variables[];
}