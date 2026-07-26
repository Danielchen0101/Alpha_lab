const DEFAULT_CANONICAL_HOST = 'www.alphalabquant.com';
const LEGACY_HOSTS = new Set(['alphalabquant.com']);
const SECURITY_HEADERS = {
  'Content-Security-Policy': "default-src 'self'; base-uri 'self'; object-src 'none'; script-src 'self' https://challenges.cloudflare.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' https://api.alphalabquant.com https://nwpxjqgqegxttucsmvmp.supabase.co wss://nwpxjqgqegxttucsmvmp.supabase.co https://challenges.cloudflare.com; frame-src https://challenges.cloudflare.com; frame-ancestors 'none'; form-action 'self'; manifest-src 'self'; worker-src 'self' blob:;",
  'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
  'Cross-Origin-Resource-Policy': 'same-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
};

const secureResponse = (response, cacheControl) => {
  const secured = new Response(response.body, response);
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    secured.headers.set(name, value);
  }
  if (cacheControl) secured.headers.set('Cache-Control', cacheControl);
  return secured;
};

/**
 * Keep authentication sessions, OAuth callbacks, analytics and canonical URLs
 * on one origin. Static assets are excluded from this Function in
 * public/_routes.json; the first HTML navigation moves legacy-host visitors to
 * the canonical origin while preserving the complete path and query string.
 */
export async function onRequest(context) {
  const requestUrl = new URL(context.request.url);
  const requestHost = requestUrl.hostname.toLowerCase();
  const configuredHost = String(context.env?.CANONICAL_HOST || DEFAULT_CANONICAL_HOST)
    .trim()
    .toLowerCase();

  if (LEGACY_HOSTS.has(requestHost) && configuredHost && requestHost !== configuredHost) {
    requestUrl.protocol = 'https:';
    requestUrl.hostname = configuredHost;
    requestUrl.port = '';
    return secureResponse(new Response(null, {
      status: 308,
      headers: { Location: requestUrl.toString() },
    }), 'private, no-store');
  }

  const response = await context.next();
  return secureResponse(response, 'public, max-age=0, must-revalidate');
}
