import { IsNotEmpty, IsBoolean, IsNumber, IsObject, IsOptional, IsString, ValidateNested, IsArray } from 'class-validator';
import { Type } from 'class-transformer';
import { PollDTO } from './wa-gate-way/wa-gate-way.dto';

export class ProgressDTO {
    responseMessage?: string;
    nextProgress: "memulai-chat" | "memilih-kategori-layanan" | "memilih_kategori_usulan" | "memilih_layanan_usulan" | "mengisi-pengaduan"  | "memilih-kategori-kembali" | "memilih-kategori-pertanyaan" | "mengkonfirmasi-keaktifan" | "menjawab-pertanyaan" | "menanyakan-kepuasan-terhadap-jawaban" | "menanyakan-rating" | "mengakhiri-chat" | "mengisi-rating-sesi-sebelumnya" | "mengisi_syarat_layanan_publik" | "memilih-jenis-layanan-usulan" | "memilih-cek-tiket-usulan";
    pollData? : PollDTO;
    answerType?: "text" | "image" | "video" | "document" | "audio" | "location" | "buttons";

}

export class BotWebhookPayload {
    message_id?: string;
    phone_number: string;
    message: string;
    webhook_room: string;
    author? : string;
    caption? : string;
    time? : string;
}

export class QueueData extends BotWebhookPayload {
    id: string;
    questionID?: string;
    categoryID?: string;
    organizationID?: string;
    year: number;
    botReply?: string;
    type: "answered" | "without-answer" | "message-without-question"
}

export class AnswerData {
    value?: string;
    latitude?: string;
    longitude?: string;
    description? : string;
    file? : string;
}

export class ButtonData {
    type : "reply" | "call" | "copy" | "url";
    text : string;
    phoneNumber? : string;
    copyCode? : string;
    url? : string;
}

class S3Dto {
    @IsString()
    Bucket: string;

    @IsString()
    Key: string;
}

class MediaDto {
    @IsString()
    url: string;

    @IsString()
    mimetype: string;

    @IsString()
    filename: string;

    @ValidateNested()
    @Type(() => S3Dto)
    s3: S3Dto;

    @IsOptional()
    error: any;
}

class LocationDto {
    @IsString()
    description: string;

    @IsString()
    latitude: string;

    @IsString()
    longitude: string;
}

class ReplyToDto {
    @IsString()
    id: string;

    @IsString()
    participant: string;

    @IsString()
    body: string;

    @IsObject()
    _data: object;
}

class PayloadDto {
    @IsString()
    id: string;

    @IsOptional()
    @IsArray()
    selectedOptions? : string[];

    @IsNumber()
    timestamp: number;

    @IsString()
    from: string;

    @IsBoolean()
    fromMe: boolean;

    @IsString()
    source: string;

    @IsString()
    to: string;

    @IsOptional()
    @IsString()
    participant?: string;

    @IsOptional()
    @IsString()
    body?: string;

    @IsBoolean()
    hasMedia: boolean;

    @IsOptional()
    @ValidateNested()
    @Type(() => MediaDto)
    media?: MediaDto;

    @IsOptional()
    @IsNumber()
    ack?: number;

    @IsOptional()
    @IsString()
    ackName?: string;

    @IsOptional()
    @IsString()
    author?: string;

    @IsOptional()
    @ValidateNested()
    @Type(() => LocationDto)
    location?: LocationDto;

    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    vCards?: string[];

    @IsOptional()
    @IsObject()
    _data?: object;

    @IsOptional()
    @ValidateNested()
    @Type(() => ReplyToDto)
    replyTo?: ReplyToDto;
}

class MeDto {
    @IsString()
    id: string;

    @IsString()
    pushName: string;
}

class EnvironmentDto {
    @IsString()
    version: string;

    @IsString()
    engine: string;

    @IsString()
    tier: string;

    @IsString()
    browser: string;
}

class RootDto {
    @IsString()
    id: string;

    @IsNumber()
    timestamp: number;

    @IsString()
    session: string;

    @IsOptional()
    @IsObject()
    metadata?: object;

    @IsString()
    engine: string;

    @IsString()
    event: string;

    @ValidateNested()
    @Type(() => PayloadDto)
    payload: PayloadDto;

    @ValidateNested()
    @Type(() => MeDto)
    me: MeDto;

    @ValidateNested()
    @Type(() => EnvironmentDto)
    environment: EnvironmentDto;
}

export class IncomingWebhookDto extends RootDto { }
