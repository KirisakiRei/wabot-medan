import { ArgumentsHost, Catch, ExceptionFilter, InternalServerErrorException } from '@nestjs/common';
import { Request, Response } from 'express';
import { LoggerService } from 'src/logger/logger.service';

@Catch(InternalServerErrorException)
export class InternalErrorFilter<T> implements ExceptionFilter {
  constructor(
    private readonly logger: LoggerService
  ){}
  catch(exception: InternalServerErrorException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let error = exception.getResponse() as
      | { message: string | any; error?: string; statusCode?: number }
      | string;

    this.logger.error(`Internal Server Error: ${exception.message}`, JSON.stringify({
      method: request.method,
      url: request.url,
      stack: exception.stack,
      error: typeof error === 'object' ? error : { message: error },
    }), request.url);

    return response.status(500).json({
      status: 500,
      message: 'An unexpected error occurred. Please try again later.',
      error: typeof error === 'object' ? error : { message: error },
    });
  }
}
