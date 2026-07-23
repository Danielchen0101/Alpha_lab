import { getEmailConfirmationRedirect } from './authRedirect';

describe('getEmailConfirmationRedirect', () => {
  it('keeps email confirmation on the current deployment origin', () => {
    expect(getEmailConfirmationRedirect()).toBe(`${window.location.origin}/auth/confirmed`);
  });
});
