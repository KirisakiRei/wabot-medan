import { Test, TestingModule } from '@nestjs/testing';
import { LayananPublikActionService } from './layanan-publik-action.service';

describe('LayananPublikActionService', () => {
  let service: LayananPublikActionService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [LayananPublikActionService],
    }).compile();

    service = module.get<LayananPublikActionService>(LayananPublikActionService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
