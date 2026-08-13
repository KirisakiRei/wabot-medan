import { Injectable } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import { LoggerService } from 'src/logger/logger.service';
import { NanobotTurnRequest, NanobotTurnResponse } from './types/nanobot.types';

@Injectable()
export class NanobotClientService {
    private readonly engine: AxiosInstance;

    constructor(
        private readonly logger: LoggerService
    ) {
        this.engine = axios.create({
            baseURL: process.env.NANOBOT_ENGINE_URL || "http://localhost:8765",
            timeout: parseInt(process.env.NANOBOT_ENGINE_TIMEOUT || "60000", 10),
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${process.env.NANOBOT_SERVICE_TOKEN || ""}`,
                "X-Internal-Request": "true"
            }
        });
    }

    async turn(request: NanobotTurnRequest): Promise<NanobotTurnResponse | null> {
        return await this.engine.post<NanobotTurnResponse>("/api/v1/turns", request).then((response) => {
            this.logger.debug(`NANOBOT TURN RESPONSE : ${JSON.stringify(response.data)}`, `NanobotClientService/turn`);

            return response.data;
        }).catch((error) => {
            this.logger.error("Error call Nanobot engine", error, `${NanobotClientService.name}/${this.turn.name}`);
            return null;
        });
    }
}
