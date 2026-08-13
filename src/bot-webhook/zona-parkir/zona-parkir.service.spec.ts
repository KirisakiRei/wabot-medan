import { Test, TestingModule } from '@nestjs/testing';
import { ZonaParkirService } from './zona-parkir.service';

describe('ZonaParkirService', () => {
  let service: ZonaParkirService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ZonaParkirService],
    }).compile();

    service = module.get<ZonaParkirService>(ZonaParkirService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
