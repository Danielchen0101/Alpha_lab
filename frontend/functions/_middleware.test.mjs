import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const source = await readFile(new URL('./_middleware.js', import.meta.url), 'utf8');
const sandbox = vm.createContext({
  URL,
  Response,
  Set,
  Object,
  String,
});
const middlewareModule = new vm.SourceTextModule(source, {
  context: sandbox,
  identifier: 'alphalab-pages-middleware',
});
await middlewareModule.link(() => {
  throw new Error('The Pages middleware must not import runtime dependencies.');
});
await middlewareModule.evaluate();

const { onRequest } = middlewareModule.namespace;

test('redirects the apex host to the canonical HTTPS host without losing URL state', async () => {
  let nextCalled = false;
  const response = await onRequest({
    request: new Request('http://alphalabquant.com/auth/confirmed?token_hash=abc&type=signup'),
    env: {},
    next: async () => {
      nextCalled = true;
      return new Response('unexpected');
    },
  });

  assert.equal(nextCalled, false);
  assert.equal(response.status, 308);
  assert.equal(
    response.headers.get('location'),
    'https://www.alphalabquant.com/auth/confirmed?token_hash=abc&type=signup',
  );
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  assert.equal(response.headers.get('x-frame-options'), 'DENY');
  assert.match(response.headers.get('content-security-policy') || '', /frame-ancestors 'none'/);
});

test('passes canonical-host requests to Pages assets and attaches security headers', async () => {
  let nextCalls = 0;
  const response = await onRequest({
    request: new Request('https://www.alphalabquant.com/signup'),
    env: { CANONICAL_HOST: 'www.alphalabquant.com' },
    next: async () => {
      nextCalls += 1;
      return new Response('<html>signup</html>', {
        status: 200,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    },
  });

  assert.equal(nextCalls, 1);
  assert.equal(response.status, 200);
  assert.equal(await response.text(), '<html>signup</html>');
  assert.equal(response.headers.get('cache-control'), 'public, max-age=0, must-revalidate');
  assert.equal(response.headers.get('strict-transport-security'), 'max-age=31536000; includeSubDomains; preload');
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
});

test('does not redirect Pages preview hostnames', async () => {
  const response = await onRequest({
    request: new Request('https://preview.quant-platform.pages.dev/research'),
    env: { CANONICAL_HOST: 'www.alphalabquant.com' },
    next: async () => new Response('preview', { status: 200 }),
  });

  assert.equal(response.status, 200);
  assert.equal(await response.text(), 'preview');
});
