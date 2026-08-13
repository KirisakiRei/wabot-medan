import { Test, TestingModule } from '@nestjs/testing';
import { PengaduanActionService } from './pengaduan-action.service';

describe('PengaduanActionService', () => {
  let service: PengaduanActionService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PengaduanActionService],
    }).compile();

    service = module.get<PengaduanActionService>(PengaduanActionService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
