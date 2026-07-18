import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Input, InputNumber, Radio, Select, Switch, message } from 'antd';
import {
  BarChartOutlined,
  BellOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  DashboardOutlined,
  GlobalOutlined,
  LineChartOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
  SaveOutlined,
  StockOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { useTradeMode } from '../contexts/TradeModeContext';
import {
  useWorkspacePreferences,
} from '../contexts/WorkspacePreferencesContext';
import { WorkspacePreferences } from '../services/api';

type SectionKey = 'general' | 'trading' | 'risk' | 'research' | 'charts' | 'notifications' | 'security';

const clonePreferences = (value: WorkspacePreferences): WorkspacePreferences => JSON.parse(JSON.stringify(value));
const splitList = (value: string): string[] => value.split(/[\n,]/).map((item) => item.trim()).filter(Boolean);

const SettingsPreferencesPanel: React.FC = () => {
  const { language, setLanguage } = useLanguage();
  const { setThemeMode } = useTheme();
  const { setTradeMode } = useTradeMode();
  const { preferences, loading, saving, error, save, reset } = useWorkspacePreferences();
  const isZh = language === 'zh-CN';
  const [active, setActive] = useState<SectionKey>('general');
  const [draft, setDraft] = useState<WorkspacePreferences>(() => clonePreferences(preferences));
  const [draftLanguage, setDraftLanguage] = useState<'en-US' | 'zh-CN'>(language);
  const [lastSavedAt, setLastSavedAt] = useState('');

  useEffect(() => {
    setDraft(clonePreferences(preferences));
    setDraftLanguage(preferences.language === 'zh-CN' ? 'zh-CN' : language);
    setLastSavedAt(preferences.updatedAt || '');
  }, [language, preferences]);

  const dirty = useMemo(() => (
    JSON.stringify(draft.general) !== JSON.stringify(preferences.general)
    || JSON.stringify(draft.trading) !== JSON.stringify(preferences.trading)
    || JSON.stringify(draft.risk) !== JSON.stringify(preferences.risk)
    || JSON.stringify(draft.research) !== JSON.stringify(preferences.research)
    || JSON.stringify(draft.charts) !== JSON.stringify(preferences.charts)
    || JSON.stringify(draft.notifications) !== JSON.stringify(preferences.notifications)
    || JSON.stringify(draft.security) !== JSON.stringify(preferences.security)
    || draft.tradeMode !== preferences.tradeMode
    || draftLanguage !== (preferences.language || language)
  ), [draft, draftLanguage, language, preferences]);

  const copy = isZh ? {
    title: '用户偏好与交易默认值', subtitle: '账户级默认设置会跨设备同步，并被扫描、图表、订单和提醒使用。',
    save: '保存全部更改', saving: '正在同步', saved: '已同步', unsaved: '有未保存更改', reset: '恢复默认',
    resetConfirm: '所有用户偏好已恢复为安全默认值。', saveSuccess: '设置已保存并同步到账户。', saveError: '设置无法保存，请检查连接后重试。',
    general: '通用与显示', trading: '交易默认值', risk: '风险与保护', research: '研究与扫描', charts: '图表与数据', notifications: '通知', security: '安全与会话',
  } : {
    title: 'User preferences & trading defaults', subtitle: 'Account defaults sync across devices and drive scanning, charts, orders, and alerts.',
    save: 'Save all changes', saving: 'Syncing', saved: 'Synced', unsaved: 'Unsaved changes', reset: 'Restore defaults',
    resetConfirm: 'All preferences were restored to safe defaults.', saveSuccess: 'Settings saved and synchronized to your account.', saveError: 'Settings could not be saved. Check the connection and try again.',
    general: 'General & display', trading: 'Trading defaults', risk: 'Risk & protection', research: 'Research & scanning', charts: 'Charts & data', notifications: 'Notifications', security: 'Security & sessions',
  };

  const nav = [
    ['general', <GlobalOutlined />, copy.general], ['trading', <StockOutlined />, copy.trading],
    ['risk', <SafetyCertificateOutlined />, copy.risk], ['research', <BarChartOutlined />, copy.research],
    ['charts', <LineChartOutlined />, copy.charts], ['notifications', <BellOutlined />, copy.notifications],
    ['security', <ClockCircleOutlined />, copy.security],
  ] as Array<[SectionKey, React.ReactNode, string]>;

  const update = <S extends SectionKey, K extends keyof WorkspacePreferences[S]>(section: S, key: K, value: WorkspacePreferences[S][K]) => {
    setDraft((current) => ({ ...current, [section]: { ...current[section], [key]: value } }));
  };

  const handleSave = async () => {
    try {
      const next = await save({
        language: draftLanguage,
        tradeMode: draft.tradeMode,
        general: draft.general, trading: draft.trading, risk: draft.risk,
        research: draft.research, charts: draft.charts,
        notifications: draft.notifications, security: draft.security,
      });
      setDraft(clonePreferences(next));
      setLastSavedAt(next.updatedAt || new Date().toISOString());
      setThemeMode(next.general.themeMode);
      setTradeMode(next.tradeMode);
      if (draftLanguage !== language) setLanguage(draftLanguage);
      message.success(copy.saveSuccess);
    } catch {
      message.error(copy.saveError);
    }
  };

  const handleReset = async () => {
    try {
      const next = await reset();
      setDraft(clonePreferences(next));
      setThemeMode(next.general.themeMode);
      message.success(copy.resetConfirm);
    } catch {
      message.error(copy.saveError);
    }
  };

  const Field: React.FC<{ label: string; hint: string; children: React.ReactNode; wide?: boolean }> = ({ label, hint, children, wide }) => (
    <label className={`settings-pref-field${wide ? ' settings-pref-field--wide' : ''}`}>
      <span><b>{label}</b><small>{hint}</small></span>{children}
    </label>
  );
  const Toggle: React.FC<{ label: string; hint: string; checked: boolean; onChange: (checked: boolean) => void; disabled?: boolean }> = ({ label, hint, checked, onChange, disabled }) => (
    <div className={`settings-pref-toggle${disabled ? ' is-locked' : ''}`}><span><b>{label}</b><small>{hint}</small></span><Switch checked={checked} onChange={onChange} disabled={disabled} /></div>
  );

  const renderGeneral = () => (
    <>
      <SectionHeader icon={<DashboardOutlined />} title={isZh ? '工作区与本地化' : 'Workspace & localization'} description={isZh ? '决定登录后的起点、市场时间和数字显示方式。' : 'Controls where sessions begin and how market time and numbers are presented.'} />
      <div className="settings-pref-grid">
        <Field label={isZh ? '网站语言' : 'Website language'} hint={isZh ? '同时用于 Discord 提醒。' : 'Also used for Discord alerts.'}><Radio.Group value={draftLanguage} onChange={(event) => setDraftLanguage(event.target.value)} options={[{ value: 'en-US', label: 'English' }, { value: 'zh-CN', label: '中文' }]} optionType="button" /></Field>
        <Field label={isZh ? '市场时区' : 'Market timezone'} hint={isZh ? '使用地区时区并自动处理夏令时。' : 'Regional timezones handle daylight saving automatically.'}><Select value={draft.general.timezone} onChange={(value) => update('general', 'timezone', value)} options={['America/New_York','America/Chicago','America/Denver','America/Los_Angeles','UTC','Europe/London','Asia/Hong_Kong','Asia/Shanghai','Asia/Tokyo'].map(value => ({ value, label: value }))} /></Field>
        <Field label={isZh ? '默认首页' : 'Default landing page'} hint={isZh ? '登录后首先打开的工作区。' : 'First workspace opened after sign-in.'}><Select value={draft.general.defaultLandingPage} onChange={(value) => update('general', 'defaultLandingPage', value)} options={[['/dashboard', isZh ? '每日概览' : 'Daily brief'], ['/market', isZh ? '市场扫描' : 'Market scanner'], ['/agent', isZh ? '研究流程' : 'Research pipeline'], ['/trade', isZh ? '交易台' : 'Trade desk'], ['/portfolio', isZh ? '投资组合' : 'Portfolio']].map(([value,label]) => ({ value, label }))} /></Field>
        <Field label={isZh ? '账户币种' : 'Account currency'} hint={isZh ? 'Alpaca 美股账户当前以 USD 结算。' : 'Alpaca US-equity accounts currently settle in USD.'}><Select value={draft.general.currency} onChange={(value) => update('general', 'currency', value)} options={[{ value: 'USD', label: 'USD · US Dollar' }]} /></Field>
        <Field label={isZh ? '数字格式' : 'Number format'} hint={isZh ? '标准数值或 K/M/B 缩写。' : 'Full values or compact K/M/B notation.'}><Radio.Group value={draft.general.numberFormat} onChange={(event) => update('general', 'numberFormat', event.target.value)} options={[{ value: 'standard', label: isZh ? '标准' : 'Standard' }, { value: 'compact', label: isZh ? '缩写' : 'Compact' }]} optionType="button" /></Field>
        <Field label={isZh ? '字体大小' : 'Text size'} hint={isZh ? '对小屏设备尤其有用。' : 'Especially useful on smaller displays.'}><Select value={draft.general.fontScale} onChange={(value) => update('general', 'fontScale', value)} options={[['compact', isZh ? '紧凑' : 'Compact'],['comfortable', isZh ? '舒适' : 'Comfortable'],['large', isZh ? '较大' : 'Large']].map(([value,label]) => ({ value, label }))} /></Field>
        <Field label={isZh ? '页面密度' : 'Workspace density'} hint={isZh ? '调整表格和卡片留白。' : 'Adjusts table and card spacing.'}><Select value={draft.general.density} onChange={(value) => update('general', 'density', value)} options={[['compact', isZh ? '紧凑' : 'Compact'],['comfortable', isZh ? '舒适' : 'Comfortable'],['spacious', isZh ? '宽松' : 'Spacious']].map(([value,label]) => ({ value, label }))} /></Field>
        <Field label={isZh ? '主题' : 'Theme'} hint={isZh ? '浅色、暗色或跟随系统。' : 'Light, dark, or follow this device.'}><Radio.Group value={draft.general.themeMode} onChange={(event) => update('general', 'themeMode', event.target.value)} options={[{ value:'light', label:isZh?'浅色':'Light' },{ value:'dark', label:isZh?'暗色':'Dark' },{ value:'system', label:isZh?'系统':'System' }]} optionType="button" /></Field>
      </div>
      <Toggle label={isZh ? '减少动画' : 'Reduce motion'} hint={isZh ? '关闭非必要的过渡动画。' : 'Disables non-essential transitions.'} checked={draft.general.reduceMotion} onChange={(value) => update('general','reduceMotion',value)} />
    </>
  );

  const renderTrading = () => (
    <>
      <SectionHeader icon={<ThunderboltOutlined />} title={isZh ? '订单预设' : 'Order presets'} description={isZh ? '预填新订单；单笔订单仍可以覆盖这些默认值。' : 'Pre-fills new orders; each ticket can still override these values.'} />
      <div className="settings-pref-callout"><b>{isZh ? '覆盖规则' : 'Precedence'}</b><span>{isZh ? '账户默认值 → Portfolio Automation 当前策略 → 单笔订单临时修改' : 'Account defaults → active Portfolio Automation policy → one-order override'}</span></div>
      <div className="settings-pref-grid">
        <Field label={isZh ? '默认账户环境' : 'Default environment'} hint={isZh ? '会记住模拟盘或实盘。' : 'Remembers Paper or Live mode.'}><Radio.Group value={draft.tradeMode} onChange={(event) => setDraft(current => ({ ...current, tradeMode: event.target.value }))} options={[{value:'paper',label:isZh?'模拟盘':'Paper'},{value:'real',label:isZh?'实盘':'Live'}]} optionType="button" /></Field>
        <Field label={isZh ? '默认订单类型' : 'Default order type'} hint={isZh ? '限价单更适合受控执行。' : 'Limit orders provide controlled execution.'}><Select value={draft.trading.defaultOrderType} onChange={(value) => update('trading','defaultOrderType',value)} options={['market','limit','stop','stop_limit','trailing_stop'].map(value => ({ value, label:value.replace('_',' ').toUpperCase() }))} /></Field>
        <Field label={isZh ? '订单有效期' : 'Time in force'} hint={isZh ? 'DAY 当日有效，GTC 撤销前有效。' : 'DAY expires today; GTC remains until canceled.'}><Select value={draft.trading.timeInForce} onChange={(value) => update('trading','timeInForce',value)} options={['day','gtc','opg','cls','ioc','fok'].map(value => ({ value, label:value.toUpperCase() }))} /></Field>
        <Field label={isZh ? '默认下单单位' : 'Default size input'} hint={isZh ? '按股数或按金额输入。' : 'Enter shares or a dollar notional.'}><Radio.Group value={draft.trading.orderSizeMode} onChange={(event) => update('trading','orderSizeMode',event.target.value)} options={[{value:'shares',label:isZh?'股数':'Shares'},{value:'dollars',label:isZh?'金额':'Dollars'}]} optionType="button" /></Field>
        <Field label={isZh ? '限价偏移' : 'Limit offset'} hint={isZh ? '相对参考价的基点数，100 bp = 1%。' : 'Basis points from reference price; 100 bp = 1%.'}><InputNumber min={0} max={500} suffix="bp" value={draft.trading.limitOffsetBps} onChange={(value) => update('trading','limitOffsetBps',Number(value || 0))} /></Field>
        <Field label={isZh ? '确认规则' : 'Confirmation policy'} hint={isZh ? '实盘始终需要确认；可让模拟盘也确认。' : 'Live always confirms; Paper can also require review.'}><Select value={draft.trading.confirmationPolicy} onChange={(value) => update('trading','confirmationPolicy',value)} options={[{value:'live_only',label:isZh?'仅实盘':'Live only'},{value:'always',label:isZh?'每笔订单':'Every order'}]} /></Field>
      </div>
      <Toggle label={isZh ? '允许盘前盘后' : 'Allow extended hours'} hint={isZh ? '自动限制为 Alpaca 支持的 DAY 限价单。' : 'Automatically constrained to Alpaca-supported DAY limit orders.'} checked={draft.trading.extendedHours} onChange={(value) => update('trading','extendedHours',value)} />
    </>
  );

  const renderRisk = () => (
    <>
      <SectionHeader icon={<SafetyCertificateOutlined />} title={isZh ? '账户级硬限制' : 'Account hard limits'} description={isZh ? '这些限制不能被 AI 或单笔订单放宽，只能进一步收紧。' : 'AI and individual tickets cannot loosen these limits; they may only become stricter.'} />
      <div className="settings-pref-grid settings-pref-grid--metrics">
        <Field label={isZh ? '单笔金额上限' : 'Maximum order notional'} hint={isZh ? '超过该金额的订单会被阻止。' : 'Orders above this value are blocked.'}><InputNumber min={1} max={10_000_000} prefix="$" value={draft.risk.maxOrderNotional} onChange={(value) => update('risk','maxOrderNotional',Number(value || 1))} /></Field>
        <Field label={isZh ? '单股仓位上限' : 'Maximum position'} hint={isZh ? '占组合净值的比例。' : 'Percentage of portfolio equity.'}><InputNumber min={1} max={100} suffix="%" value={draft.risk.maxPositionPct} onChange={(value) => update('risk','maxPositionPct',Number(value || 1))} /></Field>
        <Field label={isZh ? '每日亏损限制' : 'Daily loss limit'} hint={isZh ? '触发后停止新增买入。' : 'Stops new entries when reached.'}><InputNumber min={0.1} max={50} step={0.1} suffix="%" value={draft.risk.dailyLossLimitPct} onChange={(value) => update('risk','dailyLossLimitPct',Number(value || .1))} /></Field>
        <Field label={isZh ? '行业集中度' : 'Sector concentration'} hint={isZh ? '单一行业最大资金比例。' : 'Maximum allocation to one sector.'}><InputNumber min={1} max={100} suffix="%" value={draft.risk.sectorConcentrationPct} onChange={(value) => update('risk','sectorConcentrationPct',Number(value || 1))} /></Field>
        <Field label={isZh ? '最大持仓数量' : 'Maximum open positions'} hint={isZh ? '包括等待退出的持仓。' : 'Includes positions awaiting exit.'}><InputNumber min={1} max={500} value={draft.risk.maxOpenPositions} onChange={(value) => update('risk','maxOpenPositions',Number(value || 1))} /></Field>
        <Field label={isZh ? '行情过期阈值' : 'Stale quote threshold'} hint={isZh ? '报价超过该时间视为过期。' : 'Quotes older than this are stale.'}><InputNumber min={5} max={3600} suffix={isZh?'秒':'sec'} value={draft.risk.staleQuoteSeconds} onChange={(value) => update('risk','staleQuoteSeconds',Number(value || 5))} /></Field>
      </div>
      <Toggle label={isZh ? '过期行情禁止交易' : 'Block trading on stale quotes'} hint={isZh ? '避免使用旧价格计算仓位和限价。' : 'Prevents sizing and limits from using old prices.'} checked={draft.risk.blockOnStaleQuote} onChange={(value) => update('risk','blockOnStaleQuote',value)} />
      <Toggle disabled label={isZh ? '平台自动熔断（始终启用）' : 'Platform circuit breaker (always on)'} hint={isZh ? '连续错误或风险限制触发时暂停自动化；用户无法关闭此保护。' : 'Pauses automation after repeated errors or risk breaches; this safeguard cannot be disabled.'} checked onChange={() => undefined} />
    </>
  );

  const renderResearch = () => (
    <>
      <SectionHeader icon={<BarChartOutlined />} title={isZh ? '扫描默认条件' : 'Scanner defaults'} description={isZh ? '用于首次扫描和恢复默认；Market 页面仍可保存自己的研究方案。' : 'Used for first run and reset; Markets can still save a dedicated research mandate.'} />
      <div className="settings-pref-grid">
        <Field label={isZh ? '生产股票池' : 'Production universe'} hint={isZh ? '当前扫描器使用 Alpaca 可交易美股全集。' : 'The production scanner uses Alpaca’s tradable US-equity universe.'}><Select disabled value="alpaca_market" options={[{value:'alpaca_market',label:isZh?'Alpaca 可交易美股':'Alpaca tradable US equities'}]} /></Field>
        <Field label={isZh ? '扫描上限' : 'Scan cap'} hint={isZh ? '每次最多处理的标的数量。' : 'Maximum symbols processed per run.'}><InputNumber min={25} max={3000} value={draft.research.maxSymbols} onChange={(value)=>update('research','maxSymbols',Number(value||25))} /></Field>
        <Field label={isZh ? '候选输出' : 'Candidate output'} hint={isZh ? '排序后保留的候选数量。' : 'Ranked candidates retained.'}><InputNumber min={5} max={300} value={draft.research.outputSize} onChange={(value)=>update('research','outputSize',Number(value||5))} /></Field>
        <Field label={isZh ? 'AI 审核数量' : 'AI review limit'} hint={isZh ? '限制模型调用和运行时间。' : 'Controls model usage and runtime.'}><InputNumber min={0} max={300} value={draft.research.aiReviewLimit} onChange={(value)=>update('research','aiReviewLimit',Number(value||0))} /></Field>
        <Field label={isZh ? '最低价格' : 'Minimum price'} hint={isZh ? '过滤低价股票。' : 'Filters lower-priced securities.'}><InputNumber min={0} prefix="$" value={draft.research.minPrice} onChange={(value)=>update('research','minPrice',Number(value||0))} /></Field>
        <Field label={isZh ? '最低日均成交额' : 'Minimum ADV20'} hint={isZh ? '降低流动性和冲击成本风险。' : 'Reduces liquidity and market-impact risk.'}><InputNumber min={0} prefix="$" value={draft.research.minDollarVolume} onChange={(value)=>update('research','minDollarVolume',Number(value||0))} /></Field>
        <Field label={isZh ? '最低市值' : 'Minimum market cap'} hint={isZh ? '0 表示不限制。' : 'Use 0 for no minimum.'}><InputNumber min={0} prefix="$" value={draft.research.minMarketCap} onChange={(value)=>update('research','minMarketCap',Number(value||0))} /></Field>
        <Field label={isZh ? '数据新鲜度' : 'Data freshness'} hint={isZh ? '超过阈值的数据会标记延迟。' : 'Older data is labeled delayed.'}><InputNumber min={15} max={3600} suffix={isZh?'秒':'sec'} value={draft.research.dataFreshnessSeconds} onChange={(value)=>update('research','dataFreshnessSeconds',Number(value||15))} /></Field>
        <Field wide label={isZh ? '排除股票' : 'Excluded symbols'} hint={isZh ? '用逗号分隔，例如 TSLA, GME。' : 'Comma-separated, for example TSLA, GME.'}><Input value={draft.research.excludedSymbols.join(', ')} onChange={(event)=>update('research','excludedSymbols',splitList(event.target.value).map(value=>value.toUpperCase()))} placeholder="TSLA, GME" /></Field>
        <Field wide label={isZh ? '排除行业' : 'Excluded sectors'} hint={isZh ? '行业名称用逗号分隔。' : 'Comma-separated sector names.'}><Input value={draft.research.excludedSectors.join(', ')} onChange={(event)=>update('research','excludedSectors',splitList(event.target.value))} placeholder="Biotechnology, Energy" /></Field>
      </div>
      <div className="settings-pref-callout"><b>{isZh ? '数据范围' : 'Data coverage'}</b><span>{isZh ? '扫描因子使用常规交易时段的可复现行情；盘前盘后仅用于报价与执行验证。' : 'Scanner factors use reproducible regular-session data; extended hours are reserved for quote and execution checks.'}</span></div>
    </>
  );

  const renderCharts = () => (
    <>
      <SectionHeader icon={<LineChartOutlined />} title={isZh ? '图表与数据表达' : 'Chart & data presentation'} description={isZh ? '统一行情图、组合曲线和研究图表的默认显示。' : 'Applies consistent defaults to symbol, portfolio, and research charts.'} />
      <div className="settings-pref-grid">
        <Field label={isZh ? '默认周期' : 'Default timeframe'} hint={isZh ? '打开股票详情时使用。' : 'Used when opening symbol analysis.'}><Radio.Group value={draft.charts.timeframe} onChange={(event)=>update('charts','timeframe',event.target.value)} options={['1D','1W','1M','3M','1Y'].map(value=>({value,label:value}))} optionType="button" /></Field>
        <Field label={isZh ? '生产图表渲染器' : 'Production chart renderer'} hint={isZh ? '股票分析当前使用带均线叠加的专业折线图。' : 'Symbol analysis currently uses a professional line chart with moving-average overlays.'}><Select disabled value="line" options={[{value:'line',label:isZh?'折线 + 指标叠加':'Line + indicator overlays'}]} /></Field>
        <Field label={isZh ? '交易时段' : 'Trading session'} hint={isZh ? '常规时段或包含盘前盘后。' : 'Regular session or extended hours.'}><Select value={draft.charts.session} onChange={(value)=>update('charts','session',value)} options={[{value:'regular',label:isZh?'常规时段':'Regular hours'},{value:'extended',label:isZh?'盘前盘后':'Extended hours'}]} /></Field>
        <Field label={isZh ? '图表价格精度' : 'Chart price precision'} hint={isZh ? '股票详情价格轴和浮层的小数位。' : 'Decimals on symbol-chart axes and tooltips.'}><InputNumber min={0} max={8} value={draft.charts.precision} onChange={(value)=>update('charts','precision',Number(value||0))} /></Field>
      </div>
      <Toggle label={isZh ? '使用复权数据' : 'Use adjusted data'} hint={isZh ? '处理拆股和分红造成的价格跳空。' : 'Accounts for split and dividend adjustments.'} checked={draft.charts.adjustedData} onChange={(value)=>update('charts','adjustedData',value)} />
      <div className="settings-pref-callout"><b>{isZh ? '基准规则' : 'Benchmark policy'}</b><span>{isZh ? '研究验证固定使用 SPY 同期基准，避免用户切换基准后让结果失去可比性。' : 'Research validation uses aligned SPY periods so results remain comparable across accounts.'}</span></div>
    </>
  );

  const renderNotifications = () => (
    <>
      <SectionHeader icon={<BellOutlined />} title={isZh ? '事件与发送策略' : 'Events & delivery policy'} description={isZh ? '决定什么值得打断用户；Webhook 地址仍在 Connections 中管理。' : 'Controls what deserves attention; webhook credentials remain in Connections.'} />
      <div className="settings-pref-callout"><b>{isZh ? '渠道' : 'Channels'}</b><span>{isZh ? '网站内的送达记录会自动保留在安全中心；Discord 需要先在 Connections 保存 Webhook。' : 'Delivery history is always retained in Safety Center; Discord requires a saved webhook in Connections.'}</span></div>
      <Toggle label="Discord" hint={isZh ? '发送到已配置的 Discord 频道。' : 'Sends to the configured Discord channel.'} checked={draft.notifications.discord} onChange={(value)=>update('notifications','discord',value)} />
      <div className="settings-pref-toggle-grid">
        <Toggle label={isZh?'买入、卖出与拒单':'Buys, sells & rejections'} hint={isZh?'券商确认后的交易结果。':'Broker-confirmed outcomes.'} checked={draft.notifications.tradeActivity} onChange={(value)=>update('notifications','tradeActivity',value)} />
        <Toggle label={isZh?'推荐股票':'Stock recommendations'} hint={isZh?'可买入、复核和等待候选。':'Buy-ready, review, and wait candidates.'} checked={draft.notifications.recommendations} onChange={(value)=>update('notifications','recommendations',value)} />
        <Toggle label={isZh?'重要风险':'Material risk'} hint={isZh?'保护缺口、熔断和紧急退出。':'Protection gaps, breakers, and emergency exits.'} checked={draft.notifications.riskAlerts} onChange={(value)=>update('notifications','riskAlerts',value)} />
        <Toggle label={isZh?'流程摘要':'Pipeline digest'} hint={isZh?'运行完成、失败和关键统计。':'Completion, failures, and key counts.'} checked={draft.notifications.pipelineDigest} onChange={(value)=>update('notifications','pipelineDigest',value)} />
        <Toggle label={isZh?'数据质量':'Data quality'} hint={isZh?'延迟、回退或行情源中断。':'Delays, fallbacks, and feed outages.'} checked={draft.notifications.dataQuality} onChange={(value)=>update('notifications','dataQuality',value)} />
        <Toggle label={isZh?'账户安全':'Account security'} hint={isZh?'登录与敏感配置变化。':'Sign-ins and sensitive configuration changes.'} checked={draft.notifications.securityAlerts} onChange={(value)=>update('notifications','securityAlerts',value)} />
      </div>
      <div className="settings-pref-grid">
        <Field label={isZh ? '发送方式' : 'Delivery mode'} hint={isZh ? '即时发送或合并成摘要。' : 'Send immediately or combine into a digest.'}><Radio.Group value={draft.notifications.deliveryMode} onChange={(event)=>update('notifications','deliveryMode',event.target.value)} options={[{value:'instant',label:isZh?'即时':'Instant'},{value:'digest',label:isZh?'摘要':'Digest'}]} optionType="button" /></Field>
        <Field label={isZh ? '免打扰时间' : 'Quiet hours'} hint={isZh ? '风险与交易结果不受免打扰限制。' : 'Risk and trade outcomes bypass quiet hours.'}><div className="settings-time-range"><Input type="time" value={draft.notifications.quietStart} onChange={(event)=>update('notifications','quietStart',event.target.value)} /><span>→</span><Input type="time" value={draft.notifications.quietEnd} onChange={(event)=>update('notifications','quietEnd',event.target.value)} /></div></Field>
      </div>
      <Toggle label={isZh ? '启用免打扰' : 'Enable quiet hours'} hint={isZh ? '静默普通摘要和推荐提醒。' : 'Mutes routine digests and recommendations.'} checked={draft.notifications.quietHoursEnabled} onChange={(value)=>update('notifications','quietHoursEnabled',value)} />
    </>
  );

  const renderSecurity = () => (
    <>
      <SectionHeader icon={<ClockCircleOutlined />} title={isZh ? '会话与敏感操作' : 'Sessions & sensitive actions'} description={isZh ? '认证仍由 Supabase 管理；这里控制当前网站的安全偏好。' : 'Supabase remains the authentication authority; these are workspace safety preferences.'} />
      <div className="settings-pref-grid">
        <Field label={isZh ? '离开后自动退出' : 'Sign out after being away'} hint={isZh ? '离开网页超过该时间后结束会话。' : 'Ends the session after the site stays hidden.'}><Select value={draft.security.inactivityTimeoutMinutes} onChange={(value)=>update('security','inactivityTimeoutMinutes',value)} options={[5,10,15,30,60,120].map(value=>({value,label:`${value} ${isZh?'分钟':'minutes'}`}))} /></Field>
      </div>
      <Toggle label={isZh ? '新登录环境提醒' : 'New sign-in environment alerts'} hint={isZh ? '通过账户安全事件渠道发送提醒。' : 'Uses the account-security notification channel.'} checked={draft.security.newDeviceAlerts} onChange={(value)=>update('security','newDeviceAlerts',value)} />
      <Toggle disabled label={isZh ? '敏感操作二次确认（始终启用）' : 'Sensitive-action confirmation (always on)'} hint={isZh ? '实盘授权、关闭保护和删除数据不能跳过确认。' : 'Live authority, disabled protection, and deletion can never bypass confirmation.'} checked onChange={() => undefined} />
      <Alert showIcon type="info" message={isZh ? 'MFA、设备退出、数据导出和凭证轮换位于下方的账户安全区域。' : 'MFA, device sign-out, data export, and credential rotation remain in Account security below.'} />
    </>
  );

  const renderActive = () => ({ general: renderGeneral, trading: renderTrading, risk: renderRisk, research: renderResearch, charts: renderCharts, notifications: renderNotifications, security: renderSecurity }[active]());

  return (
    <section className="settings-preferences" aria-labelledby="settings-preferences-title">
      <header className="settings-preferences__header">
        <div><span className="settings-section-index">02 / PREFERENCES</span><h2 id="settings-preferences-title">{copy.title}</h2><p>{copy.subtitle}</p></div>
        <div className="settings-preferences__status">
          <span className={dirty ? 'is-dirty' : 'is-saved'}>{saving ? <ReloadOutlined spin /> : <CheckCircleOutlined />}{saving ? copy.saving : dirty ? copy.unsaved : copy.saved}</span>
          {lastSavedAt && <small>{new Date(lastSavedAt).toLocaleString(isZh ? 'zh-CN' : 'en-US')}</small>}
        </div>
      </header>
      {error && <Alert type="warning" showIcon message={error} className="settings-preferences__error" />}
      <div className="settings-preferences__workspace">
        <nav className="settings-preferences__nav" aria-label={copy.title}>{nav.map(([key,icon,label])=><button type="button" key={key} className={active===key?'is-active':''} onClick={()=>setActive(key)}>{icon}<span>{label}</span></button>)}</nav>
        <div className="settings-preferences__content" aria-busy={loading}>{renderActive()}</div>
      </div>
      <footer className="settings-preferences__footer">
        <Button icon={<ReloadOutlined />} onClick={handleReset} disabled={saving}>{copy.reset}</Button>
        <Button type="primary" icon={<SaveOutlined />} onClick={handleSave} loading={saving} disabled={!dirty}>{copy.save}</Button>
      </footer>
    </section>
  );
};

const SectionHeader: React.FC<{ icon: React.ReactNode; title: string; description: string }> = ({ icon, title, description }) => (
  <div className="settings-pref-section-head"><span>{icon}</span><div><h3>{title}</h3><p>{description}</p></div></div>
);

export default SettingsPreferencesPanel;
