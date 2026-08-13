import { Inject, Injectable } from '@nestjs/common';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';

@Injectable()
export class LoggerService {

    private time;

    constructor(
        @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger
    ) {
        this.time = new Date().toLocaleTimeString().replaceAll(".",":");
     }

    log(message: string, context?: string) {
        this.logger.info(message, { context, time : this.time });
    }

    error(message: string, trace?: string, context?: string) {
        this.logger.error(message, { trace, context, time : this.time });
    }

    warn(message: string, context?: string) {
        this.logger.warn(message, { context, time : this.time });
    }

    debug(message: string, context?: string) {
        this.logger.debug(message, { context, time : this.time });
    }

    verbose(message: string, context?: string) {
        this.logger.verbose(message, { context, time : this.time });
    }
}
