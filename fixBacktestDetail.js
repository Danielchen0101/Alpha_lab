const fs = require('fs');
const path = 'C:/Users/kexuc/.openclaw/workspace/professional_quant_platform/frontend/src/pages/Portfolio.tsx';
let l = fs.readFileSync(path, 'utf8').split('\n');
console.log('Lines:', l.length);

// ===== STEP 1: Replace runQuickBacktest to return ALL strategy results =====
const btFnStart = l.findIndex(x => x.indexOf('const runQuickBacktest') >= 0);
// Find the exact end: look for '};' that ends the async arrow function
// We need to find the '};' after the EVALUATION block's final return
let btFnEnd = -1;
for (let i = btFnStart; i < l.length; i++) {
  if (l[i].trim() === '};' && l[i-1].trim().indexOf('});') < 0) {
    btFnEnd = i;
    break;
  }
}
console.log('runQuickBacktest:', (btFnStart+1), '-', (btFnEnd+1), '(', (btFnEnd-btFnStart+1), 'lines)');

// NEW runQuickBacktest: returns ALL strategy results, not just best
const newRunQuickBacktest = [
  "  const runQuickBacktest = async (symbol: string, strategies: string[]): Promise<any> => {",
  '    // Backtest page supported strategies (matching Backtest.tsx line 1148-1152)',
  '    // Only these strategies have backend endpoints',
  "    const supportedByBacktest: Record<string, string> = {",
  "      'Moving Average':  'moving_average',",
  "      'MACD':            'macd',",
  "      'RSI':             'rsi',",
  "      'Bollinger Band':  'bollinger',",
  "      'Momentum Continuation': 'momentum',",
  "    };",
  "",
  "    // Strategy display names that map to supported backend strategies",
  "    // (Fine Scan may match aliases like 'Moving Average Crossover' → 'Moving Average')",
  "    const strategyDisplayAlias: Record<string, string> = {",
  "      'Moving Average Crossover': 'Moving Average',",
  "      'Moving Average': 'Moving Average',",
  "    };",
  "",
  "    if (!strategies || strategies.length === 0) {",
  "      return {",
  "        status: 'Skipped', bestStrategy: 'None',",
  "        totalReturn: 0, sharpe: 0, maxDrawdown: 0, winRate: 0, profitFactor: 0, tradeCount: 0, recentValid: false,",
  "        summary: 'No strategy to backtest',",
  "        details: []",
  "      };",
  "    }",
  "",
  "    const endDate = new Date();",
  "    const start3M = new Date(); start3M.setMonth(start3M.getMonth() - 3);",
  "    const start6M = new Date(); start6M.setMonth(start6M.getMonth() - 6);",
  "    const start1Y = new Date(); start1Y.setFullYear(start1Y.getFullYear() - 1);",
  "    const fmt = (d: Date) => d.toISOString().split('T')[0];",
  "",
  "    // Helper: backtest one strategy with one window (returns null on failure)",
  "    const tryWindow = async (backendKey: string, params: any, start: Date): Promise<any> => {",
  "      try {",
  "        const config: any = {",
  "          strategy: backendKey,",
  "          symbol: symbol,",
  "          symbols: [symbol],",
  "          startDate: fmt(start),",
  "          endDate: fmt(endDate),",
  "          initialCapital: 10000,",
  "          dataMode: 'real',",
  "          parameters: params || {},",
  "        };",
  "        const response = await backtraderAPI.runBacktest(config);",
  "        let resultData = response.data;",
  "        if (resultData?.result?.results) resultData = resultData.result.results;",
  "        if (resultData?.results) resultData = resultData.results;",
  "",
  "        return {",
  "          totalReturn: typeof resultData?.totalReturn === 'number' ? resultData.totalReturn : 0,",
  "          sharpe:   typeof resultData?.sharpeRatio === 'number' ? resultData.sharpeRatio : (resultData?.sharpe || 0),",
  "          maxDrawdown: typeof resultData?.maxDrawdown === 'number' ? resultData.maxDrawdown : 0,",
  "          winRate: typeof resultData?.winRate === 'number' ? resultData.winRate : 0,",
  "          profitFactor: typeof resultData?.profitFactor === 'number' ? resultData.profitFactor : 0,",
  "          tradeCount: (resultData?.tradesList || []).length,",
  "        };",
  "      } catch (e) {",
  "        console.warn('[QUICK BT] Failed ' + symbol + ' ' + backendKey + ': ' + (e as any).message);",
  "        return null;",
  "      }",
  "    };",
  "",
  "    // Parameters for each supported strategy (matching Backtest.tsx config)",
  "    const strategyParams: Record<string, any> = {",
  "      'moving_average': { shortMaPeriod: 10, longMaPeriod: 30 },",
  "      'rsi':            { rsiPeriod: 14, rsiOversold: 30, rsiOverbought: 70 },",
  "      'macd':           { macdFast: 12, macdSlow: 26, macdSignal: 9 },",
  "      'bollinger':      { bollingerPeriod: 20, bollingerStdDev: 2 },",
  "      'momentum':       { momentumPeriod: 10 },",
  "    };",
  "",
  "    // Process each strategy — ALL of them, sequential, no concurrency",
  "    const allDetails: any[] = [];",
  "    let bestResult: any = null;",
  "    let bestStrategyName = '';",
  "",
  "    for (const s of strategies) {",
  "      // Check if this strategy display name maps to a supported backend strategy",
  "      const resolvedName = strategyDisplayAlias[s] || s;",
  "      const backendKey = supportedByBacktest[resolvedName];",
  "      if (!backendKey) {",
  "        allDetails.push({",
  "          strategyName: s,",
  "          status: 'Skipped',",
  "          reason: 'Strategy not supported in Backtest',",
  "          totalReturn: null, sharpe: null, maxDrawdown: null, winRate: null, profitFactor: null, tradeCount: null, windowUsed: null,",
  "        });",
  "        continue;",
  "      }",
  "",
  "      const params = strategyParams[backendKey] || {};",
  "",
  "      // Try 3M window",
  "      let result = await tryWindow(backendKey, params, start3M);",
  "      let windowUsed = '3M';",
  "",
  "      // If too few trades, try 6M",
  "      if (result && result.tradeCount < 5) {",
  "        const r6m = await tryWindow(backendKey, params, start6M);",
  "        if (r6m && r6m.tradeCount > (result?.tradeCount || 0)) { result = r6m; windowUsed = '6M'; }",
  "      }",
  "",
  "      // If still too few, try 1Y",
  "      if (result && result.tradeCount < 5) {",
  "        const r1y = await tryWindow(backendKey, params, start1Y);",
  "        if (r1y && r1y.tradeCount > (result?.tradeCount || 0)) { result = r1y; windowUsed = '1Y'; }",
  "      }",
  "",
  "      if (result && result.tradeCount > 0) {",
  "        // Stability evaluation (same thresholds as before)",
  "        let st = 'Caution';",
  "        const tc = result.tradeCount;",
  "        const tr = result.totalReturn;",
  "        const dd = result.maxDrawdown;",
  "        const sr = result.sharpe;",
  "        const pf = result.profitFactor;",
  "        if (tc < 3) { st = 'Failed'; }",
  "        else if (tr < -5) { st = 'Failed'; }",
  "        else if (dd > 30) { st = 'Caution'; }",
  "        else if (sr < 0.5 && tc < 10) { st = 'Caution'; }",
  "        else if (pf < 0.8 && tc < 15) { st = 'Caution'; }",
  "        else { st = 'Passed'; }",
  "",
  "        const detail: any = {",
  "          strategyName: s,",
  "          status: st,",
  "          totalReturn: result.totalReturn,",
  "          sharpe: result.sharpe,",
  "          maxDrawdown: result.maxDrawdown,",
  "          winRate: result.winRate,",
  "          profitFactor: result.profitFactor,",
  "          tradeCount: result.tradeCount,",
  "          windowUsed: windowUsed,",
  "        };",
  "        allDetails.push(detail);",
  "",
  "        // Track best",
  "        if (result.totalReturn > (bestResult?.totalReturn || -999)) {",
  "          bestResult = result;",
  "          bestStrategyName = s;",
  "        }",
  "      } else {",
  "        allDetails.push({",
  "          strategyName: s,",
  "          status: 'Failed',",
  "          reason: 'No trades generated',",
  "          totalReturn: 0, sharpe: 0, maxDrawdown: 0, winRate: 0, profitFactor: 0, tradeCount: 0, windowUsed: windowUsed,",
  "        });",
  "      }",
  "",
  "      // Delay between strategies",
  "      await new Promise(r => setTimeout(r, 500));",
  "    }",
  "",
  "    // Build overall result from all strategies",
  "    if (!bestResult) {",
  "      return {",
  "        status: 'Error', bestStrategy: 'N/A',",
  "        totalReturn: 0, sharpe: 0, maxDrawdown: 0, winRate: 0, profitFactor: 0, tradeCount: 0, recentValid: false,",
  "        summary: allDetails.filter((d: any) => d.status === 'Skipped').length === allDetails.length",
  "          ? 'All strategies not supported by backtest engine'",
  "          : 'Backtest API returned no usable data',",
  "        details: allDetails,",
  "      };",
  "    }",
  "",
  "    // Overall status = best result status (same per-strategy evaluation)",
  "    const tc = bestResult.tradeCount;",
  "    const tr = bestResult.totalReturn;",
  "    const dd = bestResult.maxDrawdown;",
  "    const sr = bestResult.sharpe;",
  "    const pf = bestResult.profitFactor;",
  "    let overallStatus = 'Caution';",
  "    const parts: string[] = [];",
  "    if (tc < 3) { overallStatus = 'Failed'; parts.push('insufficient trades (' + tc + ')'); }",
  "    else if (tr < -5) { overallStatus = 'Failed'; parts.push('negative'); }",
  "    else if (dd > 30) { overallStatus = 'Caution'; parts.push('high drawdown ' + dd.toFixed(1) + '%'); }",
  "    else if (sr < 0.5 && tc < 10) { overallStatus = 'Caution'; parts.push('low sharpe ' + sr.toFixed(2)); }",
  "    else if (pf < 0.8 && tc < 15) { overallStatus = 'Caution'; parts.push('PF low ' + pf.toFixed(2)); }",
  "    else { overallStatus = 'Passed'; parts.push('stable'); }",
  "    if (pf >= 1.5) parts.push('PF ' + pf.toFixed(2));",
  "    if (dd > 5) parts.push('MDD ' + dd.toFixed(1) + '%');",
  "    if (sr > 1.0) parts.push('SR ' + sr.toFixed(2));",
  "    if (bestResult.winRate > 0) parts.push('WR ' + bestResult.winRate.toFixed(0) + '%');",
  "",
  "    return {",
  "      status: overallStatus,",
  "      bestStrategy: bestStrategyName,",
  "      totalReturn: bestResult.totalReturn,",
  "      sharpe: bestResult.sharpe,",
  "      maxDrawdown: bestResult.maxDrawdown,",
  "      winRate: bestResult.winRate,",
  "      profitFactor: bestResult.profitFactor,",
  "      tradeCount: bestResult.tradeCount,",
  "      recentValid: overallStatus === 'Passed',",
  "      summary: parts.join('; '),",
  "      details: allDetails,",
  "    };",
  "  };",
];

