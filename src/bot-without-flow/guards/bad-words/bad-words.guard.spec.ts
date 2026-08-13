import { BadWordsGuard } from './bad-words.guard';

describe('BadWordsGuard', () => {
  it('should be defined', () => {
    expect(new BadWordsGuard()).toBeDefined();
  });
});
