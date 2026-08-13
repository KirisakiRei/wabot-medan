import { Cache, CACHE_MANAGER } from '@nestjs/cache-manager';
import { BadRequestException, Inject, Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { BotWebhookService } from 'src/bot-webhook/bot-webhook.service';
import { CreateEventDto } from 'src/bot-webhook/message.dto';
import { SistemInformasiService } from 'src/bot-webhook/sistem-informasi/sistem-informasi.service';

@Injectable()
export class BannedWordsMiddleware implements NestMiddleware {

  constructor(
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private readonly botWebhookService: SistemInformasiService
  ) { }

  async use(req: Request, res: Response, next: NextFunction) {

    console.info("Chat Body masuk : ", req.body);

    const { payload } = req.body as CreateEventDto;
    const { from, body } = payload;
    const phone = from;
    const message = body.toLowerCase();

    const bannedWords = [
      // Kata kasar umum
      "anj***", "baj***", "bodo*", "gobl*k", "tai", "bangs*t", "kont*l", "memek", "peler", "tit*t", "jemb*t", "ngent*t",

      // Kata penghinaan personal
      "idiot", "tolol", "brengsek", "dungu", "pecundang",

      // Rasisme dan diskriminasi SARA
      "cina", "kafir", "bule", "pribumi", "jawa sial*", "hitam jele*", "islam teroris", "yahudi laknat", "nasrani biadab",

      // Seksual eksplisit atau pelecehan
      "seks", "porno", "bug*l", "mesum", "bokep", "col*", "masturb*", "ngoc*k", "jilat", "peluk cium", "open bo", "psk",

      // Kata bernada kekerasan/ancaman
      "bunuh", "bacok", "siksa", "tusuk", "tembak", "hancurkan", "gantung diri",

      // Kata negatif lainnya
      "bangke", "keparat", "celaka", "kampret", "sialan", "laknat", "neraka",

      // Bahasa asing (disaring secara lokal jika diperlukan)
      "fuck", "shit", "asshole", "bitch", "bastard", "slut", "dick", "pussy", "nigger", "faggot", "whore"
    ];

    const containsBadWords = bannedWords.some(word => message.includes(word));

    if (containsBadWords === true) {

      await this.cacheManager.set(`bad-words-${phone}`, "Pelanggaran Bad words");

      const checkCache = await this.cacheManager.get(`bad-words-${phone}`);

      if(!checkCache) {
        await this.botWebhookService.sendSeen(phone);
        await this.botWebhookService.startTyping(phone);
        await this.botWebhookService.sendChat(phone, "Chat anda tidak dapat diproses dikarenakan terindikasi pelanggaran dikarenakan mengandung kata-kata yang tidak dapat diperbolehkan");
        await this.botWebhookService.stopTyping(phone);
      }

      // throw new BadRequestException('Forbidden Words.');

      return res.status(200).send({
        status: "Blocked"
      });
    }

    res.on('finish', async () => {
      await this.cacheManager.del(`bad-words-${phone}`);
    });

    next();
  }
}
