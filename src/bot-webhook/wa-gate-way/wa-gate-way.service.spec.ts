import { Test, TestingModule } from '@nestjs/testing';
import { WaGateWayService } from './wa-gate-way.service';

describe('WaGateWayService', () => {
  let service: WaGateWayService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [WaGateWayService],
    }).compile();

    service = module.get<WaGateWayService>(WaGateWayService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
