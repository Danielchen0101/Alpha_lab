const { readFileSync } = require('fs');
const { join } = require('path');

const readStyle = (...parts) => readFileSync(join(process.cwd(), 'src', ...parts), 'utf8');

describe('dark workspace surface contract', () => {
  it('themes Ant Design transient and loading surfaces instead of leaving bright islands', () => {
    const css = readStyle('index.css');

    expect(css).toContain('--app-info-surface: rgba(');
    expect(css).toContain(':root[data-theme="dark"] .ant-alert');
    expect(css).toContain(':root[data-theme="dark"] .ant-skeleton-title');
    expect(css).toContain(':root[data-theme="dark"] .ant-message-notice-content');
    expect(css).toContain('.ant-table-ping-left:not(.ant-table-has-fix-left) .ant-table-container::before');
    expect(css).toContain(':root[data-theme="dark"] .ant-progress-inner');
  });

  it('contains Portfolio cards, tables, tooltips, empty states, and progress rails', () => {
    const css = readStyle('pages', 'PortfolioEditorial.css');

    expect(css).toContain(":root[data-theme='dark'] .portfolio-editorial {");
    expect(css).toContain('.portfolio-equity-tooltip');
    expect(css).toContain('.ant-table-placeholder .ant-table-cell');
    expect(css).toContain('.portfolio-insights .ant-progress-inner');
  });

  it('gives Crypto and Kalshi semantic dark surfaces for their custom components', () => {
    const crypto = readStyle('styles', 'Crypto.css');
    const kalshi = readStyle('styles', 'Kalshi.css');

    expect(crypto).toContain(":root[data-theme='dark'] .cx-root {");
    expect(crypto).toContain('.cx-profile-strip > div.selected');
    expect(crypto).toContain('.cx-experiment-band.blocked');
    expect(kalshi).toContain('background: color-mix(in srgb, var(--kalshi-surface) 92%, transparent);');
    expect(kalshi).toContain('background: color-mix(in srgb, var(--kalshi-green) 8%, var(--kalshi-surface));');
  });
});
