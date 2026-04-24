var fs = require('fs');
var path = 'C:/Users/kexuc/.openclaw/workspace/professional_quant_platform/frontend/src/pages/Portfolio.tsx';
var content = fs.readFileSync(path, 'utf8');

// ===== CHANGE 1: Expand results.push =====
var aiUsedLine = '          aiUsed: aiSucceeded,';
var oldPush = aiUsedLine + '\r\n        });';
var checkPos = content.indexOf(oldPush);
if (checkPos < 0) { console.log('CHANGE 1: NOT FOUND'); process.exit(1); }
console.log('CHANGE 1: Found at', checkPos);

var newPush = aiUsedLine + '\r\n          backtestStatus: \'Pending\',\r\n          backtestResults: [],\r\n        });';
content = content.replace(oldPush, newPush);
console.log('CHANGE 1: Done');

// ===== CHANGE 2: Insert backtest loop after sort =====
var sortMarker = '      results.forEach((r, i) => { r.priority = i + 1; });\r\n\r\n      setFineScanResults(results);\r\n      setFineScanProgress(100);\r\n      setFineScanStatus(\'completed\');';
var sortPos = content.indexOf(sortMarker);
if (sortPos < 0) { console.log('CHANGE 2: NOT FOUND'); process.exit(1); }
console.log('CHANGE 2: Found at', sortPos);

var backtestCode = 
'      results.forEach((r, i) => { r.priority = i + 1; });\r\n' +
'\r\n' +
'      // ===== Backtest Execution: symbol-by-symbol =====\r\n' +
'      var BACKTEST_TYPE_MAP = {\r\n' +
'        \'Moving Average\': \'moving_average\',\r\n' +
'        \'Moving Average Crossover\': \'moving_average\',\r\n' +
'        \'MACD\': \'macd\',\r\n' +
'        \'MACD Strategy\': \'macd\',\r\n' +
'        \'RSI\': \'rsi\',\r\n' +
'        \'RSI Strategy\': \'rsi\',\r\n' +
'        \'Bollinger Band\': \'bollinger\',\r\n' +
'        \'Bollinger Bands\': \'bollinger\',\r\n' +
'        \'Momentum\': \'momentum\',\r\n' +
'        \'Momentum Strategy\': \'momentum\',\r\n' +
'        \'Momentum Continuation\': \'momentum\',\r\n' +
'      };\r\n' +
'      var TIME_WINDOWS = [\'3M\', \'6M\', \'1Y\'];\r\n' +
'\r\n' +
'      // Run backtest: symbol by symbol, all strategies per symbol\r\n' +
'      for (var bi = 0; bi < results.length; bi++) {\r\n' +
'        var rec = results[bi];\r\n' +
'        var sym = rec.symbol;\r\n' +
'        var btResults = [];\r\n' +
'        var matchedStrs = rec.matchedStrategies || [];\r\n' +
'\r\n' +
'        for (var si = 0; si < matchedStrs.length; si++) {\r\n' +
'          var fsName = matchedStrs[si];\r\n' +
'          // Clean up strategy name - remove Regime prefix if present\r\n' +
'          var cleanName = fsName;\r\n' +
'          var colonIdx = fsName.indexOf(\':\');\r\n' +
'          if (colonIdx > 0) {\r\n' +
'            var afterColon = fsName.substring(colonIdx + 1).trim();\r\n' +
'            var match = afterColon.match(/[A-Z]/);\r\n' +
'            if (match) {\r\n' +
'              cleanName = afterColon.substring(match.index).trim();\r\n' +
'            }\r\n' +
'          }\r\n' +
'          cleanName = cleanName.replace(/^[\\\\\\/\\d\\.\\s]+/, \'\').trim();\r\n' +
'\r\n' +
'          var btType = BACKTEST_TYPE_MAP[cleanName];\r\n' +
'          if (!btType) {\r\n' +
'            btResults.push({\r\n' +
'              strategy: fsName,\r\n' +
'              status: \'Skipped\',\r\n' +
'              reason: \'Strategy not supported in Backtest\',\r\n' +
'            });\r\n' +
'            continue;\r\n' +
'          }\r\n' +
'\r\n' +
'          // Run backtest for each time window\r\n' +
'          for (var wi = 0; wi < TIME_WINDOWS.length; wi++) {\r\n' +
'            var tw = TIME_WINDOWS[wi];\r\n' +
'            try {\r\n' +
'              var btResp = await api.post(\'/backtest/run\', {\r\n' +
'                symbol: sym,\r\n' +
'                strategy: btType,\r\n' +
'                time_window: tw,\r\n' +
'              });\r\n' +
'              var btData = btResp.data || {};\r\n' +
'              btResults.push({\r\n' +
'                strategy: fsName,\r\n' +
'                timeWindow: tw,\r\n' +
'                status: btData.status || \'Completed\',\r\n' +
'                totalReturn: btData.totalReturn != null ? btData.totalReturn : null,\r\n' +
'                sharpeRatio: btData.sharpeRatio != null ? btData.sharpeRatio : null,\r\n' +
'                maxDrawdown: btData.maxDrawdown != null ? btData.maxDrawdown : null,\r\n' +
'                winRate: btData.winRate != null ? btData.winRate : null,\r\n' +
'                profitFactor: btData.profitFactor != null ? btData.profitFactor : null,\r\n' +
'                numTrades: btData.numTrades != null ? btData.numTrades : null,\r\n' +
'                calmarRatio: btData.calmarRatio != null ? btData.calmarRatio : null,\r\n' +
'                conclusion: btData.conclusion || \'\',\r\n' +
'              });\r\n' +
'            } catch (btErr) {\r\n' +
'              btResults.push({\r\n' +
'                strategy: fsName,\r\n' +
'                timeWindow: tw,\r\n' +
'                status: \'Error\',\r\n' +
'                reason: (btErr).message || \'Backtest API failed\',\r\n' +
'              });\r\n' +
'            }\r\n' +
'            // Small delay between time windows\r\n' +
'            await new Promise(function(r) { setTimeout(r, 200); });\r\n' +
'          } // end for each time window\r\n' +
'          await new Promise(function(r) { setTimeout(r, 300); });\r\n' +
'        } // end for each strategy\r\n' +
'\r\n' +
'        // Determine overall status for this symbol\r\n' +
'        var anyCompleted = btResults.some(function(r) { return r.status === \'Completed\' || r.status === \'Passed\'; });\r\n' +
'        var anyFailed = btResults.some(function(r) { return r.status === \'Failed\'; });\r\n' +
'        var anyError = btResults.some(function(r) { return r.status === \'Error\'; });\r\n' +
'        var allSkipped = btResults.every(function(r) { return r.status === \'Skipped\'; });\r\n' +
'        rec.backtestStatus = allSkipped ? \'Pending\' : (anyError ? \'Error\' : (anyFailed ? \'Failed\' : (anyCompleted ? \'Passed\' : \'Caution\')));\r\n' +
'        rec.backtestResults = btResults;\r\n' +
'      } // end for each symbol\r\n' +
'\r\n' +
'      setFineScanResults(results);\r\n' +
'      setFineScanProgress(100);\r\n' +
'      setFineScanStatus(\'completed\');';

