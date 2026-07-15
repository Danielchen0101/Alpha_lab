import React, { useEffect, useMemo, useRef, useState } from 'react';
import MarketingLayout from '../components/MarketingLayout';
import { PublicTabList, publicTabIds, scrollPublicTarget } from '../components/public/PublicExperience';
import { MetricStrip, MiniSparkline, PublicCta, PublicHero, SectionHeading } from '../components/public/PublicPrimitives';
import { useLanguage } from '../contexts/LanguageContext';
import './PublicSite.css';
import './PublicExperience.css';

type DataLayer = 'source' | 'normalize' | 'validate' | 'research';

const DataMethod: React.FC = () => {
  const { language } = useLanguage();
  const isZh = language === 'zh-CN';
  const methodRef = useRef<HTMLElement>(null);
  const [layer, setLayer] = useState<DataLayer>('source');
  useEffect(() => { window.scrollTo(0, 0); }, []);

  const layers = useMemo(() => ({
    source: { label: isZh ? '数据接入' : 'Source', title: isZh ? '记录来源、时间和延迟。' : 'Record source, time, and latency.', value: '08:31:04', line: [40,42,39,45,48,47,51,54,56,58,61,63], checks: [[isZh ? '数据来源' : 'SOURCE', isZh ? '市场数据' : 'MARKET DATA'], [isZh ? '采样频率' : 'FREQUENCY', isZh ? '已配置' : 'CONFIGURED'], [isZh ? '状态' : 'STATUS', isZh ? '样例' : 'SAMPLE']] },
    normalize: { label: isZh ? '标准化' : 'Normalize', title: isZh ? '复权、时区和字段进入统一结构。' : 'Adjustments, time zones, and fields enter one schema.', value: '99.8%', line: [25,30,29,35,37,42,44,49,52,55,58,62], checks: [[isZh ? '公司行动' : 'CORP ACTIONS', isZh ? '已复权' : 'ADJUSTED'], [isZh ? '时区' : 'TIME ZONE', isZh ? '已统一' : 'NORMALIZED'], [isZh ? '缺失值' : 'MISSING', isZh ? '已标记' : 'FLAGGED']] },
    validate: { label: isZh ? '质量验证' : 'Validate', title: isZh ? '缺失、异常和偏差先被标记。' : 'Missing values, anomalies, and bias are flagged first.', value: isZh ? '17 项标记' : '17 flags', line: [62,58,55,57,50,47,44,42,39,35,33,29], checks: [[isZh ? '异常值' : 'OUTLIERS', isZh ? '已检查' : 'CHECKED'], [isZh ? '数据缺口' : 'GAPS', isZh ? '已披露' : 'DISCLOSED'], [isZh ? '前视偏差' : 'LOOK-AHEAD', isZh ? '已防护' : 'GUARDED']] },
    research: { label: isZh ? '研究版本' : 'Research', title: isZh ? '每次运行绑定数据和方法版本。' : 'Every run binds data and method versions.', value: 'v2026.07', line: [20,24,28,31,35,39,43,47,52,56,61,67], checks: [[isZh ? '数据版本' : 'DATA VERSION', isZh ? '已锁定' : 'PINNED'], [isZh ? '规则集' : 'RULE SET', isZh ? '已校验' : 'HASHED'], [isZh ? '运行日志' : 'RUN LOG', isZh ? '已附加' : 'ATTACHED']] },
  }), [isZh]);
  const active = layers[layer];
  const dataPanelIds = publicTabIds('data-lineage', layer);

  return (
    <MarketingLayout tone="paper">
      <main className={`public-page public-data-page ${isZh ? 'is-zh' : 'is-en'}`}>
        <PublicHero index="05" eyebrow={isZh ? '数据与验证方法' : 'DATA & VALIDATION METHOD'} title={isZh ? '研究从数据边界开始。' : 'Research starts with data boundaries.'} subtitle={isZh ? 'AlphaLab 把数据来源、标准化、质量门槛、回测假设和成本模型放在结果之前，让每一份研究都知道自己能说明什么、不能说明什么。' : 'AlphaLab puts provenance, normalization, quality gates, backtest assumptions, and cost models before results—so each research note knows what it can and cannot claim.'} primaryLabel={isZh ? '开始模拟研究' : 'Start paper research'} secondaryLabel={isZh ? '查看数据链路' : 'Inspect the data path'} onSecondary={() => scrollPublicTarget(methodRef.current)}>
          <div className="public-instrument">
            <div className="public-instrument-header"><strong>{isZh ? '数据来源 / 样例运行' : 'DATA PROVENANCE / SAMPLE RUN'}</strong><span>{isZh ? '演示状态' : 'ILLUSTRATIVE STATUS'}</span></div>
            <div className="public-instrument-body"><MiniSparkline values={[35,39,37,44,47,51,49,55,59,62,66,70]} label={isZh ? '数据完整度样例' : 'Sample data completeness'} /></div>
            <MetricStrip metrics={[
              { label: isZh ? '资产池' : 'Universe', value: '8,421', tone: 'blue' },
              { label: isZh ? '质量标记' : 'Quality flags', value: '17', tone: 'copper' },
              { label: isZh ? '成本模型' : 'Cost model', value: isZh ? '已启用' : 'ON' },
              { label: isZh ? '数据版本' : 'Data version', value: isZh ? '已锁定' : 'PIN', tone: 'moss' },
            ]} />
          </div>
        </PublicHero>

        <section className="public-section data-lineage-section" ref={methodRef}>
          <SectionHeading eyebrow={isZh ? '数据链路' : 'THE DATA PATH'} title={isZh ? '来源 → 标准化 → 验证 → 研究。' : 'Source → normalize → validate → research.'} description={isZh ? '点击每层，查看数据进入研究前必须留下的记录。' : 'Select each layer to see what must be recorded before data enters research.'} />
          <PublicTabList id="data-lineage" items={(Object.keys(layers) as DataLayer[]).map(id => ({ id, label: layers[id].label }))} activeId={layer} onChange={id => setLayer(id as DataLayer)} ariaLabel={isZh ? '数据处理层' : 'Data processing layers'} className="data-lineage-rail" />
          <div key={layer} className="public-data-grid data-lineage-panel public-panel-swap" role="tabpanel" id={dataPanelIds.panelId} aria-labelledby={dataPanelIds.tabId}>
            <div className="public-data-main"><div className="public-instrument-header" style={{ padding: '0 0 20px', borderBottom: 0 }}><strong>{active.title}</strong><span>{isZh ? '样例记录' : 'SAMPLE RECORD'}</span></div><MiniSparkline values={active.line} color={layer === 'validate' ? 'copper' : layer === 'research' ? 'moss' : 'blue'} showNodes={layer === 'validate'} label={active.title} /></div>
            <aside className="public-data-aside"><p>{active.label}</p><strong>{active.value}</strong><dl>{active.checks.map(([name, value]) => <div key={name}><dt>{name}</dt><dd>{value}</dd></div>)}</dl></aside>
          </div>
        </section>

        <section className="public-section is-dark data-disclosure-section">
          <SectionHeading eyebrow={isZh ? '回测披露' : 'BACKTEST DISCLOSURE'} title={isZh ? '方法假设和结果同样重要。' : 'Method assumptions matter as much as results.'} description={isZh ? '公开结果必须说明时间范围、复权、基准、成本、滑点、样本外切分和已知偏差。' : 'Published results should disclose range, adjustments, benchmark, costs, slippage, out-of-sample splits, and known biases.'} />
          <div className="public-card-grid">
            {[
              [isZh ? '公司行动' : 'Corporate actions', isZh ? '拆股、分红和代码变化需要一致复权。' : 'Splits, dividends, and symbol changes require consistent adjustment.'],
              [isZh ? '幸存者偏差' : 'Survivorship bias', isZh ? '资产池定义与退市处理必须披露。' : 'Universe definition and delisting treatment must be disclosed.'],
              [isZh ? '前视偏差' : 'Look-ahead bias', isZh ? '每个因子只能使用当时已经可得的数据。' : 'Each factor may use only data available at that point in time.'],
              [isZh ? '交易成本' : 'Trading costs', isZh ? '费用、点差和滑点随换手率进入结果。' : 'Fees, spreads, and slippage enter results with turnover.'],
              [isZh ? '基准选择' : 'Benchmark choice', isZh ? '超额收益必须与相关基准比较。' : 'Excess return must be compared with a relevant benchmark.'],
              [isZh ? '参数次数' : 'Parameter trials', isZh ? '搜索次数与最终参数需要进入审计记录。' : 'Search count and final parameters belong in the audit record.'],
            ].map(([title, desc], index) => <article className="public-card" key={title} style={{ background: 'transparent', borderColor: 'rgba(255,255,255,.13)' }}><span>0{index + 1}</span><h3 style={{ color: '#f5f1e8' }}>{title}</h3><p style={{ color: 'rgba(245,241,232,.62)' }}>{desc}</p></article>)}
          </div>
        </section>

        <PublicCta eyebrow={isZh ? '方法先于结论' : 'METHOD BEFORE CONCLUSION'} title={isZh ? '用可复现的输入开始下一份研究。' : 'Start the next note with reproducible inputs.'} description={isZh ? '先定义数据与验证方法，再让结果说话。' : 'Define data and validation first, then let the result speak.'} primary={isZh ? '开始构建' : 'Start building'} secondary={isZh ? '查看研究页面' : 'Review the research page'} secondaryPath="/research" />
      </main>
    </MarketingLayout>
  );
};

export default DataMethod;
