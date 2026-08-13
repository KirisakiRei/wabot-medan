import { ArgumentsHost, BadRequestException, Catch, ExceptionFilter } from '@nestjs/common';
import { Response, Request } from 'express';
import { LoggerService } from 'src/logger/logger.service';
import { CreateEventDto } from 'src/bot-webhook/message.dto';
import { ErrorParameter, ResponseDTO } from 'src/bot-without-flow/types/common.types';
import { ChannelService } from 'src/channel/channel.service';

@Catch(BadRequestException)
export class BadRequestFilter<T> implements ExceptionFilter<BadRequestException> {

  constructor(
    private readonly logger: LoggerService,
    private readonly channelService: ChannelService
  ) { }

  async catch(exception: BadRequestException, host: ArgumentsHost) {

    const http = host.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();

    this.logger.warn(`BadRequestFilter triggered for path: ${request.url}`, 'BadRequestFilter');

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
        await this.channelService.sendText(from, exceptionResponse["returnMessage"] || "Mohon maaf, sistem kami sedang mengalami gangguan saat ini. Silahkan Mencoba beberapa saat lagi", process.env.GATEWAY_SESSION || "development");
        await this.channelService.stopTyping(from, process.env.GATEWAY_SESSION || "development");
      }
    }

    this.logger.error("Bad Request Error", JSON.stringify(errors), exceptionResponse["context"] || BadRequestFilter.name);

    const sendResponse: ResponseDTO = {
      status: "error",
      code: exceptionResponse["statusCode"] || 400,
      message: exceptionResponse["returnMessage"] || "Bad Request",
      errors: errors
    };

    return response.status(sendResponse.code).send(sendResponse);

  }
}
