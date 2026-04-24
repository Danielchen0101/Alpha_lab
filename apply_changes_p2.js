var path = 'C:/Users/kexuc/.openclaw/workspace/professional_quant_platform/frontend/src/pages/Portfolio.tsx';
var l = require('fs').readFileSync(path, 'utf8').split('\n');
console.log('Phase 2. Lines:', l.length);

// ===== CHANGE 4: Expand results.push =====
var pushStart = 5166; // 0-indexed
var pushEnd = 5175;
var setResultsLine = 5182; // setFineScanResults(results);

var mtfInsert = [
  "        mtf: analyzeMultiTimeframe({",
  "          trendLabel: ms && ms.trendLabel || c && c.trendLabel || '',",
  "          overallScore: score,",
  "          volumeStatus: ms && ms.volumeLabel || c && c.volumeLabel || '',",
  "          momentumLabel: ms && ms.momentumLabel || c && c.momentumLabel || '',",
  "          volatilityLabel: ms && ms.volatilityLabel || c && c.volatilityLabel || '',",
  "          structureLabel: ms && ms.structureLabel || c && c.structureLabel || '',",
  "          changePct: priceChange,",
  "        }),",
  "        backtest: { status: 'Pending', bestStrategy: '', summary: 'Quick backtest will run' },",
];
// Insert after the last field (aiUsed) but before '});'
var insertPos = pushEnd; // before '});'
var args = [insertPos, 0];
for (var i = 0; i < mtfInsert.length; i++) args.push(mtfInsert[i]);
Array.prototype.splice.apply(l, args);
console.log('4. Added mtf+backtest to push. Lines:', l.length);

// ===== CHANGE 5: Symbol-by-symbol backtest loop =====
// setResultsLine shifted by +10
var setResultsLine2 = setResultsLine + 10;

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
  "        // Decision score",
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

var args2 = [setResultsLine2, 0];
for (var i = 0; i < btLoop.length; i++) args2.push(btLoop[i]);
Array.prototype.splice.apply(l, args2);
console.log('5. Added backtest loop. Lines:', l.length);

require('fs').writeFileSync(path, l.join('\n'), 'utf8');
console.log('Saved phase 2');
