import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import Redis from 'ioredis';

@Injectable()
export class SessionService {

    private readonly todayDateTime: string;
    private readonly redis: Redis;

    constructor(
        @InjectQueue('session') private readonly queue: Queue
    ) {
        const formatter = new Intl.DateTimeFormat('id-ID', {
            timeZone: 'Asia/Jakarta',
            hour12: false,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
        this.todayDateTime = formatter.format(new Date()).replace(/\//g, '-').replace(', ', 'T');
        this.redis = new Redis({
            host: "localhost",
            port: 6379
        });
    }

    async checkSession(session: Record<string, any>, phone_number: string): Promise<{ phone: string, room: string, question_category: string }> {

        console.log("session : ", session);

        const currentSessionString = await this.redis.get(`session-${phone_number}`);
        const currentSession = JSON.parse(currentSessionString);

        console.log("Current session : ", currentSession);

        if (!currentSession || currentSession.phone !== phone_number) {
            const newSession = {
                phone: phone_number,
                room: `${phone_number}-${this.todayDateTime}`,
                question_category: ''
            };

            await this.redis.set(`session-${phone_number}`, JSON.stringify(newSession)).catch((err) => {
                console.error(`Error menyimpan session : `, err);
            });

            return newSession;
        }

        return currentSession;

    }

    async updateSession(session: Record<string, any>, question_category: string, phone_number: string) {
        const currentSessionString = await this.redis.get(`session-${phone_number}`);
        const currentSession: { phone: string, room: string, question_category: string } = JSON.parse(currentSessionString);

        const newSession = {
            ...currentSession,
            question_category: question_category
        }

        await this.redis.set(`session-${phone_number}`, JSON.stringify(newSession)).catch((err) => {
            console.error(`Error menyimpan session : `, err);
        });
    }

    async destroySession(session: Record<string, any>, phone_number: string) {
        await this.redis.del(`session-${phone_number}`);
    }

    async addCheckAbsensi(idPhoneNumber: string, webhook_room: string, total_chat: number, phone_number: string) {
        await this.queue.add("check-kehadiran", {
            idPhoneNumber, webhook_room, total_chat, phone_number
        }, {
            removeOnComplete: true,
            removeOnFail: true,
            delay: 60000
        });
    }

    async removeAbsensi(idPhoneNumber: string, webhook_room: string): Promise<void> {
        // Ambil hanya job yang masih bisa dibatalkan (belum selesai/gagal)
        const jobs = await this.queue.getJobs(['delayed', 'waiting', 'active']);

        // Filter job sesuai nama dan data idPhoneNumber + webhook_room
        const absensiJobs = jobs.filter(job =>
            job.name === 'check-kehadiran' &&
            job.data?.idPhoneNumber === idPhoneNumber &&
            job.data?.webhook_room === webhook_room
        );

        // Hapus semua job yang cocok
        for (const job of absensiJobs) {
            await job.remove();
        }

        console.info(`Removed ${absensiJobs.length} job(s) for idPhoneNumber: ${idPhoneNumber}, webhook_room: ${webhook_room}`);
    }

    async addRating(chatRoom: string, rating: number) {
        await this.queue.add("proses-rating", {
            chatRoom, rating
        }, {
            removeOnComplete: true,
            removeOnFail: true
        });
    }

}