content = content.replace(sortMarker, backtestCode);
console.log('CHANGE 2: Done');

// ===== CHANGE 3: Add Backtest Results Card to renderDetailPanel =====
var rdpEnd = '              </div>\r\n            </div>\r\n          </div>\r\n        </div>\r\n      </div>\r\n    </div>\r\n  );\r\n };';
var rdpEndPos = content.lastIndexOf(rdpEnd);
if (rdpEndPos < 0) {
  console.log('CHANGE 3: Trying NO backet renderDetailPanel end...');
  // Maybe there's no extra spacing. Let's find a shorter pattern
  var rdpShort = '    </div>\r\n  );\r\n };';
  var rdpShortPos = content.indexOf(rdpShort, 100000); // After line 2602
  if (rdpShortPos < 0) { 
    console.log('CHANGE 3: renderDetailPanel end NOT FOUND');
    process.exit(1);
  }
  console.log('CHANGE 3: Found short end at', rdpShortPos);
  
  // Read context to verify
  var ctx = content.substring(rdpShortPos - 300, rdpShortPos + 50);
  // Check if last line before is the proper end of a JSX block
  var beforeShort = content.substring(rdpShortPos - 100, rdpShortPos);
  console.log('Context before:', JSON.stringify(beforeShort.substring(beforeShort.length - 80)));
  
  rdpEnd = rdpShort;
  rdpEndPos = rdpShortPos;
}
console.log('CHANGE 3: Found renderDetailPanel end at', rdpEndPos);

