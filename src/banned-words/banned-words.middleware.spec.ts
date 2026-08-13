import { BannedWordsMiddleware } from './banned-words.middleware';

describe('BannedWordsMiddleware', () => {
  it('should be defined', () => {
    expect(new BannedWordsMiddleware()).toBeDefined();
  });
});