// Verify length
const oldLen = btFnEnd - btFnStart + 1;
console.log('Old:', oldLen, 'lines, New:', newRunQuickBacktest.length, 'lines');

// Replace
l.splice(btFnStart, oldLen, ...newRunQuickBacktest);
console.log('Replaced runQuickBacktest. Lines:', l.length);

// ===== STEP 2: Replace Backtest column render to add details display =====
// The column render stays simple (status tag), but we need to wire details into the expandedRowRender
// First, let's make sure backtest details are stored when the runner writes
const runnerStart = l.findIndex(x => x.indexOf('Step 3: Quick backtest') >= 0);
if (runnerStart >= 0) {
  console.log('Runner at', (runnerStart+1));
  // The runner now receives btResult with details. Make sure it stores them.
  // Find the line where r.backtest = { status: btResult.status, ... }
  const assignLine = l.findIndex(x => x.indexOf("r.backtest = {") >= 0 && x.indexOf("status") >= 0);
  if (assignLine >= 0) {
    console.log('r.backtest assign at', (assignLine+1));
  }
}

// ===== STEP 3: Add backtest detail section to renderDetailPanel =====
// renderDetailPanel is at 2603. Function ends at 2926. Add section before the closing.

// Find the closing of renderDetailPanel — look for ');' that closes 'return (...)' at the end
const renderPanelEnd = l.findIndex(function(x){return x.indexOf('};' ) >= 0 && Math.abs(x - 2603) > 250});
console.log('renderDetailPanel close at', (renderPanelEnd+1));

