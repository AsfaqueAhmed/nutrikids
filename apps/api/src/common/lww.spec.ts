import { resolveLww } from './lww';

describe('resolveLww', () => {
  const t1 = new Date('2026-01-01T10:00:00Z');
  const t2 = new Date('2026-01-01T11:00:00Z');
  it('applies when nothing exists', () => {
    expect(resolveLww(null, t1)).toEqual({ apply: true, superseded: false });
  });
  it('applies a newer write', () => {
    expect(resolveLww({ clientUpdatedAt: t1 }, t2)).toEqual({
      apply: true,
      superseded: false,
    });
  });
  it('applies an equal timestamp (idempotent replay)', () => {
    expect(resolveLww({ clientUpdatedAt: t1 }, t1)).toEqual({
      apply: true,
      superseded: false,
    });
  });
  it('rejects an older write and flags it superseded', () => {
    expect(resolveLww({ clientUpdatedAt: t2 }, t1)).toEqual({
      apply: false,
      superseded: true,
    });
  });
});
