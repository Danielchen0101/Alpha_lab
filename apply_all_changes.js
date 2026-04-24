var fs = require('fs');
var path = 'C:/Users/kexuc/.openclaw/workspace/professional_quant_platform/frontend/src/pages/Portfolio.tsx';
var l = fs.readFileSync(path, 'utf8').split('\n');
console.log('Clean v1.8.5, lines:', l.length);

// ===== CORRECT KEY LOCATIONS (0-indexed) =====
var handleFn = 4683;      // const handleRunFineScan
var priorityCol = 6276;   // title: 'Priority',
var pushStart = 5034;     // results.push({
var pushEnd = 5043;       // });
var sortLine = 5046;      // Sort by confidence
var setResultsLine = 5050; // setFineScanResults(results);
var rowClose = 2923;      // </Row>

// Count all insertions so we can track shifting
var shift = 0;

// ===== 1. NEW COLUMNS =====
var newCols = [
  '    {',
  "      title: 'MTF Alignment',",
  "      key: 'mtfAlignment',",
  '      width: 150,',
  '      render: function(record) {',
  "        var mtf = record.mtf || {};",
  "        if (!mtf.alignment) return React.createElement('span', {style:{color:'#999',fontSize:'11px'}}, '--');",
  "        var color = '#52c41a';",
  "        if (mtf.alignment.indexOf('Conflicted') >= 0) color = '#ff4d4f';",
  "        else if (mtf.alignment.indexOf('Partially') >= 0) color = '#faad14';",
  "        else if (mtf.alignment.indexOf('bearish') >= 0) color = '#ff4d4f';",
  '        return React.createElement(\'div\', null,',
  "          React.createElement(Tag, {color:color,style:{fontSize:'10px',marginBottom:0}}, mtf.alignment),",
  "          React.createElement('div', {style:{fontSize:'10px',color:'#888',marginTop:2}}, (mtf.mtfNotes||'').substring(0,50))",
  '        );',
  '      },',
  '    },',
  '    {',
  "      title: 'Daily',",
  "      key: 'dailyBias',",
  '      width: 90,',
  '      render: function(record) {',
  "        var mtf = record.mtf || {};",
  "        return React.createElement('span', {style:{fontSize:'11px',color:'#666'}}, mtf.dailyBias || '--');",
  '      },',
  '    },',
  '    {',
  "      title: '4H/1H',",
  "      key: 'midBias',",
  '      width: 80,',
  '      render: function(record) {',
  "        var mtf = record.mtf || {};",
  "        return React.createElement('span', {style:{fontSize:'11px',color:'#666'}}, mtf.midBias || '--');",
  '      },',
  '    },',
  '    {',
  "      title: 'Entry',",
  "      key: 'entryTiming',",
  '      width: 80,',
  '      render: function(record) {',
  "        var mtf = record.mtf || {};",
  "        var color = '#52c41a';",
  "        if (mtf.entryTiming === 'Extended') color = '#ff4d4f';",
  "        else if (mtf.entryTiming === 'Stable') color = '#1890ff';",
  "        return React.createElement(Tag, {color:color,style:{fontSize:'10px',marginBottom:0}}, mtf.entryTiming || '--');",
  '      },',
  '    },',
  '    {',
  "      title: 'Backtest Check',",
  "      key: 'backtestCheck',",
  '      width: 110,',
  '      render: function(record) {',
  "        var bt = record.backtest || {};",
  "        var st = bt.status || 'Pending';",
  "        var col = '#8c8c8c'; var msg = '';",
  "        if (st === 'Passed') { col='#52c41a'; msg='Stable'; }",
  "        else if (st === 'Caution') { col='#faad14'; msg=(bt.summary||'').length<30?bt.summary:'Review needed'; }",
  "        else if (st === 'Failed') { col='#ff4d4f'; msg=(bt.summary||'').length<30?bt.summary:'Unusable'; }",
  "        else if (st === 'Skipped') { col='#d9d9d9'; msg=(bt.summary||'').length<30?bt.summary:'Skipped'; }",
  "        else if (st === 'Error') { col='#8c8c8c'; var err=bt.errorClassification||'unknown'; if(err==='strategy_not_mapped')msg='Strategy'; else if(err==='api_failed_or_empty')msg='API'; else msg='No data'; }",
  '        return React.createElement(\'div\', null,',
  "          React.createElement(Tag, {color:col,style:{fontSize:'10px',marginBottom:0}}, st),",
  "          React.createElement('div', {style:{fontSize:'10px',color:'#888',marginTop:2}}, msg)",
  '        );',
  '      },',
  '    },',
  '    {',
  "      title: 'Conclusion',",
  "      key: 'conclusion',",
  '      width: 90,',
  '      render: function(record) {',
  "        var conc = record.conclusion || (record.priorityScore>=70?'Proceed':record.priorityScore>=40?'Watch':'Skip');",
  "        var ccol = record.conclusionColor || (conc==='Proceed'?'#52c41a':conc==='Watch'?'#faad14':'#ff4d4f');",
  '        return React.createElement(\'div\', null,',
  "          React.createElement(Badge, {color:ccol,text:React.createElement('span',{style:{fontSize:'11px',fontWeight:600,color:ccol}}, conc)}),",
  "          React.createElement('div', {style:{fontSize:'10px',color:'#888',marginTop:2}}, 'Score: ' + ((record.priorityScore||record.matchConfidence)||'--'))",
  '        );',
  '      },',
  '    },',
];

