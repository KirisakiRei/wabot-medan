import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from './validation/validation.pipe';
import * as session from 'express-session';
import { BadRequestFilter } from './filters/bad-request/bad-request.filter';
import { InternalErrorFilter } from './filters/internal-error/internal-error.filter';
import { LoggerService } from './logger/logger.service';

async function bootstrap() {

  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(new ValidationPipe());
  app.useGlobalFilters(new BadRequestFilter(), new InternalErrorFilter(app.get(LoggerService)));
  app.use(
    session({
      secret : process.env.SESSION_SECRET ?? "wa-bot-secret-key",
      resave : false,
      saveUninitialized : false,
      cookie : {
        maxAge : 60000
      }
    })
  );
  app.enableCors({
    // origin: ['http://172.22.0.34:3000', 'http://192.168.114.20:3000', 'http://103.116.168.167:3000'],
    origin: ['http://172.22.0.34:3000'],
    // origin : "*",
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    allowedHeaders: 'Content-Type, Authorization',
    credentials: true, // Jika butuh cookie atau sesi
  });

  await app.listen(process.env.PORT ?? 8001, '0.0.0.0');
}
bootstrap();
