import { Test, TestingModule } from '@nestjs/testing';
import { SistemInformasiService } from './sistem-informasi.service';

describe('SistemInformasiService', () => {
  let service: SistemInformasiService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SistemInformasiService],
    }).compile();

    service = module.get<SistemInformasiService>(SistemInformasiService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
