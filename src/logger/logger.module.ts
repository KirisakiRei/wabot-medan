import { Global, Module } from '@nestjs/common';
import { WinstonModule } from 'nest-winston';
import * as winston from 'winston';
import { createDailyFolderTransport } from './daily-folder-transport';
import { LoggerService } from './logger.service';

@Global()
@Module({
  imports: [
    WinstonModule.forRoot({
      transports: [
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.colorize(),
            winston.format.printf(
              ({ level, message, timestamp, context }) =>
                `[${timestamp}] [${level}]${context ? ' [' + context + ']' : ''}: ${message}`,
            ),
          ),
        }),

        createDailyFolderTransport({
          level: 'error',
          filename: 'error.log',
        }),

        createDailyFolderTransport({
          level: 'warn',
          filename: 'warn.log',
        }),

        createDailyFolderTransport({
          level: 'debug',
          filename: 'debug.log',
        }),

        createDailyFolderTransport({
          filename: 'combined.log',
        }),
      ],
    }),
  ],
  providers : [LoggerService],
  exports: [WinstonModule, LoggerService],
})
export class LoggerModule {}
