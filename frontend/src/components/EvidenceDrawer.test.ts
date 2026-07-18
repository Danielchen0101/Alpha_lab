import { sanitizeEvidence } from './EvidenceDrawer';

describe('sanitizeEvidence', () => {
  it('redacts secret keys at every supported nesting level', () => {
    expect(sanitizeEvidence({
      token: 'top-secret',
      nested: { apiKey: 'abc123', password: 'hunter2' },
      rows: [{ session_cookie: 'cookie-value' }],
      visible: 'kept',
    })).toEqual({
      token: '[redacted]',
      nested: { apiKey: '[redacted]', password: '[redacted]' },
      rows: [{ session_cookie: '[redacted]' }],
      visible: 'kept',
    });
  });

  it('redacts credentials embedded in values and URLs', () => {
    // Assemble credential-shaped fixtures at runtime so repository secret
    // scanners do not mistake the deliberately fake test data for a leak.
    const fakeJwt = ['eyJhbGciOiJIUzI1NiJ9', 'eyJzdWIiOiIxMjMifQ', 'signaturevalue'].join('.');
    const fakeWebhook = ['https://discord.com/api/webhooks', '123456789', 'very-secret-webhook-token'].join('/');
    const credentialUrl = ['https://user', 'password@example.com/report?symbol=AAPL&access_token=secret#code=oauth-code'].join(':');
    const result = sanitizeEvidence({
      source: credentialUrl,
      note: `Authorization: Bearer ${fakeJwt}`,
      webhook: fakeWebhook,
    }) as Record<string, string>;

    expect(result.source).toContain('symbol=AAPL');
    expect(result.source).not.toContain('password');
    expect(result.source).not.toContain('secret');
    expect(result.source).not.toContain('oauth-code');
    expect(result.note).not.toContain('eyJhbGci');
    expect(result.webhook).toBe('[redacted]');
  });

  it('limits oversized evidence arrays and deeply nested structures', () => {
    let nested: any = { leaf: 'hidden' };
    for (let index = 0; index < 10; index += 1) nested = { nested };
    const result = sanitizeEvidence({
      rows: Array.from({ length: 120 }, (_, index) => index),
      nested,
    }) as any;

    expect(result.rows).toHaveLength(100);
    expect(JSON.stringify(result)).toContain('[nested data omitted]');
  });
});
