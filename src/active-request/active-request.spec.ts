import { Test, TestingModule } from '@nestjs/testing';
import { ActiveRequest } from './active-request';

describe('ActiveRequest', () => {
  let provider: ActiveRequest;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ActiveRequest],
    }).compile();

    provider = module.get<ActiveRequest>(ActiveRequest);
  });

  it('should be defined', () => {
    expect(provider).toBeDefined();
  });
});
