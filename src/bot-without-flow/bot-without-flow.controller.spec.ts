import { Test, TestingModule } from '@nestjs/testing';
import { BotWithoutFlowController } from './bot-without-flow.controller';

describe('BotWithoutFlowController', () => {
  let controller: BotWithoutFlowController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BotWithoutFlowController],
    }).compile();

    controller = module.get<BotWithoutFlowController>(BotWithoutFlowController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
