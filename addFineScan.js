const fs = require('fs');
const path = 'C:/Users/kexuc/.openclaw/workspace/professional_quant_platform/frontend/src/pages/Portfolio.tsx';
let l = fs.readFileSync(path, 'utf8').split('\n');
console.log('Initial lines:', l.length);

// ============================================================
// INSERTS (bottom-up to preserve indices)
// ============================================================

// ---- C) JSX BLOCK ----
// Insert Fine Scan JSX before line containing "// 测试函数：验证AI Recommendations实现"
const testCommentIdx = l.findIndex(x => x.includes('测试函数：验证AI Recommendations实现'));
console.log('testComment at:', testCommentIdx+1);

// The blank line before the test comment is where we insert the new section
// Looking at the structure: 
// 6079 })()}
// 6080 </Card>
// 6081 </div>       <-- this closes the Continue Scan section div
// 6082 (blank)      <-- insert here (line 6083 in original)
// 6083 (blank)      <-- becomes 6084 after insert
// Wait, let me re-check

// Actual: 6081 is the </div> (closing the section)
// 6082 is blank
// 6083 is blank  
// 6084 is </div> (closing component div)
// 6085 is blank
// 6086 is ");"
// 6087 is blank
// 6088 is "// 测试函数"
// Actually after state insertion, let's re-check

// Let's find the exact insertion point: the blank line between section close and component close
// The Continue Scan section structure ends with:
//   })()}
// </Card>     <-- last outer Card
// </div>      <-- section wrapping div
//
// (blank)
// </div>      <-- component root div
// );

// We insert after the section </div>, before </div>

// Actually let's find the exact lines
const sectionCloseDiv = l.findIndex((x, i) => {
  return x.trim() === '</div>' && 
         i > 6050 && 
         i < 6085 && 
         l[i+1] && l[i+1].trim() === '' &&
         l[i+2] && l[i+2].trim() === '</div>';
});
console.log('Section close </div> at:', sectionCloseDiv+1);
console.log('Next:', l[sectionCloseDiv+1].trimEnd().substring(0, 40));
console.log('Next2:', l[sectionCloseDiv+2].trimEnd().substring(0, 40));

