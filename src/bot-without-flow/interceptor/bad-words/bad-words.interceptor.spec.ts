import { BadWordsInterceptor } from './bad-words.interceptor';

describe('BadWordsInterceptor', () => {
  it('should be defined', () => {
    expect(new BadWordsInterceptor()).toBeDefined();
  });
});
