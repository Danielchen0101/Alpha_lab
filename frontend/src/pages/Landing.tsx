import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AnimatePresence,
  motion,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
} from 'framer-motion';
import MarketingLayout from '../components/MarketingLayout';
import SignalEstuaryVisual from '../components/home/SignalEstuaryVisual';
import ResearchExamplesExplorer from '../components/public/ResearchExamplesExplorer';
import { Translation, useLanguage } from '../contexts/LanguageContext';
import './Landing.css';

type StageIndex = 0 | 1 | 2 | 3;
type MarketFieldCopy = Translation['landing']['marketField'];

interface StagePanelProps {
  copy: MarketFieldCopy;
  isZh: boolean;
}

interface StageDefinition {
  id: 'observe' | 'filter' | 'test' | 'plan';
  label: string;
  short: string;
  title: string;
  description: string;
}

interface StageRailProps {
  stages: StageDefinition[];
  active: StageIndex;
  onSelect?: (index: StageIndex) => void;
  ariaLabel: string;
}

const StageGlyph: React.FC<{ stage: StageIndex }> = ({ stage }) => (
  <span className={`market-stage-glyph market-stage-glyph--${stage}`} aria-hidden="true">
    <i />
    <i />
    <i />
  </span>
);

const StageRail: React.FC<StageRailProps> = ({ stages, active, onSelect, ariaLabel }) => (
  <ol className="market-stage-rail" aria-label={ariaLabel}>
    {stages.map((stage, index) => {
      const stageIndex = index as StageIndex;
      return (
        <li key={stage.id} className={active === stageIndex ? 'is-active' : ''}>
          <button
            type="button"
            onClick={() => onSelect?.(stageIndex)}
            aria-current={active === stageIndex ? 'step' : undefined}
          >
            <StageGlyph stage={stageIndex} />
            <span className="market-stage-number">0{index + 1}</span>
            <span className="market-stage-name">{stage.label}</span>
            <span className="market-stage-short">{stage.short}</span>
          </button>
        </li>
      );
    })}
  </ol>
);

const EquityChart: React.FC<{ copy: MarketFieldCopy; compact?: boolean; isZh: boolean }> = ({ copy, compact = false, isZh }) => {
  const chartId = React.useId().replace(/:/g, '');
  const titleId = `equity-title-${chartId}`;
  const descId = `equity-desc-${chartId}`;
  const gradientId = `equity-area-${chartId}`;
  return (
  <svg className={`market-equity-chart ${compact ? 'is-compact' : ''}`} viewBox="0 0 720 250" role="img" aria-labelledby={`${titleId} ${descId}`}>
    <title id={titleId}>{copy.equityWalkForward} · SPY</title>
    <desc id={descId}>{`${copy.walkForward}: 5/5. ${copy.sharpe}: 2.45. ${copy.maxDrawdown}: -4.1%.`}</desc>
    <defs>
      <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#2b5fae" stopOpacity=".17" />
        <stop offset="100%" stopColor="#2b5fae" stopOpacity="0" />
      </linearGradient>
    </defs>
    <g className="market-equity-grid" aria-hidden="true">
      {[45, 90, 135, 180, 225].map((y) => <line key={y} x1="20" y1={y} x2="704" y2={y} />)}
      {[120, 244, 368, 492, 616].map((x, index) => (
        <React.Fragment key={x}>
          <rect x={x - 100} y="24" width="100" height="202" className={index % 2 ? 'fold-alt' : ''} />
          <text x={x - 89} y="42">{isZh ? `窗口 ${index + 1}` : `FOLD ${index + 1}`}</text>
        </React.Fragment>
      ))}
    </g>
    <path
      className="market-benchmark-line"
      d="M20 206 C80 198 112 190 151 184 C204 175 245 174 291 158 C340 143 383 150 432 140 C485 129 532 123 579 111 C630 99 668 102 704 86"
      fill="none"
    />
    <path className="market-equity-area" d="M20 207 C48 201 68 190 93 181 C119 171 132 149 160 156 C190 164 202 126 229 135 C259 144 275 116 301 121 C330 126 345 92 376 106 C407 121 425 98 448 92 C472 87 489 138 519 120 C546 104 562 79 590 86 C615 93 635 65 656 73 C677 80 687 52 704 43 L704 225 L20 225 Z" fill={`url(#${gradientId})`} aria-hidden="true" />
    <path
      className="market-equity-line"
      d="M20 207 C48 201 68 190 93 181 C119 171 132 149 160 156 C190 164 202 126 229 135 C259 144 275 116 301 121 C330 126 345 92 376 106 C407 121 425 98 448 92 C472 87 489 138 519 120 C546 104 562 79 590 86 C615 93 635 65 656 73 C677 80 687 52 704 43"
      fill="none"
    />
    {[160, 301, 448, 590, 704].map((x, index) => (
      <circle key={x} cx={x} cy={[156, 121, 92, 86, 43][index]} r="3" className="market-equity-point" />
    ))}
    <circle cx="704" cy="43" r="8" className="market-equity-halo" aria-hidden="true" />
  </svg>
  );
};

