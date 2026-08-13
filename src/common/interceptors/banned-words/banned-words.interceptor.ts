import { Cache, CACHE_MANAGER } from '@nestjs/cache-manager';
import { CallHandler, ExecutionContext, Inject, Injectable, NestInterceptor } from '@nestjs/common';
import { Request, Response } from 'express';
import { Observable } from 'rxjs';
import { BotWebhookService } from 'src/bot-webhook/bot-webhook.service';
import { CreateEventDto } from 'src/bot-webhook/message.dto';
import { SistemInformasiService } from 'src/bot-webhook/sistem-informasi/sistem-informasi.service';
import { PrismaService } from 'src/prisma/prisma.service';

export function BannedWordsInterceptor(session? : string) {
  @Injectable()
  class BannedWordsInterceptorWithParam implements NestInterceptor {
  
    constructor(
      @Inject(CACHE_MANAGER) public cacheManager: Cache,
      public readonly botWebhookService: SistemInformasiService,
      public readonly prisma: PrismaService
    ) { }
  
    async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
  
      const ctx = context.switchToHttp();
      const req = ctx.getRequest<Request>();
      const res = ctx.getResponse<Response>();
  
      const { payload } = req.body as CreateEventDto;
      const { from, body } = payload || {};
      const phone = from;
      const message = (body || '').toLowerCase();
  
      // console.info("Body Interceptor : ", req.body);
  
      let bannedWords: string[] = [];
  
      try {
        const bannedWordsFromDb = await this.prisma.wordFilters.findMany();
  
        bannedWords = bannedWordsFromDb.length > 0 ? bannedWordsFromDb.map(word => word.word.toLowerCase()) : [
          "anj***", "baj***", "bodo*", "gobl*k", "tai", "bangs*t", "kont*l", "memek", "peler", "tit*t", "jemb*t", "ngent*t",
          "idiot", "tolol", "brengsek", "dungu", "pecundang",
          "cina", "kafir", "bule", "pribumi", "jawa sial*", "hitam jele*", "islam teroris", "yahudi laknat", "nasrani biadab",
          "seks", "porno", "bug*l", "mesum", "bokep", "col*", "masturb*", "ngoc*k", "jilat", "peluk cium", "open bo", "psk",
          "bunuh", "bacok", "siksa", "tusuk", "tembak", "hancurkan", "gantung diri",
          "bangke", "keparat", "celaka", "kampret", "sialan", "laknat", "neraka",
          "fuck", "shit", "asshole", "bitch", "bastard", "slut", "dick", "pussy", "nigger", "faggot", "whore"
        ];
      }
      catch (err) {
        console.error("Error saat mengambil banned words dari database:", err);
        // Jika terjadi error, gunakan daftar kata terlarang default
        bannedWords = [
          "anj***", "baj***", "bodo*", "gobl*k", "tai", "bangs*t", "kont*l", "memek", "peler", "tit*t", "jemb*t", "ngent*t",
          "idiot", "tolol", "brengsek", "dungu", "pecundang",
          "cina", "kafir", "bule", "pribumi", "jawa sial*", "hitam jele*", "islam teroris", "yahudi laknat", "nasrani biadab",
          "seks", "porno", "bug*l", "mesum", "bokep", "col*", "masturb*", "ngoc*k", "jilat", "peluk cium", "open bo", "psk",
          "bunuh", "bacok", "siksa", "tusuk", "tembak", "hancurkan", "gantung diri",
          "bangke", "keparat", "celaka", "kampret", "sialan", "laknat", "neraka",
          "fuck", "shit", "asshole", "bitch", "bastard", "slut", "dick", "pussy", "nigger", "faggot", "whore"
        ];
      }
  
  
      const containsBadWords = bannedWords.some(word => message.includes(word));
  
      if (containsBadWords == true) {
  
        const checkCache: string = await this.cacheManager.get(`bad-words-${phone}`);
  
        if (!checkCache) {

          const variabels = await this.botWebhookService.getVariables();
           const pesanError = variabels.find((item) => item.name == "respon_banned_words").content;
  
          await this.botWebhookService.sendSeen(phone, session);
          await this.botWebhookService.startTyping(phone, session);
          await this.botWebhookService.sendChat(phone, pesanError || "Chat anda tidak dapat diproses dikarenakan mengandung kata-kata yang tidak diperbolehkan.", session);
          await this.botWebhookService.stopTyping(phone, session);
  
          await this.cacheManager.set(`bad-words-${phone}`, "Pelanggaran Bad words");
        }
  
  
        res.status(200).json({ status: "Blocked" });
        return new Observable(); // akhiri pipeline
      }
  
      res.on('finish', async () => {
        if (phone) {
          await this.cacheManager.del(`bad-words-${phone}`);
        }
      });
  
      return next.handle();
    }
  }

  return BannedWordsInterceptorWithParam;
}
