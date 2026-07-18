/* eslint-disable testing-library/no-unnecessary-act -- this test uses React's low-level createRoot API, not Testing Library render helpers */
import React, { act } from 'react';
import { Simulate } from 'react-dom/test-utils';
import { createRoot, Root } from 'react-dom/client';
import MfaEnrollmentPanel from './MfaEnrollmentPanel';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../contexts/AuthContext';

jest.mock('../lib/supabaseClient', () => ({
  supabase: {
    auth: {
      mfa: {
        listFactors: jest.fn(),
        enroll: jest.fn(),
        challengeAndVerify: jest.fn(),
        unenroll: jest.fn(),
      },
    },
  },
}));

jest.mock('../contexts/AuthContext', () => ({
  useAuth: jest.fn(),
}));

jest.mock('antd', () => {
  const React = require('react');
  return {
    Alert: ({ message, type }: any) => <div role="alert" data-type={type}>{message}</div>,
    Button: ({ children, onClick, disabled, loading, type, danger }: any) => (
      <button type={type === 'primary' ? 'button' : 'button'} onClick={onClick} disabled={disabled || loading} data-danger={danger ? 'true' : undefined}>
        {children}
      </button>
    ),
    Input: ({ value, onChange, placeholder, maxLength, inputMode }: any) => (
      <input value={value} onChange={onChange} placeholder={placeholder} maxLength={maxLength} inputMode={inputMode} />
    ),
    Spin: () => <span aria-label="loading" />,
  };
});

const mfa = supabase.auth.mfa as unknown as {
  listFactors: jest.Mock;
  enroll: jest.Mock;
  challengeAndVerify: jest.Mock;
  unenroll: jest.Mock;
};
const mockedUseAuth = useAuth as jest.Mock;

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const findButton = (container: HTMLElement, text: string) => (
  Array.from(container.querySelectorAll('button')).find((button) => button.textContent?.includes(text)) as HTMLButtonElement | undefined
);

describe('MfaEnrollmentPanel', () => {
  let container: HTMLDivElement;
  let root: Root;
  let refreshMfaAssurance: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    refreshMfaAssurance = jest.fn().mockResolvedValue(true);
    mockedUseAuth.mockReturnValue({ refreshMfaAssurance });
    mfa.unenroll.mockResolvedValue({ data: {}, error: null });
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('enrolls and verifies a TOTP factor before reporting MFA as enabled', async () => {
    mfa.listFactors
      .mockResolvedValueOnce({ data: { totp: [] }, error: null })
      .mockResolvedValueOnce({ data: { totp: [{ id: 'factor-1', status: 'verified' }] }, error: null });
    mfa.enroll.mockResolvedValueOnce({
      data: { id: 'factor-1', totp: { qr_code: 'data:image/svg+xml;base64,qr', secret: 'SETUP-SECRET' } },
      error: null,
    });
    mfa.challengeAndVerify.mockResolvedValueOnce({ data: {}, error: null });

    await act(async () => {
      root.render(<MfaEnrollmentPanel language="en-US" />);
    });

    await act(async () => {
      findButton(container, 'Enable authenticator')?.click();
    });

    expect(mfa.enroll).toHaveBeenCalledWith({
      factorType: 'totp',
      friendlyName: 'AlphaLab authenticator',
    });
    expect(container.querySelector('img')?.getAttribute('src')).toBe('data:image/svg+xml;base64,qr');
    expect(container.textContent).toContain('SETUP-SECRET');

    const input = container.querySelector('input') as HTMLInputElement;
    act(() => {
      Simulate.change(input, { target: { value: '123456' } } as any);
    });
    await act(async () => {
      findButton(container, 'Verify and enable')?.click();
    });

    expect(mfa.challengeAndVerify).toHaveBeenCalledWith({ factorId: 'factor-1', code: '123456' });
    expect(refreshMfaAssurance).toHaveBeenCalledTimes(1);
    expect(mfa.listFactors).toHaveBeenCalledTimes(2);
    expect(container.textContent).toContain('Enabled');
    expect(container.textContent).toContain('Two-factor authentication is enabled');
  });

  it('rejects an incomplete code without calling Supabase verification', async () => {
    mfa.listFactors.mockResolvedValueOnce({ data: { totp: [] }, error: null });
    mfa.enroll.mockResolvedValueOnce({
      data: { id: 'factor-2', totp: { qr_code: 'data:image/svg+xml;base64,qr', secret: 'SETUP-SECRET' } },
      error: null,
    });

    await act(async () => {
      root.render(<MfaEnrollmentPanel language="en-US" />);
    });
    await act(async () => {
      findButton(container, 'Enable authenticator')?.click();
    });

    const input = container.querySelector('input') as HTMLInputElement;
    act(() => {
      Simulate.change(input, { target: { value: '123' } } as any);
    });
    await act(async () => {
      findButton(container, 'Verify and enable')?.click();
    });

    expect(mfa.challengeAndVerify).not.toHaveBeenCalled();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('incorrect or expired');
  });

  it('removes an existing verified factor and refreshes assurance state', async () => {
    mfa.listFactors
      .mockResolvedValueOnce({ data: { totp: [{ id: 'verified-factor', status: 'verified' }] }, error: null })
      .mockResolvedValueOnce({ data: { totp: [] }, error: null });

    await act(async () => {
      root.render(<MfaEnrollmentPanel language="en-US" />);
    });
    await act(async () => {
      findButton(container, 'Remove two-factor authentication')?.click();
    });

    expect(mfa.unenroll).toHaveBeenCalledWith({ factorId: 'verified-factor' });
    expect(refreshMfaAssurance).toHaveBeenCalledTimes(1);
    expect(container.textContent).toContain('Two-factor authentication has been removed');
    expect(container.textContent).toContain('Not enabled');
  });
});
