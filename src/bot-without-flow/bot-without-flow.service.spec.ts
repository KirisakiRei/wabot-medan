import { Test, TestingModule } from '@nestjs/testing';
import { BotWithoutFlowService } from './bot-without-flow.service';

describe('BotWithoutFlowService', () => {
  let service: BotWithoutFlowService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [BotWithoutFlowService],
    }).compile();

    service = module.get<BotWithoutFlowService>(BotWithoutFlowService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
