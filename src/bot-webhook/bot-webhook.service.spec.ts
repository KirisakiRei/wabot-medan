import { Test, TestingModule } from '@nestjs/testing';
import { BotWebhookService } from './bot-webhook.service';

describe('BotWebhookService', () => {
  let service: BotWebhookService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [BotWebhookService],
    }).compile();

    service = module.get<BotWebhookService>(BotWebhookService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
