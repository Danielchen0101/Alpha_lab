import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../../contexts/LanguageContext';

interface PublicHeroProps {
  eyebrow: string;
  index: string;
  title: string;
  subtitle: string;
  primaryLabel?: string;
  secondaryLabel?: string;
  onSecondary?: () => void;
  children: React.ReactNode;
}

export const PublicHero: React.FC<PublicHeroProps> = ({
  eyebrow,
  index,
  title,
  subtitle,
  primaryLabel,
  secondaryLabel,
  onSecondary,
  children,
}) => {
  const navigate = useNavigate();

  return (
    <section className="public-hero">
      <div className="public-hero-copy">
        <div className="public-kicker"><span>{index}</span><i aria-hidden="true" /><b>{eyebrow}</b></div>
        <h1>{title}</h1>
        <p>{subtitle}</p>
        {(primaryLabel || secondaryLabel) && (
          <div className="public-actions">
            {primaryLabel && <button type="button" className="public-primary" onClick={() => navigate('/signup')}>{primaryLabel}</button>}
            {secondaryLabel && <button type="button" className="public-secondary" onClick={onSecondary}>{secondaryLabel}<span aria-hidden="true">↓</span></button>}
          </div>
        )}
      </div>
      <div className="public-hero-visual">{children}</div>
    </section>
  );
};

interface SectionHeadingProps {
  eyebrow: string;
  title: string;
  description?: string;
  level?: 1 | 2;
}

export const SectionHeading: React.FC<SectionHeadingProps> = ({ eyebrow, title, description, level = 2 }) => {
  const Heading = level === 1 ? 'h1' : 'h2';

  return (
    <header className="public-section-heading">
      <p>{eyebrow}</p>
      <div>
        <Heading>{title}</Heading>
        {description && <span>{description}</span>}
      </div>
    </header>
  );
};

interface MiniSparklineProps {
  values: number[];
  color?: 'blue' | 'moss' | 'copper';
  label: string;
  secondaryValues?: number[];
  secondaryLabel?: string;
  startLabel?: string;
  endLabel?: string;
  size?: 'compact' | 'featured';
  variant?: 'smooth' | 'step';
  baseline?: 'bottom' | 'first';
  bands?: number;
  showNodes?: boolean;
}

interface ChartPoint { x: number; y: number; }

const smoothPath = (points: ChartPoint[]) => {
  if (!points.length) return '';
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  return points.slice(0, -1).reduce((path, point, index) => {
    const previous = points[index - 1] || point;
    const next = points[index + 1];
    const afterNext = points[index + 2] || next;
    const segmentMinY = Math.min(point.y, next.y);
    const segmentMaxY = Math.max(point.y, next.y);
    const clampY = (value: number) => Math.max(segmentMinY, Math.min(segmentMaxY, value));
    const control1 = { x: point.x + (next.x - previous.x) / 6, y: clampY(point.y + (next.y - previous.y) / 6) };
    const control2 = { x: next.x - (afterNext.x - point.x) / 6, y: clampY(next.y - (afterNext.y - point.y) / 6) };
    return `${path} C ${control1.x.toFixed(1)} ${control1.y.toFixed(1)}, ${control2.x.toFixed(1)} ${control2.y.toFixed(1)}, ${next.x.toFixed(1)} ${next.y.toFixed(1)}`;
  }, `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`);
};

const stepPath = (points: ChartPoint[]) => points.reduce((path, point, index) => {
  if (index === 0) return `M ${point.x.toFixed(1)} ${point.y.toFixed(1)}`;
  return `${path} H ${point.x.toFixed(1)} V ${point.y.toFixed(1)}`;
}, '');