// The Fine Scan JSX block goes between sectionCloseDiv and sectionCloseDiv+2
// ===== FINE SCAN JSX BLOCK =====
const fineScanJSX = `
      {/* 3. Fine Scan */}
      <div style={{ marginBottom: 24 }}>
        <Title level={4}>
          <ThunderboltOutlined style={{ marginRight: '8px' }} />
          Fine Scan
          <Text style={{ fontSize: '13px', fontWeight: 'normal', color: '#888', marginLeft: '12px' }}>
            Step 1: Strategy matching scan for continue-list candidates
          </Text>
        </Title>
        
        <Card>
          <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <Text style={{ fontSize: '12px', color: '#666' }}>
                Analyzes each continue-list candidate's market structure and matches 2-3 suitable strategies
              </Text>
            </div>
            <Space>
              <Button
                type="primary"
                icon={<ThunderboltOutlined />}
                onClick={handleRunFineScan}
                disabled={fineScanStatus === 'running' || preferredContinueScanList.length === 0}
                loading={fineScanStatus === 'running'}
              >
                {fineScanStatus === 'running' ? 'Running...' : 'Run Fine Scan'}
              </Button>
            </Space>
          </div>

          {fineScanStatus === 'running' && (
            <div style={{ marginBottom: 16 }}>
              <Progress percent={fineScanProgress} status="active" />
              <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                Processing candidates...
              </div>
            </div>
          )}

          {fineScanResults.length > 0 && (
            <Table
              dataSource={fineScanResults}
              rowKey="symbol"
              pagination={false}
              size="small"
              scroll={{ x: 'max-content' }}
              columns={[
                {
                  title: 'Symbol',
                  key: 'symbol',
                  width: 80,
                  render: (record) => (
                    <Text strong style={{ fontSize: '12px' }}>{record.symbol}</Text>
                  ),
                },
                {
                  title: 'Regime',
                  key: 'regime',
                  width: 130,
                  render: (record) => {
                    const regime = record.regime || 'Unknown';
                    let color = '#8c8c8c';
                    let bg = '#f0f0f0';
                    if (regime === 'Trending') { color = '#1890ff'; bg = '#e6f7ff'; }
                    else if (regime === 'Range-bound') { color = '#faad14'; bg = '#fff7e6'; }
                    else if (regime === 'Breakout-ready') { color = '#52c41a'; bg = '#f6ffed'; }
                    return (
                      <Tag color={color} style={{ fontSize: '11px', fontWeight: 500 }}>{regime}</Tag>
                    );
                  },
                },
                {
                  title: 'Matched Strategies',
                  key: 'strategies',
                  width: 280,
                  render: (record) => {
                    const strategies = record.matchedStrategies || [];
                    return (
                      <Space size={[4, 4]} wrap>
                        {strategies.map((s: string, i: number) => (
                          <Tag key={i} style={{ fontSize: '10px', margin: 0 }}>{s}</Tag>
                        ))}
                      </Space>
                    );
                  },
                },
                {
                  title: 'Why Matched',
                  key: 'reason',
                  width: 200,
                  render: (record) => (
                    <Text style={{ fontSize: '11px', color: '#666', lineHeight: '1.4' }}>
                      {record.matchReason || ''}
                    </Text>
                  ),
                },
                {
                  title: 'Key Signals',
                  key: 'signals',
                  width: 200,
                  render: (record) => {
                    const signals = record.keySignals || [];
                    return (
                      <Space size={[2, 2]} wrap>
                        {signals.map((sig: string, i: number) => (
                          <Tag key={i} color="default" style={{ fontSize: '9px', margin: 0, padding: '0 4px', lineHeight: '18px' }}>
                            {sig}
                          </Tag>
                        ))}
                      </Space>
                    );
                  },
                },
                {
                  title: 'Match',
                  key: 'confidence',
                  width: 80,
                  render: (record) => {
                    const conf = record.matchConfidence || 0;
                    let color = '#8c8c8c';
                    if (conf >= 80) color = '#52c41a';
                    else if (conf >= 60) color = '#faad14';
                    else color = '#ff4d4f';
                    return (
                      <div style={{ textAlign: 'center' }}>
                        <div style={{
                          display: 'inline-block',
                          padding: '2px 8px',
                          borderRadius: '4px',
                          backgroundColor: color + '20',
                          color: color,
                          fontSize: '11px',
                          fontWeight: 600
                        }}>
                          {conf}%
                        </div>
                      </div>
                    );
                  },
                },
                {
                  title: 'Priority',
                  key: 'priority',
                  width: 70,
                  render: (record) => (
                    <div style={{ textAlign: 'center' }}>
                      <Text style={{ fontSize: '11px', color: '#1f1f1f', fontWeight: 500 }}>
                        #{record.priority || '-'}
                      </Text>
                    </div>
                  ),
                },
              ]}
            />
          )}

          {fineScanStatus === 'completed' && fineScanResults.length === 0 && (
            <div style={{ textAlign: 'center', padding: '24px 0', color: '#999' }}>
              <Text>No candidates to analyze. Run Continue Scan first.</Text>
            </div>
          )}

          {fineScanStatus === 'error' && (
            <div style={{ textAlign: 'center', padding: '24px 0', color: '#ff4d4f' }}>
              <CloseCircleOutlined style={{ fontSize: '24px', marginBottom: 8 }} />
              <div>An error occurred during strategy matching</div>
            </div>
          )}

          {fineScanStatus === 'idle' && fineScanResults.length === 0 && (
            <div style={{ textAlign: 'center', padding: '24px 0', color: '#999' }}>
              <ThunderboltOutlined style={{ fontSize: '36px', marginBottom: 12, opacity: 0.4 }} />
              <div style={{ fontSize: '13px' }}>Run Fine Scan to match strategies for continue-list candidates</div>
              <div style={{ fontSize: '11px', marginTop: 8, color: '#bbb' }}>
                Scan will analyze each candidate's market structure and recommend 2-3 suitable strategies
              </div>
            </div>
          )}
        </Card>
      </div>
`.trimStart();

