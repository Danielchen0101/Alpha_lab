import { validateSupabaseBrowserConfig } from './supabaseClient';

describe('validateSupabaseBrowserConfig', () => {
  it('requires both browser auth variables in production', () => {
    expect(validateSupabaseBrowserConfig(undefined, 'anon-key', 'production'))
      .toContain('is missing');
    expect(validateSupabaseBrowserConfig('https://project.supabase.co', '', 'production'))
      .toContain('is missing');
  });

  it('accepts an HTTPS Supabase endpoint in production', () => {
    expect(validateSupabaseBrowserConfig(
      'https://project.supabase.co',
      'anon-key',
      'production',
    )).toBe('');
  });

  it('rejects all HTTP endpoints in production, including localhost', () => {
    expect(validateSupabaseBrowserConfig(
      'http://127.0.0.1:54321',
      'anon-key',
      'production',
    )).toContain('must use HTTPS');
  });

  it('allows HTTP only for a local development endpoint', () => {
    expect(validateSupabaseBrowserConfig(
      'http://localhost:54321',
      'anon-key',
      'development',
    )).toBe('');
    expect(validateSupabaseBrowserConfig(
      'http://supabase.internal:54321',
      'anon-key',
      'development',
    )).toContain('except for local development');
  });

  it.each([
    'not a URL',
    'https://user:password@project.supabase.co',
  ])('rejects malformed or credential-bearing endpoint %s', (url) => {
    expect(validateSupabaseBrowserConfig(url, 'anon-key', 'production'))
      .toContain('Supabase auth unavailable');
  });
});
