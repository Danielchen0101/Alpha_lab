import {
  AUTH_AWAY_TIMEOUT_MS,
  AuthOperationTimeoutError,
  clearSessionAway,
  getAwayTimeRemaining,
  hasSessionAwayExpired,
  markSessionAway,
  readAwaySince,
  withAuthTimeout,
} from './authSession';

describe('auth away-session policy', () => {
  beforeEach(() => clearSessionAway());

  it('keeps a returning user signed in before ten minutes', () => {
    const awaySince = markSessionAway(1_000);
    expect(readAwaySince()).toBe(1_000);
    expect(hasSessionAwayExpired(awaySince, 1_000 + AUTH_AWAY_TIMEOUT_MS - 1)).toBe(false);
    expect(getAwayTimeRemaining(awaySince, 1_000 + AUTH_AWAY_TIMEOUT_MS - 1)).toBe(1);
  });

  it('expires the session at ten minutes and preserves the first away time', () => {
    expect(markSessionAway(2_000)).toBe(2_000);
    expect(markSessionAway(8_000)).toBe(2_000);
    expect(hasSessionAwayExpired(2_000, 2_000 + AUTH_AWAY_TIMEOUT_MS)).toBe(true);
  });

  it('clears the persisted away marker after the user returns', () => {
    markSessionAway(3_000);
    clearSessionAway();
    expect(readAwaySince()).toBeNull();
  });
});

describe('bounded auth operations', () => {
  afterEach(() => jest.useRealTimers());

  it('stops waiting when Supabase Auth does not answer', async () => {
    jest.useFakeTimers();
    const bounded = withAuthTimeout(new Promise<void>(() => {}), 250, 'Auth test');
    jest.advanceTimersByTime(250);
    await expect(bounded).rejects.toBeInstanceOf(AuthOperationTimeoutError);
  });
});
