import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Button,
  Checkbox,
  Form,
  Input,
  InputNumber,
  Modal,
  Radio,
  Select,
  Switch,
  message,
} from 'antd';
import {
  ArrowLeftOutlined,
  CheckOutlined,
  DownOutlined,
  InfoCircleOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons';
import { tradingAccountAPI } from '../services/api';
import { useTradeMode } from '../contexts/TradeModeContext';
import { useLanguage } from '../contexts/LanguageContext';
import { normalizeMarketSymbol } from '../routes/marketRoutes';
import './OrderModal.css';

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

export interface OrderFormValues {
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

const ORDER_TYPES = ['market', 'limit', 'stop', 'stop_limit', 'trailing_stop'] as const;
const TIME_IN_FORCE_OPTIONS = ['day', 'gtc', 'opg', 'cls', 'ioc', 'fok'] as const;
const ORDER_CLASSES = ['simple', 'bracket', 'oco', 'oto'] as const;
const isPositiveNumber = (value: unknown): boolean => Number.isFinite(Number(value)) && Number(value) > 0;

type OrderErrorCategory = 'session' | 'configuration' | 'rateLimit' | 'timeout' | 'network' | 'generic';

const orderErrorDetail = (value: unknown): string => {
  if (typeof value === 'string') return value.trim();
  if (!value || typeof value !== 'object') return '';
  const record = value as Record<string, any>;
  return orderErrorDetail(
    record.response?.data?.detail
    ?? record.response?.data?.error
    ?? record.response?.data?.message
    ?? record.detail
    ?? record.error
    ?? record.message,
  );
};

const orderErrorCategory = (value: unknown): OrderErrorCategory => {
  const record = value && typeof value === 'object' ? value as Record<string, any> : {};
  const status = Number(record.response?.status ?? record.statusCode ?? record.status);
  const detail = orderErrorDetail(value).toLowerCase();
  if (status === 401 || status === 403 || /session|unauthori[sz]ed|forbidden|auth(?:entication)?|token|sign[ -]?in|login/.test(detail)) return 'session';
  if (status === 429 || /rate.?limit|too many requests|quota/.test(detail)) return 'rateLimit';
  if (status === 408 || /timeout|timed out|deadline|aborted/.test(detail)) return 'timeout';
  if (/network|offline|connection (?:refused|reset)|econn|fetch failed|failed to fetch|dns/.test(detail)) return 'network';
  if (status === 400 || status === 404 || status === 409 || status === 422 || /config|credential|api.?key|not configured|missing|required|invalid|buying power|insufficient/.test(detail)) return 'configuration';
  return 'generic';
};

export const normalizeOrderSymbolInput = (value: unknown): string => (
  String(value ?? '')
    .toUpperCase()
    .replace(/[^A-Z0-9.-]/g, '')
    .slice(0, 15)
);

export interface TradingOrderPayload {
  mode: 'paper' | 'real';
  symbol: string;
  side: 'buy' | 'sell';
  type: string;
  time_in_force: string;
  extended_hours: boolean;
  confirmed: boolean;
  qty?: number;
  notional?: number;
  limit_price?: number;
  stop_price?: number;
  trail_price?: number;
  trail_percent?: number;
  order_class?: string;
  take_profit?: { limit_price: number };
  stop_loss?: { stop_price: number; limit_price?: number };
  client_order_id?: string;
}

export const buildTradingOrderPayload = (
  values: OrderFormValues,
  mode: 'paper' | 'real',
): TradingOrderPayload => {
  const payload: TradingOrderPayload = {
    mode,
    symbol: normalizeMarketSymbol(values.symbol),
    side: values.side,
    type: values.type,
    time_in_force: values.time_in_force,
    extended_hours: Boolean(values.extended_hours),
    confirmed: mode === 'real',
  };

  if (values.amountMode === 'shares' && values.qty !== undefined) payload.qty = values.qty;
  if (values.amountMode === 'dollars' && values.notional !== undefined) payload.notional = values.notional;
  if (values.limit_price !== undefined) payload.limit_price = values.limit_price;
  if (values.stop_price !== undefined) payload.stop_price = values.stop_price;
  if (values.type === 'trailing_stop') {
    if (values.trailMode === 'price' && values.trail_price !== undefined) payload.trail_price = values.trail_price;
    if (values.trailMode === 'percent' && values.trail_percent !== undefined) payload.trail_percent = values.trail_percent;
  }

  if (values.order_class !== 'simple') {
    payload.order_class = values.order_class;
    if (values.take_profit_limit_price !== undefined) {
      payload.take_profit = { limit_price: values.take_profit_limit_price };
    }
    if (values.stop_loss_stop_price !== undefined) {
      payload.stop_loss = { stop_price: values.stop_loss_stop_price };
      if (values.stop_loss_limit_price !== undefined) {
        payload.stop_loss.limit_price = values.stop_loss_limit_price;
      }
    }
  }

  const clientOrderId = values.client_order_id?.trim();
  if (clientOrderId) payload.client_order_id = clientOrderId;
  return payload;
};

const ORDER_MODAL_COPY = {
  'en-US': {
    newOrder: 'New order',
    reviewOrder: 'Review order',
    detailsStep: 'Order details',
    reviewStep: 'Review & submit',
    paperAccount: 'Paper account',
    liveAccount: 'Live account',
    paperNote: 'No real funds are used. Review the order before sending it to Alpaca Paper.',
    liveNote: 'This order uses your live Alpaca account. A deliberate confirmation is required before submission.',
    symbol: 'Symbol',
    symbolPlaceholder: 'AAPL',
    side: 'Direction',
    buy: 'Buy',
    sell: 'Sell',
    orderSize: 'Order size',
    amountMode: 'Enter by',
    shares: 'Shares',
    dollars: 'Dollar value',
    quantity: 'Quantity',
    quantityPlaceholder: 'e.g. 10 or 0.5',
    dollarAmount: 'Dollar amount',
    orderSetup: 'Execution',
    orderType: 'Order type',
    market: 'Market',
    limit: 'Limit',
    stop: 'Stop',
    stopLimit: 'Stop limit',
    trailingStop: 'Trailing stop',
    marketHelp: 'Executes at the best available price.',
    limitHelp: 'Executes only at your limit price or better.',
    stopHelp: 'Becomes a market order after the stop price is reached.',
    stopLimitHelp: 'Becomes a limit order after the stop price is reached.',
    trailingStopHelp: 'The stop follows favorable price movement by a fixed distance.',
    timeInForce: 'Time in force',
    day: 'Day',
    gtc: 'Good till canceled',
    opg: 'Market open',
    cls: 'Market close',
    ioc: 'Immediate or cancel',
    fok: 'Fill or kill',
    limitPrice: 'Limit price',
    stopPrice: 'Stop price',
    trailType: 'Trailing distance',
    trailPrice: 'Price distance',
    trailPercent: 'Percent distance',
    optionalSettings: 'Advanced settings',
    optionalSettingsHint: 'Extended hours, linked exits and order identifiers',
    extendedHours: 'Extended-hours session',
    extendedHoursHint: 'Requires a Day limit order.',
    clientOrderId: 'Client order ID',
    clientIdPlaceholder: 'Optional reference',
    orderClass: 'Linked order',
    simple: 'No linked exits',
    bracket: 'Take profit + stop loss',
    oco: 'One cancels the other',
    oto: 'One triggers the other',
    takeProfit: 'Take-profit limit',
    stopLoss: 'Stop-loss trigger',
    stopLimitOptional: 'Stop-loss limit (optional)',
    stopLimitNote: 'Leave blank to trigger a market stop-loss order.',
    cancel: 'Cancel',
    back: 'Edit order',
    reviewAction: 'Review {side}',
    submitPaper: 'Place paper {side}',
    submitLive: 'Place live {side}',
    orderSummary: 'Order summary',
    account: 'Account',
    action: 'Action',
    amount: 'Amount',
    estimatedValue: 'Estimated value',
    calculatedAtFill: 'Calculated at fill',
    linkedExits: 'Linked exits',
    extendedHoursValue: 'Extended hours',
    yes: 'Yes',
    liveReviewTitle: 'Live-order confirmation',
    liveReviewText: 'I have reviewed the symbol, direction, size and prices. I understand this submits an order using real funds.',
    paperReviewTitle: 'Ready for paper execution',
    paperReviewText: 'This order will be sent to your Alpaca Paper account for simulated execution.',
    requiredConfirmation: 'Confirm that you understand this is a live order before submitting.',
    reviewModeChanged: 'The trading account changed. Review the order again before submitting.',
    success: '{side} order for {symbol} was submitted.',
    symbolRequired: 'Enter a symbol.',
    symbolInvalid: 'Enter a valid symbol using letters, numbers, a period, or a hyphen.',
    sideRequired: 'Choose Buy or Sell.',
    qtyRequired: 'Quantity must be greater than zero.',
    dollarsRequired: 'Dollar amount must be greater than zero.',
    limitRequired: 'Enter a limit price for this order type.',
    stopRequired: 'Enter a stop price for this order type.',
    trailRequired: 'Enter a trailing price or percentage.',
    extendedLimitOnly: 'Extended hours supports limit orders only.',
    extendedDayOnly: 'Extended hours requires Day time in force.',
    linkedPricesRequired: 'Enter both take-profit and stop-loss prices for this linked order.',
    submissionFailed: 'Order submission failed.',
    sessionError: 'Your session is no longer valid. Sign in again, then rebuild the order.',
    configurationError: 'The order or broker configuration is incomplete or invalid.',
    rateLimitError: 'The broker is rate limiting requests. Wait a moment, then retry.',
    timeoutError: 'The order request timed out. Check order status before trying again.',
    networkError: 'The broker service could not be reached. Check the network and connection status.',
    confirmationRequiredAgain: 'The live-order confirmation expired. Review the order again before submitting.',
    errorDetail: 'Detail',
  },
  'zh-CN': {
    newOrder: '新建订单',
    reviewOrder: '核对订单',
    detailsStep: '填写订单',
    reviewStep: '核对并提交',
    paperAccount: '模拟账户',
    liveAccount: '实盘账户',
    paperNote: '不会使用真实资金。订单核对后将发送至 Alpaca 模拟账户。',
    liveNote: '此订单使用您的 Alpaca 实盘账户，提交前必须主动确认风险。',
    symbol: '股票代码',
    symbolPlaceholder: '例如 AAPL',
    side: '交易方向',
    buy: '买入',
    sell: '卖出',
    orderSize: '订单规模',
    amountMode: '输入方式',
    shares: '股数',
    dollars: '金额',
    quantity: '数量',
    quantityPlaceholder: '例如 10 或 0.5',
    dollarAmount: '订单金额',
    orderSetup: '执行方式',
    orderType: '订单类型',
    market: '市价单',
    limit: '限价单',
    stop: '止损单',
    stopLimit: '止损限价单',
    trailingStop: '移动止损单',
    marketHelp: '按市场当前可获得的最优价格成交。',
    limitHelp: '仅在指定价格或更优价格成交。',
    stopHelp: '触及止损价后转为市价单。',
    stopLimitHelp: '触及止损价后转为限价单。',
    trailingStopHelp: '止损价会按固定距离跟随有利的价格变化。',
    timeInForce: '有效期',
    day: '当日有效',
    gtc: '撤销前有效',
    opg: '开盘时执行',
    cls: '收盘时执行',
    ioc: '立即成交或取消',
    fok: '全部成交或取消',
    limitPrice: '限价',
    stopPrice: '触发价',
    trailType: '跟踪距离',
    trailPrice: '按价格',
    trailPercent: '按百分比',
    optionalSettings: '高级设置',
    optionalSettingsHint: '盘前盘后、关联止盈止损和订单标识',
    extendedHours: '允许盘前盘后交易',
    extendedHoursHint: '仅支持当日有效的限价单。',
    clientOrderId: '自定义订单 ID',
    clientIdPlaceholder: '选填，用于内部追踪',
    orderClass: '关联订单',
    simple: '不关联退出订单',
    bracket: '止盈 + 止损',
    oco: '一个成交后取消另一个',
    oto: '一个成交后触发另一个',
    takeProfit: '止盈限价',
    stopLoss: '止损触发价',
    stopLimitOptional: '止损限价（选填）',
    stopLimitNote: '留空时，触发止损后将使用市价单。',
    cancel: '取消',
    back: '返回修改',
    reviewAction: '核对{side}订单',
    submitPaper: '提交模拟{side}订单',
    submitLive: '提交实盘{side}订单',
    orderSummary: '订单摘要',
    account: '账户',
    action: '操作',
    amount: '数量 / 金额',
    estimatedValue: '预计金额',
    calculatedAtFill: '成交时计算',
    linkedExits: '关联退出',
    extendedHoursValue: '盘前盘后',
    yes: '是',
    liveReviewTitle: '实盘订单确认',
    liveReviewText: '我已核对股票代码、交易方向、数量和价格，并了解该操作将使用真实资金提交订单。',
    paperReviewTitle: '准备模拟执行',
    paperReviewText: '此订单将发送到 Alpaca 模拟账户，不会使用真实资金。',
    requiredConfirmation: '请先确认您了解这是实盘订单。',
    reviewModeChanged: '交易账户已切换，请重新核对订单后再提交。',
    success: '{symbol} 的{side}订单已提交。',
    symbolRequired: '请输入股票代码。',
    symbolInvalid: '请输入有效的股票代码，仅可使用字母、数字、小数点或连字符。',
    sideRequired: '请选择买入或卖出。',
    qtyRequired: '数量必须大于 0。',
    dollarsRequired: '订单金额必须大于 0。',
    limitRequired: '此订单类型需要填写限价。',
    stopRequired: '此订单类型需要填写触发价。',
    trailRequired: '请填写移动止损价格或百分比。',
    extendedLimitOnly: '盘前盘后交易仅支持限价单。',
    extendedDayOnly: '盘前盘后交易必须选择当日有效。',
    linkedPricesRequired: '关联订单必须同时填写止盈价和止损价。',
    submissionFailed: '订单提交失败。',
    sessionError: '登录会话已失效，请重新登录后再填写订单。',
    configurationError: '订单内容或券商配置不完整，请检查后重试。',
    rateLimitError: '券商请求过于频繁，请稍等片刻后重试。',
    timeoutError: '订单请求等待超时，请先检查订单状态，再决定是否重试。',
    networkError: '暂时无法连接券商服务，请检查网络和连接状态。',
    confirmationRequiredAgain: '实盘确认已失效，请重新核对订单后再提交。',
    errorDetail: '详情',
  },
} as const;

const OrderModal: React.FC<OrderModalProps> = ({
  visible,
  onClose,
  onSuccess,
  preset,
}) => {
  const { tradeMode } = useTradeMode();
  const { language } = useLanguage();
  const copy = ORDER_MODAL_COPY[language];
  const formatOrderError = (value: unknown): string => {
    const friendly = {
      session: copy.sessionError,
      configuration: copy.configurationError,
      rateLimit: copy.rateLimitError,
      timeout: copy.timeoutError,
      network: copy.networkError,
      generic: copy.submissionFailed,
    }[orderErrorCategory(value)];
    const detail = orderErrorDetail(value);
    if (language === 'zh-CN' || !detail || detail === friendly) return friendly;
    return `${friendly} ${copy.errorDetail}: ${detail}`;
  };
  const [form] = Form.useForm<OrderFormValues>();
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const [confirmStep, setConfirmStep] = useState(false);
  const [realFinalConfirm, setRealFinalConfirm] = useState(false);
  const [reviewMode, setReviewMode] = useState<'paper' | 'real' | null>(null);
  const [reviewValues, setReviewValues] = useState<OrderFormValues | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const orderType = Form.useWatch('type', form) || 'market';
  const orderClass = Form.useWatch('order_class', form) || 'simple';
  const amountMode = Form.useWatch('amountMode', form) || 'shares';
  const trailMode = Form.useWatch('trailMode', form) || 'price';
  const watchedSymbol = Form.useWatch('symbol', form);
  const watchedSide = Form.useWatch('side', form) || 'buy';
  const watchedQty = Form.useWatch('qty', form);
  const watchedNotional = Form.useWatch('notional', form);
  const watchedLimitPrice = Form.useWatch('limit_price', form);
  const watchedStopPrice = Form.useWatch('stop_price', form);
  const watchedTrailPrice = Form.useWatch('trail_price', form);
  const watchedTrailPercent = Form.useWatch('trail_percent', form);
  const watchedTimeInForce = Form.useWatch('time_in_force', form) || 'day';
  const watchedExtendedHours = Form.useWatch('extended_hours', form) || false;
  const watchedTakeProfitPrice = Form.useWatch('take_profit_limit_price', form);
  const watchedStopLossPrice = Form.useWatch('stop_loss_stop_price', form);

  useEffect(() => {
    if (!visible) return;

    const hasPresetLimit = Number.isFinite(preset?.limitPrice) && Number(preset?.limitPrice) > 0;
    const hasLinkedExits = Number.isFinite(preset?.takeProfitPrice)
      && Number(preset?.takeProfitPrice) > 0
      && Number.isFinite(preset?.stopLossPrice)
      && Number(preset?.stopLossPrice) > 0;

    form.resetFields();
    setConfirmStep(false);
    setRealFinalConfirm(false);
    setReviewMode(null);
    setReviewValues(null);
    setAdvancedOpen(hasLinkedExits);
    setError(null);
    form.setFieldsValue({
      symbol: preset?.symbol || '',
      side: preset?.side || 'buy',
      amountMode: 'shares',
      qty: preset?.qty || undefined,
      notional: undefined,
      type: hasPresetLimit ? 'limit' : 'market',
      time_in_force: 'day',
      trailMode: 'price',
      extended_hours: false,
      order_class: hasLinkedExits ? 'bracket' : 'simple',
      limit_price: preset?.limitPrice || undefined,
      stop_price: undefined,
      trail_price: undefined,
      trail_percent: undefined,
      take_profit_limit_price: preset?.takeProfitPrice || undefined,
      stop_loss_stop_price: preset?.stopLossPrice || undefined,
      stop_loss_limit_price: undefined,
      client_order_id: undefined,
    });
  }, [
    form,
    preset?.limitPrice,
    preset?.qty,
    preset?.side,
    preset?.stopLossPrice,
    preset?.symbol,
    preset?.takeProfitPrice,
    visible,
  ]);

  useEffect(() => {
    setConfirmStep(false);
    setRealFinalConfirm(false);
    setReviewMode(null);
    setReviewValues(null);
    setError(null);
  }, [tradeMode]);

  useEffect(() => {
    if (orderClass !== 'simple') setAdvancedOpen(true);
  }, [orderClass]);

  const isFormValid = useMemo(() => {
    const symbol = watchedSymbol?.trim();
    if (!symbol || !normalizeMarketSymbol(symbol) || !watchedSide) return false;
    if (amountMode === 'shares' && !isPositiveNumber(watchedQty)) return false;
    if (amountMode === 'dollars' && !isPositiveNumber(watchedNotional)) return false;
    if ((orderType === 'limit' || orderType === 'stop_limit') && !isPositiveNumber(watchedLimitPrice)) return false;
    if ((orderType === 'stop' || orderType === 'stop_limit') && !isPositiveNumber(watchedStopPrice)) return false;
    if (orderType === 'trailing_stop') {
      if (trailMode === 'price' && !isPositiveNumber(watchedTrailPrice)) return false;
      if (trailMode === 'percent' && !isPositiveNumber(watchedTrailPercent)) return false;
    }
    if (watchedExtendedHours && (orderType !== 'limit' || watchedTimeInForce !== 'day')) return false;
    if (orderClass !== 'simple') {
      if (!isPositiveNumber(watchedTakeProfitPrice) || !isPositiveNumber(watchedStopLossPrice)) return false;
    }
    return true;
  }, [
    amountMode,
    orderClass,
    orderType,
    trailMode,
    watchedExtendedHours,
    watchedLimitPrice,
    watchedNotional,
    watchedQty,
    watchedSide,
    watchedStopLossPrice,
    watchedStopPrice,
    watchedSymbol,
    watchedTakeProfitPrice,
    watchedTimeInForce,
    watchedTrailPercent,
    watchedTrailPrice,
  ]);

  const validate = (candidateValues?: OrderFormValues): string | null => {
    const values = candidateValues ?? form.getFieldsValue(true);
    if (!values.symbol?.trim()) return copy.symbolRequired;
    if (!normalizeMarketSymbol(values.symbol)) return copy.symbolInvalid;
    if (!values.side) return copy.sideRequired;
    if (values.amountMode === 'shares' && !isPositiveNumber(values.qty)) return copy.qtyRequired;
    if (values.amountMode === 'dollars' && !isPositiveNumber(values.notional)) return copy.dollarsRequired;
    if ((values.type === 'limit' || values.type === 'stop_limit') && !isPositiveNumber(values.limit_price)) return copy.limitRequired;
    if ((values.type === 'stop' || values.type === 'stop_limit') && !isPositiveNumber(values.stop_price)) return copy.stopRequired;
    if (values.type === 'trailing_stop') {
      if (values.trailMode === 'price' && !isPositiveNumber(values.trail_price)) return copy.trailRequired;
      if (values.trailMode === 'percent' && !isPositiveNumber(values.trail_percent)) return copy.trailRequired;
    }
    if (values.extended_hours) {
      if (values.type !== 'limit') return copy.extendedLimitOnly;
      if (values.time_in_force !== 'day') return copy.extendedDayOnly;
    }
    if (['bracket', 'oco', 'oto'].includes(values.order_class)) {
      if (!isPositiveNumber(values.take_profit_limit_price) || !isPositiveNumber(values.stop_loss_stop_price)) {
        return copy.linkedPricesRequired;
      }
    }
    return null;
  };

  const orderTypeLabel = (value?: string) => ({
    market: copy.market,
    limit: copy.limit,
    stop: copy.stop,
    stop_limit: copy.stopLimit,
    trailing_stop: copy.trailingStop,
  }[value || ''] || value || '—');

  const timeInForceLabel = (value?: string) => ({
    day: copy.day,
    gtc: copy.gtc,
    opg: copy.opg,
    cls: copy.cls,
    ioc: copy.ioc,
    fok: copy.fok,
  }[value || ''] || value?.toUpperCase() || '—');

  const orderClassLabel = (value?: string) => ({
    simple: copy.simple,
    bracket: copy.bracket,
    oco: copy.oco,
    oto: copy.oto,
  }[value || ''] || value || '—');

  const orderTypeHelp = ({
    market: copy.marketHelp,
    limit: copy.limitHelp,
    stop: copy.stopHelp,
    stop_limit: copy.stopLimitHelp,
    trailing_stop: copy.trailingStopHelp,
  } as Record<string, string>)[orderType];

  const handleReviewClick = () => {
    if (submittingRef.current) return;
    const values = form.getFieldsValue(true);
    const normalizedSymbol = normalizeMarketSymbol(values.symbol);
    const normalizedValues = { ...values, symbol: normalizedSymbol || values.symbol?.trim() };
    const validationError = validate(normalizedValues);
    if (validationError) {
      setError(validationError);
      return;
    }
    form.setFieldValue('symbol', normalizedSymbol);
    setConfirmStep(true);
    setRealFinalConfirm(false);
    setReviewMode(tradeMode);
    setReviewValues(normalizedValues);
    setError(null);
  };

  const handleSubmit = async () => {
    if (submittingRef.current) return;
    if (!confirmStep || reviewMode !== tradeMode || !reviewValues) {
      setConfirmStep(false);
      setRealFinalConfirm(false);
      setReviewMode(null);
      setReviewValues(null);
      setError(copy.reviewModeChanged);
      return;
    }
    const validationError = validate(reviewValues);
    if (validationError) {
      setError(validationError);
      return;
    }
    if (tradeMode === 'real' && !realFinalConfirm) {
      setError(copy.requiredConfirmation);
      return;
    }

    const values = reviewValues;
    const submissionMode = reviewMode;
    submittingRef.current = true;
    setSubmitting(true);
    setError(null);

    try {
      const payload = buildTradingOrderPayload(values, submissionMode);
      const response = await tradingAccountAPI.placeOrder(payload);
      if (response.data.success) {
        const successText = copy.success
          .replace('{side}', values.side === 'buy' ? copy.buy : copy.sell)
          .replace('{symbol}', values.symbol.trim().toUpperCase());
        message.success(successText);
        onSuccess();
        onClose();
      } else {
        const errorMessage = response.data.status === 'confirmation_required'
          ? copy.confirmationRequiredAgain
          : formatOrderError(response.data);
        setError(errorMessage);
        message.error(errorMessage);
        if (response.data.status === 'confirmation_required') {
          setConfirmStep(false);
          setRealFinalConfirm(false);
          setReviewMode(null);
          setReviewValues(null);
        }
      }
    } catch (submissionError: any) {
      const errorMessage = formatOrderError(submissionError);
      setError(errorMessage);
      message.error(errorMessage);
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  const resetReview = () => {
    setConfirmStep(false);
    setRealFinalConfirm(false);
    setReviewMode(null);
    setReviewValues(null);
    setError(null);
  };

  const handleBack = () => {
    if (submittingRef.current) return;
    resetReview();
  };

  const handleModalClose = () => {
    if (submittingRef.current) return;
    resetReview();
    onClose();
  };

  const showingReview = confirmStep && reviewMode === tradeMode && Boolean(reviewValues);
  const previewValues = showingReview && reviewValues ? reviewValues : form.getFieldsValue(true);
  const previewSide = previewValues.side || watchedSide;
  const sideLabel = previewSide === 'sell' ? copy.sell : copy.buy;
  const previewAmountMode = previewValues.amountMode || amountMode;
  const orderAmount = previewAmountMode === 'shares'
    ? `${Number(previewValues.qty || 0).toLocaleString()} ${copy.shares.toLowerCase()}`
    : `$${Number(previewValues.notional || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
  const estimatedValue = previewAmountMode === 'dollars' && isPositiveNumber(previewValues.notional)
    ? Number(previewValues.notional)
    : previewAmountMode === 'shares'
      && isPositiveNumber(previewValues.qty)
      && isPositiveNumber(previewValues.limit_price)
      ? Number(previewValues.qty) * Number(previewValues.limit_price)
      : null;

  return (
    <Modal
      title={(
        <div className="order-modal__heading">
          <div>
            <span className="order-modal__eyebrow">{showingReview ? copy.reviewStep : copy.detailsStep}</span>
            <strong>{showingReview ? copy.reviewOrder : copy.newOrder}</strong>
          </div>
          <span className={`order-modal__mode-pill order-modal__mode-pill--${tradeMode}`}>
            <i aria-hidden="true" />
            {tradeMode === 'real' ? copy.liveAccount : copy.paperAccount}
          </span>
        </div>
      )}
      open={visible}
      onCancel={handleModalClose}
      width={720}
      footer={null}
      destroyOnHidden
      maskClosable={false}
      closable={!submitting}
      keyboard={!submitting}
      centered
      className={`order-modal order-modal--${tradeMode}`}
    >
      <div className="order-modal__steps" aria-label={`${copy.detailsStep}, ${copy.reviewStep}`}>
        <div className={`order-modal__step ${showingReview ? 'is-complete' : 'is-active'}`}>
          <span>{showingReview ? <CheckOutlined /> : '1'}</span>
          <b>{copy.detailsStep}</b>
        </div>
        <div className="order-modal__step-line" />
        <div className={`order-modal__step ${showingReview ? 'is-active' : ''}`}>
          <span>2</span>
          <b>{copy.reviewStep}</b>
        </div>
      </div>

      <div className={`order-modal__account-note ${tradeMode === 'real' ? 'is-live' : 'is-paper'}`}>
        {tradeMode === 'real' ? <SafetyCertificateOutlined /> : <InfoCircleOutlined />}
        <span>{tradeMode === 'real' ? copy.liveNote : copy.paperNote}</span>
      </div>

      {error && (
        <Alert
          message={error}
          type="error"
          showIcon
          closable
          onClose={() => setError(null)}
          className="order-modal__error"
        />
      )}

      {showingReview ? (
        <div className="order-modal__review">
          <section className="order-modal__review-hero">
            <div>
              <span className={`order-modal__side-chip is-${previewSide}`}>{sideLabel}</span>
              <h3>{previewValues.symbol?.trim().toUpperCase()}</h3>
              <p>{orderAmount}</p>
            </div>
            <div className="order-modal__review-estimate">
              <span>{copy.estimatedValue}</span>
              <strong>
                {estimatedValue
                  ? `$${estimatedValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                  : copy.calculatedAtFill}
              </strong>
            </div>
          </section>

          <section className="order-modal__summary" aria-label={copy.orderSummary}>
            <h4>{copy.orderSummary}</h4>
            <dl>
              <div><dt>{copy.account}</dt><dd>{tradeMode === 'real' ? copy.liveAccount : copy.paperAccount}</dd></div>
              <div><dt>{copy.action}</dt><dd className={`is-${previewSide}`}>{sideLabel}</dd></div>
              <div><dt>{copy.amount}</dt><dd>{orderAmount}</dd></div>
              <div><dt>{copy.orderType}</dt><dd>{orderTypeLabel(previewValues.type)}</dd></div>
              <div><dt>{copy.timeInForce}</dt><dd>{timeInForceLabel(previewValues.time_in_force)}</dd></div>
              {previewValues.limit_price && (
                <div><dt>{copy.limitPrice}</dt><dd>${Number(previewValues.limit_price).toFixed(2)}</dd></div>
              )}
              {previewValues.stop_price && (
                <div><dt>{copy.stopPrice}</dt><dd>${Number(previewValues.stop_price).toFixed(2)}</dd></div>
              )}
              {previewValues.type === 'trailing_stop' && previewValues.trail_price && (
                <div><dt>{copy.trailPrice}</dt><dd>${Number(previewValues.trail_price).toFixed(2)}</dd></div>
              )}
              {previewValues.type === 'trailing_stop' && previewValues.trail_percent && (
                <div><dt>{copy.trailPercent}</dt><dd>{previewValues.trail_percent}%</dd></div>
              )}
              {previewValues.order_class !== 'simple' && (
                <div><dt>{copy.linkedExits}</dt><dd>{orderClassLabel(previewValues.order_class)}</dd></div>
              )}
              {previewValues.take_profit_limit_price && (
                <div><dt>{copy.takeProfit}</dt><dd className="is-positive">${Number(previewValues.take_profit_limit_price).toFixed(2)}</dd></div>
              )}
              {previewValues.stop_loss_stop_price && (
                <div><dt>{copy.stopLoss}</dt><dd>${Number(previewValues.stop_loss_stop_price).toFixed(2)}</dd></div>
              )}
              {previewValues.extended_hours && (
                <div><dt>{copy.extendedHoursValue}</dt><dd>{copy.yes}</dd></div>
              )}
            </dl>
          </section>

          {tradeMode === 'real' ? (
            <label className={`order-modal__live-confirm ${realFinalConfirm ? 'is-checked' : ''}`}>
              <Checkbox
                checked={realFinalConfirm}
                disabled={submitting}
                onChange={(event) => {
                  setRealFinalConfirm(event.target.checked);
                  if (event.target.checked) setError(null);
                }}
              />
              <span>
                <b>{copy.liveReviewTitle}</b>
                <small>{copy.liveReviewText}</small>
              </span>
            </label>
          ) : (
            <div className="order-modal__paper-confirm">
              <CheckOutlined />
              <span><b>{copy.paperReviewTitle}</b><small>{copy.paperReviewText}</small></span>
            </div>
          )}

          <div className="order-modal__footer">
            <Button
              icon={<ArrowLeftOutlined />}
              onClick={handleBack}
              disabled={submitting}
              className="order-modal__secondary"
            >
              {copy.back}
            </Button>
            <Button
              type="primary"
              loading={submitting}
              disabled={submitting || (tradeMode === 'real' && !realFinalConfirm)}
              onClick={handleSubmit}
              className={`order-modal__primary is-${previewSide}`}
            >
              {(tradeMode === 'real' ? copy.submitLive : copy.submitPaper).replace('{side}', sideLabel)}
            </Button>
          </div>
        </div>
      ) : (
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
          className="order-modal__form"
        >
          <section className="order-modal__section">
            <div className="order-modal__section-title"><span>01</span><h4>{copy.detailsStep}</h4></div>
            <div className="order-modal__identity-grid">
              <Form.Item name="side" label={copy.side} rules={[{ required: true }]}>
                <Radio.Group className="order-modal__side-toggle" buttonStyle="solid">
                  <Radio.Button value="buy" className="is-buy">{copy.buy}</Radio.Button>
                  <Radio.Button value="sell" className="is-sell">{copy.sell}</Radio.Button>
                </Radio.Group>
              </Form.Item>
              <Form.Item
                name="symbol"
                label={copy.symbol}
                normalize={normalizeOrderSymbolInput}
                rules={[
                  { required: true, message: copy.symbolRequired },
                  {
                    validator: (_, value) => (
                      !value || normalizeMarketSymbol(value)
                        ? Promise.resolve()
                        : Promise.reject(new Error(copy.symbolInvalid))
                    ),
                  },
                ]}
              >
                <Input
                  placeholder={copy.symbolPlaceholder}
                  autoComplete="off"
                  spellCheck={false}
                  maxLength={15}
                />
              </Form.Item>
            </div>
          </section>

          <section className="order-modal__section">
            <div className="order-modal__section-title"><span>02</span><h4>{copy.orderSize}</h4></div>
            <div className="order-modal__amount-grid">
              <Form.Item name="amountMode" label={copy.amountMode}>
                <Radio.Group className="order-modal__amount-toggle">
                  <Radio.Button value="shares">{copy.shares}</Radio.Button>
                  <Radio.Button value="dollars">{copy.dollars}</Radio.Button>
                </Radio.Group>
              </Form.Item>
              {amountMode === 'shares' ? (
                <Form.Item name="qty" label={copy.quantity} rules={[{ required: true, message: copy.qtyRequired }]}>
                  <InputNumber min={0.0001} step={0.01} placeholder={copy.quantityPlaceholder} />
                </Form.Item>
              ) : (
                <Form.Item name="notional" label={copy.dollarAmount} rules={[{ required: true, message: copy.dollarsRequired }]}>
                  <InputNumber min={0.01} step={1} placeholder="0.00" prefix="$" />
                </Form.Item>
              )}
            </div>
          </section>

          <section className="order-modal__section">
            <div className="order-modal__section-title"><span>03</span><h4>{copy.orderSetup}</h4></div>
            <div className="order-modal__execution-grid">
              <Form.Item name="type" label={copy.orderType}>
                <Select options={ORDER_TYPES.map((value) => ({ value, label: orderTypeLabel(value) }))} />
              </Form.Item>
              <Form.Item name="time_in_force" label={copy.timeInForce}>
                <Select options={TIME_IN_FORCE_OPTIONS.map((value) => ({ value, label: timeInForceLabel(value) }))} />
              </Form.Item>
            </div>
            <p className="order-modal__field-help"><InfoCircleOutlined />{orderTypeHelp}</p>

            {(orderType === 'limit' || orderType === 'stop_limit' || orderType === 'stop') && (
              <div className="order-modal__price-grid">
                {(orderType === 'limit' || orderType === 'stop_limit') && (
                  <Form.Item name="limit_price" label={copy.limitPrice} rules={[{ required: true, message: copy.limitRequired }]}>
                    <InputNumber min={0.01} step={0.01} prefix="$" />
                  </Form.Item>
                )}
                {(orderType === 'stop' || orderType === 'stop_limit') && (
                  <Form.Item name="stop_price" label={copy.stopPrice} rules={[{ required: true, message: copy.stopRequired }]}>
                    <InputNumber min={0.01} step={0.01} prefix="$" />
                  </Form.Item>
                )}
              </div>
            )}

            {orderType === 'trailing_stop' && (
              <div className="order-modal__price-grid">
                <Form.Item name="trailMode" label={copy.trailType}>
                  <Radio.Group className="order-modal__amount-toggle">
                    <Radio.Button value="price">{copy.trailPrice}</Radio.Button>
                    <Radio.Button value="percent">{copy.trailPercent}</Radio.Button>
                  </Radio.Group>
                </Form.Item>
                {trailMode === 'price' ? (
                  <Form.Item name="trail_price" label={copy.trailPrice} rules={[{ required: true, message: copy.trailRequired }]}>
                    <InputNumber prefix="$" min={0.01} step={0.01} />
                  </Form.Item>
                ) : (
                  <Form.Item name="trail_percent" label={copy.trailPercent} rules={[{ required: true, message: copy.trailRequired }]}>
                    <InputNumber suffix="%" min={0.1} step={0.1} />
                  </Form.Item>
                )}
              </div>
            )}
          </section>

          <section className="order-modal__advanced-shell">
            <button
              type="button"
              className="order-modal__advanced-trigger"
              onClick={() => setAdvancedOpen((open) => !open)}
              aria-expanded={advancedOpen}
            >
              <span><b>{copy.optionalSettings}</b><small>{copy.optionalSettingsHint}</small></span>
              <DownOutlined className={advancedOpen ? 'is-open' : ''} />
            </button>

            {advancedOpen && (
              <div className="order-modal__advanced-panel">
                <div className="order-modal__switch-row">
                  <div><b>{copy.extendedHours}</b><small>{copy.extendedHoursHint}</small></div>
                  <Form.Item name="extended_hours" valuePropName="checked" noStyle><Switch /></Form.Item>
                </div>

                <div className="order-modal__advanced-grid">
                  <Form.Item name="order_class" label={copy.orderClass}>
                    <Select options={ORDER_CLASSES.map((value) => ({ value, label: orderClassLabel(value) }))} />
                  </Form.Item>
                  <Form.Item name="client_order_id" label={copy.clientOrderId}>
                    <Input placeholder={copy.clientIdPlaceholder} />
                  </Form.Item>
                </div>

                {orderClass !== 'simple' && (
                  <div className="order-modal__linked-orders">
                    <Form.Item name="take_profit_limit_price" label={copy.takeProfit} rules={[{ required: true, message: copy.linkedPricesRequired }]}>
                      <InputNumber prefix="$" min={0.01} step={0.01} />
                    </Form.Item>
                    <Form.Item name="stop_loss_stop_price" label={copy.stopLoss} rules={[{ required: true, message: copy.linkedPricesRequired }]}>
                      <InputNumber prefix="$" min={0.01} step={0.01} />
                    </Form.Item>
                    <Form.Item name="stop_loss_limit_price" label={copy.stopLimitOptional}>
                      <InputNumber prefix="$" min={0.01} step={0.01} />
                    </Form.Item>
                    <p>{copy.stopLimitNote}</p>
                  </div>
                )}
              </div>
            )}
          </section>

          <div className="order-modal__footer">
            <Button onClick={handleModalClose} disabled={submitting} className="order-modal__secondary">
              {copy.cancel}
            </Button>
            <Button
              type="primary"
              disabled={submitting || !isFormValid}
              onClick={handleReviewClick}
              className={`order-modal__primary is-${watchedSide}`}
            >
              {copy.reviewAction.replace('{side}', sideLabel)}
            </Button>
          </div>
        </Form>
      )}
    </Modal>
  );
};

export default OrderModal;