var args = [priorityCol + 1, 0];
for(var i=0;i<newCols.length;i++) args.push(newCols[i]);
Array.prototype.splice.apply(l, args);
shift += newCols.length;
console.log('1. Columns. Lines:', l.length);

// ===== 2. analyzeMultiTimeframe =====
var mtfFn = [
  '',
  'function analyzeMultiTimeframe(candidate) {',
  "  var trendLabel = candidate.trendLabel || candidate.trend || 'Neutral';",
  '  var score = candidate.overallScore || candidate.trendScore || 0;',
  "  var volumeStatus = candidate.volumeStatus || 'Normal';",
  "  var momentumLabel = candidate.momentumLabel || '';",
  "  var volatilityLabel = candidate.volatilityLabel || '';",
  "  var structureLabel = candidate.structureLabel || '';",
  '  var priceChange = candidate.changePct || candidate.priceChangePct || 0;',
  '',
  "  var dailyBias = 'Neutral';",
  "  if (trendLabel === 'Strong Bullish') dailyBias = 'Strong Bullish';",
  "  else if (trendLabel === 'Bullish') dailyBias = 'Bullish';",
  "  else if (trendLabel === 'Bearish') dailyBias = 'Bearish';",
  "  else if (trendLabel === 'Strong Bearish') dailyBias = 'Strong Bearish';",
  '',
  '  var midSignals = 0;',
  "  if (momentumLabel === 'strengthening' || momentumLabel === 'improving') midSignals++;",
  "  if (structureLabel === 'uptrend' || structureLabel === 'breakout') midSignals++;",
  "  if (structureLabel === 'pullback' || structureLabel === 'consolidating') midSignals--;",
  "  if (volumeStatus === 'High' || volumeStatus === 'Increasing') midSignals++;",
  '  if (score >= 75) midSignals++;',
  '',
  "  var midBias = 'Neutral'; var midStructure = 'Mixed';",
  "  if (midSignals >= 4) { midStructure = 'Strong'; midBias = 'Bullish'; }",
  "  else if (midSignals >= 2) { midStructure = 'Mixed'; midBias = dailyBias.indexOf('Bullish')>=0?'Slightly Bullish':dailyBias.indexOf('Bearish')>=0?'Slightly Bearish':'Neutral'; }",
  "  else if (midSignals <= 0) { midStructure = 'Weak'; midBias = 'Bearish'; } else { midStructure = 'Weak'; midBias = 'Neutral'; }",
  '',
  "  var entryTiming = 'Normal';",
  "  if (Math.abs(priceChange) > 5) entryTiming = 'Extended';",
  "  else if (Math.abs(priceChange) < 1 && trendLabel.indexOf('Bullish') >= 0) entryTiming = 'Stable';",
  "  else if (volatilityLabel === 'Low') entryTiming = 'Stable';",
  "  else if (volatilityLabel === 'High' && Math.abs(priceChange) > 3) entryTiming = 'Extended';",
  '',
  "  var alignment = 'Conflicted';",
  "  var isBull = dailyBias.indexOf('Bullish') >= 0;",
  "  var isBear = dailyBias.indexOf('Bearish') >= 0;",
  "  if (isBull && midBias === 'Bullish') alignment = 'Aligned';",
  "  else if (isBull && midBias !== 'Bearish') alignment = 'Partially aligned';",
  "  else if (isBear && midBias === 'Bearish') alignment = 'Aligned (bearish)';",
  "  else if (isBear && midBias !== 'Bullish') alignment = 'Partially aligned';",
  '',
  "  var mtfNotes = alignment === 'Aligned' ? 'Strong multi-timeframe support' : alignment === 'Partially aligned' ? 'Caution: divergence' : alignment === 'Aligned (bearish)' ? 'Bearish across timeframes' : 'Conflicting signals';",
  '  return { alignment: alignment, dailyBias: dailyBias, midBias: midBias, entryTiming: entryTiming, midStructure: midStructure, mtfNotes: mtfNotes };',
  '};',
  '',
];