var backtestCardHtml = 
'                </div>\r\n' +
'              </div>\r\n' +
'            </div>\r\n' +
'          </div>\r\n' +
'          \r\n' +
'          {/* ==== Backtest Results ==== */}\r\n' +
'          <div style={{ marginTop: \'16px\' }}>\r\n' +
'            <Card\r\n' +
'              size="small"\r\n' +
'              title={\r\n' +
'                <div style={{ display: \'flex\', alignItems: \'center\', gap: \'8px\' }}>\r\n' +
'                  <span style={{ fontSize: \'13px\', fontWeight: \'600\' }}>📈 Backtest Results</span>\r\n' +
'                  {record.backtestStatus ? (\r\n' +
'                    <Tag color={record.backtestStatus === \'Passed\' ? \'success\' : (record.backtestStatus === \'Error\' ? \'error\' : (record.backtestStatus === \'Failed\' ? \'warning\' : \'default\'))} style={{ fontSize: \'10px\' }}>\r\n' +
'                      {record.backtestStatus}\r\n' +
'                    </Tag>\r\n' +
'                  ) : null}\r\n' +
'                </div>\r\n' +
'              }\r\n' +
'              style={{ border: \'1px solid #e8e8e8\' }}\r\n' +
'              bodyStyle={{ padding: \'12px\' }}\r\n' +
'            >\r\n' +
'              {(!record.backtestResults || record.backtestResults.length === 0) ? (\r\n' +
'                <div style={{ textAlign: \'center\', padding: \'20px\', color: \'#999\', fontSize: \'12px\' }}>\r\n' +
'                  No backtest results available. Run Fine Scan to generate backtest data.\r\n' +
'                </div>\r\n' +
'              ) : (\r\n' +
'                <div>\r\n' +
'                  {record.backtestResults.map(function(bt, idx) {\r\n' +
'                    if (bt.status === \'Skipped\') {\r\n' +
'                      return (\r\n' +
'                        <div key={idx} style={{ display: \'flex\', justifyContent: \'space-between\', alignItems: \'center\', padding: \'8px 12px\', marginBottom: \'6px\', backgroundColor: \'#fafafa\', borderRadius: \'6px\', fontSize: \'12px\', border: \'1px solid #f0f0f0\' }}>\r\n' +
'                          <div style={{ fontWeight: \'600\', color: \'#333\' }}>{bt.strategy}</div>\r\n' +
'                          <div>\r\n' +
'                            <Tag color="default">Skipped</Tag>\r\n' +
'                            <span style={{ color: \'#999\', fontSize: \'11px\', marginLeft: \'8px\' }}>{bt.reason || \'Not applicable\'}</span>\r\n' +
'                          </div>\r\n' +
'                        </div>\r\n' +
'                      );\r\n' +
'                    }\r\n' +
'                    if (bt.status === \'Error\') {\r\n' +
'                      return (\r\n' +
'                        <div key={idx} style={{ display: \'flex\', justifyContent: \'space-between\', alignItems: \'center\', padding: \'8px 12px\', marginBottom: \'6px\', backgroundColor: \'#fff2f0\', borderRadius: \'6px\', fontSize: \'12px\', border: \'1px solid #ffa39e\' }}>\r\n' +
'                          <div>\r\n' +
'                            <span style={{ fontWeight: \'600\', color: \'#333\' }}>{bt.strategy}</span>\r\n' +
'                            {bt.timeWindow ? <span style={{ color: \'#999\', marginLeft: 8 }}>({bt.timeWindow})</span> : null}\r\n' +
'                          </div>\r\n' +
'                          <Tag color="error">Error: {bt.reason || \'Unknown\'}</Tag>\r\n' +
'                        </div>\r\n' +
'                      );\r\n' +
'                    }\r\n' +
'                    return (\r\n' +
'                      <div key={idx} style={{ marginBottom: \'8px\', padding: \'10px 12px\', backgroundColor: bt.status === \'Completed\' ? \'#f6ffed\' : \'#fffbe6\', borderRadius: \'6px\', border: \'1px solid \' + (bt.status === \'Completed\' ? \'#b7eb8f\' : \'#ffe58f\') }}>\r\n' +
'                        <div style={{ display: \'flex\', justifyContent: \'space-between\', alignItems: \'center\', marginBottom: \'6px\' }}>\r\n' +
'                          <div style={{ fontWeight: \'600\', fontSize: \'12px\', color: \'#333\' }}>\r\n' +
'                            {bt.strategy}\r\n' +
'                            {bt.timeWindow ? <span style={{ color: \'#999\', marginLeft: 8, fontWeight: \'normal\' }}>({bt.timeWindow})</span> : null}\r\n' +
'                          </div>\r\n' +
'                          <Tag color={bt.status === \'Completed\' ? \'success\' : (bt.status === \'Caution\' ? \'warning\' : \'default\')}>{bt.status || \'Completed\'}</Tag>\r\n' +
'                        </div>\r\n' +
'                        <div style={{ display: \'grid\', gridTemplateColumns: \'repeat(4, 1fr)\', gap: \'8px\', fontSize: \'11px\' }}>\r\n' +
'                          <div>\r\n' +
'                            <div style={{ color: \'#999\', marginBottom: \'2px\' }}>Total Return</div>\r\n' +
'                            <div style={{ fontWeight: \'600\', color: bt.totalReturn != null && bt.totalReturn >= 0 ? \'#52c41a\' : \'#ff4d4f\' }}>{bt.totalReturn != null ? (bt.totalReturn >= 0 ? \'+\' : \'\') + bt.totalReturn.toFixed(2) + \'%\' : \'--\'}</div>\r\n' +
'                          </div>\r\n' +
'                          <div>\r\n' +
'                            <div style={{ color: \'#999\', marginBottom: \'2px\' }}>Sharpe</div>\r\n' +
'                            <div style={{ fontWeight: \'600\', color: \'#333\' }}>{bt.sharpeRatio != null ? bt.sharpeRatio.toFixed(2) : \'--\'}</div>\r\n' +
'                          </div>\r\n' +
'                          <div>\r\n' +
'                            <div style={{ color: \'#999\', marginBottom: \'2px\' }}>Max DD</div>\r\n' +
'                            <div style={{ fontWeight: \'600\', color: \'#ff4d4f\' }}>{bt.maxDrawdown != null ? Math.abs(bt.maxDrawdown).toFixed(2) + \'%\' : \'--\'}</div>\r\n' +
'                          </div>\r\n' +
'                          <div>\r\n' +
'                            <div style={{ color: \'#999\', marginBottom: \'2px\' }}>Win Rate</div>\r\n' +
'                            <div style={{ fontWeight: \'600\', color: \'#333\' }}>{bt.winRate != null ? bt.winRate.toFixed(1) + \'%\' : \'--\'}</div>\r\n' +
'                          </div>\r\n' +
'                          <div>\r\n' +
'                            <div style={{ color: \'#999\', marginBottom: \'2px\' }}>Profit Factor</div>\r\n' +
'                            <div style={{ fontWeight: \'600\', color: \'#333\' }}>{bt.profitFactor != null ? bt.profitFactor.toFixed(2) : \'--\'}</div>\r\n' +
'                          </div>\r\n' +
'                          <div>\r\n' +
'                            <div style={{ color: \'#999\', marginBottom: \'2px\' }}>Trades</div>\r\n' +
'                            <div style={{ fontWeight: \'600\', color: \'#333\' }}>{bt.numTrades != null ? bt.numTrades : \'--\'}</div>\r\n' +
'                          </div>\r\n' +
'                          <div>\r\n' +
'                            <div style={{ color: \'#999\', marginBottom: \'2px\' }}>Calmar Ratio</div>\r\n' +
'                            <div style={{ fontWeight: \'600\', color: \'#333\' }}>{bt.calmarRatio != null ? bt.calmarRatio.toFixed(2) : \'--\'}</div>\r\n' +
'                          </div>\r\n' +
'                          {bt.conclusion ? (\r\n' +
'                            <div style={{ gridColumn: \'1 / -1\' }}>\r\n' +
'                              <div style={{ color: \'#999\', marginBottom: \'2px\' }}>Conclusion</div>\r\n' +
'                              <div style={{ fontWeight: \'400\', color: \'#555\', fontSize: \'10px\', lineHeight: 1.4 }}>{bt.conclusion}</div>\r\n' +
'                            </div>\r\n' +
'                          ) : null}\r\n' +
'                        </div>\r\n' +
'                      </div>\r\n' +
'                    );\r\n' +
'                  })}\r\n' +
'                </div>\r\n' +
'              )}\r\n' +
'            </Card>\r\n' +
'          </div>\r\n' +
'        </div>\r\n' +
'      </div>\r\n' +
'    </div>\r\n' +
'  );\r\n' +
' };';

content = content.replace(rdpEnd, backtestCardHtml);
console.log('CHANGE 3: Done');

fs.writeFileSync(path, content, 'utf8');
var newLineCount = content.split('\n').length;
console.log('ALL DONE. New line count:', newLineCount);
