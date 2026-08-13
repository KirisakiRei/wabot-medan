import { Test, TestingModule } from '@nestjs/testing';
import { ResponseGeneratorService } from './response-generator.service';

describe('ResponseGeneratorService', () => {
  let service: ResponseGeneratorService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ResponseGeneratorService],
    }).compile();

    service = module.get<ResponseGeneratorService>(ResponseGeneratorService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
