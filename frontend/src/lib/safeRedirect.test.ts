import { getSafeInternalRedirect } from './safeRedirect';

describe('getSafeInternalRedirect', () => {
  it.each([
    ['/dashboard', '/dashboard'],
    ['/research?mode=crypto#signals', '/research?mode=crypto#signals'],
    ['/path with spaces', '/path%20with%20spaces'],
  ])('accepts and normalizes internal path %s', (candidate, expected) => {
    expect(getSafeInternalRedirect(candidate)).toBe(expected);
  });

  it.each([
    null,
    '',
    'dashboard',
    '//evil.example/path',
    '/\\\\evil.example/path',
    '/%5C%5Cevil.example/path',
    '/safe\n//evil.example',
    'https://evil.example/path',
  ])('rejects unsafe redirect target %s', (candidate) => {
    expect(getSafeInternalRedirect(candidate)).toBeNull();
  });
});
