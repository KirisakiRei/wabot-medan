import { Test, TestingModule } from '@nestjs/testing';
import { ZonaParkirPrismaService } from './zona-parkir-prisma.service';

describe('ZonaParkirPrismaService', () => {
  let service: ZonaParkirPrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ZonaParkirPrismaService],
    }).compile();

    service = module.get<ZonaParkirPrismaService>(ZonaParkirPrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
