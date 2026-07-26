import assert from 'node:assert/strict';
import test from 'node:test';
import {
  PRODUCTION_API_BASE_URL,
  PRODUCTION_SITE_URL,
  PRODUCTION_SUPABASE_URL,
  validateProductionBuildEnv,
} from './validate-build-env.mjs';

const completeConfig = {
  REACT_APP_SITE_URL: PRODUCTION_SITE_URL,
  REACT_APP_API_BASE_URL: PRODUCTION_API_BASE_URL,
  REACT_APP_SUPABASE_URL: PRODUCTION_SUPABASE_URL,
  REACT_APP_SUPABASE_ANON_KEY: 'public-anon-key',
  REACT_APP_TURNSTILE_SITE_KEY: 'public-turnstile-site-key',
};

test('skips strict public-auth validation outside an explicit production build', () => {
  assert.deepEqual(validateProductionBuildEnv({
    REACT_APP_ENV: 'test',
  }), []);
});

test('requires every public frontend value for an explicit production build', () => {
  assert.deepEqual(validateProductionBuildEnv({
    REACT_APP_ENV: 'production',
  }), [
    'REACT_APP_SITE_URL is required',
    'REACT_APP_API_BASE_URL is required',
    'REACT_APP_SUPABASE_URL is required',
    'REACT_APP_SUPABASE_ANON_KEY is required',
    'REACT_APP_TURNSTILE_SITE_KEY is required',
  ]);
});

test('Cloudflare Pages fails closed even when REACT_APP_ENV is omitted', () => {
  assert.deepEqual(validateProductionBuildEnv({
    CF_PAGES: '1',
  }), [
    'REACT_APP_SITE_URL is required',
    'REACT_APP_API_BASE_URL is required',
    'REACT_APP_SUPABASE_URL is required',
    'REACT_APP_SUPABASE_ANON_KEY is required',
    'REACT_APP_TURNSTILE_SITE_KEY is required',
  ]);
});

test('rejects non-HTTPS production endpoints', () => {
  assert.deepEqual(validateProductionBuildEnv({
    REACT_APP_ENV: 'production',
    REACT_APP_SITE_URL: 'http://www.alphalabquant.com',
    REACT_APP_API_BASE_URL: 'http://api.alphalabquant.com/api',
    REACT_APP_SUPABASE_URL: 'http://127.0.0.1:54321',
    REACT_APP_SUPABASE_ANON_KEY: 'public-anon-key',
    REACT_APP_TURNSTILE_SITE_KEY: 'public-turnstile-site-key',
  }), [
    'REACT_APP_SITE_URL must use HTTPS',
    'REACT_APP_API_BASE_URL must use HTTPS',
    'REACT_APP_SUPABASE_URL must use HTTPS',
  ]);
});

test('requires Cloudflare Pages hosts to match the deployed CSP', () => {
  assert.deepEqual(validateProductionBuildEnv({
    CF_PAGES: '1',
    REACT_APP_SITE_URL: 'https://preview.example.com',
    REACT_APP_API_BASE_URL: '/api',
    REACT_APP_SUPABASE_URL: 'https://another-project.supabase.co',
    REACT_APP_SUPABASE_ANON_KEY: 'public-anon-key',
    REACT_APP_TURNSTILE_SITE_KEY: 'public-turnstile-site-key',
  }), [
    `REACT_APP_SITE_URL must equal ${PRODUCTION_SITE_URL}`,
    `REACT_APP_API_BASE_URL must equal ${PRODUCTION_API_BASE_URL}`,
    `REACT_APP_SUPABASE_URL must equal ${PRODUCTION_SUPABASE_URL}`,
  ]);
});

test('rejects whitespace that would change runtime authentication values', () => {
  assert.deepEqual(validateProductionBuildEnv({
    REACT_APP_ENV: 'production',
    ...completeConfig,
    REACT_APP_SITE_URL: ` ${PRODUCTION_SITE_URL}`,
    REACT_APP_SUPABASE_ANON_KEY: ' public-anon-key',
  }), [
    'REACT_APP_SITE_URL must not contain leading or trailing whitespace',
    'REACT_APP_SUPABASE_ANON_KEY must not contain leading or trailing whitespace',
  ]);
});

test('accepts the canonical Cloudflare Pages configuration without REACT_APP_ENV', () => {
  assert.deepEqual(validateProductionBuildEnv({
    CF_PAGES: '1',
    ...completeConfig,
  }), []);
});

test('accepts the same-origin API for an explicit production Docker build', () => {
  assert.deepEqual(validateProductionBuildEnv({
    REACT_APP_ENV: 'production',
    ...completeConfig,
    REACT_APP_API_BASE_URL: '/api',
  }), []);
});
