import { BadRequestException, Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { ActiveRequest } from './active-request';
import { CreateEventDto } from 'src/bot-webhook/message.dto';
import { BotWebhookService } from 'src/bot-webhook/bot-webhook.service';
import { SistemInformasiService } from 'src/bot-webhook/sistem-informasi/sistem-informasi.service';

@Injectable()
export class ActiveRequestMiddleware implements NestMiddleware {

  constructor(private readonly redisService: ActiveRequest, private readonly botWebhookService: SistemInformasiService) { }

  async use(req: Request, res: Response, next: NextFunction) {

    const { payload } = req.body as CreateEventDto;

    if (!payload) {
      console.error("Error validasi")
      throw new BadRequestException('Payload wajib diisi');
    }
    const { from } = payload;

    const phone = from;

    if (!phone) {
      console.error("Error Validasi")
      throw new BadRequestException('Nomor HP wajib diisi');
    }

    const existLocker = await this.redisService.exists(`lock:${phone}`);
    if (existLocker) {
      const isLocked = await this.redisService.get(`lock:${phone}`);

      console.info(`Check spam : ${isLocked}`);

      const variables = await this.botWebhookService.getVariables();

      if (isLocked === "locked") {
        await this.botWebhookService.sendSeen(phone);
        await this.botWebhookService.startTyping(phone);
        await this.botWebhookService.sendChat(phone, variables.find((item) => item.name == "respon_spam_chat").content || "Chat anda sedang diproses. Mohon menunggu. Diharapkan tidak spam chat. Terimakasih");
        await this.botWebhookService.stopTyping(phone);

        // throw new BadRequestException('Permintaan untuk nomor ini sedang diproses.');

        return res.status(200).send({
          status: "Blocked"
        });
      }
    }

    // Tandai sebagai sedang diproses
    await this.redisService.set(`lock:${phone}`, 'locked'); // TTL 30 detik

    // const lastMessage = await this.redisService.get(`last-message:${phone}`);

    // if (lastMessage === body) {

    //   return res.status(200).send({
    //     status: "Blocked"
    //   });

    // }

    // await this.redisService.set(`last-message:${phone}`, body);

    // Pastikan dilepas setelah response selesai
    res.on('finish', async () => {
      await this.redisService.del(`lock:${phone}`);
    });

    next();
  }
}
