var path = 'C:/Users/kexuc/.openclaw/workspace/professional_quant_platform/frontend/src/pages/Portfolio.tsx';
var l = require('fs').readFileSync(path, 'utf8').split('\n');
console.log('Starting v1.8.5, lines:', l.length);

// ===================== KEY LOCATIONS =====================
var handleFn = 4683;
var priorityCol = 6276;
var pushStart = 5034;
var pushEnd = 5043;
var sortLine = 5046;
var setResultsLine = 5050;
var setProgressLine = 5051;
var rowClose = 2900; // will search

// ===================== CHANGE 1: New columns =====================
var newCols = [
  '    {',
  "      title: 'MTF Alignment',",
  "      key: 'mtfAlignment',",
  '      width: 150,',
  '      render: (record: any) => {',
  "        const mtf = record.mtf || {};",
  "        if (!mtf.alignment) return <span style={{color:'#999',fontSize:'11px'}}>--</span>;",
  "        let color = '#52c41a';",
  "        if (mtf.alignment.indexOf('Conflicted') >= 0) color = '#ff4d4f';",
  "        else if (mtf.alignment.indexOf('Partially') >= 0) color = '#faad14';",
  "        else if (mtf.alignment.indexOf('bearish') >= 0) color = '#ff4d4f';",
  '        return (',
  '          <div>',
  "            <Tag color={color} style={{fontSize:'10px',marginBottom:0}}>{mtf.alignment}</Tag>",
  "            <div style={{fontSize:'10px',color:'#888',marginTop:2}}>{mtf.mtfNotes?.substring(0,50) || ''}</div>",
  '          </div>',
  '        );',
  '      },',
  '    },',
  '    {',
  "      title: 'Daily',",
  "      key: 'dailyBias',",
  '      width: 90,',
  '      render: (record: any) => {',
  "        const mtf = record.mtf || {};",
  "        return <span style={{fontSize:'11px',color:'#666'}}>{mtf.dailyBias || '--'}</span>;",
  '      },',
  '    },',
  '    {',
  "      title: '4H/1H',",
  "      key: 'midBias',",
  '      width: 80,',
  '      render: (record: any) => {',
  "        const mtf = record.mtf || {};",
  "        return <span style={{fontSize:'11px',color:'#666'}}>{mtf.midBias || '--'}</span>;",
  '      },',
  '    },',
  '    {',
  "      title: 'Entry',",
  "      key: 'entryTiming',",
  '      width: 80,',
  '      render: (record: any) => {',
  "        const mtf = record.mtf || {};",
  "        let color = '#52c41a';",
  "        if (mtf.entryTiming === 'Extended') color = '#ff4d4f';",
  "        else if (mtf.entryTiming === 'Stable') color = '#1890ff';",
  "        return <Tag color={color} style={{fontSize:'10px',marginBottom:0}}>{mtf.entryTiming || '--'}</Tag>;",
  '      },',
  '    },',
  '    {',
  "      title: 'Backtest Check',",
  "      key: 'backtestCheck',",
  '      width: 110,',
  '      render: (record: any) => {',
  "        const bt = record.backtest || {};",
  "        const st = bt.status || 'Pending';",
  "        let col = '#8c8c8c'; let msg = '';",
  "        if (st === 'Passed') { col='#52c41a'; msg='Stable'; }",
  "        else if (st === 'Caution') { col='#faad14'; msg=(bt.summary||'').length<30?bt.summary:'Review needed'; }",
  "        else if (st === 'Failed') { col='#ff4d4f'; msg=(bt.summary||'').length<30?bt.summary:'Unusable'; }",
  "        else if (st === 'Skipped') { col='#d9d9d9'; msg=(bt.summary||'').length<30?bt.summary:'Skipped'; }",
  "        else if (st === 'Error') { col='#8c8c8c'; const err=bt.errorClassification||'unknown'; if(err==='strategy_not_mapped')msg='Strategy'; else if(err==='api_failed_or_empty')msg='API'; else msg='No data'; }",
  '        return (',
  '          <div>',
  "            <Tag color={col} style={{fontSize:'10px',marginBottom:0}}>{st}</Tag>",
  "            <div style={{fontSize:'10px',color:'#888',marginTop:2}}>{msg}</div>",
  '          </div>',
  '        );',
  '      },',
  '    },',
  '    {',
  "      title: 'Conclusion',",
  "      key: 'conclusion',",
  '      width: 90,',
  '      render: (record: any) => {',
  "        const conc = (record.conclusion) || (record.priorityScore>=70?'Proceed':record.priorityScore>=40?'Watch':'Skip');",
  "        const ccol = record.conclusionColor || (conc==='Proceed'?'#52c41a':conc==='Watch'?'#faad14':'#ff4d4f');",
  '        return (',
  '          <div>',
  "            <Badge color={ccol} text={<span style={{fontSize:'11px',fontWeight:600,color:ccol}}>{conc}</span>} />",
  "            <div style={{fontSize:'10px',color:'#888',marginTop:2}}>Score: {(record.priorityScore||record.matchConfidence)||'--'}</div>",
  '          </div>',
  '        );',
  '      },',
  '    },',
];

l.splice(priorityCol + 1, 0, newCols);
console.log('1. Added columns. Lines:', l.length);

// Save
require('fs').writeFileSync(path, l.join('\n'), 'utf8');
console.log('Saved after col insert');