args = [handleFn, 0];
for(var i=0;i<mtfFn.length;i++) args.push(mtfFn[i]);
Array.prototype.splice.apply(l, args);
shift += mtfFn.length;
console.log('2. MTF fn. Lines:', l.length);

// ===== 3. runQuickBacktest =====
var qbtFn = [
  '',
  'async function runQuickBacktest(symbol, strategies) {',
  '  var supported = { "Moving Average": "moving_average", "MACD": "macd", "RSI": "rsi", "Bollinger Band": "bollinger", "Momentum Continuation": "momentum" };',
  '  var alias = { "Moving Average Crossover": "Moving Average", "Moving Average": "Moving Average" };',
  '',
  '  if (!strategies || strategies.length === 0) {',
  "    return { status: 'Skipped', bestStrategy: 'None', totalReturn: 0, sharpe: 0, maxDrawdown: 0, winRate: 0, profitFactor: 0, tradeCount: 0, recentValid: false, summary: 'No strategy to backtest', details: [] };",
  '  }',
  '',
  '  var endDate = new Date();',
  '  var s3m = new Date(); s3m.setMonth(s3m.getMonth() - 3);',
  '  var s6m = new Date(); s6m.setMonth(s6m.getMonth() - 6);',
  '  var s1y = new Date(); s1y.setFullYear(s1y.getFullYear() - 1);',
  "  var fmt = function(d){return d.toISOString().split('T')[0]};",
  '',
  '  async function tryWindow(bk, params, start) {',
  '    try {',
  "      var cfg = { strategy: bk, symbol: symbol, symbols: [symbol], startDate: fmt(start), endDate: fmt(endDate), initialCapital: 10000, dataMode: 'real', parameters: params || {} };",
  '      var resp = await backtraderAPI.runBacktest(cfg);',
  '      var rd = resp.data;',
  '      if (rd && rd.result && rd.result.results) rd = rd.result.results;',
  '      if (rd && rd.results) rd = rd.results;',
  "      return { totalReturn: typeof rd?.totalReturn === 'number' ? rd.totalReturn : 0, sharpe: typeof rd?.sharpeRatio === 'number' ? rd.sharpeRatio : (rd?.sharpe || 0), maxDrawdown: typeof rd?.maxDrawdown === 'number' ? rd.maxDrawdown : 0, winRate: typeof rd?.winRate === 'number' ? rd.winRate : 0, profitFactor: typeof rd?.profitFactor === 'number' ? rd.profitFactor : 0, tradeCount: (rd?.tradesList || []).length };",
  "    } catch(e) { console.warn('[BT] fail ' + symbol + ' ' + bk + ': ' + e.message); return null; }",
  '  }',
  '',
  '  var paramsMap = { moving_average: { shortMaPeriod: 10, longMaPeriod: 30 }, rsi: { rsiPeriod: 14, rsiOversold: 30, rsiOverbought: 70 }, macd: { macdFast: 12, macdSlow: 26, macdSignal: 9 }, bollinger: { bollingerPeriod: 20, bollingerStdDev: 2 }, momentum: { momentumPeriod: 10 } };',
  '',
  '  var allDetails = [];',
  "  var bestResult = null; var bestName = '';",
  '',
  '  for (var si = 0; si < strategies.length; si++) {',
  '    var s = strategies[si];',
  '    var resolved = alias[s] || s;',
  '    var bk = supported[resolved];',
  '    if (!bk) {',
  "      allDetails.push({ strategyName: s, status: 'Skipped', reason: 'Strategy not supported in Backtest', totalReturn: null, sharpe: null, maxDrawdown: null, winRate: null, profitFactor: null, tradeCount: null, windowUsed: null });",
  '      continue;',
  '    }',
  '',
  '    var params = paramsMap[bk] || {};',
  "    var result = await tryWindow(bk, params, s3m); var wUsed = '3M';",
  '    if (result && result.tradeCount < 5) {',
  '      var r6 = await tryWindow(bk, params, s6m);',
  '      if (r6 && r6.tradeCount > (result?.tradeCount || 0)) { result = r6; wUsed = \'6M\'; }',
  '    }',
  '    if (result && result.tradeCount < 5) {',
  '      var r1 = await tryWindow(bk, params, s1y);',
  '      if (r1 && r1.tradeCount > (result?.tradeCount || 0)) { result = r1; wUsed = \'1Y\'; }',
  '    }',
  '',
  '    if (result && result.tradeCount > 0) {',
  "      var st = 'Caution'; var tc = result.tradeCount; var tr = result.totalReturn;",
  '      var dd = result.maxDrawdown; var sr = result.sharpe; var pf = result.profitFactor;',
  "      if (tc < 3) st = 'Failed'; else if (tr < -5) st = 'Failed'; else if (dd > 30) st = 'Caution';",
  "      else if (sr < 0.5 && tc < 10) st = 'Caution'; else if (pf < 0.8 && tc < 15) st = 'Caution'; else st = 'Passed';",
  '      allDetails.push({ strategyName: s, status: st, windowUsed: wUsed, totalReturn: result.totalReturn, sharpe: result.sharpe, maxDrawdown: result.maxDrawdown, winRate: result.winRate, profitFactor: result.profitFactor, tradeCount: result.tradeCount });',
  '      if (result.totalReturn > (bestResult?.totalReturn || -999)) { bestResult = result; bestName = s; }',
  '    } else {',
  "      allDetails.push({ strategyName: s, status: 'Failed', reason: 'No trades generated', totalReturn: 0, sharpe: 0, maxDrawdown: 0, winRate: 0, profitFactor: 0, tradeCount: 0, windowUsed: wUsed });",
  '    }',
  '    await new Promise(function(r){setTimeout(r,500)});',
  '  }',
  '',
  '  if (!bestResult) {',
  '    var allSkipped = allDetails.filter(function(d){return d.status === \'Skipped\'}).length === allDetails.length;',
  "    return { status: 'Error', bestStrategy: 'N/A', totalReturn: 0, sharpe: 0, maxDrawdown: 0, winRate: 0, profitFactor: 0, tradeCount: 0, recentValid: false, summary: allSkipped ? 'All strategies not supported' : 'Backtest API returned no usable data', errorClassification: allSkipped ? 'strategy_not_mapped' : 'api_failed_or_empty', details: allDetails };",
  '  }',
  '',
  '  var tc = bestResult.tradeCount; var tr = bestResult.totalReturn;',
  '  var dd = bestResult.maxDrawdown; var sr = bestResult.sharpe; var pf = bestResult.profitFactor;',
  "  var overall = 'Caution'; var parts = [];",
  "  if (tc < 3) { overall = 'Failed'; parts.push('insufficient trades (' + tc + ')'); }",
  "  else if (tr < -5) { overall = 'Failed'; parts.push('negative'); }",
  "  else if (dd > 30) { overall = 'Caution'; parts.push('high drawdown ' + dd.toFixed(1) + '%'); }",
  "  else if (sr < 0.5 && tc < 10) { overall = 'Caution'; parts.push('low sharpe ' + sr.toFixed(2)); }",
  "  else if (pf < 0.8 && tc < 15) { overall = 'Caution'; parts.push('PF low ' + pf.toFixed(2)); }",
  "  else { overall = 'Passed'; parts.push('stable'); }",
  "  if (pf >= 1.5) parts.push('PF ' + pf.toFixed(2));",
  "  if (dd > 5) parts.push('MDD ' + dd.toFixed(1) + '%');",
  "  if (sr > 1.0) parts.push('SR ' + sr.toFixed(2));",
  "  if (bestResult.winRate > 0) parts.push('WR ' + bestResult.winRate.toFixed(0) + '%');",
  '',
  "  return { status: overall, bestStrategy: bestName, totalReturn: bestResult.totalReturn, sharpe: bestResult.sharpe, maxDrawdown: bestResult.maxDrawdown, winRate: bestResult.winRate, profitFactor: bestResult.profitFactor, tradeCount: bestResult.tradeCount, recentValid: overall === 'Passed', summary: parts.join('; '), details: allDetails };",
  '};',
  '',
];

