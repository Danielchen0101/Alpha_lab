import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Button, Input, Spin } from 'antd';
import {
  CheckCircleOutlined,
  KeyOutlined,
  LockOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import './MfaEnrollmentPanel.css';

type Factor = {
  id: string;
  friendly_name?: string;
  status?: string;
  created_at?: string;
};

type Enrollment = {
  factorId: string;
  qrCode: string;
  secret: string;
};

interface Props {
  language: 'zh-CN' | 'en-US';
}

const MfaEnrollmentPanel: React.FC<Props> = ({ language }) => {
  const zh = language === 'zh-CN';
  const { refreshMfaAssurance } = useAuth();
  const [factors, setFactors] = useState<Factor[]>([]);
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  const copy = zh ? {
    title: '双重验证',
    description: '使用身份验证器为登录和实盘操作增加第二层保护。启用后，每次新登录都需要 6 位动态验证码。',
    enabled: '已启用',
    disabled: '未启用',
    enable: '启用身份验证器',
    disable: '撤销双重验证',
    scan: '用 Google Authenticator、1Password、Authy 等应用扫描二维码，然后输入当前验证码完成启用。',
    manual: '无法扫描时，可手动输入密钥',
    placeholder: '输入 6 位验证码',
    verify: '验证并启用',
    cancel: '取消',
    loadError: '无法读取双重验证状态，请稍后重试。',
    enrollError: '无法创建身份验证器，请稍后重试。',
    verifyError: '验证码不正确或已过期，请使用新的验证码重试。',
    enabledMessage: '双重验证已启用。之后的新登录将要求验证码。',
    disabledMessage: '双重验证已撤销。',
    disableError: '暂时无法撤销双重验证，请重新验证会话后再试。',
    factorName: 'AlphaLab 身份验证器',
  } : {
    title: 'Two-factor authentication',
    description: 'Add an authenticator check to sign-in and live-trading access. Once enabled, every new sign-in requires a rotating 6-digit code.',
    enabled: 'Enabled',
    disabled: 'Not enabled',
    enable: 'Enable authenticator',
    disable: 'Remove two-factor authentication',
    scan: 'Scan the QR code with Google Authenticator, 1Password, Authy, or another authenticator, then enter the current code to finish setup.',
    manual: 'If you cannot scan, enter this setup key manually',
    placeholder: 'Enter 6-digit code',
    verify: 'Verify and enable',
    cancel: 'Cancel',
    loadError: 'Two-factor status is temporarily unavailable. Try again shortly.',
    enrollError: 'The authenticator could not be created. Try again shortly.',
    verifyError: 'The code is incorrect or expired. Use a new code and try again.',
    enabledMessage: 'Two-factor authentication is enabled. New sign-ins will require a code.',
    disabledMessage: 'Two-factor authentication has been removed.',
    disableError: 'Two-factor authentication could not be removed. Re-verify your session and try again.',
    factorName: 'AlphaLab authenticator',
  };

  const loadFactors = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.auth.mfa.listFactors();
    if (error) {
      setMessage({ tone: 'error', text: copy.loadError });
    } else {
      setFactors((data?.totp || []) as Factor[]);
    }
    setLoading(false);
  }, [copy.loadError]);

  useEffect(() => {
    loadFactors();
  }, [loadFactors]);

  const verifiedFactor = factors.find((factor) => factor.status === 'verified');

  const beginEnrollment = async () => {
    setWorking(true);
    setMessage(null);
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: 'totp',
      friendlyName: copy.factorName,
    });
    if (error || !data?.id || !data.totp?.qr_code) {
      setMessage({ tone: 'error', text: copy.enrollError });
    } else {
      setEnrollment({
        factorId: data.id,
        qrCode: data.totp.qr_code,
        secret: data.totp.secret || '',
      });
    }
    setWorking(false);
  };

  const cancelEnrollment = async () => {
    if (enrollment?.factorId) await supabase.auth.mfa.unenroll({ factorId: enrollment.factorId });
    setEnrollment(null);
    setCode('');
    setMessage(null);
    await loadFactors();
  };

  const verifyEnrollment = async () => {
    if (!enrollment || !/^\d{6}$/.test(code.trim())) {
      setMessage({ tone: 'error', text: copy.verifyError });
      return;
    }
    setWorking(true);
    setMessage(null);
    const { error } = await supabase.auth.mfa.challengeAndVerify({
      factorId: enrollment.factorId,
      code: code.trim(),
    });
    if (error) {
      setMessage({ tone: 'error', text: copy.verifyError });
    } else {
      setEnrollment(null);
      setCode('');
      setMessage({ tone: 'success', text: copy.enabledMessage });
      await refreshMfaAssurance();
      await loadFactors();
    }
    setWorking(false);
  };

  const disable = async () => {
    if (!verifiedFactor) return;
    setWorking(true);
    setMessage(null);
    const { error } = await supabase.auth.mfa.unenroll({ factorId: verifiedFactor.id });
    if (error) {
      setMessage({ tone: 'error', text: copy.disableError });
    } else {
      setMessage({ tone: 'success', text: copy.disabledMessage });
      await refreshMfaAssurance();
      await loadFactors();
    }
    setWorking(false);
  };

  return (
    <section className="mfa-enrollment" aria-labelledby="mfa-enrollment-title">
      <div className="mfa-enrollment__heading">
        <span className="mfa-enrollment__icon"><SafetyCertificateOutlined /></span>
        <div>
          <div className="mfa-enrollment__title-row">
            <strong id="mfa-enrollment-title">{copy.title}</strong>
            {!loading && (
              <span className={`mfa-enrollment__status${verifiedFactor ? ' is-enabled' : ''}`}>
                {verifiedFactor ? <CheckCircleOutlined /> : <LockOutlined />}
                {verifiedFactor ? copy.enabled : copy.disabled}
              </span>
            )}
          </div>
          <p>{copy.description}</p>
        </div>
      </div>

      {message && <Alert type={message.tone} showIcon message={message.text} closable onClose={() => setMessage(null)} />}

      {loading ? <div className="mfa-enrollment__loading"><Spin size="small" /></div> : enrollment ? (
        <div className="mfa-enrollment__setup">
          <p>{copy.scan}</p>
          <div className="mfa-enrollment__qr">
            <img src={enrollment.qrCode} alt={zh ? '身份验证器二维码' : 'Authenticator QR code'} />
            {enrollment.secret && <div><span>{copy.manual}</span><code>{enrollment.secret}</code></div>}
          </div>
          <div className="mfa-enrollment__verify">
            <Input
              prefix={<KeyOutlined />}
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
              onPressEnter={verifyEnrollment}
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder={copy.placeholder}
              maxLength={6}
              aria-label={copy.placeholder}
            />
            <Button type="primary" onClick={verifyEnrollment} loading={working}>{copy.verify}</Button>
            <Button onClick={cancelEnrollment} disabled={working}>{copy.cancel}</Button>
          </div>
        </div>
      ) : verifiedFactor ? (
        <Button danger onClick={disable} loading={working}>{copy.disable}</Button>
      ) : (
        <Button type="primary" icon={<SafetyCertificateOutlined />} onClick={beginEnrollment} loading={working}>{copy.enable}</Button>
      )}
    </section>
  );
};

export default MfaEnrollmentPanel;
