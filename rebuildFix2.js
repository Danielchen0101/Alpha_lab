const fs = require('fs');
const path = 'C:/Users/kexuc/.openclaw/workspace/professional_quant_platform/frontend/src/pages/Portfolio.tsx';
let l = fs.readFileSync(path, 'utf8').split('\n');
console.log('Phase 2. Lines:', l.length);

// ============================
// 5. Add MTF analysis to results.push
// ============================
// Find the results.push that includes symbol, regime, matchedStrategies
const pushIdx = l.findIndex(x => x.indexOf('results.push({') >= 0 && x.indexOf('symbol') >= 0 && x.indexOf('regime') >= 0 && x.indexOf('matchedStrategies') >= 0);
console.log('results.push at', (pushIdx+1));

// The push currently ends with '});' after aiUsed
// We need to add mtf: analyzeMultiTimeframe(...) before the closing
const pushEnd = l.findIndex(x => x.indexOf('});' ) >= 0 && x > pushIdx && x < pushIdx + 20);
console.log('push end at', (pushEnd+1));
console.log('pushEnd line:', l[pushEnd].trim().substring(0,40));

for (let i = pushIdx; i <= pushEnd; i++) {
  var t = l[i].trim();
  console.log((i+1),':',t.substring(0,60));
}