// Backtest detail section to insert before the closing ';'
const backtestDetailSection = [
  "",
  "                  {/* Backtest Detail Section */}",
  "                  <Card",
  "                    size=\"small\"",
  "                    title={<div style={{display:'flex',alignItems:'center',gap:'8px'}}><span style={{fontSize:'13px',fontWeight:'600'}}>� Backtest Check Detail</span></div>}",
  "                    style={{height:'100%', border:'1px solid #e8e8e8'}}",
  "                    bodyStyle={{padding:'16px'}}",
  "                  >",
  "                    {(() => {",
  "                      const bt = record.backtest || {};",
  "                      const details = bt.details || [];",
  "                      if (!details || details.length === 0) {",
  "                        return <div style={{color:'#999',fontSize:'12px',fontStyle:'italic',padding:'12px 0',textAlign:'center'}}>No backtest data</div>;",
  "                      }",
  "                      return (",
  "                        <div style={{display:'flex',flexDirection:'column',gap:'8px'}}>",
  "                          {details.map((det: any, i: number) => (",
  "                            <div",
  "                              key={i}",
  "                              style={{",
  "                                border: '1px solid ' + (det.status === 'Passed' ? '#b7eb8f' : det.status === 'Caution' ? '#ffe58f' : det.status === 'Failed' ? '#ffa39e' : det.status === 'Skipped' ? '#d9d9d9' : '#d9d9d9'),",
  "                                borderRadius: '6px',",
  "                                padding: '12px',",
  "                                backgroundColor: det.status === 'Skipped' ? '#fafafa' : '#fff',",
  "                              }}",
  "                            >",
  "                              {/* Strategy header */}",
  "                              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'8px'}}>",
  "                                <div style={{fontSize:'13px',fontWeight:'600',color:'#1f1f1f'}}>{det.strategyName}</div>",
  "                                <Tag color={det.status === 'Passed' ? 'green' : det.status === 'Caution' ? 'gold' : det.status === 'Failed' ? 'red' : det.status === 'Skipped' ? 'default' : 'default'} style={{fontSize:'11px',margin:0}}>{det.status}</Tag>",
  "                              </div>",
  "                              {det.status === 'Skipped' && det.reason ? (",
  "                                <div style={{fontSize:'11px',color:'#888'}}>Reason: {det.reason}</div>",
  "                              ) : (",
  "                                <div>",
  "                                  {/* Metrics grid — exact same display logic as Backtest.tsx */}",
  "                                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'4px 16px'}}>",
  "                                    <div style={{fontSize:'11px',color:'#666'}}>Total Return</div>",
  "                                    <div style={{fontSize:'13px',fontWeight:'700',color: (det.totalReturn || 0) >= 0 ? '#52c41a' : '#ff4d4f'}}>",
  "                                      {(det.totalReturn || 0).toFixed(2)}%",
  "                                    </div>",
  "                                    <div style={{fontSize:'11px',color:'#666'}}>Max Drawdown</div>",
  "                                    <div style={{fontSize:'12px',fontWeight:'600',color:'#ff4d4f'}}>",
  "                                      {(det.maxDrawdown || 0).toFixed(2)}%",
  "                                    </div>",
  "                                    <div style={{fontSize:'11px',color:'#666'}}>Sharpe Ratio</div>",
  "                                    <div style={{fontSize:'12px',fontWeight:'600'}}>{(det.sharpe || 0).toFixed(2)}</div>",
  "                                    <div style={{fontSize:'11px',color:'#666'}}>Win Rate</div>",
  "                                    <div style={{fontSize:'12px',fontWeight:'600'}}>{(det.winRate || 0).toFixed(1)}%</div>",
  "                                    <div style={{fontSize:'11px',color:'#666'}}>Profit Factor</div>",
  "                                    <div style={{fontSize:'12px',fontWeight:'600'}}>{(det.profitFactor || 0).toFixed(2)}</div>",
  "                                    <div style={{fontSize:'11px',color:'#666'}}>Trades</div>",
  "                                    <div style={{fontSize:'12px',fontWeight:'600'}}>{det.tradeCount || 0}</div>",
  "                                    <div style={{fontSize:'11px',color:'#666'}}>Window</div>",
  "                                    <div style={{fontSize:'12px',fontWeight:'600'}}>{det.windowUsed || 'N/A'}</div>",
  "                                  </div>",
  "                                  {/* Conclusion per strategy */}",
  "                                  <div style={{marginTop:'8px',padding:'6px 8px',borderRadius:'4px',backgroundColor:'#f5f5f5',fontSize:'11px'}}>",
  "                                    <span style={{fontWeight:'600',color:'#333'}}>Conclusion: </span>",
  "                                    <span style={{color:det.status === 'Passed'?'#52c41a':'#faad14'}}>",
  "                                      {det.status === 'Passed' ? 'Stable and usable for this timeframe' :",
  "                                       det.status === 'Caution' ? 'Use with caution — check risk metrics' :",
  "                                       det.status === 'Failed' ? 'Not viable' : det.status}",
  "                                    </span>",
  "                                  </div>",
  "                                </div>",
  "                              )}",
  "                            </div>",
  "                          ))}",
  "                        </div>",
  "                      );",
  "                    })()}",
  "                  </Card>",
];