var handleFn2 = handleFn + mtfFn.length;
args = [handleFn2, 0];
for(var i=0;i<qbtFn.length;i++) args.push(qbtFn[i]);
Array.prototype.splice.apply(l, args);
shift += qbtFn.length;
console.log('3. runQuickBacktest. Lines:', l.length);

// ===== 4. Expand results.push =====
var pushStart2 = pushStart + shift;
var pushEnd2 = pushEnd + shift;

// Remove old '});' and replace with expanded push
// First, remove the old push block end and insert new fields
var oldEndLine = l[pushEnd2];
// Replace '});' with the expanded version
l[pushEnd2] = '          aiUsed: aiSucceeded,';
l.splice(pushEnd2 + 1, 0,
  '          mtf: analyzeMultiTimeframe({',
  "            trendLabel: ms && ms.trendLabel || c && c.trendLabel || '',",
  '            overallScore: score,',
  "            volumeStatus: ms && ms.volumeLabel || c && c.volumeLabel || '',",
  "            momentumLabel: ms && ms.momentumLabel || c && c.momentumLabel || '',",
  "            volatilityLabel: ms && ms.volatilityLabel || c && c.volatilityLabel || '',",
  "            structureLabel: ms && ms.structureLabel || c && c.structureLabel || '',",
  '            changePct: priceChange,',
  '          }),',
  "          backtest: { status: 'Pending', bestStrategy: '', summary: 'Quick backtest will run' },",
  '        });'
);
shift += 11;
console.log('4. Push expanded. Lines:', l.length);

