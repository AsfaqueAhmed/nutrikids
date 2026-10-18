import { loadEnv } from './env';

describe('loadEnv', () => {
  const base = {
    DATABASE_URL: 'postgresql://u:p@localhost:5433/db',
    JWT_ACCESS_SECRET: 'x'.repeat(32),
  };

  it('applies defaults', () => {
    const env = loadEnv(base);
    expect(env.PORT).toBe(3000);
    expect(env.JWT_ACCESS_TTL_SECONDS).toBe(900);
    expect(env.REFRESH_TTL_DAYS).toBe(30);
  });

  it('rejects a short JWT secret', () => {
    expect(() => loadEnv({ ...base, JWT_ACCESS_SECRET: 'short' })).toThrow();
  });

  it('rejects a missing DATABASE_URL', () => {
    expect(() =>
      loadEnv({ JWT_ACCESS_SECRET: base.JWT_ACCESS_SECRET }),
    ).toThrow();
  });
});
