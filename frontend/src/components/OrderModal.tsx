import React, { useState, useEffect, useMemo } from 'react';
import {
  Modal, Form, Input, Select, InputNumber, Switch, Button, Space,
  Typography, Divider, Alert, Descriptions, Radio, Tooltip, Row, Col, message
} from 'antd';

import {
  SafetyOutlined, WarningOutlined,
} from '@ant-design/icons';
import { tradingAccountAPI } from '../services/api';
import { useTradeMode } from '../contexts/TradeModeContext';
import { useLanguage } from '../contexts/LanguageContext';

const { Text } = Typography;
const { Option } = Select;

export interface OrderModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  /** Pre-fill values when opening from a position or watchlist */
  preset?: {
    symbol?: string;
    side?: 'buy' | 'sell';
    qty?: number;
    limitPrice?: number;
    takeProfitPrice?: number;
    stopLossPrice?: number;
  };
}

interface OrderFormValues {
  symbol: string;
  side: 'buy' | 'sell';
  amountMode: 'shares' | 'dollars';
  qty?: number;
  notional?: number;
  type: string;
  time_in_force: string;
  limit_price?: number;
  stop_price?: number;
  trail_price?: number;
  trail_percent?: number;
  trailMode: 'price' | 'percent';
  extended_hours: boolean;
  order_class: string;
  take_profit_limit_price?: number;
  stop_loss_stop_price?: number;
  stop_loss_limit_price?: number;
  client_order_id?: string;
}

const ORDER_TYPES = [
  { value: 'market', label: 'Market' },
  { value: 'limit', label: 'Limit' },
  { value: 'stop', label: 'Stop' },
  { value: 'stop_limit', label: 'Stop Limit' },
  { value: 'trailing_stop', label: 'Trailing Stop' },
];

const TIME_IN_FORCE_OPTIONS = [
  { value: 'day', label: 'Day' },
  { value: 'gtc', label: 'GTC (Good Till Canceled)' },
  { value: 'opg', label: 'OPG (On Market Open)' },
  { value: 'cls', label: 'CLS (On Market Close)' },
  { value: 'ioc', label: 'IOC (Immediate or Cancel)' },
  { value: 'fok', label: 'FOK (Fill or Kill)' },
];

const ORDER_CLASSES = [
  { value: 'simple', label: 'Simple' },
  { value: 'bracket', label: 'Bracket (TP + SL)' },
  { value: 'oco', label: 'OCO (One Cancels Other)' },
  { value: 'oto', label: 'OTO (One Triggers Other)' },
];

