import { Test, TestingModule } from '@nestjs/testing';
import { UsulanService } from './usulan.service';

describe('UsulanService', () => {
  let service: UsulanService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [UsulanService],
    }).compile();

    service = module.get<UsulanService>(UsulanService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
