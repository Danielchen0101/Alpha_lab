import React, { useState, useEffect, useRef } from 'react';
import { Tooltip } from 'antd';
import { CheckCircleFilled, WarningFilled, LoadingOutlined } from '@ant-design/icons';
import { useLanguage } from '../contexts/LanguageContext';
import { API_BASE_URL } from '../services/api';

type SystemStatus = 'checking' | 'online' | 'unavailable';

const SystemStatusIndicator: React.FC = () => {
  const { t } = useLanguage();
  const [status, setStatus] = useState<SystemStatus>('checking');
  const [lastOk, setLastOk] = useState<Date | null>(null);
  const mountedRef = useRef(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const check = React.useCallback(async () => {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(`${API_BASE_URL}/health`, {
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (!mountedRef.current) return;
      if (res.ok) {
        setStatus('online');
        setLastOk(new Date());
      } else {
        setStatus('unavailable');
      }
    } catch {
      if (mountedRef.current) setStatus('unavailable');
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    check();
    intervalRef.current = setInterval(check, 60000);
    return () => {
      mountedRef.current = false;
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [check]);

  const icon = status === 'online' ? (
    <CheckCircleFilled style={{ color: '#10b981', fontSize: 12 }} />
  ) : status === 'unavailable' ? (
    <WarningFilled style={{ color: '#f59e0b', fontSize: 12 }} />
  ) : (
    <LoadingOutlined style={{ color: '#64748b', fontSize: 12 }} />
  );

  const label =
    status === 'online'
      ? t.systemStatus.online
      : status === 'unavailable'
      ? t.systemStatus.unavailable
      : t.systemStatus.checking;

  const tooltipTitle =
    status === 'online'
      ? `${t.systemStatus.apiHealthy} | ${t.systemStatus.lastChecked}: ${lastOk?.toLocaleTimeString() ?? '–'}`
      : status === 'unavailable'
      ? t.systemStatus.unavailableDesc
      : t.systemStatus.checking;

  return (
    <Tooltip title={tooltipTitle}>
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 11,
          color: status === 'online' ? '#6ee7b7' : status === 'unavailable' ? '#fbbf24' : '#64748b',
          cursor: 'default',
          whiteSpace: 'nowrap',
        }}
      >
        {icon}
        {label}
      </span>
    </Tooltip>
  );
};

export default SystemStatusIndicator;
