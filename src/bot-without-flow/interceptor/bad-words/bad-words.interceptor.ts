import { Cache, CACHE_MANAGER } from '@nestjs/cache-manager';
import { CallHandler, ExecutionContext, Inject, Injectable, NestInterceptor, UnauthorizedException } from '@nestjs/common';
import { Request, Response } from 'express';
import { Observable } from 'rxjs';
import { BotWebhookService } from 'src/bot-webhook/bot-webhook.service';
import { CreateEventDto } from 'src/bot-webhook/message.dto';
import { SistemInformasiService } from 'src/bot-webhook/sistem-informasi/sistem-informasi.service';
import { BotWithoutFlowService } from 'src/bot-without-flow/bot-without-flow.service';
import { ErrorParameter } from 'src/bot-without-flow/types/common.types';
import { PrismaService } from 'src/prisma/prisma.service';

export function BannedWordsInterceptor(session?: string) {
  @Injectable()
  class BannedWordsInterceptorWithParam implements NestInterceptor {

    constructor(
      public readonly wabotService: BotWithoutFlowService,
      public readonly prisma: PrismaService
    ) { }

    async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {

      const ctx = context.switchToHttp();
      const req = ctx.getRequest<Request>();
      const res = ctx.getResponse<Response>();

      const { payload } = req.body as CreateEventDto;
      const { body } = payload || {};

      if (body) {

        let bannedWords: string[] = [];

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

        if (bannedWords.some(word => body.toLowerCase().includes(word))) {
          const variabels = await this.wabotService.getVariables();

          const pesanError = variabels.find((item) => item.name == "respon_banned_words")?.content ?? "Pesan tidak dapat diproses karena mengandung kata-kata yang tidak diperbolehkan.";

          const response: ErrorParameter = {
            message: pesanError,
            returnMessage: pesanError,
            statusCode: 401,
            context: BannedWordsInterceptor.name
          }

          throw new UnauthorizedException(response);
        }
      }

      // res.on('finish', async () => {
      //   if (phone) {
      //     await this.cacheManager.del(`bad-words-${phone}`);
      //   }
      // });

      return next.handle();
    }
  }

  return BannedWordsInterceptorWithParam;
}
