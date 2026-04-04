// Portfolio 下半页重做演示
// 展示如何应用统一的设计系统

const PortfolioRedesignDemo = () => {
  // 使用上一轮建立的 DESIGN_SYSTEM
  const DESIGN_SYSTEM = {
    colors: {
      primary: '#1890ff',
      success: '#52c41a',
      error: '#ff4d4f',
      warning: '#faad14',
      text: {
        primary: 'rgba(0, 0, 0, 0.85)',
        secondary: 'rgba(0, 0, 0, 0.45)',
      },
      background: {
        card: '#ffffff',
        page: '#f5f5f5',
        hover: '#fafafa',
      },
      border: '#f0f0f0',
    },
    spacing: {
      xs: '8px',
      sm: '16px',
      md: '24px',
      lg: '32px',
      xl: '48px',
    },
    card: {
      borderRadius: '8px',
      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
      border: '1px solid #f0f0f0',
    },
  };

  const styles = {
    card: {
      borderRadius: DESIGN_SYSTEM.card.borderRadius,
      boxShadow: DESIGN_SYSTEM.card.boxShadow,
      border: DESIGN_SYSTEM.card.border,
      backgroundColor: DESIGN_SYSTEM.colors.background.card,
      padding: DESIGN_SYSTEM.spacing.md,
      marginBottom: DESIGN_SYSTEM.spacing.md,
    },
    sectionTitle: {
      fontSize: '18px',
      fontWeight: 600,
      marginBottom: DESIGN_SYSTEM.spacing.sm,
      color: DESIGN_SYSTEM.colors.text.primary,
    },
    subsectionTitle: {
      fontSize: '16px',
      fontWeight: 600,
      marginBottom: DESIGN_SYSTEM.spacing.xs,
      color: DESIGN_SYSTEM.colors.text.primary,
    },
    description: {
      fontSize: '13px',
      color: DESIGN_SYSTEM.colors.text.secondary,
      marginBottom: DESIGN_SYSTEM.spacing.sm,
    },
    statValue: (color) => ({
      fontSize: '20px',
      fontWeight: 600,
      color: color || DESIGN_SYSTEM.colors.text.primary,
    }),
    statTitle: {
      fontSize: '12px',
      color: DESIGN_SYSTEM.colors.text.secondary,
      marginBottom: '4px',
    },
    tag: {
      borderRadius: '12px',
      padding: '2px 8px',
      fontSize: '11px',
      fontWeight: 500,
    },
    table: {
      header: {
        backgroundColor: DESIGN_SYSTEM.colors.background.hover,
        fontWeight: 600,
        color: DESIGN_SYSTEM.colors.text.primary,
      },
      cell: {
        padding: '12px 16px',
      },
    },
  };

  return (
    <div style={{ padding: DESIGN_SYSTEM.spacing.md }}>
      {/* ========== Paper Trading Control Panel (重做版) ========== */}
      <div style={{ marginBottom: DESIGN_SYSTEM.spacing.lg }}>
        <h2 style={styles.sectionTitle}>Trading Control Panel</h2>
        
        {/* 状态信息区 */}
        <div style={{ ...styles.card, marginBottom: DESIGN_SYSTEM.spacing.sm }}>
          <h3 style={styles.subsectionTitle}>Current Status</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: DESIGN_SYSTEM.spacing.sm }}>
            <div style={{ 
              ...styles.tag, 
              backgroundColor: DESIGN_SYSTEM.colors.primary + '15',
              color: DESIGN_SYSTEM.colors.primary 
            }}>
              Mode: LOCAL
            </div>
            <div style={{ 
              ...styles.tag, 
              backgroundColor: DESIGN_SYSTEM.colors.success + '15',
              color: DESIGN_SYSTEM.colors.success 
            }}>
              Strategy: MA Crossover
            </div>
            <div style={{ 
              ...styles.tag, 
              backgroundColor: DESIGN_SYSTEM.colors.warning + '15',
              color: DESIGN_SYSTEM.colors.warning 
            }}>
              Preset: Fast (5/10)
            </div>
            <div style={{ 
              ...styles.tag, 
              backgroundColor: DESIGN_SYSTEM.colors.text.secondary + '15',
              color: DESIGN_SYSTEM.colors.text.secondary 
            }}>
              Slippage: 0.10%
            </div>
            <div style={{ 
              ...styles.tag, 
              backgroundColor: DESIGN_SYSTEM.colors.text.secondary + '15',
              color: DESIGN_SYSTEM.colors.text.secondary 
            }}>
              Commission: $0.00
            </div>
          </div>
        </div>

        {/* 控制按钮区 */}
        <div style={{ ...styles.card, marginBottom: DESIGN_SYSTEM.spacing.sm }}>
          <h3 style={styles.subsectionTitle}>Trading Controls</h3>
          <div style={{ display: 'flex', gap: DESIGN_SYSTEM.spacing.sm, flexWrap: 'wrap' }}>
            <button style={{
              padding: `${DESIGN_SYSTEM.spacing.xs} ${DESIGN_SYSTEM.spacing.sm}`,
              backgroundColor: DESIGN_SYSTEM.colors.success,
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              fontWeight: 500,
              cursor: 'pointer',
            }}>
              Start Paper Trading
            </button>
            <button style={{
              padding: `${DESIGN_SYSTEM.spacing.xs} ${DESIGN_SYSTEM.spacing.sm}`,
              backgroundColor: DESIGN_SYSTEM.colors.error,
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              fontWeight: 500,
              cursor: 'pointer',
            }}>
              Stop Paper Trading
            </button>
            <button style={{
              padding: `${DESIGN_SYSTEM.spacing.xs} ${DESIGN_SYSTEM.spacing.sm}`,
              backgroundColor: DESIGN_SYSTEM.colors.primary,
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              fontWeight: 500,
              cursor: 'pointer',
            }}>
              Run Batch Experiment
            </button>
          </div>
        </div>

        {/* 设置区 */}
        <div style={styles.card}>
          <h3 style={styles.subsectionTitle}>Trading Settings</h3>
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: DESIGN_SYSTEM.spacing.sm 
          }}>
            <div>
              <div style={styles.statTitle}>Symbol</div>
              <div style={styles.statValue()}>AAPL</div>
            </div>
            <div>
              <div style={styles.statTitle}>Shares per Trade</div>
              <div style={styles.statValue()}>10</div>
            </div>
            <div>
              <div style={styles.statTitle}>Interval</div>
              <div style={styles.statValue()}>5 seconds</div>
            </div>
          </div>
        </div>
      </div>

      {/* ========== Session Analysis (重做版) ========== */}
      <div style={{ marginBottom: DESIGN_SYSTEM.spacing.lg }}>
        <h2 style={styles.sectionTitle}>Session Analysis</h2>
        
        {/* Comparison 模块 */}
        <div style={{ ...styles.card, marginBottom: DESIGN_SYSTEM.spacing.md }}>
          <h3 style={styles.subsectionTitle}>Backtest vs Paper Trading Comparison</h3>
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: '1fr 1fr',
            gap: DESIGN_SYSTEM.spacing.md,
            borderTop: `1px solid ${DESIGN_SYSTEM.colors.border}`,
            paddingTop: DESIGN_SYSTEM.spacing.md 
          }}>
            {/* Backtest 侧 */}
            <div>
              <div style={{ 
                ...styles.statTitle, 
                color: DESIGN_SYSTEM.colors.primary,
                fontWeight: 600 
              }}>
                Backtest Results
              </div>
              <div style={styles.statValue(DESIGN_SYSTEM.colors.primary)}>+12.5%</div>
              <div style={styles.description}>25 trades • $1,250 profit</div>
            </div>
            
            {/* Paper Trading 侧 */}
            <div>
              <div style={{ 
                ...styles.statTitle, 
                color: DESIGN_SYSTEM.colors.success,
                fontWeight: 600 
              }}>
                Paper Trading Results
              </div>
              <div style={styles.statValue(DESIGN_SYSTEM.colors.success)}>+10.2%</div>
              <div style={styles.description}>22 trades • $1,020 profit</div>
            </div>
          </div>
          
          {/* Gap 分析 */}
          <div style={{ 
            marginTop: DESIGN_SYSTEM.spacing.md,
            padding: DESIGN_SYSTEM.spacing.sm,
            backgroundColor: DESIGN_SYSTEM.colors.background.hover,
            borderRadius: '4px'
          }}>
            <div style={styles.statTitle}>Performance Gap</div>
            <div style={styles.statValue(DESIGN_SYSTEM.colors.warning)}>-2.3%</div>
            <div style={styles.description}>Mainly due to slippage and commission costs</div>
          </div>
        </div>

        {/* Session Insights */}
        <div style={styles.card}>
          <h3 style={styles.subsectionTitle}>Session Insights</h3>
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
            gap: DESIGN_SYSTEM.spacing.sm 
          }}>
            <div>
              <div style={styles.statTitle}>Total Sessions</div>
              <div style={styles.statValue()}>15</div>
            </div>
            <div>
              <div style={styles.statTitle}>Win Rate</div>
              <div style={styles.statValue(DESIGN_SYSTEM.colors.success)}>73%</div>
            </div>
            <div>
              <div style={styles.statTitle}>Avg Return</div>
              <div style={styles.statValue(DESIGN_SYSTEM.colors.success)}>+8.2%</div>
            </div>
            <div>
              <div style={styles.statTitle}>Best Session</div>
              <div style={styles.statValue(DESIGN_SYSTEM.colors.success)}>+24.5%</div>
            </div>
          </div>
        </div>
      </div>

      {/* ========== Positions & Trades (重做版) ========== */}
      <div>
        <h2 style={styles.sectionTitle}>Positions & Trading Activity</h2>
        
        {/* Current Positions 表格 */}
        <div style={{ ...styles.card, marginBottom: DESIGN_SYSTEM.spacing.md }}>
          <h3 style={styles.subsectionTitle}>Current Positions</h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={styles.table.header}>
                  <th style={{ ...styles.table.cell, textAlign: 'left' }}>Symbol</th>
                  <th style={{ ...styles.table.cell, textAlign: 'right' }}>Shares</th>
                  <th style={{ ...styles.table.cell, textAlign: 'right' }}>Avg Price</th>
                  <th style={{ ...styles.table.cell, textAlign: 'right' }}>Market Value</th>
                  <th style={{ ...styles.table.cell, textAlign: 'right' }}>P&L</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ ...styles.table.cell, fontWeight: 600 }}>AAPL</td>
                  <td style={{ ...styles.table.cell, textAlign: 'right' }}>100</td>
                  <td style={{ ...styles.table.cell, textAlign: 'right' }}>$175.50</td>
                  <td style={{ ...styles.table.cell, textAlign: 'right' }}>$17,600</td>
                  <td style={{ ...styles.table.cell, textAlign: 'right', color: DESIGN_SYSTEM.colors.success }}>
                    +$50 (+0.28%)
                  </td>
                </tr>
                <tr>
                  <td style={{ ...styles.table.cell, fontWeight: 600 }}>TSLA</td>
                  <td style={{ ...styles.table.cell, textAlign: 'right' }}>50</td>
                  <td style={{ ...styles.table.cell, textAlign: 'right' }}>$250.00</td>
                  <td style={{ ...styles.table.cell, textAlign: 'right' }}$12,500</td>
                  <td style={{ ...styles.table.cell, textAlign: 'right', color: DESIGN_SYSTEM.colors.error }}>
                    -$125 (-1.00%)
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent Trades 表格 */}
        <div style={styles.card}>
          <h3 style={styles.subsectionTitle}>Recent Trades</h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={styles.table.header}>
                  <th style={{ ...styles.table.cell, textAlign: 'left' }}>Time</th>
                  <th style={{ ...styles.table.cell, textAlign: 'left' }}>Symbol</th>
                  <th style={{ ...styles.table.cell, textAlign: 'left' }}>Action</th>
                  <th style={{ ...styles.table.cell, textAlign: 'right' }}>Shares</th>
                  <th style={{ ...styles.table.cell, textAlign: 'right' }}>Price</th>
                  <th style={{ ...styles.table.cell, textAlign: 'right' }}>Value</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={styles.table.cell}>14:30:22</td>
                  <td style={{ ...styles.table.cell, fontWeight: 600 }}>AAPL</td>
                  <td style={{ ...styles.table.cell, color: DESIGN_SYSTEM.colors.success }}>BUY</td>
                  <td style={{ ...styles.table.cell, textAlign: 'right' }}>10</td>
                  <td style={{ ...styles.table.cell, textAlign: 'right' }}>$176.00</td>
                  <td style={{ ...styles.table.cell, textAlign: 'right' }}>$1,760</td>
                </tr>
                <tr>
                  <td style={styles.table.cell}>14:25:15</td>
                  <td style={{ ...styles.table.cell, fontWeight: 600 }}>TSLA</td>
                  <td style={{ ...styles.table.cell, color: DESIGN_SYSTEM.colors.error }}>SELL</td>
                  <td style={{ ...styles.table.cell, textAlign: 'right' }}>5</td>
                  <td style={{ ...styles.table.cell, textAlign: 'right' }}$249.50</td>
                  <td style={{ ...styles.table.cell, textAlign: 'right' }}$1,247.50</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

// 导出演示组件
export default PortfolioRedesignDemo;