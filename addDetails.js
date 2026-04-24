const fs = require('fs');
const path = 'C:/Users/kexuc/.openclaw/workspace/professional_quant_platform/frontend/src/pages/Portfolio.tsx';
let l = fs.readFileSync(path, 'utf8').split('\n');
const idx = l.findIndex(function(x){return x.indexOf('errorClassification: (btResult') >= 0});
if (idx >= 0) {
  l.splice(idx+1, 0, '            details: btResult.details || [],');
  fs.writeFileSync(path, l.join('\n'), 'utf8');
  console.log('Added details line at', (idx+2));
} else {
  console.log('errorClassification line not found');
}
