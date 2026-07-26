import { satisfiesResetPasswordPolicy } from './ResetPassword';
import { satisfiesSignUpPasswordPolicy } from './SignUp';

const policyChecks = [
  satisfiesSignUpPasswordPolicy,
  satisfiesResetPasswordPolicy,
];

describe.each([
  ['account creation', satisfiesSignUpPasswordPolicy],
  ['password reset', satisfiesResetPasswordPolicy],
])('%s password policy', (_flow, satisfiesPolicy) => {
  test.each([
    'AlphaLab1',
    'A1bcdefg',
    'Longer-password-9Z',
  ])('accepts a compliant password: %s', (password) => {
    expect(satisfiesPolicy(password)).toBe(true);
  });

  test.each([
    ['fewer than 8 characters', 'Aa1bcde'],
    ['no lowercase letter', 'ALPHALAB1'],
    ['no uppercase letter', 'alphalab1'],
    ['no number', 'AlphaLabs'],
  ])('rejects %s', (_case, password) => {
    expect(satisfiesPolicy(password)).toBe(false);
  });
});

test.each([
  'AlphaLab1',
  'Aa1bcdef',
  'Aa1bcde',
  'ALPHALAB1',
  'alphalab1',
  'AlphaLabs',
])('account creation and reset enforce the same result for %s', (password) => {
  const results = policyChecks.map((satisfiesPolicy) => satisfiesPolicy(password));
  expect(results[0]).toBe(results[1]);
});
