export class LayananPublikDTO {
    request_bank_id: string;
    request_token: string;
    request_sender : string;
    request_history: requestHistories[];
}

export class requestHistories {
    request_form_id: string;
    value: string;
    type: "text" | "file";
}