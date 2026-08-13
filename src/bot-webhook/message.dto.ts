import {
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { QuestionAnswer } from 'generated/prisma';
import { JsonValue } from 'generated/prisma/runtime/library';

class MeDto {
  @IsString()
  id: string;

  @IsString()
  pushName: string;
}

class KeyDto {
  @IsString()
  remoteJid: string;

  @IsBoolean()
  fromMe: boolean;

  @IsString()
  id: string;
}

class DisappearingModeDto {
  @IsString()
  initiator: string;

  @IsString()
  trigger: string;

  @IsBoolean()
  initiatedByMe: boolean;
}

class ContextInfoDto {
  @IsString()
  ephemeralSettingTimestamp: string;

  @ValidateNested()
  @Type(() => DisappearingModeDto)
  disappearingMode: DisappearingModeDto;
}

class ExtendedTextMessageDto {
  @IsString()
  text: string;

  @ValidateNested()
  @Type(() => ContextInfoDto)
  contextInfo: ContextInfoDto;

  @IsString()
  inviteLinkGroupTypeV2: string;
}

class DeviceListMetadataDto {
  @IsString()
  senderKeyHash: string;

  @IsString()
  senderTimestamp: string;

  @IsString()
  senderAccountType: string;

  @IsString()
  receiverAccountType: string;

  @IsString()
  recipientKeyHash: string;

  @IsString()
  recipientTimestamp: string;
}

class MessageContextInfoDto {
  @ValidateNested()
  @Type(() => DeviceListMetadataDto)
  deviceListMetadata: DeviceListMetadataDto;

  @IsNumber()
  deviceListMetadataVersion: number;

  @IsString()
  messageSecret: string;
}

class MessageDto {
  @ValidateNested()
  @Type(() => ExtendedTextMessageDto)
  extendedTextMessage: ExtendedTextMessageDto;

  @ValidateNested()
  @Type(() => MessageContextInfoDto)
  messageContextInfo: MessageContextInfoDto;
}

class _DataDto {
  // @ValidateNested()
  // @Type(() => KeyDto)
  // key: KeyDto;

  // @IsNumber()
  // messageTimestamp: number;

  @IsString()
  pushName: string;

  // @IsBoolean()
  // broadcast: boolean;

  // @ValidateNested()
  // @Type(() => MessageDto)
  // message: MessageDto;

  // @IsNumber()
  // status: number;
}

class VoteDTO {
  @IsString()
  id: string;

  @IsArray()
  selectedOptions: string[];

  @IsNumber()
  timestamp: number;

  @IsString()
  to: string;

  @IsString()
  from: string;

  @IsBoolean()
  fromMe: boolean;
}

class MediaDTO {
  @IsString()
  @IsOptional()
  url?: string;

  @IsString()
  @IsOptional()
  mimetype?: string;

  @IsString()
  @IsOptional()
  fileName?: string;
}

class PayloadDto {

  @IsOptional()
  @IsString()
  id?: string;

  @IsNumber()
  timestamp: number;

  @IsString()
  from: string;

  @IsOptional()
  @IsBoolean()
  fromMe?: boolean;

  @IsOptional()
  @ValidateNested()
  @Type(() => VoteDTO)
  vote?: VoteDTO;

  @IsOptional()
  @IsString()
  source?: string;

  @IsString()
  @IsOptional()
  body?: string;

  @IsBoolean()
  hasMedia: boolean;

  @IsOptional()
  @ValidateNested()
  @Type(() => MediaDTO)
  media?: MediaDTO;

  @IsOptional()
  @IsNumber()
  ack?: number;

  @IsOptional()
  @IsString()
  ackName?: string;

  @IsOptional()
  @IsString()
  author?: string;

  //   @IsOptional()
  //   replyTo?: any;
  @IsOptional()
  @ValidateNested()
  @Type(() => _DataDto)
  _data?: _DataDto;
}

class EnvironmentDto {
  @IsString()
  version: string;

  @IsString()
  engine: string;

  @IsString()
  tier: string;

  //   @IsOptional()
  //   browser?: any;
}

export class CreateEventDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsOptional()
  @IsNumber()
  timestamp?: number;

  @IsOptional()
  @IsString()
  event?: string;

  @IsOptional()
  @IsString()
  session?: string;

  @IsOptional()
  @IsObject()
  metadata?: object;

  @IsOptional()
  @ValidateNested()
  @Type(() => MeDto)
  me?: MeDto;

  @ValidateNested()
  @Type(() => PayloadDto)
  payload: PayloadDto;

  @IsOptional()
  @IsString()
  engine?: string;

  //   @ValidateNested()
  //   @Type(() => EnvironmentDto)
  //   environment: EnvironmentDto;
}

export class AnswerDTO {
  id: string;
  question_id: string;
  answer_type: "text" | "image" | "video" | "document" | "audio" | "location";
  answer: JsonValue;
  order: number;
  is_active: number;
  Questions: {
    question: string;
    organization_id : string;
  }
}