// ===== 5. Backtest loop =====
var setResultsLine2 = setResultsLine + shift;
console.log('setResultsLine2:', (setResultsLine2+1), '-', l[setResultsLine2].trim().substring(0,40));

var btLoop = [
  "",
  "      // Step 3: Backtest — one symbol at a time, all strategies sequential",
  "      for (var bi = 0; bi < results.length; bi++) {",
  "        var r = results[bi];",
  "        if (r.regime === 'Unclear' || r.matchConfidence < 30) {",
  "          r.backtest = { status: 'Skipped', bestStrategy: 'None', summary: 'Low confidence' };",
  "          continue;",
  "        }",
  "        var btResult = await runQuickBacktest(r.symbol, r.matchedStrategies);",
  "        r.backtest = {",
  "          status: btResult.status,",
  "          bestStrategy: btResult.bestStrategy,",
  "          totalReturn: btResult.totalReturn, sharpe: btResult.sharpe,",
  "          maxDrawdown: btResult.maxDrawdown, profitFactor: btResult.profitFactor, tradeCount: btResult.tradeCount,",
  "          strategySummary: (btResult.bestStrategy || '') + ': ' + (btResult.totalReturn > 0 ? '+' : '') + btResult.totalReturn.toFixed(1) + '%' + (btResult.tradeCount > 0 ? ' (' + btResult.tradeCount + ' trades)' : ''),",
  "          summary: btResult.summary,",
  "          errorClassification: btResult && btResult.errorClassification || '',",
  "          details: btResult && btResult.details || [],",
  "        };",
  "        var ds = r.matchConfidence || 50;",
  "        var mf = r.mtf || {};",
  "        var bt = r.backtest;",
  "        if (mf.alignment === 'Aligned') ds += 15;",
  "        else if (mf.alignment && mf.alignment.indexOf('Conflicted') >= 0) ds -= 20;",
  "        else if (mf.alignment && mf.alignment.indexOf('Partially') >= 0) ds -= 5;",
  "        if (bt.status === 'Passed') ds += 20;",
  "        else if (bt.status === 'Caution') ds += 5;",
  "        else if (bt.status === 'Failed' || bt.status === 'Error') ds = Math.max(1, ds - 20);",
  "        else if (!bt.status || bt.status === 'Pending') ds = Math.max(1, ds - 10);",
  "        ds = Math.max(1, Math.min(100, ds));",
  "        r.conclusion = ds >= 70 ? 'Proceed' : ds >= 40 ? 'Watch' : 'Skip';",
  "        r.conclusionColor = r.conclusion === 'Proceed' ? '#52c41a' : r.conclusion === 'Watch' ? '#faad14' : '#ff4d4f';",
  "        r.priorityScore = ds;",
  "        if (bi < results.length - 1) { await new Promise(function(x){setTimeout(x,300)}); }",
  "      }",
  "",
  "      // Cleanup: ensure no Pending remains",
  "      results.forEach(function(rr) {",
  "        var bb = rr.backtest || {};",
  "        if (!bb.status || bb.status === 'Pending') { bb.status = 'Skipped'; bb.summary = 'No backtest data'; }",
  "        rr.backtest = bb;",
  "      });",
];