const ObserveStage: React.FC<StagePanelProps> = ({ copy, isZh }) => {
  const streams = useMemo(
    () => Array.from({ length: 16 }, (_, index) => ({
      y: 24 + index * 18,
      bend: (index % 5) * 5 - 8,
      color: index === 11 ? '#2b5fae' : index % 4 === 0 ? '#6f8564' : '#7693a0',
    })),
    [],
  );

  return (
    <div className="specimen-observe">
      <div className="specimen-observe-map">
        <svg viewBox="0 0 700 325" aria-hidden="true">
          <g className="observe-guide-lines">
            {[62, 132, 202, 272].map(y => <line key={y} x1="20" y1={y} x2="680" y2={y} />)}
          </g>
          {streams.map((stream, index) => (
            <path
              key={stream.y}
              d={`M20 ${stream.y} C190 ${stream.y + stream.bend}, 340 ${174 - stream.bend}, 680 ${162 + (index - 8) * 4}`}
              fill="none"
              stroke={stream.color}
              strokeOpacity={index === 11 ? 0.95 : 0.28}
              strokeWidth={index === 11 ? 2 : 1}
            />
          ))}
          <circle cx="680" cy="174" r="5" fill="#2b5fae" />
          <text x="625" y="158" className="observe-nvda-label">NVDA</text>
        </svg>
        <div className="observe-axis-note">{isZh ? '价格 · 成交量 · 波动率 · 市场环境' : 'PRICE · VOLUME · VOLATILITY · REGIME'}</div>
      </div>
      <aside className="specimen-observe-notes">
        <span className="specimen-kicker">{isZh ? '标的池概览' : 'UNIVERSE MAP'}</span>
        <strong>8,421</strong>
        <span>{copy.observed}</span>
        <dl>
          <div><dt>{isZh ? '美股' : 'US EQUITIES'}</dt><dd>6,840</dd></div>
          <div><dt>ETFs</dt><dd>1,172</dd></div>
          <div><dt>{isZh ? '今日流动性达标' : 'LIQUID TODAY'}</dt><dd>409</dd></div>
        </dl>
      </aside>
    </div>
  );
};

const FilterStage: React.FC<StagePanelProps> = ({ copy, isZh }) => {
  const candidates = [
    { symbol: 'NVDA', setup: isZh ? '动量' : 'Momentum', score: '92', status: copy.passed, selected: true },
    { symbol: 'AAPL', setup: isZh ? '趋势延续' : 'Continuation', score: '85', status: copy.passed },
    { symbol: 'MSFT', setup: isZh ? '趋势' : 'Trend', score: '78', status: copy.review },
    { symbol: 'AMD', setup: isZh ? '动量' : 'Momentum', score: '71', status: copy.review },
    { symbol: 'TSLA', setup: isZh ? '均值回归' : 'Reversion', score: '54', status: copy.blocked },
  ];
  const gates = [copy.liquidityGate, copy.structureGate, copy.evidenceGate];

  return (
    <div className="specimen-filter">
      <div className="filter-candidates">
        <div className="filter-heading"><span>{copy.candidates}</span><strong>{copy.candidateCount}</strong></div>
        {candidates.map(candidate => (
          <div className={`filter-row ${candidate.selected ? 'is-selected' : ''}`} key={candidate.symbol}>
            <strong>{candidate.symbol}</strong>
            <span>{candidate.setup}</span>
            <span className="filter-score">{candidate.score}</span>
            <span className={`filter-status is-${candidate.status === copy.passed ? 'passed' : candidate.status === copy.blocked ? 'blocked' : 'review'}`}>
              {candidate.status}
            </span>
          </div>
        ))}
      </div>
      <aside className="filter-gates">
        <span className="specimen-kicker">{isZh ? '确定性门槛' : 'DETERMINISTIC GATES'}</span>
        <strong>NVDA</strong>
        <span className="filter-validation-count">{copy.validationCount}</span>
        {gates.map((gate, index) => (
          <div className="filter-gate" key={gate}>
            <span>{gate}</span>
            <i style={{ '--gate-fill': `${92 - index * 8}%` } as React.CSSProperties} />
            <b>{copy.passed}</b>
          </div>
        ))}
      </aside>
    </div>
  );
};

