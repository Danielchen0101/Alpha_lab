var fs = require('fs');
var path = 'C:/Users/kexuc/.openclaw/workspace/professional_quant_platform/frontend/src/pages/Portfolio.tsx';
var lines = fs.readFileSync(path, 'utf8').split('\n');

// Find index of Profit Factor value line
var pfLabelIdx = -1;
for(var i=0;i<lines.length;i++){
  if(lines[i].indexOf("Profit Factor") >= 0 &&
     lines[i].indexOf("style:{fontSize:'11px',color:'#666'}") >= 0){
    pfLabelIdx = i;
    break;
  }
}

console.log('Profit Factor label at line:', pfLabelIdx);
if(pfLabelIdx > 0){
  // After profit factor's value line (label+1), insert Calmar Ratio
  var insertAt = pfLabelIdx + 2;
  lines.splice(insertAt, 0,
    "                          React.createElement('div', {style:{fontSize:'11px',color:'#666'}}, 'Calmar Ratio'),",
    "                          React.createElement('div', {style:{fontSize:'12px',fontWeight:'600'}}, (function(){var v=det.calmarRatio||det.calmar||0;return v.toFixed(2);})()),"
  );
  console.log('Inserted Calmar Ratio at line:', insertAt);
}

fs.writeFileSync(path, lines.join('\n'), 'utf8');
console.log('Done');
