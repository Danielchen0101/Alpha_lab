import React from 'react';
import { Space, Tag } from 'antd';
import type { TradingAccountResponse } from '../services/api';

export const brokerRiskState = (account: Pick<TradingAccountResponse, 'tradingBlocked' | 'accountBlocked'> | null) => {
  if (account?.tradingBlocked === true || account?.accountBlocked === true) return 'blocked';
  if (account?.tradingBlocked === false && account?.accountBlocked === false) return 'reported_clear';
  return 'unknown';
};

const BrokerRiskStatus: React.FC<{ account: TradingAccountResponse | null; language: string }> = ({ account, language }) => {
  const zh = language === 'zh-CN';
  const status = brokerRiskState(account);
  return <Space direction="vertical" size={6}>
    <Space wrap>
      {account?.tradingBlocked === true && <Tag color="red">{zh ? '券商交易限制' : 'Broker trading blocked'}</Tag>}
      {account?.accountBlocked === true && <Tag color="red">{zh ? '券商账户限制' : 'Broker account blocked'}</Tag>}
      {status === 'reported_clear' && <Tag color="green">{zh ? '已报告的券商限制未触发' : 'Reported broker blocks are clear'}</Tag>}
      {status === 'unknown' && <Tag>{zh ? '券商限制状态未完整提供' : 'Broker block status incomplete'}</Tag>}
    </Space>
    <small style={{ color: 'var(--app-text-muted)' }}>{zh ? '旧版 PDT 字段' : 'Legacy PDT field'}: {typeof account?.patternDayTrader === 'boolean' ? String(account.patternDayTrader) : (zh ? '未提供' : 'Not provided')}</small>
  </Space>;
};

export default BrokerRiskStatus;
