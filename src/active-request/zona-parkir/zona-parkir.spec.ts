import { Test, TestingModule } from '@nestjs/testing';
import { ZonaParkir } from './zona-parkir';

describe('ZonaParkir', () => {
  let provider: ZonaParkir;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ZonaParkir],
    }).compile();

    provider = module.get<ZonaParkir>(ZonaParkir);
  });

  it('should be defined', () => {
    expect(provider).toBeDefined();
  });
});