export const MiniSparkline: React.FC<MiniSparklineProps> = ({
  values,
  color = 'blue',
  label,
  secondaryValues,
  secondaryLabel,
  startLabel,
  endLabel,
  size = 'compact',
  variant = 'smooth',
  baseline = 'bottom',
  bands = 0,
  showNodes = false,
}) => {
  const { language } = useLanguage();
  const isZh = language === 'zh-CN';
  const resolvedStartLabel = startLabel || (isZh ? '起点' : 'START');
  const resolvedEndLabel = endLabel || (isZh ? '现在' : 'NOW');
  const featured = size === 'featured';
  const width = featured ? 640 : 360;
  const height = featured ? 220 : 118;
  const plot = featured
    ? { left: 28, right: 624, top: 18, bottom: 188 }
    : { left: 18, right: 348, top: 12, bottom: 92 };
  const primaryValues = values.length ? values : [0];
  const compareValues = secondaryValues?.length ? secondaryValues : undefined;
  const domainValues = compareValues ? [...primaryValues, ...compareValues] : primaryValues;
  const min = Math.min(...domainValues);
  const max = Math.max(...domainValues);
  const domainPadding = Math.max(1, (max - min) * .1);
  const domainMin = min - domainPadding;
  const domainMax = max + domainPadding;
  const range = Math.max(1, domainMax - domainMin);
  const chartId = React.useId().replace(/:/g, '');
  const gradientId = `spark-area-${chartId}`;
  const titleId = `spark-title-${chartId}`;
  const descId = `spark-desc-${chartId}`;
  const toPoints = (series: number[]) => series.map((value, index) => ({
    x: plot.left + (index / Math.max(1, series.length - 1)) * (plot.right - plot.left),
    y: plot.bottom - ((value - domainMin) / range) * (plot.bottom - plot.top),
  }));
  const primaryPoints = toPoints(primaryValues);
  const comparisonPoints = compareValues ? toPoints(compareValues) : undefined;
  const pathBuilder = variant === 'step' ? stepPath : smoothPath;
  const primaryPath = pathBuilder(primaryPoints);
  const comparisonPath = comparisonPoints ? pathBuilder(comparisonPoints) : undefined;
  const firstPoint = primaryPoints[0];
  const lastPoint = primaryPoints[primaryPoints.length - 1];
  const comparisonLastPoint = comparisonPoints?.[comparisonPoints.length - 1];
  const baselineY = baseline === 'first' ? firstPoint.y : plot.bottom;
  const areaPath = `${primaryPath} L ${lastPoint.x.toFixed(1)} ${baselineY.toFixed(1)} L ${firstPoint.x.toFixed(1)} ${baselineY.toFixed(1)} Z`;
  const axisY = height - 7;

  return (
    <svg className={`public-sparkline is-${color} size-${size} ${comparisonPath ? 'has-comparison' : ''}`} viewBox={`0 0 ${width} ${height}`} role="img" aria-labelledby={`${titleId} ${descId}`}>
      <title id={titleId}>{label}</title>
      <desc id={descId}>
        {isZh
          ? `${label}：从 ${primaryValues[0].toFixed(1)} 变化至 ${primaryValues[primaryValues.length - 1].toFixed(1)}。`
          : `${label}: ${primaryValues[0].toFixed(1)} to ${primaryValues[primaryValues.length - 1].toFixed(1)}.`}
        {comparisonPath
          ? isZh
            ? ` ${secondaryLabel || '对比基准'}：从 ${compareValues?.[0].toFixed(1)} 变化至 ${compareValues?.[compareValues.length - 1].toFixed(1)}。`
            : ` ${secondaryLabel || 'Comparison'}: ${compareValues?.[0].toFixed(1)} to ${compareValues?.[compareValues.length - 1].toFixed(1)}.`
          : ''}
      </desc>
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity=".2" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      {bands > 0 && (
        <g className="public-sparkline-bands" aria-hidden="true">
          {Array.from({ length: bands }, (_, index) => {
            const bandWidth = (plot.right - plot.left) / bands;
            return <rect key={index} x={plot.left + bandWidth * index} y={plot.top} width={bandWidth} height={plot.bottom - plot.top} className={index % 2 === 0 ? 'is-even' : undefined} />;
          })}
        </g>
      )}
      <g className="public-sparkline-grid" aria-hidden="true">
        {[plot.top, (plot.top + plot.bottom) / 2, plot.bottom].map(y => <line key={`y-${y}`} x1={plot.left} y1={y} x2={plot.right} y2={y} />)}
        {[0, .25, .5, .75, 1].map(step => {
          const x = plot.left + step * (plot.right - plot.left);
          return <line key={`x-${step}`} x1={x} y1={plot.top} x2={x} y2={plot.bottom} />;
        })}
      </g>
      <path className="public-sparkline-area" d={areaPath} fill={`url(#${gradientId})`} aria-hidden="true" />
      {comparisonPath && <path className="public-sparkline-comparison" d={comparisonPath} aria-hidden="true" />}
      <path className="public-sparkline-line" d={primaryPath} aria-hidden="true" />
      {showNodes && <g className="public-sparkline-nodes" aria-hidden="true">{primaryPoints.map((point, index) => <circle key={index} cx={point.x} cy={point.y} r="1.8" />)}</g>}
      <g className="public-sparkline-start" aria-hidden="true"><circle cx={firstPoint.x} cy={firstPoint.y} r="2" /></g>
      {comparisonLastPoint && <circle className="public-sparkline-comparison-end" cx={comparisonLastPoint.x} cy={comparisonLastPoint.y} r="2.5" aria-hidden="true" />}
      <g className="public-sparkline-end" aria-hidden="true">
        <circle className="public-sparkline-halo" cx={lastPoint.x} cy={lastPoint.y} r="7" />
        <circle className="public-sparkline-dot" cx={lastPoint.x} cy={lastPoint.y} r="3.2" />
      </g>
      <g className="public-sparkline-axis" aria-hidden="true">
        <text x={plot.left} y={axisY}>{resolvedStartLabel}</text>
        <text x={plot.right} y={axisY} textAnchor="end">{resolvedEndLabel}</text>
      </g>
    </svg>
  );
};

interface MetricStripProps {
  metrics: Array<{ label: string; value: string; tone?: 'blue' | 'moss' | 'copper' }>;
}

export const MetricStrip: React.FC<MetricStripProps> = ({ metrics }) => (
  <dl className="public-metric-strip">
    {metrics.map((metric, index) => (
      <div key={`${metric.label}-${index}`}>
        <dt><span>0{index + 1}</span>{metric.label}</dt>
        <dd className={metric.tone ? `is-${metric.tone}` : undefined}>{metric.value}</dd>
      </div>
    ))}
  </dl>
);

interface PublicCtaProps {
  eyebrow: string;
  title: string;
  description: string;
  primary: string;
  secondary: string;
  secondaryPath?: string;
}

export const PublicCta: React.FC<PublicCtaProps> = ({ eyebrow, title, description, primary, secondary, secondaryPath = '/workflow' }) => {
  const navigate = useNavigate();
  return (
    <section className="public-cta">
      <p>{eyebrow}</p>
      <h2>{title}</h2>
      <span>{description}</span>
      <div className="public-actions">
        <button type="button" className="public-primary" onClick={() => navigate('/signup')}>{primary}</button>
        <button type="button" className="public-secondary" onClick={() => navigate(secondaryPath)}>{secondary}<span aria-hidden="true">↗</span></button>
      </div>
    </section>
  );
};
