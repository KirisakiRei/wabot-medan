import { Injectable } from '@nestjs/common';
import axios, { AxiosError, AxiosInstance } from 'axios';
import { LoggerService } from 'src/logger/logger.service';
import { SendFileDTO, SendLocationDTO } from './types/wa-gate-way.dto';

@Injectable()
export class WhatsappService {
    private readonly wagateway: AxiosInstance;

    constructor(
        private readonly logger: LoggerService,
    ) {
        this.wagateway = axios.create({
            baseURL: process.env.WA_BOT_GATE_WAY,
            timeout: 10000,
            headers: {
                "Content-Type": "application/json",
                "X-Api-Key": process.env.WA_BOT_WA_GATE_WAY_API_KEY,
                "X-Internal-Request": "true"
            }
        });
    }

    async sendSeen(phone_number: string, session?: string) {
        await this.wagateway.post('/api/sendSeen', {
            chatId: phone_number,
            messageIds: [
                `false_${phone_number}_AAAAAAAAAAAAAAAAAAAA`
            ],
            participant: null,
            session: session || process.env.WA_BOT_GATEWAY_SESSION
        }).then((response) => {
            this.logger.log(`Request Sended`, `${WhatsappService.name}/${this.sendSeen.name}`)
        }).catch((error) => this.logger.error(`Error Gateway : ${error}`, error.name, `${WhatsappService.name}/${this.sendSeen.name}`));
    }

    async startTyping(phone_number: string, session?: string) {
        await this.wagateway.post('/api/startTyping', {
            chatId: phone_number,
            session: session || process.env.WA_BOT_GATEWAY_SESSION
        }).then((response) => {
            this.logger.log(`Request Sended`, `${WhatsappService.name}/${this.startTyping.name}`)
        }).catch((error) => this.logger.error(`Error Gateway : ${error}`, error.name, `${WhatsappService.name}/${this.startTyping.name}`));
    }

    async stopTyping(phone_number: string, session?: string) {
        await this.wagateway.post('/api/stopTyping', {
            chatId: phone_number,
            session: session || process.env.WA_BOT_GATEWAY_SESSION
        }).then((response) => {
            this.logger.log(`Request Sended`, `${WhatsappService.name}/${this.stopTyping.name}`)
        }).catch((error) => this.logger.error(`Error Gateway : ${error}`, error.name, `${WhatsappService.name}/${this.stopTyping.name}`));
    }

    async sendText(phone_number: string, teks: string, session?: string) {
        await this.wagateway.post('/api/sendText', {
            chatId: phone_number,
            reply_to: null,
            text: teks,
            linkPreview: true,
            linkPreviewHighQuality: false,
            session: session || process.env.WA_BOT_GATEWAY_SESSION
        }).then((response) => {
            this.logger.log(`Request Sended`, `${WhatsappService.name}/${this.sendText.name}`)
        }).catch((error) => this.logger.error(`Error Gateway : ${error} dengan session ${session}`, JSON.stringify(error), `${WhatsappService.name}/${this.sendText.name}`));
    }

    async sendImage({ phone_number, file, description }: SendFileDTO, session?: string) {

        const { mimetype, filename, url } = file;

        await this.wagateway.post('/api/sendImage', {
            chatId: phone_number,
            file: {
                mimetype: mimetype,
                filename: filename,
                url: url
            },
            reply_to: null,
            caption: description,
            session: session || process.env.WA_BOT_GATEWAY_SESSION
        }).then((response) => {
            this.logger.log(`Request Sended`, `${WhatsappService.name}/${this.sendImage.name}`)
        }).catch((error) => this.logger.error(`Error Gateway : ${error}`, error.name, `${WhatsappService.name}/${this.sendImage.name}`));
    }

    async sendLocation({ phone_number, title, latitude, longitude }: SendLocationDTO, session?: string) {
        await this.wagateway.post('/api/sendLocation', {
            chatId: phone_number,
            latitude: latitude,
            longitude: longitude,
            title: title,
            reply_to: null,
            session: session || process.env.WA_BOT_GATEWAY_SESSION
        }).then((response) => {
            this.logger.log(`Request Sended`, `${WhatsappService.name}/${this.sendLocation.name}`)
        }).catch((error) => this.logger.error(`Error Gateway : ${error}`, error.name, `${WhatsappService.name}/${this.sendLocation.name}`));
    }

    async sendFile({ phone_number, file, description }: SendFileDTO, session?: string) {

        const { mimetype, filename, url } = file;

        await this.wagateway.post('/api/sendFile', {
            chatId: phone_number,
            file: {
                mimetype: mimetype,
                filename: filename,
                url: url
            },
            reply_to: null,
            caption: description,
            session: session || process.env.WA_BOT_GATEWAY_SESSION
        }).then((response) => {
            this.logger.log(`Request Sended`, `${WhatsappService.name}/${this.sendFile.name}`)
        }).catch((error) => this.logger.error(`Error Gateway : ${error}`, error.name, `${WhatsappService.name}/${this.sendFile.name}`));
    }

    async sendVideo({ phone_number, file, description }: SendFileDTO, session?: string) {
        const { mimetype, filename, url } = file;

        await this.wagateway.post('/api/sendVideo', {
            chatId: phone_number,
            file: {
                mimetype: mimetype,
                filename: filename,
                url: url
            },
            reply_to: null,
            asNote: false,
            convert: true,
            caption: description,
            session: session || process.env.WA_BOT_GATEWAY_SESSION
        }).then((response) => {
            this.logger.log(`Request Sended`, `${WhatsappService.name}/${this.sendVideo.name}`)
        }).catch((error) => this.logger.error(`Error Gateway : ${error}`, error.name, `${WhatsappService.name}/${this.sendVideo.name}`));
    }
}
