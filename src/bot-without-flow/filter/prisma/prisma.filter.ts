import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import { Response } from 'express';
import { PrismaClientInitializationError, PrismaClientKnownRequestError, PrismaClientUnknownRequestError, PrismaClientValidationError } from 'generated/prisma/runtime/library';
import { LoggerService } from 'src/logger/logger.service';

@Catch(
  PrismaClientKnownRequestError,
  PrismaClientValidationError,
  PrismaClientInitializationError,
  PrismaClientUnknownRequestError
)
export class PrismaFilter<T> implements ExceptionFilter<PrismaClientKnownRequestError | PrismaClientValidationError | PrismaClientInitializationError | PrismaClientUnknownRequestError> {

  constructor(
    private readonly logger : LoggerService
  ){}

  catch(exception: PrismaClientKnownRequestError | PrismaClientValidationError | PrismaClientInitializationError | PrismaClientUnknownRequestError, host: ArgumentsHost) {
    const http = host.switchToHttp();
    const response = http.getResponse<Response>();

    this.logger.error(exception.message, exception.stack, PrismaFilter.name);

    response.status(500).json({
      status: "error",
      code : 500,
      message: `Internal Server Error`,
      error: `Mohon Maaf.Terjadi Kesalahan Sistem pada Database Kami.`
    });
  }
}
