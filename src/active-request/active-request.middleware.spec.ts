import { ActiveRequestMiddleware } from './active-request.middleware';

describe('ActiveRequestMiddleware', () => {
  it('should be defined', () => {
    expect(new ActiveRequestMiddleware()).toBeDefined();
  });
});
