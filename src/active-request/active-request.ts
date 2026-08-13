import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import Redis from 'ioredis';


@Injectable()
export class ActiveRequest implements OnModuleInit, OnModuleDestroy {
    private client: Redis;

    onModuleInit() {
        this.client = new Redis({
            host: 'localhost',
            port: 6379,
            db: 0
        });
    }

    onModuleDestroy() {
        this.client?.disconnect();
    }

    async set(key: string, value: string, ttlSeconds = 60) {
        await this.client.set(key, value, 'EX', ttlSeconds);
    }

    async exists(key: string) {
        const exists = await this.client.exists(key);
        return exists === 1;
    }

    async get(key: string) {
        return await this.client.get(key);
    }

    async del(key: string) {
        return await this.client.del(key);
    }
}
