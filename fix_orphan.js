var fs = require('fs');
var path = 'C:/Users/kexuc/.openclaw/workspace/professional_quant_platform/frontend/src/pages/Portfolio.tsx';
var l = fs.readFileSync(path, 'utf8').split('\n');
console.log('Fix. Lines:', l.length);

// Find the broken push block
var pushStart = -1;
for(var i = 0; i < l.length; i++){
  if(l[i].indexOf('results.push({') >= 0 && l[i].indexOf('symbol') >= 0 && l[i].indexOf('regime') >= 0){
    pushStart = i; break;
  }
}
console.log('pushStart at', (pushStart+1));

// Find where the malformed block is
for(var i = pushStart; i < pushStart + 25; i++){
  console.log((i+1),':',JSON.stringify(l[i]));
}

// The fix: line 5232 (0-index: 5231) is '        });\r' 
// and lines 5233+ are non-CRLF mtf fields that should be BEFORE the });
// Remove them and re-insert at correct position
// Actual content at 5233..5243 are mis-placed
// We need to move them BEFORE 5231 '});\r' and remove the orphan '}\r' at 5243

// Remove lines 5233-5243 (mtf, backtest, orphan }) and re-insert before line 5231
var orphanBlock = l.splice(5233, 5243 - 5233 + 1);
console.log('Removed ', orphanBlock.length, 'orphan lines');

// Insert before the '});' at 5231
var args = [5231, 0];
for(var i = 0; i < orphanBlock.length; i++) args.push(orphanBlock[i]);
Array.prototype.splice.apply(l, args);
console.log('Reinserted. Lines:', l.length);

// Remove the empty orphan } that was left (the original line 5243 '}')
// Now it should be at the end of the inserted block
// Check what's at the new position
for(var i = pushStart; i < pushStart + 25; i++){
  console.log((i+1),':',JSON.stringify(l[i]));
}

fs.writeFileSync(path, l.join('\n'), 'utf8');
console.log('Saved');
