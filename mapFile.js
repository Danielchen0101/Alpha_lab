var l = require('fs').readFileSync('C:/Users/kexuc/.openclaw/workspace/professional_quant_platform/frontend/src/pages/Portfolio.tsx','utf8').split('\n');
var h = l.findIndex(function(x){return x.indexOf('const handleRunFineScan')>=0});
var p = l.findIndex(function(x){return x.indexOf('Priority')>=0 && x.indexOf('title')>=0});

// Search for push occurrence INSIDE handleRunFineScan body
var ps = -1;
for(var i = h; i < h + 600 && i < l.length; i++){
  if(l[i].indexOf('push({') >= 0) { ps = i; break; }
}
console.log('handleRunFineScan:',(h+1),'->',l[h].trim().substring(0,60));
console.log('Priority col:',(p+1),'->',l[p].trim().substring(0,60));
console.log('push inside handleRunFineScan:',(ps+1));
if(ps >= 0){
  var pe = -1;
  for(var i=ps;i<l.length && i<ps+25;i++){
    if(l[i].trim()==='});'){pe=i;break}
  }
  console.log('push end:',(pe+1));
  for(var i=ps;i<=pe;i++) console.log((i+1),':',l[i].trim().substring(0,70));
}

var s = l.findIndex(function(x){return x.indexOf('Sort by confidence')>=0});
var r = l.findIndex(function(x){return x.trim()==='</Row>' && x>2000});
console.log('Sort:',(s+1));
console.log('</Row>:',(r+1));