const TestStage: React.FC<StagePanelProps> = ({ copy, isZh }) => (
  <div className="specimen-test">
    <div className="test-chart-panel">
      <div className="chart-legend">
        <span className="is-equity">{copy.equityWalkForward}</span>
        <span className="is-benchmark">{copy.benchmark}</span>
      </div>
      <EquityChart copy={copy} isZh={isZh} />
    </div>
    <dl className="test-metrics">
      <div><dt>{copy.walkForward}</dt><dd>5/5</dd></div>
      <div><dt>{copy.sharpe}</dt><dd>2.45</dd></div>
      <div><dt>{copy.maxDrawdown}</dt><dd className="is-risk">-4.1%</dd></div>
      <div><dt>{copy.hardGatesPassed}</dt><dd className="is-pass">✓</dd></div>
      <div><dt>{copy.riskBudget}</dt><dd>1%</dd></div>
      <div><dt>{copy.manualApproval}</dt><dd className="is-pending">○</dd></div>
    </dl>
    <div className="test-plan-evidence">
      <div className="trade-plan-mini">
        <span className="specimen-kicker">{copy.tradePlan}</span>
        <div><span className="entry-line">{copy.entry}</span><b>$925.30</b></div>
        <div><span className="stop-line">{copy.stop}</span><b>$887.40</b></div>
        <div><span className="target-line">{copy.target}</span><b>$1,050.00</b></div>
      </div>
      <div className="evidence-mini">
        <span className="specimen-kicker">{copy.evidence}</span>
        {[copy.evidenceMomentum, copy.evidenceEarnings, copy.evidenceFlow, copy.evidenceVolatility, copy.evidenceTechnical].map((label, index) => (
          <div key={label}><span>{label}</span><b>{index === 2 ? '○' : '+'}</b></div>
        ))}
      </div>
    </div>
  </div>
);

const PlanStage: React.FC<StagePanelProps> = ({ copy, isZh }) => (
  <div className="specimen-plan">
    <div className="plan-price-map">
      <div className="plan-map-header">
        <span className="specimen-kicker">{isZh ? 'NVDA · 模拟交易计划' : 'NVDA · PAPER TRADE PLAN'}</span>
        <strong>{copy.paperReady}</strong>
      </div>
      <div className="plan-chart-area">
        <svg viewBox="0 0 720 260" aria-hidden="true">
          <line x1="30" y1="58" x2="690" y2="58" className="plan-target" />
          <line x1="30" y1="126" x2="690" y2="126" className="plan-entry" />
          <line x1="30" y1="211" x2="690" y2="211" className="plan-stop" />
          <path d="M30 202 C88 191 126 176 172 181 C220 186 263 145 307 153 C354 161 390 122 438 130 C486 138 532 95 576 108 C620 120 653 82 690 74" fill="none" className="plan-price-path" />
          <text x="605" y="48">{isZh ? '目标 $1,050' : 'TARGET $1,050'}</text>
          <text x="617" y="116">{isZh ? '入场 $925' : 'ENTRY $925'}</text>
          <text x="620" y="201">{isZh ? '止损 $887' : 'STOP $887'}</text>
        </svg>
        <dl className="market-visually-hidden">
          <div><dt>{copy.target}</dt><dd>$1,050</dd></div>
          <div><dt>{copy.entry}</dt><dd>$925</dd></div>
          <div><dt>{copy.stop}</dt><dd>$887</dd></div>
        </dl>
      </div>
    </div>
    <aside className="plan-order-sheet">
      <span className="specimen-kicker">{isZh ? '风险边界' : 'RISK ENVELOPE'}</span>
      <div className="risk-ring"><span>1%</span><small>{copy.riskBudget}</small></div>
      <dl>
        <div><dt>{isZh ? '仓位' : 'POSITION'}</dt><dd>{isZh ? '18 股' : '18 shares'}</dd></div>
        <div><dt>R:R</dt><dd>3.28</dd></div>
        <div><dt>{isZh ? '模式' : 'MODE'}</dt><dd>{isZh ? '模拟' : 'PAPER'}</dd></div>
      </dl>
      <div className="approval-state">
        <i />
        <span>{copy.awaitingApproval}</span>
      </div>
    </aside>
  </div>
);

