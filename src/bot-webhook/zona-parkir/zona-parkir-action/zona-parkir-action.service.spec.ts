import { Test, TestingModule } from '@nestjs/testing';
import { ZonaParkirActionService } from './zona-parkir-action.service';

describe('ZonaParkirActionService', () => {
  let service: ZonaParkirActionService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ZonaParkirActionService],
    }).compile();

    service = module.get<ZonaParkirActionService>(ZonaParkirActionService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