args = [setResultsLine2, 0];
for(var i=0;i<btLoop.length;i++) args.push(btLoop[i]);
Array.prototype.splice.apply(l, args);
shift += btLoop.length;
console.log('5. Backtest loop. Lines:', l.length);

// ===== 6. Backtest Detail in renderDetailPanel =====
var btDetail = [
  "",
  '          {/* Backtest Detail */}',
  "          <Col span={8}>",
  "            <Card",
  '              size="small"',
  "              title={<div style={{display:'flex',alignItems:'center',gap:'8px'}}><span style={{fontSize:'13px',fontWeight:'600'}}> Backtest Detail</span></div>}",
  "              style={{height:'100%', border:'1px solid #e8e8e8'}}",
  "              bodyStyle={{padding:'16px'}}",
  "            >",
  "              {(function() {",
  "                var bt = record.backtest || {};",
  "                var details = bt.details || [];",
  "                if (!details || details.length === 0) {",
  "                  return React.createElement('div', {style:{color:'#999',fontSize:'12px',fontStyle:'italic',padding:'12px 0',textAlign:'center'}}, 'No backtest data');",
  "                }",
  "                var els = [];",
  "                for (var di = 0; di < details.length; di++) {",
  "                  var det = details[di];",
  "                  var bc = det.status === 'Passed' ? '#b7eb8f' : det.status === 'Caution' ? '#ffe58f' : det.status === 'Failed' ? '#ffa39e' : det.status === 'Skipped' ? '#d9d9d9' : '#d9d9d9';",
  "                  var bg = det.status === 'Skipped' ? '#fafafa' : '#fff';",
  "                  els.push(React.createElement('div', {key:di,style:{border:'1px solid '+bc,borderRadius:'6px',padding:'12px',backgroundColor:bg,marginBottom:'8px'}},",
  "                    React.createElement('div', {style:{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'8px'}},",
  "                      React.createElement('span', {style:{fontSize:'13px',fontWeight:'600'}}, det.strategyName),",
  "                      React.createElement(Tag, {color:det.status==='Passed'?'green':det.status==='Caution'?'gold':det.status==='Failed'?'red':'default',style:{fontSize:'11px',margin:0}}, det.status)",
  "                    ),",
  "                    det.status === 'Skipped' && det.reason",
  "                      ? React.createElement('div', {style:{fontSize:'11px',color:'#888'}}, 'Reason: ' + (det.reason || ''))",
  "                      : React.createElement('div', null,",
  "                        React.createElement('div', {style:{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'4px 16px'}},",
  "                          React.createElement('div', {style:{fontSize:'11px',color:'#666'}}, 'Total Return'),",
  "                          React.createElement('div', {style:{fontSize:'13px',fontWeight:'700',color:(det.totalReturn||0)>=0?'#52c41a':'#ff4d4f'}}, (det.totalReturn!=null?det.totalReturn:0).toFixed(2) + '%'),",
  "                          React.createElement('div', {style:{fontSize:'11px',color:'#666'}}, 'Max Drawdown'),",
  "                          React.createElement('div', {style:{fontSize:'12px',fontWeight:'600',color:'#ff4d4f'}}, Math.abs(det.maxDrawdown||0).toFixed(2) + '%'),",
  "                          React.createElement('div', {style:{fontSize:'11px',color:'#666'}}, 'Sharpe Ratio'),",
  "                          React.createElement('div', {style:{fontSize:'12px',fontWeight:'600'}}, (det.sharpe||0).toFixed(2)),",
  "                          React.createElement('div', {style:{fontSize:'11px',color:'#666'}}, 'Win Rate'),",
  "                          React.createElement('div', {style:{fontSize:'12px',fontWeight:'600'}}, (det.winRate||0).toFixed(1) + '%'),",
  "                          React.createElement('div', {style:{fontSize:'11px',color:'#666'}}, 'Profit Factor'),",
  "                          React.createElement('div', {style:{fontSize:'12px',fontWeight:'600'}}, (det.profitFactor||0).toFixed(2)),",
  "                          React.createElement('div', {style:{fontSize:'11px',color:'#666'}}, 'Trades'),",
  "                          React.createElement('div', {style:{fontSize:'12px',fontWeight:'600'}}, det.tradeCount || 0),",
  "                          React.createElement('div', {style:{fontSize:'11px',color:'#666'}}, 'Window'),",
  "                          React.createElement('div', {style:{fontSize:'12px',fontWeight:'600'}}, det.windowUsed || 'N/A'),",
  "                        ),",
  "                        React.createElement('div', {style:{marginTop:'8px',padding:'6px 8px',borderRadius:'4px',backgroundColor:'#f5f5f5',fontSize:'11px'}},",
  "                          React.createElement('span', {style:{fontWeight:'600'}}, 'Conclusion: '),",
  "                          React.createElement('span', {style:{color:det.status==='Passed'?'#52c41a':det.status==='Caution'?'#faad14':'#ff4d4f'}},",
  "                            det.status==='Passed' ? 'Stable — usable for trading' : det.status==='Caution' ? 'Review risk metrics before trading' : det.status==='Failed' ? 'Not viable for current conditions' : det.status",
  "                          )",
  "                        )",
  "                      )",
  "                  ));",
  "                }",
  "                return React.createElement('div', {style:{display:'flex',flexDirection:'column',gap:'8px'}}, els);",
  "              })()}",
  "            </Card>",
  "          </Col>",
];

args = [rowClose, 0];
for(var i=0;i<btDetail.length;i++) args.push(btDetail[i]);
Array.prototype.splice.apply(l, args);
console.log('6. Backtest Detail section. Lines:', l.length);

// Save
fs.writeFileSync(path, l.join('\n'), 'utf8');
console.log('DONE. Lines:', l.length);