interface ResearchSpecimenProps {
  stage: StageIndex;
  copy: MarketFieldCopy;
  isZh: boolean;
  showPeek?: boolean;
}

const ResearchSpecimen: React.FC<ResearchSpecimenProps> = ({ stage, copy, isZh, showPeek = false }) => {
  const shouldReduceMotion = useReducedMotion();
  const panels = [ObserveStage, FilterStage, TestStage, PlanStage] as const;
  const Panel = panels[stage];

  return (
    <div className={`research-specimen-shell ${showPeek ? 'has-peek' : ''}`}>
      <article className="research-specimen" aria-live="polite">
        <header className="research-specimen-header">
          <div>
            <strong>NVDA · {copy.momentum}</strong>
            <span>{copy.walkForwardAnalysis}</span>
          </div>
          <span className="specimen-mode-badge">{copy.sampleMode}</span>
        </header>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            className="research-specimen-body"
            key={stage}
            initial={shouldReduceMotion ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={shouldReduceMotion ? undefined : { opacity: 0, y: -8 }}
            transition={{ duration: shouldReduceMotion ? 0 : 0.38, ease: [0.16, 1, 0.3, 1] }}
          >
            <Panel copy={copy} isZh={isZh} />
          </motion.div>
        </AnimatePresence>
      </article>
      {showPeek && (
        <aside className="specimen-next-peek" aria-hidden="true">
          <span>{isZh ? '投资组合' : 'PORTFOLIO'}</span>
          <small>{isZh ? '风险分配' : 'RISK ALLOCATION'}</small>
          <div className="peek-ring" />
          <i />
          <i />
          <i />
          <i />
        </aside>
      )}
    </div>
  );
};

const Landing: React.FC = () => {
  const navigate = useNavigate();
  const { language, t } = useLanguage();
  const isZh = language === 'zh-CN';
  const copy = t.landing.marketField;
  const shouldReduceMotion = useReducedMotion();
  const storyRef = useRef<HTMLElement>(null);
  const mobileTrackRef = useRef<HTMLDivElement>(null);
  const [activeStage, setActiveStage] = useState<StageIndex>(0);
  const [mobileStage, setMobileStage] = useState<StageIndex>(0);

  const stages = useMemo<StageDefinition[]>(() => [
    { id: 'observe', label: copy.stageObserve, short: copy.stageObserveShort, title: copy.stageObserveTitle, description: copy.stageObserveDesc },
    { id: 'filter', label: copy.stageFilter, short: copy.stageFilterShort, title: copy.stageFilterTitle, description: copy.stageFilterDesc },
    { id: 'test', label: copy.stageTest, short: copy.stageTestShort, title: copy.stageTestTitle, description: copy.stageTestDesc },
    { id: 'plan', label: copy.stagePlan, short: copy.stagePlanShort, title: copy.stagePlanTitle, description: copy.stagePlanDesc },
  ], [copy]);

  const { scrollYProgress } = useScroll({
    target: storyRef,
    offset: ['start start', 'end end'],
  });

  useMotionValueEvent(scrollYProgress, 'change', latest => {
    const nextStage = Math.min(3, Math.floor(Math.max(0, latest) * 4)) as StageIndex;
    setActiveStage(current => current === nextStage ? current : nextStage);
  });

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const scrollToStage = (stage: StageIndex) => {
    const story = storyRef.current;
    if (!story) return;
    const storyTop = story.getBoundingClientRect().top + window.scrollY;
    const availableDistance = Math.max(0, story.offsetHeight - window.innerHeight);
    window.scrollTo({
      top: storyTop + (availableDistance * stage) / 3,
      behavior: shouldReduceMotion ? 'auto' : 'smooth',
    });
  };

  const scrollMobileStage = (stage: StageIndex) => {
    const track = mobileTrackRef.current;
    const slide = track?.children.item(stage) as HTMLElement | null;
    if (!track || !slide) return;
    track.scrollTo({
      left: slide.offsetLeft - track.offsetLeft,
      behavior: shouldReduceMotion ? 'auto' : 'smooth',
    });
    setMobileStage(stage);
  };

  const handleMobileScroll = (event: React.UIEvent<HTMLDivElement>) => {
    const track = event.currentTarget;
    const slides = Array.from(track.children) as HTMLElement[];
    if (!slides.length) return;
    const nearest = slides.reduce((best, slide, index) => {
      const distance = Math.abs(slide.offsetLeft - track.offsetLeft - track.scrollLeft);
      return distance < best.distance ? { index, distance } : best;
    }, { index: 0, distance: Number.POSITIVE_INFINITY });
    const next = Math.min(3, Math.max(0, nearest.index)) as StageIndex;
    setMobileStage(current => current === next ? current : next);
  };

  return (
    <MarketingLayout tone="paper">
      <main className={`market-field-page ${language === 'zh-CN' ? 'is-zh' : 'is-en'}`}>
        <section className="market-field-hero" aria-labelledby="market-field-title">
          <span className="paper-register paper-register--left" aria-hidden="true" />
          <span className="paper-register paper-register--right" aria-hidden="true" />
          <div className="market-hero-grid">
            <div className="market-hero-copy">
              <div className="market-title-meta">
                <span aria-hidden="true">01</span>
                <i aria-hidden="true" />
                <p className="market-eyebrow">{copy.eyebrow}</p>
              </div>
              <h1 id="market-field-title">
                <span>{copy.titleLine1}</span>
                <span className="market-title-promise">{copy.titleLine2}<i aria-hidden="true" /></span>
              </h1>
              <p className="market-hero-subtitle">{copy.subtitle}</p>
              <div className="market-hero-actions">
                <button type="button" className="market-primary-action" onClick={() => scrollToStage(0)}>
                  {copy.exploreWorkflow}
                </button>
                <button type="button" className="market-text-action" onClick={() => navigate('/platform')}>
                  {copy.openPlatform}<span aria-hidden="true">↗</span>
                </button>
              </div>
            </div>
            <div className="market-hero-estuary">
              <SignalEstuaryVisual
                locale={language}
                progress={1}
                className="signal-estuary--hero"
              />
            </div>
            <div className="market-hero-specimen">
              <ResearchSpecimen stage={2} copy={copy} isZh={isZh} showPeek />
            </div>
            <div className="market-hero-rail">
              <StageRail stages={stages} active={2} onSelect={scrollToStage} ariaLabel={copy.storyEyebrow} />
              <button type="button" className="market-scroll-cue" onClick={() => scrollToStage(0)}>
                {copy.scrollCue}<span aria-hidden="true">↓</span>
              </button>
            </div>
          </div>
        </section>

        <section className="market-story-intro" aria-labelledby="market-story-title">
          <p className="market-eyebrow">{copy.storyEyebrow}</p>
          <div>
            <h2 id="market-story-title">{copy.storyTitle}</h2>
            <p>{copy.storySubtitle}</p>
          </div>
        </section>

        {shouldReduceMotion ? (
          <section className="market-story-reduced" aria-label={copy.storyEyebrow}>
            {stages.map((stage, index) => (
              <article key={stage.id}>
                <div className="market-reduced-copy">
                  <span>0{index + 1}</span>
                  <h3>{stage.title}</h3>
                  <p>{stage.description}</p>
                </div>
                <ResearchSpecimen stage={index as StageIndex} copy={copy} isZh={isZh} />
              </article>
            ))}
          </section>
        ) : (
          <section className="market-story" ref={storyRef} aria-label={copy.storyEyebrow}>
            <div className="market-story-sticky">
              <motion.div className="market-story-progress" style={{ scaleX: scrollYProgress }} />
              <div className="market-story-copy">
                <span className="market-story-index">0{activeStage + 1} / 04</span>
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div
                    key={activeStage}
                    initial={{ opacity: 0, y: 18 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -12 }}
                    transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                  >
                    <p className="market-story-stage-label">{stages[activeStage].label}</p>
                    <h3>{stages[activeStage].title}</h3>
                    <p>{stages[activeStage].description}</p>
                  </motion.div>
                </AnimatePresence>
              </div>
              <div className="market-story-canvas">
                <ResearchSpecimen stage={activeStage} copy={copy} isZh={isZh} />
              </div>
              <div className="market-story-rail">
                <StageRail stages={stages} active={activeStage} onSelect={scrollToStage} ariaLabel={copy.storyEyebrow} />
              </div>
            </div>
          </section>
        )}

        <section className="market-story-mobile" aria-label={copy.storyEyebrow}>
          <div className="market-mobile-track" ref={mobileTrackRef} onScroll={handleMobileScroll}>
            {stages.map((stage, index) => (
              <article className="market-mobile-slide" key={stage.id}>
                <div className="market-mobile-slide-copy">
                  <span>0{index + 1} / 04 · {stage.label}</span>
                  <h3>{stage.title}</h3>
                  <p>{stage.description}</p>
                </div>
                <ResearchSpecimen stage={index as StageIndex} copy={copy} isZh={isZh} />
              </article>
            ))}
          </div>
          <div className="market-mobile-controls">
            <button
              type="button"
              onClick={() => scrollMobileStage(Math.max(0, mobileStage - 1) as StageIndex)}
              disabled={mobileStage === 0}
              aria-label={t.common.back}
            >
              ←
            </button>
            <div aria-live="polite" aria-atomic="true">
              <span>{stages[mobileStage].label}</span>
              <b>{mobileStage + 1} / 4</b>
            </div>
            <button
              type="button"
              onClick={() => scrollMobileStage(Math.min(3, mobileStage + 1) as StageIndex)}
              disabled={mobileStage === 3}
              aria-label={t.common.next}
            >
              →
            </button>
          </div>
        </section>

        <section className="market-examples" aria-labelledby="market-examples-title">
          <header className="market-examples-heading">
            <p className="market-eyebrow">{language === 'zh-CN' ? '交互式研究案例' : 'INTERACTIVE RESEARCH EXAMPLES'}</p>
            <div>
              <h2 id="market-examples-title">{language === 'zh-CN' ? '先检查结果是怎么得出的。' : 'Inspect how the result was produced.'}</h2>
              <p>{language === 'zh-CN' ? '切换研究假设和时间范围，比较样本外收益、回撤、换手率与证据摘要。全部数字均为模拟界面样例。' : 'Switch research hypotheses and ranges to compare out-of-sample return, drawdown, turnover, and the attached evidence summary. All figures are simulated interface examples.'}</p>
            </div>
          </header>
          <ResearchExamplesExplorer locale={language} />
          <div className="market-examples-footer">
            <span>{language === 'zh-CN' ? '3 份公开研究样本 · 15 个样本外窗口' : '3 PUBLIC RESEARCH NOTES · 15 OUT-OF-SAMPLE FOLDS'}</span>
            <button type="button" className="market-text-action" onClick={() => navigate('/examples')}>
              {language === 'zh-CN' ? '浏览全部案例' : 'Browse all examples'}<span aria-hidden="true">↗</span>
            </button>
          </div>
        </section>

        <section className="market-proof" aria-labelledby="market-proof-title">
          <div className="market-proof-copy">
            <p className="market-eyebrow">{copy.researchProof}</p>
            <h2 id="market-proof-title">{copy.researchProofTitle}</h2>
            <p>{copy.researchProofDesc}</p>
          </div>
          <dl className="market-proof-metrics">
            <div><dt><span aria-hidden="true">01</span>{copy.observed}</dt><dd>8,421</dd></div>
            <div><dt><span aria-hidden="true">02</span>{copy.shortlisted}</dt><dd>24</dd></div>
            <div><dt><span aria-hidden="true">03</span>{copy.validated}</dt><dd>3</dd></div>
            <div><dt><span aria-hidden="true">04</span>{copy.riskPlan}</dt><dd>1</dd></div>
          </dl>
        </section>

        <section className="market-final-cta">
          <p className="market-eyebrow">{isZh ? 'ALPHALAB · 模拟优先' : 'ALPHALAB · PAPER FIRST'}</p>
          <h2>{copy.ctaTitle}</h2>
          <p>{copy.ctaDesc}</p>
          <div>
            <button type="button" className="market-primary-action" onClick={() => navigate('/signup')}>
              {copy.ctaPrimary}
            </button>
            <button type="button" className="market-text-action" onClick={() => navigate('/workflow')}>
              {copy.ctaSecondary}<span aria-hidden="true">↗</span>
            </button>
          </div>
        </section>
      </main>
    </MarketingLayout>
  );
};

export default Landing;
