import { ArgumentsHost, Catch, ExceptionFilter, UnauthorizedException } from '@nestjs/common';
import { Response, Request } from 'express';
import { CreateEventDto } from 'src/bot-webhook/message.dto';
import { ErrorParameter, ResponseDTO } from 'src/bot-without-flow/types/common.types';
import { LoggerService } from 'src/logger/logger.service';
import { ChannelService } from 'src/channel/channel.service';

@Catch(UnauthorizedException)
export class UnauthorizedFilter<T> implements ExceptionFilter<UnauthorizedException> {

  constructor(
    private readonly logger: LoggerService,
    private readonly channelService: ChannelService
  ) { }

  async catch(exception: UnauthorizedException, host: ArgumentsHost) {
    const http = host.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();

    const exceptionResponse = exception.getResponse() as | ErrorParameter | string;

    let errors: any = {};

    if (typeof exceptionResponse === 'object' && Array.isArray(exceptionResponse['message'])) {
      // kalau ValidationPipe kirim array message
      errors = exceptionResponse['message'];
    } else if (typeof exceptionResponse === 'object') {
      // fallback kalau ada error lain
      errors = exceptionResponse['message'] ?? exceptionResponse;
    } else {
      // kalau benar-benar string
      errors = [exceptionResponse];
    }

    if (request.body) {
      const { payload } = request.body as CreateEventDto;
      if (payload) {
        const { from } = payload;
        await this.channelService.sendSeen(from, process.env.GATEWAY_SESSION || "development");
        await this.channelService.startTyping(from, process.env.GATEWAY_SESSION || "development");
        await this.channelService.sendText(from, exceptionResponse["returnMessage"] || "Mohon Maaf Pesan anda tidak diizinkan oleh sistem karena mengandung kata-kata yang kurang sopan atau berbahaya.", process.env.GATEWAY_SESSION || "development");
        await this.channelService.stopTyping(from, process.env.GATEWAY_SESSION || "development");
      }
    }

    this.logger.warn(JSON.stringify(errors), exceptionResponse["context"] || UnauthorizedFilter.name);

    const sendResponse: ResponseDTO = {
      status: "error",
      code: exceptionResponse["statusCode"] || 401,
      message: exceptionResponse["returnMessage"] || "Unauthorized",
      errors: errors
    };

    return response.status(200).send(sendResponse);
  }
}
