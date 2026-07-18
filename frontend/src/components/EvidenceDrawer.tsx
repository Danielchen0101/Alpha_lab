import React, { useMemo } from 'react';
import { Button, Descriptions, Drawer, Empty, Space, Tag, Typography } from 'antd';
import { DownloadOutlined, SafetyCertificateOutlined } from '@ant-design/icons';
import { exportJsonReport, timestampedFilename } from '../utils/exportReport';
import './EvidenceDrawer.css';

const { Text, Paragraph } = Typography;

type Props = {
  open: boolean;
  onClose: () => void;
  record: Record<string, any> | null;
  language: string;
  stage?: string;
};

const secretPattern = /(secret|password|passphrase|token|api[_-]?key|authorization|credential|cookie|session|webhook)/i;
const secretQueryPattern = /^(?:access_token|refresh_token|id_token|token|api[_-]?key|key|secret|signature|sig|code|password|passphrase|authorization|credential|cookie|session)$/i;

const sanitizeEvidenceString = (input: string): string => {
  let sanitized = input
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [redacted]')
    .replace(/([?&#;,\s"'](?:access_token|refresh_token|id_token|token|api[_-]?key|secret|signature|authorization|credential)=)[^&#;,\s"']+/gi, '$1[redacted]')
    .replace(/("(?:access_token|refresh_token|id_token|token|api[_-]?key|secret|password|authorization|credential)"\s*:\s*")[^"]+/gi, '$1[redacted]')
    .replace(/\b((?:access_token|refresh_token|id_token|token|api[_-]?key|secret|password|authorization|credential)\s*[:=]\s*)[^\s,;&]+/gi, '$1[redacted]')
    .replace(/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g, '[redacted-jwt]')
    .replace(/(discord(?:app)?\.com\/api\/webhooks\/\d+\/)[^/?#\s]+/gi, '$1[redacted]');

  if (/^https?:\/\//i.test(sanitized)) {
    try {
      const url = new URL(sanitized);
      if (url.username) url.username = '[redacted]';
      if (url.password) url.password = '[redacted]';
      Array.from(url.searchParams.keys()).forEach((key) => {
        if (secretQueryPattern.test(key)) url.searchParams.set(key, '[redacted]');
      });
      url.hash = url.hash.replace(/((?:access_token|refresh_token|id_token|token|code)=)[^&]+/gi, '$1[redacted]');
      sanitized = url.toString();
    } catch {
      // The inline patterns above still protect malformed or partial URLs.
    }
  }
  return sanitized;
};

export const sanitizeEvidence = (value: unknown, depth = 0): unknown => {
  if (depth > 7) return '[nested data omitted]';
  if (Array.isArray(value)) return value.slice(0, 100).map((item) => sanitizeEvidence(item, depth + 1));
  if (typeof value === 'string') return sanitizeEvidenceString(value);
  if (!value || typeof value !== 'object') return value;
  return Object.entries(value as Record<string, unknown>).reduce<Record<string, unknown>>((result, [key, nested]) => {
    result[key] = secretPattern.test(key) ? '[redacted]' : sanitizeEvidence(nested, depth + 1);
    return result;
  }, {});
};

const first = (record: Record<string, any>, keys: string[]) => {
  for (const key of keys) {
    const value = record[key];
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return null;
};

const display = (value: unknown) => {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
};

const displayWithUnit = (value: unknown, unit: string) => {
  const rendered = display(value);
  if (rendered === '—' || rendered.endsWith(unit)) return rendered;
  return `${rendered}${unit}`;
};

const EvidenceDrawer: React.FC<Props> = ({ open, onClose, record, language, stage }) => {
  const zh = language === 'zh-CN';
  const safeRecord = useMemo(() => sanitizeEvidence(record || {}) as Record<string, any>, [record]);
  const symbol = String(safeRecord?.symbol || safeRecord?.ticker || '').toUpperCase();
  const safeStageValue = sanitizeEvidence(stage || first(safeRecord, ['stage', 'currentStage']));
  const safeStage = display(safeStageValue);
  const copy = zh ? {
    title: '决策证据', subtitle: '用于复核的只读数据、版本和决策说明', summary: '证据摘要', symbol: '标的', stage: '阶段', decision: '决策', score: '评分', reliability: '可靠度', updated: '更新时间', source: '数据来源', version: '规则 / 模型版本', reason: '决策说明', raw: '完整证据包', rawHint: '敏感字段会在显示和导出时自动遮盖。', export: '导出证据 JSON', empty: '没有可显示的证据记录。', protected: '只读审计记录',
  } : {
    title: 'Decision evidence', subtitle: 'Read-only data, versions, and rationale for review', summary: 'Evidence summary', symbol: 'Symbol', stage: 'Stage', decision: 'Decision', score: 'Score', reliability: 'Reliability', updated: 'Updated', source: 'Data source', version: 'Rule / model version', reason: 'Decision rationale', raw: 'Full evidence packet', rawHint: 'Sensitive fields are redacted in both the view and export.', export: 'Export evidence JSON', empty: 'No evidence record is available.', protected: 'Read-only audit record',
  };

  const score = first(safeRecord, ['evidenceScore', 'selectionScore', 'overallScore', 'validationScore', 'fineScanScore', 'confidence']);
  const reliability = first(safeRecord, ['scoreReliability', 'evidenceReliability', 'dataCompleteness']);
  const reason = first(safeRecord, ['reviewNote', 'finalReason', 'reason', 'aiTraderRationale', 'scannerReason', 'validationReason']);

  return (
    <Drawer
      className="evidence-drawer"
      width={620}
      open={open}
      onClose={onClose}
      destroyOnClose
      title={<div><strong>{copy.title}{symbol ? ` · ${symbol}` : ''}</strong><span>{copy.subtitle}</span></div>}
      extra={record ? <Button icon={<DownloadOutlined />} onClick={() => exportJsonReport(timestampedFilename(`alphalab-${symbol || 'record'}-evidence`, 'json'), { schemaVersion: 1, exportedAt: new Date().toISOString(), stage: safeStageValue || null, evidence: safeRecord })}>{copy.export}</Button> : null}
    >
      {!record ? <Empty description={copy.empty} /> : (
        <Space direction="vertical" size={20} style={{ width: '100%' }}>
          <div className="evidence-drawer__integrity"><SafetyCertificateOutlined /><strong>{copy.protected}</strong><span>{copy.rawHint}</span></div>
          <section>
            <h3>{copy.summary}</h3>
            <Descriptions bordered column={2} size="small">
              <Descriptions.Item label={copy.symbol}>{symbol || '—'}</Descriptions.Item>
              <Descriptions.Item label={copy.stage}>{safeStage}</Descriptions.Item>
              <Descriptions.Item label={copy.decision}><Tag>{display(first(safeRecord, ['decision', 'aiTraderDecision', 'aiDecision', 'status']))}</Tag></Descriptions.Item>
              <Descriptions.Item label={copy.score}>{score === null ? '—' : displayWithUnit(score, '/100')}</Descriptions.Item>
              <Descriptions.Item label={copy.reliability}>{reliability === null ? '—' : displayWithUnit(reliability, '%')}</Descriptions.Item>
              <Descriptions.Item label={copy.updated}>{display(first(safeRecord, ['updatedAt', 'lastUpdated', 'completedAt', 'createdAt']))}</Descriptions.Item>
              <Descriptions.Item label={copy.source} span={2}>{display(first(safeRecord, ['dataSource', 'source', 'newsSource', 'provider', 'marketDataSource']))}</Descriptions.Item>
              <Descriptions.Item label={copy.version} span={2}>{display(first(safeRecord, ['scoreVersion', 'modelVersion', 'rulesVersion', 'strategyVersion', 'aiModel']))}</Descriptions.Item>
            </Descriptions>
          </section>
          <section><h3>{copy.reason}</h3><Paragraph className="evidence-drawer__reason">{display(reason)}</Paragraph></section>
          <section><h3>{copy.raw}</h3><pre className="evidence-drawer__raw"><Text>{JSON.stringify(safeRecord, null, 2)}</Text></pre></section>
        </Space>
      )}
    </Drawer>
  );
};

export default EvidenceDrawer;
