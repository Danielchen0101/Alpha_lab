import React, { useState, useEffect } from 'react';
import {
  Modal, Form, Input, Select, InputNumber, Switch, Button, Space,
  Typography, Divider, Alert, Descriptions, Radio, Tooltip, Row, Col
} from 'antd';

import {
  ExclamationCircleOutlined, SafetyOutlined,
} from '@ant-design/icons';
import { tradingAccountAPI } from '../services/api';

const { Text } = Typography;
const { Option } = Select;

export interface OrderModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  tradeMode: 'paper' | 'real';
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
  visible, onClose, onSuccess, tradeMode, preset,
}) => {
  const [form] = Form.useForm<OrderFormValues>();
  const [submitting, setSubmitting] = useState(false);
  const [confirmStep, setConfirmStep] = useState(false);
  const [realDoubleConfirm, setRealDoubleConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const orderType = Form.useWatch('type', form) || 'market';
  const orderClass = Form.useWatch('order_class', form) || 'simple';
  const amountMode = Form.useWatch('amountMode', form) || 'shares';
  const trailMode = Form.useWatch('trailMode', form) || 'price';

  // Reset form when modal opens with new preset
  useEffect(() => {
    if (visible) {
      setConfirmStep(false);
      setRealDoubleConfirm(false);
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

  const handleSubmit = async () => {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    if (!confirmStep) {
      setConfirmStep(true);
      setError(null);
      return;
    }

    if (tradeMode === 'real' && !realDoubleConfirm) {
      setRealDoubleConfirm(true);
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
        onSuccess();
        onClose();
      } else {
        const errMsg = res.data.error || res.data.message || 'Order failed';
        setError(errMsg);
        if (res.data.status === 'confirmation_required') {
          setConfirmStep(false);
          setRealDoubleConfirm(false);
        }
      }
    } catch (e: any) {
      setError(e?.response?.data?.error || e?.message || 'Order submission failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = () => {
    if (confirmStep && !submitting) {
      setConfirmStep(false);
      setRealDoubleConfirm(false);
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
          <span style={{ fontWeight: 700, fontSize: 16 }}>
            {confirmStep ? 'Confirm Order' : 'New Order'}
          </span>
          <span style={{
            fontSize: 11,
            fontWeight: 700,
            padding: '2px 8px',
            borderRadius: 4,
            background: tradeMode === 'real' ? '#fff1f0' : '#e6f7ff',
            color: tradeMode === 'real' ? '#cf1322' : '#096dd9',
            border: `1px solid ${tradeMode === 'real' ? '#ffa39e' : '#91d5ff'}`,
          }}>
            {tradeMode === 'real' ? 'REAL TRADING' : 'PAPER TRADING'}
          </span>
        </Space>
      }
      open={visible}
      onCancel={handleCancel}
      width={640}
      footer={null}
      destroyOnClose
    >
      {tradeMode === 'real' && (
        <Alert
          message="Real Trading Mode"
          description="You are placing orders with real money. Orders will be sent to api.alpaca.markets. Please verify all details before confirming."
          type="error"
          showIcon
          icon={<ExclamationCircleOutlined />}
          style={{ marginBottom: 16 }}
          banner
        />
      )}

      {error && (
        <Alert
          message={error}
          type="error"
          showIcon
          closable
          onClose={() => setError(null)}
          style={{ marginBottom: 16 }}
        />
      )}

      {confirmStep ? (
        /* ── Confirm Preview ── */
        <div>
          <Descriptions
            column={2}
            bordered
            size="small"
            style={{ marginBottom: 16 }}
            labelStyle={{ fontWeight: 600, fontSize: 12, color: '#595959' }}
            contentStyle={{ fontSize: 13 }}
          >
            <Descriptions.Item label="Mode">
              <Text strong type={tradeMode === 'real' ? 'danger' : undefined}>
                {tradeMode === 'paper' ? 'Paper' : 'Real'}
              </Text>
            </Descriptions.Item>
            <Descriptions.Item label="Endpoint">
              <Text code style={{ fontSize: 11 }}>
                {tradeMode === 'paper' ? 'paper-api.alpaca.markets' : 'api.alpaca.markets'}
              </Text>
            </Descriptions.Item>
            <Descriptions.Item label="Symbol">
              <Text strong>{previewValues.symbol?.toUpperCase()}</Text>
            </Descriptions.Item>
            <Descriptions.Item label="Side">
              <Text type={previewValues.side === 'buy' ? 'success' : 'danger'} strong>
                {previewValues.side?.toUpperCase()}
              </Text>
            </Descriptions.Item>
            <Descriptions.Item label={amountMode === 'shares' ? 'Quantity' : 'Amount'}>
              {amountMode === 'shares'
                ? `${previewValues.qty} shares`
                : `$${previewValues.notional?.toFixed(2)}`
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
                ${previewValues.limit_price}
              </Descriptions.Item>
            )}
            {previewValues.stop_price && (
              <Descriptions.Item label="Stop Price">
                ${previewValues.stop_price}
              </Descriptions.Item>
            )}
            {previewValues.type === 'trailing_stop' && previewValues.trail_price && (
              <Descriptions.Item label="Trail Price">
                ${previewValues.trail_price}
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
                    ${previewValues.take_profit_limit_price}
                  </Descriptions.Item>
                )}
                {previewValues.stop_loss_stop_price && (
                  <Descriptions.Item label="Stop Loss">
                    ${previewValues.stop_loss_stop_price}
                    {previewValues.stop_loss_limit_price && ` (limit: $${previewValues.stop_loss_limit_price})`}
                  </Descriptions.Item>
                )}
              </>
            )}
            {previewValues.extended_hours && (
              <Descriptions.Item label="Extended Hours">
                <Text type="warning">Yes</Text>
              </Descriptions.Item>
            )}
          </Descriptions>

          {tradeMode === 'real' && realDoubleConfirm && (
            <Alert
              message="Final Confirmation Required"
              description={
                <div style={{ marginTop: 8 }}>
                  <Text strong type="danger" style={{ fontSize: 14 }}>
                    This will place a REAL order with REAL money.
                  </Text>
                  <br />
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    Click "Submit REAL Order" to confirm. This action cannot be undone.
                  </Text>
                </div>
              }
              type="warning"
              showIcon
              style={{ marginBottom: 16 }}
            />
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button onClick={handleCancel} disabled={submitting}>
              {tradeMode === 'real' && realDoubleConfirm ? 'Cancel' : 'Back'}
            </Button>
            <Button
              type="primary"
              danger={tradeMode === 'real'}
              loading={submitting}
              onClick={handleSubmit}
              icon={tradeMode === 'real' && realDoubleConfirm ? <SafetyOutlined /> : undefined}
            >
              {tradeMode === 'real'
                ? (realDoubleConfirm ? 'Submit REAL Order' : 'Review & Confirm')
                : 'Submit Paper Order'
              }
            </Button>
          </div>
        </div>
      ) : (
        /* ── Order Form ── */
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
            <Text strong style={{ fontSize: 12, color: '#8c8c8c', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Basic Order
            </Text>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <Form.Item name="symbol" label="Symbol" rules={[{ required: true }]}>
              <Input placeholder="AAPL" style={{ textTransform: 'uppercase' }} />
            </Form.Item>
            <Form.Item name="side" label="Side" rules={[{ required: true }]}>
              <Select>
                <Option value="buy">Buy</Option>
                <Option value="sell">Sell</Option>
              </Select>
            </Form.Item>
            <Form.Item name="time_in_force" label="Time in Force">
              <Select>
                {TIME_IN_FORCE_OPTIONS.map(t => (
                  <Option key={t.value} value={t.value}>{t.label}</Option>
                ))}
              </Select>
            </Form.Item>
          </div>

          <Divider style={{ margin: '12px 0' }} />

          {/* ── Amount ── */}
          <div style={{ marginBottom: 4 }}>
            <Text strong style={{ fontSize: 12, color: '#8c8c8c', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Amount
            </Text>
          </div>
          <Form.Item name="amountMode" label="Amount Mode">
            <Radio.Group>
              <Radio.Button value="shares">Shares</Radio.Button>
              <Radio.Button value="dollars">Dollars</Radio.Button>
            </Radio.Group>
          </Form.Item>
          {amountMode === 'shares' ? (
            <Form.Item name="qty" label="Quantity" rules={[{ required: true }]}>
              <InputNumber min={0.0001} step={0.01} style={{ width: '100%' }} placeholder="Shares, e.g. 0.5" />
            </Form.Item>
          ) : (
            <Form.Item name="notional" label="Dollar Amount ($)" rules={[{ required: true }]}>
              <InputNumber min={0.01} step={1} style={{ width: '100%' }} placeholder="Dollar amount" prefix="$" />
            </Form.Item>
          )}

          <Divider style={{ margin: '12px 0' }} />

          {/* ── Order Type ── */}
          <div style={{ marginBottom: 4 }}>
            <Text strong style={{ fontSize: 12, color: '#8c8c8c', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Order Type
            </Text>
          </div>
          <Form.Item name="type" label="Type">
            <Select>
              {ORDER_TYPES.map(t => (
                <Option key={t.value} value={t.value}>{t.label}</Option>
              ))}
            </Select>
          </Form.Item>

          {(orderType === 'limit' || orderType === 'stop_limit') && (
            <Form.Item name="limit_price" label="Limit Price" rules={[{ required: true }]}>
              <InputNumber min={0} step={0.01} style={{ width: '100%' }} prefix="$" />
            </Form.Item>
          )}
          {(orderType === 'stop' || orderType === 'stop_limit') && (
            <Form.Item name="stop_price" label="Stop Price" rules={[{ required: true }]}>
              <InputNumber min={0} step={0.01} style={{ width: '100%' }} prefix="$" />
            </Form.Item>
          )}
          {orderType === 'trailing_stop' && (
            <>
              <Form.Item name="trailMode" label="Trail Type">
                <Radio.Group>
                  <Radio.Button value="price">Trail Price</Radio.Button>
                  <Radio.Button value="percent">Trail Percent</Radio.Button>
                </Radio.Group>
              </Form.Item>
              {trailMode === 'price' ? (
                <Form.Item name="trail_price" label={<span style={{ fontSize: 12, fontWeight: 600 }}>Trail Price ($) <span style={{ color: '#ff4d4f' }}>*</span></span>} rules={[{ required: true }]}>
                  <InputNumber prefix="$" style={{ width: '100%', height: 36 }} min={0.01} step={0.01} />
                </Form.Item>
              ) : (
                <Form.Item name="trail_percent" label={<span style={{ fontSize: 12, fontWeight: 600 }}>Trail Percent (%) <span style={{ color: '#ff4d4f' }}>*</span></span>} rules={[{ required: true }]}>
                  <InputNumber suffix="%" style={{ width: '100%', height: 36 }} min={0.1} step={0.1} />
                </Form.Item>
              )}
            </>
          )}

          <Divider style={{ margin: '12px 0' }} />

          {/* ── Advanced Options ── */}
          <div className="form-section-title">Advanced Options</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Form.Item name="extended_hours" label={<span style={{ fontSize: 12, fontWeight: 600 }}>Extended Hours</span>} valuePropName="checked">
              <Switch />
            </Form.Item>
            <Form.Item name="client_order_id" label={<span style={{ fontSize: 12, fontWeight: 600 }}>Client Order ID (optional)</span>}>
              <Input placeholder="Custom ID" style={{ height: 36 }} />
            </Form.Item>
          </div>

          <Divider style={{ margin: '12px 0' }} />

          {/* ── Risk / Bracket ── */}
          <div className="form-section-title">Risk / Bracket Orders</div>
          <Form.Item name="order_class" label={<span style={{ fontSize: 12, fontWeight: 600 }}>Order Class</span>}>
            <Select style={{ height: 36 }}>
              {ORDER_CLASSES.map(c => <Option key={c.value} value={c.value}>{c.label}</Option>)}
            </Select>
          </Form.Item>

          {orderClass !== 'simple' && (
            <div style={{ background: '#f8f9fb', padding: '16px', borderRadius: 8, marginTop: 8, border: '1px solid #e8e8e8' }}>
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item name="take_profit_limit_price" label={<span style={{ fontSize: 11, fontWeight: 600, color: '#52c41a' }}>Take Profit Limit <span style={{ color: '#ff4d4f' }}>*</span></span>} rules={[{ required: true }]} style={{ marginBottom: 12 }}>
                    <InputNumber prefix="$" style={{ width: '100%', height: 36 }} min={0.01} step={0.01} />
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item name="stop_loss_stop_price" label={<span style={{ fontSize: 11, fontWeight: 600, color: '#ff4d4f' }}>Stop Loss Price <span style={{ color: '#ff4d4f' }}>*</span></span>} rules={[{ required: true }]} style={{ marginBottom: 0 }}>
                    <InputNumber prefix="$" style={{ width: '100%', height: 36 }} min={0.01} step={0.01} />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="stop_loss_limit_price" label={<span style={{ fontSize: 11, fontWeight: 600, color: '#8c8c8c' }}>Stop Limit (Optional)</span>} style={{ marginBottom: 0 }}>
                    <Tooltip title="Optional: if not set, stop loss triggers a market order">
                      <InputNumber prefix="$" style={{ width: '100%', height: 36 }} min={0.01} step={0.01} />
                    </Tooltip>
                  </Form.Item>
                </Col>
              </Row>
            </div>
          )}
        </Form>
      )}

      {/* Footer */}
      <div className="order-ticket-footer">
        <Button onClick={handleCancel} disabled={submitting} style={{ borderRadius: 6, fontWeight: 600 }}>
          {tradeMode === 'real' && realDoubleConfirm ? 'Cancel' : 'Back'}
        </Button>
        <Button
          type="primary"
          danger={previewValues.side === 'sell' || tradeMode === 'real'}
          loading={submitting}
          onClick={handleSubmit}
          icon={tradeMode === 'real' && realDoubleConfirm ? <SafetyOutlined /> : undefined}
          style={{ 
            borderRadius: 6, fontWeight: 700, minWidth: 120,
            background: confirmStep ? (tradeMode === 'real' ? '#ff4d4f' : '#1890ff') : (previewValues.side === 'sell' ? '#faad14' : '#1890ff'),
            borderColor: confirmStep ? (tradeMode === 'real' ? '#ff4d4f' : '#1890ff') : (previewValues.side === 'sell' ? '#faad14' : '#1890ff'),
            color: '#fff'
          }}
        >
          {confirmStep 
            ? (tradeMode === 'real' ? 'Submit LIVE Order' : 'Submit Paper Order')
            : `Review ${previewValues.side === 'buy' ? 'Buy' : 'Sell'}`
          }
        </Button>
      </div>
    </Modal>
  );
};

export default OrderModal;
