import { BannedWordsInterceptor } from './banned-words.interceptor';

describe('BannedWordsInterceptor', () => {
  it('should be defined', () => {
    expect(new BannedWordsInterceptor()).toBeDefined();
  });
});
