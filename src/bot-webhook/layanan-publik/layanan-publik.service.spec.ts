import { Test, TestingModule } from '@nestjs/testing';
import { LayananPublikService } from './layanan-publik.service';

describe('LayananPublikService', () => {
  let service: LayananPublikService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [LayananPublikService],
    }).compile();

    service = module.get<LayananPublikService>(LayananPublikService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
