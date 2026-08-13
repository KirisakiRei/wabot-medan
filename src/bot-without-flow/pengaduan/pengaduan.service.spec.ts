import { Test, TestingModule } from '@nestjs/testing';
import { PengaduanService } from './pengaduan.service';

describe('PengaduanService', () => {
  let service: PengaduanService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PengaduanService],
    }).compile();

    service = module.get<PengaduanService>(PengaduanService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
