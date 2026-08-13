import { Module } from '@nestjs/common';
import { LoggerService } from 'src/logger/logger.service';
import { QueueModule } from 'src/bot-without-flow/queue/queue.module';
import { TelegramController } from './telegram.controller';
import { TelegramService } from './telegram.service';

@Module({
    imports: [QueueModule],
    controllers: [TelegramController],
    providers: [TelegramService, LoggerService],
    exports: [TelegramService]
})
export class TelegramModule { }