// Insert Fine Scan JSX before the blank line after section close
// Insert at sectionCloseDiv + 1 (the blank line after section </div>)
const jsxInsertLines = fineScanJSX.split('\n');
// Insert one blank line, Fine Scan, then continue
// We insert at sectionCloseDiv+1 (replacing the blank line)
// Actually insert AFTER sectionCloseDiv
l.splice(sectionCloseDiv + 1, 0, ...jsxInsertLines, '');
console.log('After JSX insert:', l.length);

// ---- B) HANDLER FUNCTIONS ----
// Insert the handler before the return statement
// Find the return ( statement
const mainReturnIdx = l.findIndex((x, i) => x.trim() === 'return (' && i > 4600 && i < 4700);
console.log('mainReturn at:', mainReturnIdx+1);

// The handler functions go just before this return
const handlerCode = `

  // Fine Scan: Regime detection and strategy matching
  const handleRunFineScan = async () => {
    if (preferredContinueScanList.length === 0) {
      message.warning('No continue list candidates available. Run Continue Scan first.');
      return;
    }

    setFineScanStatus('running');
    setFineScanProgress(0);
    setFineScanResults([]);

    try {
      const results: any[] = [];
      const candidates = preferredContinueScanList;

      for (let i = 0; i < candidates.length; i++) {
        const c = candidates[i];
        const progress = Math.round(((i + 1) / candidates.length) * 100);
        setFineScanProgress(progress);

        // Extract available data
        const trend = c.trendLabel || c.trend || 'Neutral';
        const score = c.overallScore || c.trendScore || 0;
        const risk = c.eventRisk || 'Medium';
        const sector = c.sector || 'Unknown';
        const change = c.priceChangePct || c.changePct || 0;
        const volumeStatus = c.volumeStatus || 'Normal';
        const newsSentiment = c.newsSentiment || 'Neutral';
        const structure = c.structureLabel || '';
        const momentumLabel = c.momentumLabel || '';
        const volatilityLabel = c.volatilityLabel || '';

        // === REGIME DETECTION (rule-based) ===
        let regime = 'Unknown';
        let matchReason = '';
        let matchedStrategies: string[] = [];
        let keySignals: string[] = [];
        let matchConfidence = 0;

        // Build signal array from available fields
        if (trend === 'Strong Bullish' || trend === 'Bullish') keySignals.push('Bullish trend');
        if (score >= 75) keySignals.push('High score: ' + score);
        if (volumeStatus === 'High') keySignals.push('High volume');
        if (change > 2) keySignals.push('Price surge: ' + change.toFixed(1) + '%');
        if (change < -2) keySignals.push('Price drop: ' + change.toFixed(1) + '%');
        if (risk === 'Low') keySignals.push('Low risk');
        if (risk === 'High') keySignals.push('High risk');
        if (newsSentiment === 'Positive') keySignals.push('Positive news');
        if (newsSentiment === 'Negative') keySignals.push('Negative news');
        if (structure === 'uptrend') keySignals.push('EMA aligned uptrend');
        if (structure === 'sideways') keySignals.push('Range-bound structure');
        if (structure === 'breakout') keySignals.push('Breakout structure');
        if (momentumLabel === 'strengthening') keySignals.push('MACD strengthening');
        if (volatilityLabel === 'low') keySignals.push('Low volatility');
        if (volumeStatus === 'Normal' && change > 0) keySignals.push('Healthy volume');

        // === REGIME CLASSIFICATION ===

        // 1) Trending stock
        if (
          structure === 'uptrend' ||
          (trend === 'Strong Bullish' && score >= 70) ||
          (trend === 'Bullish' && score >= 80 && volumeStatus !== 'Low')
        ) {
          regime = 'Trending';
          matchedStrategies = ['Moving Average', 'MACD', 'Breakout Follow-through'];
          matchReason = 'Uptrend structure with momentum';
          matchConfidence = Math.min(95, 60 + score * 0.35);
        }

        // 2) Range-bound stock
        else if (
          structure === 'sideways' ||
          (trend === 'Neutral' && risk !== 'High' && Math.abs(change) < 3) ||
          (score >= 50 && score < 70 && volatilityLabel === 'low')
        ) {
          regime = 'Range-bound';
          matchedStrategies = ['RSI', 'Mean Reversion', 'Bollinger Band'];
          matchReason = 'Sideways structure with bounded price action';
          matchConfidence = Math.min(90, 50 + score * 0.4);
        }

        // 3) Breakout-ready stock
        else if (
          structure === 'breakout' ||
          (trend === 'Strong Bullish' && risk === 'Low') ||
          (trend === 'Bullish' && volumeStatus === 'High' && change > 0) ||
          (score >= 75 && newsSentiment === 'Positive' && volumeStatus !== 'Low')
        ) {
          regime = 'Breakout-ready';
          matchedStrategies = ['Breakout', 'Volume Confirmation', 'Momentum Continuation'];
          matchReason = 'Approaching breakout level with volume support';
          matchConfidence = Math.min(90, 55 + score * 0.35);
        }

        // 4) Conservative fallback - trending (vast majority of bullish stocks)
        else if (trend === 'Bullish' || trend === 'Strong Bullish') {
          regime = 'Trending';
          matchedStrategies = ['Moving Average', 'MACD'];
          matchReason = 'Bullish trend with moderate signals';
          matchConfidence = Math.max(40, Math.min(70, score * 0.6));
        }

        // 5) Neutral with risk
        else if (risk === 'High' || trend === 'Bearish' || trend === 'Strong Bearish') {
          regime = 'Range-bound';
          matchedStrategies = ['RSI', 'Mean Reversion'];
          matchReason = 'High risk or bearish — conservative strategies only';
          matchConfidence = Math.min(50, score * 0.35);
        }

        // 6) Unknown
        else {
          regime = 'Trending';
          matchedStrategies = ['Moving Average'];
          matchReason = 'Limited data — conservative single strategy';
          matchConfidence = 35;
        }

        // Trim redundant key signals
        if (keySignals.length > 6) {
          keySignals = keySignals.slice(0, 6);
        }

        results.push({
          symbol: c.symbol || 'N/A',
          regime,
          matchedStrategies,
          matchReason,
          keySignals,
          matchConfidence: Math.round(matchConfidence),
          priority: 0, // will be set after sorting
          // Keep original reference
          originalScore: score,
          originalTrend: trend,
        });
      }

      // Sort by confidence descending and assign priority
      results.sort((a, b) => b.matchConfidence - a.matchConfidence);
      results.forEach((r, i) => { r.priority = i + 1; });

      setFineScanResults(results);
      setFineScanProgress(100);
      setFineScanStatus('completed');
      message.success(\`Strategy matching complete: \${results.length} candidates analyzed\`);
    } catch (error) {
      console.error('Fine scan error:', error);
      setFineScanStatus('error');
      message.error('Fine scan failed: ' + (error as any).message);
    }
  };
`.trimStart();

const handlerLines = handlerCode.split('\n');
l.splice(mainReturnIdx, 0, ...handlerLines, '');
console.log('After handler insert:', l.length);

// ---- A) STATE VARIABLES ----
// Already inserted above but now the indices shifted
// Actually the state insert wasn't applied yet because previous attempts failed
// Let's find the current aiMutexIdx
const currentAiMutexIdx = l.findIndex(x => x.includes('// AI调用互斥控制'));
console.log('currentAiMutexIdx:', currentAiMutexIdx);

const stateLines = [
  '',
  '  // Fine Scan 状态',
  '  const [fineScanStatus, setFineScanStatus] = useState(\'idle\');',
  '  const [fineScanResults, setFineScanResults] = useState<any[]>([]);',
  '  const [fineScanProgress, setFineScanProgress] = useState(0);',
  '',
];

l.splice(currentAiMutexIdx, 0, ...stateLines);
console.log('After state insert:', l.length);

// Write file
fs.writeFileSync(path, l.join('\n'), 'utf8');
console.log('\\nFinal lines:', l.length);
console.log('DONE');
