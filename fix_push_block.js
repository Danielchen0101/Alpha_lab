var fs = require('fs');
var path = 'C:/Users/kexuc/.openclaw/workspace/professional_quant_platform/frontend/src/pages/Portfolio.tsx';
var l = fs.readFileSync(path, 'utf8').split('\n');
console.log('Lines:', l.length);

// Find the actual push block
var pushStart = -1;
for(var i = 0; i < l.length; i++){
  if(l[i].indexOf('results.push({')>=0 && l[i+1].indexOf('symbol,')>=0){
    pushStart = i;
    break;
  }
}
console.log('Push at', (pushStart+1));

// We need to replace lines 5232-5242 (0-indexed from pushStart+9 to pushStart+19)
// with the correct mtf + backtest fields inside the push object
var idx = pushStart; // line 0-indexed

// Lines to remove: from pushStart+8 (after aiUsed) to pushStart+18 (orphan '}')
var removeStart = idx + 9;  // line 5232 (0-indexed)
var removeEnd = idx + 19;   // line 5242 (0-indexed)

console.log('Removing lines', (removeStart+1), 'to', (removeEnd+1), '(', (removeEnd-removeStart+1), 'lines)');

var removed = l.splice(removeStart, removeEnd - removeStart + 1);
console.log('Removed:', removed.length, 'lines');

// Insert proper mtf + backtest
var correctFields = [
  "          mtf: analyzeMultiTimeframe({",
  "            trendLabel: ms && ms.trendLabel || c && c.trendLabel || '',",
  "            overallScore: score,",
  "            volumeStatus: ms && ms.volumeLabel || c && c.volumeLabel || '',",
  "            momentumLabel: ms && ms.momentumLabel || c && c.momentumLabel || '',",
  "            volatilityLabel: ms && ms.volatilityLabel || c && c.volatilityLabel || '',",
  "            structureLabel: ms && ms.structureLabel || c && c.structureLabel || '',",
  "            changePct: priceChange,",
  "          }),",
  "          backtest: { status: 'Pending', bestStrategy: '', summary: 'Quick backtest will run' },",
];

var args = [removeStart, 0];
for(var i = 0; i < correctFields.length; i++) args.push(correctFields[i]);
Array.prototype.splice.apply(l, args);
console.log('Inserted correct fields. Lines:', l.length);

// Check result
var newPushStart = -1;
for(var i = pushStart - 1; i < pushStart + 25; i++){
  if(l[i].indexOf('results.push({')>=0 && l[i+1].indexOf('symbol,')>=0) newPushStart = i;
}
if(newPushStart >= 0){
  console.log('New push at', (newPushStart+1));
  for(var i = newPushStart; i < newPushStart + 15; i++) console.log((i+1),':',l[i].trim().substring(0,60));
}
// Also show after
for(var i = removeStart + 9; i < removeStart + 15; i++) console.log((i+1),':',l[i].trim().substring(0,60));

fs.writeFileSync(path, l.join('\n'), 'utf8');
console.log('Saved');