// Insert before </div> that closes the Row, before the return ); 
// Actually insert inside the 3-col Row — find last Col of the Row (around line 2890+)
// Easiest: find the closing of the Row gutter and insert before it
const rowCloseIdx = l.findIndex(function(x) {return x.indexOf('Row') >= 0 && x.indexOf('gutter') < 0 && x.indexOf('/') >= 0 && Math.abs(x - 2860) < 30});
if (rowCloseIdx >= 0) console.log('Row close at', (rowCloseIdx+1));
else {
  // Find news col close and insert backtest as 4th col
  // Look for Col closing around top news
  const newsCol = l.findIndex(function(x){return x.indexOf('No recent news') >= 0});
  console.log('News col near', (newsCol+1));
}

// Let me just insert after line 2919 (before the closing of the last Card)
// Search for the specific structure near end of renderDetailPanel
const lastColEnd = l.findIndex(function(x){return x.indexOf('Col') >= 0 && x.indexOf('span') >= 0 && Math.abs(x - 2900) < 50});
console.log('Last Col span at', (lastColEnd+1));
const rowEnd = l.findIndex(function(x){return x.indexOf('Row') >= 0 && x.indexOf('gutter') < 0 && x.indexOf('Close') < 0 && Math.abs(x - lastColEnd) < 20 && x.indexOf('/') >= 0});
console.log('Row / at', (rowEnd+1));

// Display area around row close
for (let i = rowEnd - 5; i <= rowEnd + 5; i++) {
  console.log((i+1),':',l[i].trim().substring(0,80));
}

// Insert backtest detail section after the Row close (</Row>)
fs.writeFileSync(path, l.join('\n'), 'utf8');
console.log('Phase 1 done. Lines:', l.length);
