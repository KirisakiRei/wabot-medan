import { BadRequestException, Injectable, NestMiddleware } from '@nestjs/common';
import { BotWebhookService } from '../bot-webhook.service';
import { ActiveRequest } from 'src/active-request/active-request';
import { NextFunction, Request, Response } from 'express';
import { CreateEventDto } from '../message.dto';
import { SistemInformasiService } from '../sistem-informasi/sistem-informasi.service';

@Injectable()
export class PengaduanMiddleware implements NestMiddleware {

  constructor(private readonly redisService: ActiveRequest, private readonly botWebhookService: SistemInformasiService) { }

  async use(req: Request, res: Response, next: NextFunction) {
    const { payload } = req.body as CreateEventDto;
    const { from, body } = payload;

    const phone = from;

    if (!phone) {
      throw new BadRequestException('Nomor HP wajib diisi');
    }

    const isLocked = await this.redisService.get(`lock:${phone}`);
    if (isLocked === "locked") {
      await this.botWebhookService.sendSeen(phone, "wapengaduan");
      await this.botWebhookService.startTyping(phone, "wapengaduan");
      await this.botWebhookService.sendChat(phone, "Chat anda sedang diproses. Mohon menunggu. Diharapkan tidak spam chat. Terimakasih", "wapengaduan");
      await this.botWebhookService.stopTyping(phone, "wapengaduan");

      // throw new BadRequestException('Permintaan untuk nomor ini sedang diproses.');

      return res.status(200).send({
        status: "Blocked"
      });
    }

    // Tandai sebagai sedang diproses
    await this.redisService.set(`lock:${phone}`, 'locked'); // TTL 30 detik

    const lastMessage = await this.redisService.get(`last-message:${phone}`);

    if (lastMessage === body) {

      return res.status(200).send({
        status: "Blocked"
      });

    }

    await this.redisService.set(`last-message:${phone}`, body);

    // Pastikan dilepas setelah response selesai
    res.on('finish', async () => {
      await this.redisService.del(`lock:${phone}`);
    });
    next();
  }
}
