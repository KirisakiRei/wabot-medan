import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import { request_banks, request_categories, request_forms, request_histories } from 'generated/prisma';
import Redis from 'ioredis';
import { BotWebhookPayload } from 'src/bot-webhook/bot-webhook.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { LayananPublikDTO } from '../layanan-publik.dto';

@Injectable()
export class LayananPublikActionService {

    private readonly redis: Redis;

    constructor(
        @InjectQueue('layanan-publik') private readonly queue: Queue,
        private readonly prisma: PrismaService,
    ) {
        this.redis = new Redis({
            host: "localhost",
            port: 6379
        });
    }

    async getRequestCategories(): Promise<{ id: string, name: string }[]> {
        try {
            const data = await this.prisma.request_categories.findMany({
                where: {
                    deleted_at: null
                }
            });

            return data.map((item) => (
                {
                    id: item.id,
                    name: item.name
                }
            ));
        }
        catch (err) {
            console.error("Error get data from database : ", err);
            return [];
        }
    }

    async getRequestBanks(idCategory: string): Promise<{ id: string, name: string }[]> {
        try {
            const data = await this.prisma.request_banks.findMany({
                where: {
                    category_id: idCategory,
                    deleted_at: null
                }
            });

            return data.map((item) => (
                {
                    id: item.id,
                    name: item.request_name
                }
            ));
        }
        catch (err) {
            console.error("Error mengambil request_banks : ", err);
            return [];
        }
    }

    async getRequestBankById(id: string): Promise<request_banks | null> {
        try {
            const data = await this.prisma.request_banks.findUnique({
                where: {
                    id: id,
                    deleted_at: null
                }
            });

            return data;
        }
        catch (err) {
            console.error("Error mengambil request_banks by id : ", err);
            return null;
        }
    }

    async getRequestForms(idBank: string): Promise<request_forms[]> {
        try {
            const data = await this.prisma.request_forms.findMany({
                where: {
                    request_id: idBank
                }
            });

            return data;
        }
        catch (err) {
            console.error("Error mengambil request_forms : ", err);
            return [];
        }
    }

    async findCategory(data: BotWebhookPayload): Promise<request_categories | null> {
        try {
            const keywords = data.message && data.message.includes(" ") ? data.message.split(" ").slice(0, Math.min(10, data.message.split(" ").length)) : data.message ? [data.message] : [];

            if (keywords.length == 0) return null;

            const query = await this.prisma.request_categories.findMany({
                where: {
                    deleted_at: null,
                    OR: keywords.map((word) => ({
                        name: {
                            contains: word
                        }
                    }))
                },
                take: 50
            });

            const scored = query.map((q) => ({
                ...q,
                matchCount: keywords.filter((word) =>
                    q.name.toLowerCase().includes(word.toLowerCase())
                ).length,
            })).sort((a, b) => b.matchCount - a.matchCount);

            const bestMatch = scored[0];

            return bestMatch;
        }
        catch (err) {
            console.log(err);
            console.log("Error mencari kategori");
            return null;
        }
    }

    async addJobToQueue(data: LayananPublikDTO): Promise<void> {
        try {
            const job = await this.queue.add('simpan-data', data, {
                removeOnComplete: true,
                removeOnFail: true
            });

            console.info("Job added to queue:", job.id);
        }
        catch (err) {
            console.error("Error adding job to queue:", err);
        }
    }

    async checkRequestStatus(phoneNumber: string, ticket: string): Promise<(request_histories & { requestBank: { request_name: string } | null }) | null> {
        try {
            const data = await this.prisma.request_histories.findFirst({
                select: {
                    id: true,
                    request_id: true,
                    submit_response: true,
                    status: true,
                    sender: true,
                    created_at: true,
                    updated_at: true,
                    deleted_at: true,
                    requestBank: {
                        select: {
                            request_name: true,
                        }
                    }
                },
                where: {
                    sender: phoneNumber,
                    submit_response: ticket,
                    deleted_at: null
                },
                orderBy: {
                    created_at: 'desc'
                }
            });

            return data;
        }
        catch (err) {
            console.error("Error checking request status:", err);
            return null;
        }
    }
}
