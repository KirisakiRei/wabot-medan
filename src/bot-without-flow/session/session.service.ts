import { Injectable } from '@nestjs/common';
import Redis from 'ioredis';
import { BotWebhookPayload } from 'src/bot-webhook/bot-webhook.dto';

@Injectable()
export class SessionService {
    constructor(
        private readonly redisService: Redis
    ) { }

    async setSession(session: "sesi-percakapan" | "mengisi-formulir" | "konfirmasi-melanjutkan-percakapan" | "mengisi-rating", payload : BotWebhookPayload) {
        await this.redisService.set(`bot-session-${payload.phone_number}`, session);
    }

    async getSession(payload : BotWebhookPayload) : Promise<"sesi-percakapan" | "mengisi-formulir" | "konfirmasi-melanjutkan-percakapan" | "mengisi-rating">{
        const session = await this.redisService.get(`bot-session-${payload.phone_number}`);

        if(!session) {
            await this.setSession("sesi-percakapan", payload);

            return "sesi-percakapan"
        }

        return session as "sesi-percakapan" | "mengisi-formulir" | "konfirmasi-melanjutkan-percakapan" | "mengisi-rating";
    }

    async setSessionRoom(sessionRoom: string, payload : BotWebhookPayload) {
        await this.redisService.set(`bot-session-room-${payload.phone_number}`, sessionRoom);
    }

    async getSessionRoom(payload : BotWebhookPayload) : Promise<string> {
        const sessionRoom = await this.redisService.get(`bot-session-room-${payload.phone_number}`);
        if(!sessionRoom) {
            const newSessionRoom = `room-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
            await this.setSessionRoom(newSessionRoom, payload);
            return newSessionRoom;
        }
        return sessionRoom;
    }
}
