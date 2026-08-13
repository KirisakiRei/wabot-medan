export class SendLocationDTO {
    latitude: number;
    longitude: number;
    title: string;
    phone_number: string;
}

export class PollDTO {
    name: string;
    options: string[];
    multipleAnswer: boolean;
}

export class SendFileDTO {
    file: FileInfo;
    description: string;
    phone_number: string;
}

export class FileInfo {
    mimetype: string;
    filename: string;
    url: string;
}