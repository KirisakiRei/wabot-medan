import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import { Observable } from 'rxjs';
import { CreateEventDto } from 'src/bot-webhook/message.dto';
import { BotWithoutFlowService } from 'src/bot-without-flow/bot-without-flow.service';
import { ErrorParameter } from 'src/bot-without-flow/types/common.types';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class BadWordsGuard implements CanActivate {

  constructor(
    private readonly prismaService: PrismaService,
    private readonly wabotService: BotWithoutFlowService,
  ) { }

  async canActivate(
    context: ExecutionContext,
  ): Promise<boolean> {

    const request = context.switchToHttp().getRequest<Request>();

    const { payload } = request.body as CreateEventDto;
    const { body } = payload;

    if (body) {
      let bannedWords: string[] = [];

      const bannedWordsFromDb = await this.prismaService.wordFilters.findMany();

      bannedWordsFromDb.map((item) => {
        bannedWords.push(item.word.toLowerCase());
      })

      if (bannedWords.some(word => body.toLowerCase().includes(word))) {
        const variabels = await this.wabotService.getVariables();

        const pesanError = variabels.find((item) => item.name == "respon_banned_words").content;

        const response: ErrorParameter = {
          message: pesanError,
          returnMessage: pesanError,
          statusCode: 401,
          context: BadWordsGuard.name
        }

        throw new UnauthorizedException(response);
      }
    }

    return true;
  }
}