const OrderModal: React.FC<OrderModalProps> = ({
  visible, onClose, onSuccess, preset,
}) => {
  const { tradeMode } = useTradeMode();
  const { t } = useLanguage();
  const [form] = Form.useForm<OrderFormValues>();
  const [submitting, setSubmitting] = useState(false);
  const [confirmStep, setConfirmStep] = useState(false);
  const [realFinalConfirm, setRealFinalConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const orderType = Form.useWatch('type', form) || 'market';
  const orderClass = Form.useWatch('order_class', form) || 'simple';
  const amountMode = Form.useWatch('amountMode', form) || 'shares';
  const trailMode = Form.useWatch('trailMode', form) || 'price';
  const watchedSymbol = Form.useWatch('symbol', form);
  const watchedSide = Form.useWatch('side', form);
  const watchedQty = Form.useWatch('qty', form);
  const watchedNotional = Form.useWatch('notional', form);
  const watchedLimitPrice = Form.useWatch('limit_price', form);

  // Reset form when modal opens with new preset
  useEffect(() => {
    if (visible) {
      setConfirmStep(false);
      setRealFinalConfirm(false);
      setError(null);
      form.setFieldsValue({
        symbol: preset?.symbol || '',
        side: preset?.side || 'buy',
        amountMode: 'shares',
        qty: preset?.qty || undefined,
        type: 'market',
        time_in_force: 'day',
        trailMode: 'price',
        extended_hours: false,
        order_class: 'simple',
        limit_price: preset?.limitPrice || undefined,
        take_profit_limit_price: preset?.takeProfitPrice || undefined,
        stop_loss_stop_price: preset?.stopLossPrice || undefined,
      });
    }
  }, [visible, preset, form]);

  const isFormValid = useMemo((): boolean => {
    const symbol = watchedSymbol?.trim();
    const side = watchedSide;
    const qty = watchedQty;
    const notional = watchedNotional;
    if (!symbol) return false;
    if (!side) return false;
    if (amountMode === 'shares' && (!qty || qty <= 0)) return false;
    if (amountMode === 'dollars' && (!notional || notional <= 0)) return false;
    return true;
  }, [watchedSymbol, watchedSide, watchedQty, watchedNotional, amountMode]);

  const validate = (): string | null => {
    const v = form.getFieldsValue();
    if (!v.symbol?.trim()) return 'Symbol is required';
    if (!v.side) return 'Side is required';
    if (v.amountMode === 'shares' && (!v.qty || v.qty <= 0)) return 'Qty must be > 0';
    if (v.amountMode === 'dollars' && (!v.notional || v.notional <= 0)) return 'Dollar amount must be > 0';
    if ((v.type === 'limit' || v.type === 'stop_limit') && !v.limit_price) return 'Limit price is required for this order type';
    if ((v.type === 'stop' || v.type === 'stop_limit') && !v.stop_price) return 'Stop price is required for this order type';
    if (v.type === 'trailing_stop' && !v.trail_price && !v.trail_percent) return 'Trail price or trail percent is required';
    if (v.extended_hours) {
      if (v.type !== 'limit') return 'Extended hours only allows limit orders';
      if (v.time_in_force !== 'day') return 'Extended hours requires Day TIF';
    }
    if (['bracket', 'oco', 'oto'].includes(v.order_class)) {
      if (!v.take_profit_limit_price) return 'Bracket/OCO/OTO requires take profit price';
      if (!v.stop_loss_stop_price) return 'Bracket/OCO/OTO requires stop loss price';
    }
    return null;
  };

  // Estimated value for review step
  const estimatedValue = useMemo((): number | null => {
    if (amountMode === 'dollars' && watchedNotional) return watchedNotional;
    if (amountMode === 'shares' && watchedQty && watchedLimitPrice) {
      return watchedQty * watchedLimitPrice;
    }
    return null;
  }, [amountMode, watchedQty, watchedNotional, watchedLimitPrice]);

  const handleReviewClick = () => {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    setConfirmStep(true);
    setError(null);
  };

  const handleSubmit = async () => {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    if (tradeMode === 'real' && !realFinalConfirm) {
      setRealFinalConfirm(true);
      return;
    }

    const v = form.getFieldsValue();
    setSubmitting(true);
    setError(null);

    try {
      const payload: any = {
        mode: tradeMode,
        symbol: v.symbol.trim().toUpperCase(),
        side: v.side,
        type: v.type,
        time_in_force: v.time_in_force,
        extended_hours: v.extended_hours || false,
        confirmed: true,
      };

      if (v.amountMode === 'shares') {
        payload.qty = v.qty;
      } else {
        payload.notional = v.notional;
      }

      if (v.limit_price) payload.limit_price = v.limit_price;
      if (v.stop_price) payload.stop_price = v.stop_price;
      if (v.type === 'trailing_stop') {
        if (v.trailMode === 'price' && v.trail_price) payload.trail_price = v.trail_price;
        if (v.trailMode === 'percent' && v.trail_percent) payload.trail_percent = v.trail_percent;
      }

      if (v.order_class !== 'simple') {
        payload.order_class = v.order_class;
        if (v.take_profit_limit_price) {
          payload.take_profit = { limit_price: v.take_profit_limit_price };
        }
        if (v.stop_loss_stop_price) {
          payload.stop_loss = { stop_price: v.stop_loss_stop_price };
          if (v.stop_loss_limit_price) {
            payload.stop_loss.limit_price = v.stop_loss_limit_price;
          }
        }
      }

      if (v.client_order_id?.trim()) {
        payload.client_order_id = v.client_order_id.trim();
      }

      const res = await tradingAccountAPI.placeOrder(payload);
      if (res.data.success) {
        message.success(`Order placed successfully: ${v.side.toUpperCase()} ${v.qty || v.notional} ${v.symbol?.toUpperCase()}`);
        onSuccess();
        onClose();
      } else {
        const errMsg = res.data.error || res.data.message || 'Order failed';
        setError(errMsg);
        message.error(errMsg);
        if (res.data.status === 'confirmation_required') {
          setConfirmStep(false);
          setRealFinalConfirm(false);
        }
      }
    } catch (e: any) {
      const errMsg = e?.response?.data?.error || e?.message || 'Order submission failed';
      setError(errMsg);
      message.error(errMsg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = () => {
    if (realFinalConfirm && !submitting) {
      setRealFinalConfirm(false);
      return;
    }
    if (confirmStep && !submitting) {
      setConfirmStep(false);
      setRealFinalConfirm(false);
      setError(null);
      return;
    }
    onClose();
  };

  const previewValues = form.getFieldsValue();

  return (
    <Modal
      title={
        <Space>
          <span style={{ fontWeight: 700, fontSize: 16, color: 'var(--app-text-strong)' }}>
            {realFinalConfirm ? (t.trade?.finalConfirmation || 'Final Confirmation') : confirmStep ? (t.trade?.reviewOrder || 'Review Order') : (t.trade?.newOrder || 'New Order')}
          </span>
          <span style={{
            fontSize: 11,
            fontWeight: 700,
            padding: '2px 8px',
            borderRadius: 4,
            background: tradeMode === 'real' ? 'rgba(239, 68, 68, 0.12)' : 'rgba(59, 130, 246, 0.12)',
            color: tradeMode === 'real' ? '#ef4444' : '#60a5fa',
            border: `1px solid ${tradeMode === 'real' ? 'rgba(239, 68, 68, 0.25)' : 'rgba(59, 130, 246, 0.25)'}`,
          }}>
            {tradeMode === 'real' ? (t.trade?.realTradingLabel || 'REAL TRADING') : (t.trade?.paperTradingLabel || 'PAPER TRADING')}
          </span>
        </Space>
      }
      open={visible}
      onCancel={handleCancel}
      width="min(100vw, 680px)"
      footer={null}
      destroyOnClose
      maskClosable={false}
      className="dark-modal"
    >
      <style>{`
        .order-modal-form-grid-3 {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 12px;
        }
        .order-modal-form-grid-2 {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }
        @media (max-width: 520px) {
          .order-modal-form-grid-3,
          .order-modal-form-grid-2 {
            grid-template-columns: 1fr;
          }
          .order-modal-bracket-row .ant-col {
            flex: 0 0 100%;
            max-width: 100%;
          }
          .order-modal-actions {
            flex-direction: column;
          }
          .order-modal-actions button {
            width: 100%;
            min-width: unset !important;
          }
          .dark-modal .ant-descriptions-view table {
            display: block;
          }
          .dark-modal .ant-descriptions-view table tbody {
            display: block;
          }
          .dark-modal .ant-descriptions-view table tbody tr {
            display: flex;
            flex-direction: column;
          }
          .dark-modal .ant-descriptions-item {
            padding-bottom: 8px;
          }
        }
      `}</style>
      {tradeMode === 'real' && (
        <Alert
          message="Real Trading Mode - Orders will be sent to api.alpaca.markets"
          description="You are placing orders with real money. Please verify all details carefully. This is a live trading environment."
          type="error"
          showIcon
          icon={<WarningOutlined />}
          style={{ marginBottom: 16, borderRadius: 8, background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.2)' }}
        />
      )}

      {error && (
        <Alert
          message={error}
          type="error"
          showIcon
          closable
          onClose={() => setError(null)}
          style={{ marginBottom: 16, borderRadius: 8 }}
        />
      )}

      {confirmStep ? (
        /* ── Review / Confirm Step ── */
        <div>
          {tradeMode === 'real' && realFinalConfirm && (
            <Alert
              message="FINAL WARNING: This will place a REAL order with REAL money"
              description={
                <div style={{ marginTop: 4 }}>
                  <Text strong type="danger" style={{ fontSize: 14 }}>
                    Orders cannot be undone once submitted. Verify ALL details before proceeding.
                  </Text>
                </div>
              }
              type="error"
              showIcon
              icon={<SafetyOutlined />}
              style={{ marginBottom: 16, borderRadius: 8, border: '2px solid #ef4444' }}
            />
          )}

          {tradeMode === 'real' && !realFinalConfirm && (
            <Alert
              message="Review your order carefully"
              description="Click 'Confirm & Place Real Order' to proceed. A final confirmation will be required."
              type="warning"
              showIcon
              style={{ marginBottom: 16, borderRadius: 8 }}
            />
          )}

          <Descriptions
            column={2}
            bordered
            size="small"
            style={{ marginBottom: 16 }}
            labelStyle={{ fontWeight: 600, fontSize: 12, color: 'var(--app-text-muted)', background: 'var(--app-card-bg-soft)' }}
            contentStyle={{ fontSize: 13, background: 'var(--app-card-bg)', color: 'var(--app-text)' }}
          >
            <Descriptions.Item label="Mode">
              <Text strong type={tradeMode === 'real' ? 'danger' : undefined} style={{ color: tradeMode === 'real' ? '#ef4444' : 'var(--app-blue-text)' }}>
                {tradeMode === 'paper' ? 'Paper Trading' : 'Real Trading'}
              </Text>
            </Descriptions.Item>
            <Descriptions.Item label="Endpoint">
              <Text code style={{ fontSize: 11, background: 'var(--app-input-bg)', border: '1px solid var(--app-border-soft)' }}>
                {tradeMode === 'paper' ? 'paper-api.alpaca.markets' : 'api.alpaca.markets'}
              </Text>
            </Descriptions.Item>
            <Descriptions.Item label="Symbol">
              <Text strong style={{ fontSize: 15, color: 'var(--app-text-strong)' }}>{previewValues.symbol?.toUpperCase()}</Text>
            </Descriptions.Item>
            <Descriptions.Item label="Side">
              <Text type={previewValues.side === 'buy' ? 'success' : 'danger'} strong style={{ color: previewValues.side === 'buy' ? '#4ade80' : '#ef4444' }}>
                {previewValues.side?.toUpperCase()}
              </Text>
            </Descriptions.Item>
            <Descriptions.Item label={amountMode === 'shares' ? 'Quantity' : 'Notional Amount'}>
              {amountMode === 'shares'
                ? `${previewValues.qty} shares`
                : `$${Number(previewValues.notional || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`
              }
            </Descriptions.Item>
            <Descriptions.Item label="Order Type">
              {ORDER_TYPES.find(t => t.value === previewValues.type)?.label || previewValues.type}
            </Descriptions.Item>
            <Descriptions.Item label="Time in Force">
              {previewValues.time_in_force?.toUpperCase()}
            </Descriptions.Item>
            {previewValues.limit_price && (
              <Descriptions.Item label="Limit Price">
                <span style={{ fontWeight: 700, color: 'var(--app-text-strong)' }}>${Number(previewValues.limit_price).toFixed(2)}</span>
              </Descriptions.Item>
            )}
            {previewValues.stop_price && (
              <Descriptions.Item label="Stop Price">
                <span style={{ fontWeight: 700, color: '#ef4444' }}>${Number(previewValues.stop_price).toFixed(2)}</span>
              </Descriptions.Item>
            )}
            {previewValues.type === 'trailing_stop' && previewValues.trail_price && (
              <Descriptions.Item label="Trail Price">
                ${Number(previewValues.trail_price).toFixed(2)}
              </Descriptions.Item>
            )}
            {previewValues.type === 'trailing_stop' && previewValues.trail_percent && (
              <Descriptions.Item label="Trail Percent">
                {previewValues.trail_percent}%
              </Descriptions.Item>
            )}
            {previewValues.order_class !== 'simple' && (
              <>
                <Descriptions.Item label="Order Class">
                  {previewValues.order_class?.toUpperCase()}
                </Descriptions.Item>
                {previewValues.take_profit_limit_price && (
                  <Descriptions.Item label="Take Profit">
                    <span style={{ fontWeight: 700, color: '#4ade80' }}>${Number(previewValues.take_profit_limit_price).toFixed(2)}</span>
                  </Descriptions.Item>
                )}
                {previewValues.stop_loss_stop_price && (
                  <Descriptions.Item label="Stop Loss">
                    <span style={{ fontWeight: 700, color: '#ef4444' }}>${Number(previewValues.stop_loss_stop_price).toFixed(2)}</span>
                    {previewValues.stop_loss_limit_price && ` (limit: $${Number(previewValues.stop_loss_limit_price).toFixed(2)})`}
                  </Descriptions.Item>
                )}
              </>
            )}
            {previewValues.extended_hours && (
              <Descriptions.Item label="Extended Hours">
                <Text type="warning" style={{ color: '#fbbf24' }}>Yes</Text>
              </Descriptions.Item>
            )}
            {estimatedValue && (
              <Descriptions.Item label="Estimated Value">
                <Text strong style={{ color: 'var(--app-text-strong)' }}>${estimatedValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</Text>
              </Descriptions.Item>
            )}
          </Descriptions>

          <div className="order-modal-actions" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Button onClick={handleCancel} disabled={submitting} size="large" style={{ borderRadius: 8, background: 'var(--app-card-bg-soft)', color: 'var(--app-text)', borderColor: 'var(--app-border)' }}>
              {realFinalConfirm ? (t.trade?.cancel || 'Cancel') : 'Back'}
            </Button>
            <Button
              type="primary"
              danger={tradeMode === 'real' && realFinalConfirm}
              loading={submitting}
              onClick={handleSubmit}
              size="large"
              icon={tradeMode === 'real' && realFinalConfirm ? <SafetyOutlined /> : undefined}
              style={{
                borderRadius: 8,
                fontWeight: 700,
                minWidth: 200,
                background: tradeMode === 'real' && realFinalConfirm ? '#ef4444' : undefined,
                borderColor: tradeMode === 'real' && realFinalConfirm ? '#ef4444' : undefined,
              }}
            >
              {tradeMode === 'real'
                ? (realFinalConfirm ? (t.trade?.placeRealOrder || 'Place Real Order') : (t.trade?.confirmPlaceReal || 'Confirm & Place Real Order'))
                : (t.trade?.placePaperOrder || 'Place Paper Order')
              }
            </Button>
          </div>
        </div>
      ) : (
        /* ── Order Form ── */
        <div>
          <Form
            form={form}
            layout="vertical"
            initialValues={{
              side: 'buy',
              amountMode: 'shares',
              type: 'market',
              time_in_force: 'day',
              trailMode: 'price',
              extended_hours: false,
              order_class: 'simple',
            }}
            size="small"
          >
            {/* ── Basic Order ── */}
            <div style={{ marginBottom: 4 }}>
              <Text strong style={{ fontSize: 12, color: 'var(--app-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Basic Order
              </Text>
            </div>
            <div className="order-modal-form-grid-3">
              <Form.Item name="symbol" label={<span style={{ color: 'var(--app-text)' }}>Symbol</span>} rules={[{ required: true, message: 'Symbol is required' }]}>
                <Input placeholder="AAPL" style={{ textTransform: 'uppercase', background: 'var(--app-input-bg)', color: 'var(--app-text)', borderColor: 'var(--app-border)' }} />
              </Form.Item>
              <Form.Item name="side" label={<span style={{ color: 'var(--app-text)' }}>Side</span>} rules={[{ required: true }]}>
                <Select dropdownStyle={{ background: 'var(--app-card-bg)' }}>
                  <Option value="buy">Buy</Option>
                  <Option value="sell">Sell</Option>
                </Select>
              </Form.Item>
              <Form.Item name="time_in_force" label={<span style={{ color: 'var(--app-text)' }}>Time in Force</span>}>
                <Select dropdownStyle={{ background: 'var(--app-card-bg)' }}>
                  {TIME_IN_FORCE_OPTIONS.map(t => (
                    <Option key={t.value} value={t.value}>{t.label}</Option>
                  ))}
                </Select>
              </Form.Item>
            </div>

            <Divider style={{ margin: '12px 0', borderColor: 'var(--app-border-soft)' }} />

            {/* ── Amount ── */}
            <div style={{ marginBottom: 4 }}>
              <Text strong style={{ fontSize: 12, color: 'var(--app-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Amount
              </Text>
            </div>
            <Form.Item name="amountMode" label={<span style={{ color: 'var(--app-text)' }}>Amount Mode</span>}>
              <Radio.Group>
                <Radio.Button value="shares">Shares</Radio.Button>
                <Radio.Button value="dollars">Dollars</Radio.Button>
              </Radio.Group>
            </Form.Item>
            {amountMode === 'shares' ? (
              <Form.Item name="qty" label={<span style={{ color: 'var(--app-text)' }}>Quantity</span>} rules={[{ required: true, message: 'Quantity is required' }]}>
                <InputNumber min={0.0001} step={0.01} style={{ width: '100%', background: 'var(--app-input-bg)', color: 'var(--app-text)', borderColor: 'var(--app-border)' }} placeholder="Shares, e.g. 0.5" />
              </Form.Item>
            ) : (
              <Form.Item name="notional" label={<span style={{ color: 'var(--app-text)' }}>Dollar Amount ($)</span>} rules={[{ required: true, message: 'Dollar amount is required' }]}>
                <InputNumber min={0.01} step={1} style={{ width: '100%', background: 'var(--app-input-bg)', color: 'var(--app-text)', borderColor: 'var(--app-border)' }} placeholder="Dollar amount" prefix="$" />
              </Form.Item>
            )}

            <Divider style={{ margin: '12px 0', borderColor: 'var(--app-border-soft)' }} />

            {/* ── Order Type ── */}
            <div style={{ marginBottom: 4 }}>
              <Text strong style={{ fontSize: 12, color: 'var(--app-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Order Type
              </Text>
            </div>
            <Form.Item name="type" label={<span style={{ color: 'var(--app-text)' }}>Type</span>}>
              <Select dropdownStyle={{ background: 'var(--app-card-bg)' }}>
                {ORDER_TYPES.map(t => (
                  <Option key={t.value} value={t.value}>{t.label}</Option>
                ))}
              </Select>
            </Form.Item>

            {(orderType === 'limit' || orderType === 'stop_limit') && (
              <Form.Item name="limit_price" label={<span style={{ color: 'var(--app-text)' }}>Limit Price</span>} rules={[{ required: true, message: 'Limit price is required' }]}>
                <InputNumber min={0} step={0.01} style={{ width: '100%', background: 'var(--app-input-bg)', color: 'var(--app-text)', borderColor: 'var(--app-border)' }} prefix="$" />
              </Form.Item>
            )}
            {(orderType === 'stop' || orderType === 'stop_limit') && (
              <Form.Item name="stop_price" label={<span style={{ color: 'var(--app-text)' }}>Stop Price</span>} rules={[{ required: true, message: 'Stop price is required' }]}>
                <InputNumber min={0} step={0.01} style={{ width: '100%', background: 'var(--app-input-bg)', color: 'var(--app-text)', borderColor: 'var(--app-border)' }} prefix="$" />
              </Form.Item>
            )}
            {orderType === 'trailing_stop' && (
              <>
                <Form.Item name="trailMode" label={<span style={{ color: 'var(--app-text)' }}>Trail Type</span>}>
                  <Radio.Group>
                    <Radio.Button value="price">Trail Price</Radio.Button>
                    <Radio.Button value="percent">Trail Percent</Radio.Button>
                  </Radio.Group>
                </Form.Item>
                {trailMode === 'price' ? (
                  <Form.Item name="trail_price" label={<span style={{ fontSize: 12, fontWeight: 600, color: 'var(--app-text)' }}>Trail Price ($) <span style={{ color: '#ff4d4f' }}>*</span></span>} rules={[{ required: true }]}>
                    <InputNumber prefix="$" style={{ width: '100%', height: 36, background: 'var(--app-input-bg)', color: 'var(--app-text)', borderColor: 'var(--app-border)' }} min={0.01} step={0.01} />
                  </Form.Item>
                ) : (
                  <Form.Item name="trail_percent" label={<span style={{ fontSize: 12, fontWeight: 600, color: 'var(--app-text)' }}>Trail Percent (%) <span style={{ color: '#ff4d4f' }}>*</span></span>} rules={[{ required: true }]}>
                    <InputNumber suffix="%" style={{ width: '100%', height: 36, background: 'var(--app-input-bg)', color: 'var(--app-text)', borderColor: 'var(--app-border)' }} min={0.1} step={0.1} />
                  </Form.Item>
                )}
              </>
            )}

            <Divider style={{ margin: '12px 0', borderColor: 'var(--app-border-soft)' }} />

            {/* ── Advanced Options ── */}
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--app-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
              Advanced Options
            </div>
            <div className="order-modal-form-grid-2">
              <Form.Item name="extended_hours" label={<span style={{ fontSize: 12, fontWeight: 600, color: 'var(--app-text)' }}>Extended Hours</span>} valuePropName="checked">
                <Switch />
              </Form.Item>
              <Form.Item name="client_order_id" label={<span style={{ fontSize: 12, fontWeight: 600, color: 'var(--app-text)' }}>Client Order ID (optional)</span>}>
                <Input placeholder="Custom ID" style={{ height: 36, background: 'var(--app-input-bg)', color: 'var(--app-text)', borderColor: 'var(--app-border)' }} />
              </Form.Item>
            </div>

            <Divider style={{ margin: '12px 0', borderColor: 'var(--app-border-soft)' }} />

            {/* ── Risk / Bracket ── */}
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--app-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
              Risk / Bracket Orders
            </div>
            <Form.Item name="order_class" label={<span style={{ fontSize: 12, fontWeight: 600, color: 'var(--app-text)' }}>Order Class</span>}>
              <Select style={{ height: 36 }} dropdownStyle={{ background: 'var(--app-card-bg)' }}>
                {ORDER_CLASSES.map(c => <Option key={c.value} value={c.value}>{c.label}</Option>)}
              </Select>
            </Form.Item>

            {orderClass !== 'simple' && (
              <div style={{ background: 'var(--app-card-bg-soft)', padding: '16px', borderRadius: 8, marginTop: 8, border: '1px solid var(--app-border-soft)' }}>
                <Row gutter={16} className="order-modal-bracket-row">
                  <Col xs={24} sm={12}>
                    <Form.Item name="take_profit_limit_price" label={<span style={{ fontSize: 11, fontWeight: 600, color: '#4ade80' }}>Take Profit Limit <span style={{ color: '#ff4d4f' }}>*</span></span>} rules={[{ required: true }]} style={{ marginBottom: 12 }}>
                      <InputNumber prefix="$" style={{ width: '100%', height: 36, background: 'var(--app-input-bg)', color: 'var(--app-text)', borderColor: 'var(--app-border)' }} min={0.01} step={0.01} />
                    </Form.Item>
                  </Col>
                </Row>
                <Row gutter={16} className="order-modal-bracket-row">
                  <Col xs={24} sm={12}>
                    <Form.Item name="stop_loss_stop_price" label={<span style={{ fontSize: 11, fontWeight: 600, color: '#ef4444' }}>Stop Loss Price <span style={{ color: '#ff4d4f' }}>*</span></span>} rules={[{ required: true }]} style={{ marginBottom: 0 }}>
                      <InputNumber prefix="$" style={{ width: '100%', height: 36, background: 'var(--app-input-bg)', color: 'var(--app-text)', borderColor: 'var(--app-border)' }} min={0.01} step={0.01} />
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={12}>
                    <Form.Item name="stop_loss_limit_price" label={<span style={{ fontSize: 11, fontWeight: 600, color: 'var(--app-text-muted)' }}>Stop Limit (Optional)</span>} style={{ marginBottom: 0 }}>
                      <Tooltip title="Optional: if not set, stop loss triggers a market order">
                        <InputNumber prefix="$" style={{ width: '100%', height: 36, background: 'var(--app-input-bg)', color: 'var(--app-text)', borderColor: 'var(--app-border)' }} min={0.01} step={0.01} />
                      </Tooltip>
                    </Form.Item>
                  </Col>
                </Row>
              </div>
            )}
          </Form>

          {/* Form footer buttons */}
          <Divider style={{ margin: '16px 0', borderColor: 'var(--app-border-soft)' }} />
          <div className="order-modal-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button onClick={onClose} disabled={submitting} style={{ borderRadius: 8, fontWeight: 600, background: 'var(--app-card-bg-soft)', color: 'var(--app-text)', borderColor: 'var(--app-border)' }}>
              {t.trade?.cancel || 'Cancel'}
            </Button>
            <Button
              type="primary"
              disabled={!isFormValid}
              onClick={handleReviewClick}
              style={{
                borderRadius: 8,
                fontWeight: 700,
                minWidth: 140,
                background: previewValues.side === 'sell' ? '#faad14' : '#1890ff',
                borderColor: previewValues.side === 'sell' ? '#faad14' : '#1890ff',
              }}
            >
              Review {previewValues.side === 'buy' ? 'Buy' : 'Sell'}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
};

export default OrderModal;
