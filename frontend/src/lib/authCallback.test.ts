import {
  classifyAuthCallbackError,
  parseAuthCallback,
  scheduleAuthCallbackRedemption,
  shouldAutoDetectAuthSession,
} from './authCallback';

describe('parseAuthCallback', () => {
  it('prioritizes provider errors over tokens', () => {
    expect(parseAuthCallback(
      '?error=access_denied&error_description=Link+expired&code=ignored',
      '',
    )).toEqual({
      kind: 'provider_error',
      code: 'access_denied',
      description: 'Link expired',
    });
  });

  it('parses a custom token-hash confirmation template', () => {
    expect(parseAuthCallback('?token_hash=abc123&type=signup', '')).toEqual({
      kind: 'token_hash',
      tokenHash: 'abc123',
      otpType: 'signup',
    });
  });

  it('parses a PKCE authorization code', () => {
    expect(parseAuthCallback('?code=pkce-code', '')).toEqual({
      kind: 'code',
      code: 'pkce-code',
    });
  });

  it('parses implicit-flow tokens from the URL fragment', () => {
    expect(parseAuthCallback('', '#access_token=access&refresh_token=refresh&type=signup')).toEqual({
      kind: 'implicit',
      accessToken: 'access',
      refreshToken: 'refresh',
      flowType: 'signup',
    });
  });

  it('keeps an implicit flow type coupled to its fragment when the query disagrees', () => {
    expect(parseAuthCallback(
      '?type=recovery',
      '#access_token=access&refresh_token=refresh&type=signup',
    )).toEqual({
      kind: 'implicit',
      accessToken: 'access',
      refreshToken: 'refresh',
      flowType: 'signup',
    });
  });

  it('does not combine a token hash and flow type from different URL components', () => {
    expect(parseAuthCallback(
      '?token_hash=confirmation-token',
      '#type=recovery',
    )).toEqual({ kind: 'none' });
  });

  it('does not accept an incomplete implicit session', () => {
    expect(parseAuthCallback('', '#access_token=access')).toEqual({ kind: 'none' });
  });
});

describe('scheduleAuthCallbackRedemption', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('redeems once when React StrictMode cleans up the throwaway effect', () => {
    jest.useFakeTimers();
    const redeem = jest.fn();

    const cleanupThrowawayEffect = scheduleAuthCallbackRedemption(redeem);
    cleanupThrowawayEffect();
    const cleanupCommittedEffect = scheduleAuthCallbackRedemption(redeem);

    jest.runOnlyPendingTimers();

    expect(redeem).toHaveBeenCalledTimes(1);
    cleanupCommittedEffect();
  });

  it('reports a slow redemption without cancelling or marking it failed', () => {
    jest.useFakeTimers();
    const redeem = jest.fn();
    const onSlow = jest.fn();
    const cleanup = scheduleAuthCallbackRedemption(redeem, {
      onSlow,
      slowAfterMs: 15000,
    });

    jest.advanceTimersByTime(0);
    expect(redeem).toHaveBeenCalledTimes(1);
    expect(onSlow).not.toHaveBeenCalled();

    jest.advanceTimersByTime(15000);
    expect(onSlow).toHaveBeenCalledTimes(1);
    expect(redeem).toHaveBeenCalledTimes(1);
    cleanup();
  });

  it('cancels both redemption and the slow-state notification on cleanup', () => {
    jest.useFakeTimers();
    const redeem = jest.fn();
    const onSlow = jest.fn();
    const cleanup = scheduleAuthCallbackRedemption(redeem, {
      onSlow,
      slowAfterMs: 15000,
    });

    cleanup();
    jest.runOnlyPendingTimers();

    expect(redeem).not.toHaveBeenCalled();
    expect(onSlow).not.toHaveBeenCalled();
  });
});

describe('classifyAuthCallbackError', () => {
  it.each([
    ['otp_expired', 'expired'],
    ['Token has expired or is invalid', 'expired'],
    ['Failed to fetch', 'network'],
    ['invalid token', 'invalid'],
  ] as const)('classifies %s as %s', (message, expected) => {
    expect(classifyAuthCallbackError(message)).toBe(expected);
  });
});

describe('shouldAutoDetectAuthSession', () => {
  it.each(['/auth/confirmed', '/auth/confirmed/', '/reset-password'])(
    'leaves dedicated callback route %s for the page to verify even with callback tokens',
    (path) => {
      expect(shouldAutoDetectAuthSession(
        new URL(`https://alphalabquant.com${path}`),
        { access_token: 'manual-token' },
      )).toBe(false);
    },
  );

  it.each(['/signin', '/dashboard', '/'])(
    'does not classify an ordinary page load on %s as an auth callback',
    (path) => {
      expect(shouldAutoDetectAuthSession(new URL(`https://alphalabquant.com${path}`))).toBe(false);
    },
  );

  it.each(['access_token', 'error', 'error_description', 'error_code'])(
    'matches Supabase implicit callback detection for %s',
    (parameter) => {
      expect(shouldAutoDetectAuthSession(
        new URL('https://alphalabquant.com/signin'),
        { [parameter]: 'present' },
      )).toBe(true);
    },
  );

  it('does not treat an unrelated fragment value as an implicit callback', () => {
    expect(shouldAutoDetectAuthSession(
      new URL('https://alphalabquant.com/dashboard'),
      { refresh_token: 'incomplete' },
    )).toBe(false);
  });
});
