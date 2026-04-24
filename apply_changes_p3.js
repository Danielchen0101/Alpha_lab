var path = 'C:/Users/kexuc/.openclaw/workspace/professional_quant_platform/frontend/src/pages/Portfolio.tsx';
var l = require('fs').readFileSync(path, 'utf8').split('\n');
console.log('Phase 3. Lines:', l.length);

// ===== CHANGE 6: Backtest Detail section in renderDetailPanel =====
// Row close at 2923 (unchanged by previous inserts)
var rowClose = l.findIndex(function(x){return x.trim()==='</Row>'});
console.log('</Row> at', (rowClose+1));

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
  "              })()}" ,
  "            </Card>",
  "          </Col>",
];

var args = [rowClose, 0];
for (var i = 0; i < btDetail.length; i++) args.push(btDetail[i]);
Array.prototype.splice.apply(l, args);
console.log('6. Added Backtest Detail. Lines:', l.length);

require('fs').writeFileSync(path, l.join('\n'), 'utf8');
console.log('Saved phase 3');
