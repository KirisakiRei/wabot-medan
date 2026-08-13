export type TelegramUpdate = {
    update_id: number;
    message?: TelegramMessage;
    edited_message?: TelegramMessage;
};

export type TelegramMessage = {
    message_id: number;
    date: number;
    chat: {
        id: number;
        type: string;
        first_name?: string;
        last_name?: string;
        username?: string;
    };
    from?: {
        id: number;
        first_name?: string;
        username?: string;
    };
    text?: string;
    caption?: string;
    photo?: TelegramPhotoSize[];
    document?: TelegramDocument;
    location?: TelegramLocation;
};

export type TelegramPhotoSize = {
    file_id: string;
    file_unique_id: string;
    width: number;
    height: number;
    file_size?: number;
};

export type TelegramDocument = {
    file_id: string;
    file_unique_id: string;
    file_name?: string;
    mime_type?: string;
    file_size?: number;
};

export type TelegramLocation = {
    latitude: number;
    longitude: number;
};

export type TelegramFileResult = {
    ok: boolean;
    result?: {
        file_id: string;
        file_path: string;
        file_size?: number;
    };
};
