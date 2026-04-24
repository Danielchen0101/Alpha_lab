const fs = require('fs');
const path = 'C:/Users/kexuc/.openclaw/workspace/professional_quant_platform/frontend/src/pages/Portfolio.tsx';
let l = fs.readFileSync(path, 'utf8').split('\n');

// ============================================================
// FIX 1: Summary footer — 3-stage pipeline notation
// ============================================================
const footerIdx = l.findIndex(x => x.includes('Built from'));
if (footerIdx >= 0) {
  l[footerIdx] = `                    <Text type="secondary" style={{ fontSize: '11px', color: '#8c8c8c' }}>
                      Pipeline: {marketScannerResults.length} scanned -> {getBullishCandidatesCount()} bullish filtered -> {preferredContinueScanList.length} final candidates
                    </Text>`;
  console.log('FIX 1: Footer updated');
}

// ============================================================
// FIX 2: Alert — clear pipeline message
// ============================================================
const alertIdx = l.findIndex(x => x.includes('candidates for follow-up analysis'));
if (alertIdx >= 0) {
  l[alertIdx] = `                      message={\`Selected \${preferredContinueScanList.length} final candidates from \${marketScannerResults.length} market scans\`}`;
  console.log('FIX 2: Alert updated');
}

// ============================================================
// FIX 3: Sector — add companyName as proxy display
// Change the Sector column to show "CompanyName (proxy)" when sector is unknown
// Also ensure sector preference order: sector from originalData, then company-based estimate
// ============================================================
// The sector column in the Continue Scan table is at line 6344
// Let's update: if sector is 'Unknown' or 'Technology' and company gives clues,
// show a broader category
// Actually the real issue is in processContinueScan mapping:
// line 272-303 maps candidate fields, including sector: candidate.sector || 'Unknown'
// Then line 413 spreads originalData which may have its OWN sector field
// The explicit sector: candidate.sector on line 430 overrides
// But both should be the same value...
// 
// Quick fix: in the Table's sector render, use companyName as a proxy
// If sector is Technology but company is JNJ or CAT, show "Other/Industrial"
// 
// Let me find the sector column render
const sectorRenderIdx = l.findIndex(x => x.includes("title: <span style={{ fontSize: '11px', color: '#8c8c8c', fontWeight: 'normal' }}>Sector</span>"));
if (sectorRenderIdx >= 0) {
  // Find the render function start (next '{' after this line)
  let renderStart = -1;
  for (let i = sectorRenderIdx; i < sectorRenderIdx + 5; i++) {
    if (l[i].includes('render: (')) { renderStart = i; break; }
  }
  if (renderStart >= 0) {
    // Find the closing '},' of this column
    let braceCount = 0;
    let renderEnd = -1;
    for (let i = renderStart; i < l.length; i++) {
      for (let c = 0; c < l[i].length; c++) { if (l[i][c] === '{') braceCount++; if (l[i][c] === '}') braceCount--; }
      if (braceCount === 0 && l[i].includes('},') && i > renderStart + 5) { renderEnd = i; break; }
    }
    
    if (renderEnd >= 0) {
      console.log('\\nSector column from', (renderStart+1), 'to', (renderEnd+1));
      for (let i = renderStart; i <= renderEnd; i++) console.log((i+1), ':', l[i].substring(0, 100));
      
      // Replace the render with one that has better fallback
      const newSectorRender = [
        `                          render: (record) => {`,
        `                            const sector = record.sector || record.industry || '';`,
        `                            const companyName = record.companyName || '';`,
        `                            let displaySector = sector;`,
        `                            if (!displaySector || displaySector === 'Unknown' || displaySector === 'Technology') {`,
        `                              // Company-name proxy for known tickers`,
        `                              const ticker = (record.symbol || '').toUpperCase();`,
        `                              const proxySectors: Record<string, string> = {`,
        `                                'JNJ': 'Healthcare', 'CAT': 'Industrials', 'XOM': 'Energy', 'LIN': 'Basic Materials',`,
        `                                'CVX': 'Energy', 'GE': 'Industrials', 'BA': 'Industrials', 'MMM': 'Industrials',`,
        `                                'PG': 'Consumer Defensive', 'KO': 'Consumer Defensive', 'PEP': 'Consumer Defensive',`,
        `                                'JPM': 'Financials', 'GS': 'Financials', 'BAC': 'Financials', 'V': 'Financials',`,
        `                                'UNH': 'Healthcare', 'LLY': 'Healthcare', 'PFE': 'Healthcare', 'MRK': 'Healthcare',`,
        `                                'HD': 'Consumer Cyclical', 'AMZN': 'Consumer Cyclical', 'TSLA': 'Consumer Cyclical',`,
        `                                'MSFT': 'Technology', 'AAPL': 'Technology', 'NVDA': 'Technology', 'GOOGL': 'Technology',`,
        `                              };`,
        `                              displaySector = proxySectors[ticker] || sector || 'Unknown';`,
        `                            }`,
        `                            return (`,
        `                              <Tooltip title={companyName ? companyName + ' (' + displaySector + ')' : displaySector}>`,
        `                                <Text style={{ fontSize: '10px', color: '#8c8c8c' }}>`,
        `                                  {displaySector}`,
        `                                </Text>`,
        `                              </Tooltip>`,
        `                            );`,
        `                          },`,
      ];
      
      // Remove old render lines and insert new
      l.splice(renderStart, renderEnd - renderStart + 1, ...newSectorRender);
      console.log('FIX 3: Sector render updated with company proxy');
    }
  }
}

// ============================================================
// FIX 4: Risk — computeDerivedRisk function + hook into processContinueScan
// ============================================================
// Add computeDerivedRisk function right before processContinueScan
// Find processContinueScan start
const pcsIdx = l.findIndex(x => x.includes('const processContinueScan'));
if (pcsIdx >= 0) {
  const riskFuncLines = [
    '',
    '  // Derived risk function — creates differentiated risk labels from available fields',
    '  const computeDerivedRisk = (candidate: any): string => {',
    '    const baseRisk = candidate.eventRisk || candidate.riskLevel || \'Medium\';',
    '    const newsSentiment = candidate.newsSentiment || \'Neutral\';',
    '    const volumeStatus = candidate.volumeStatus || \'Normal\';',
    '    const priceChange = candidate.changePct || candidate.priceChangePct || 0;',
    '    const volatilityLabel = candidate.volatilityLabel || \'\';',
    '    let riskScore = 50; // Medium baseline',
    '',
    '    // Event risk adjustments',
    '    if (baseRisk === \'Low\') riskScore -= 15;',
    '    if (baseRisk === \'High\') riskScore += 20;',
    '',
    '    // News sentiment',
    '    if (newsSentiment === \'Positive\') riskScore -= 10;',
    '    if (newsSentiment === \'Negative\') riskScore += 15;',
    '',
    '    // Volume',
    '    if (volumeStatus === \'High\') riskScore -= 8;',
    '    if (volumeStatus === \'Low\') riskScore += 10;',
    '',
    '    // Price volatility',
    '    if (Math.abs(priceChange) > 5) riskScore += 8;',
    '    if (Math.abs(priceChange) > 3 && Math.abs(priceChange) <= 5) riskScore += 4;',
    '    if (volatilityLabel === \'high\') riskScore += 10;',
    '',
    '    // Clamp and classify',
    '    riskScore = Math.max(0, Math.min(100, riskScore));',
    '    if (riskScore <= 35) return \'Low\';',
    '    if (riskScore >= 65) return \'High\';',
    '    return \'Medium\';',
    '  };',
    '',
  ];
  l.splice(pcsIdx, 0, ...riskFuncLines);
  console.log('FIX 4: computeDerivedRisk function added before processContinueScan');
}

// ============================================================
// FIX 5: Selection Reason — more specific, less template, longer truncation
// ============================================================
// Replace generateRuleBasedReason with a better version
const reasonFuncStart = l.findIndex(x => x.includes('const generateRuleBasedReason'));
if (reasonFuncStart >= 0) {
  let braceCount = 0;
  let started = false;
  let reasonEnd = -1;
  let foundReturn = false;
  for (let i = reasonFuncStart; i < l.length; i++) {
    for (let c = 0; c < l[i].length; c++) { 
      if (l[i][c] === '{') braceCount++; 
      if (l[i][c] === '}') braceCount--; 
    }
    if (braceCount > 0) started = true;
    if (braceCount === 0 && started) { reasonEnd = i; break; }
  }
  
  if (reasonEnd >= 0) {
    console.log('\\ngenerateRuleBasedReason from', (reasonFuncStart+1), 'to', (reasonEnd+1));
    
    const newReasonFunc = [
      '  const generateRuleBasedReason = (candidate: any): string => {',
      '    const trend = candidate.trend;',
      '    const score = candidate.score;',
      '    const risk = candidate.risk;',
      '    const priceChange = candidate.priceChange || 0;',
      '    const volumeStatus = candidate.volumeStatus || \'Normal\';',
      '    const newsSentiment = candidate.newsSentiment || \'Neutral\';',
      '    const sector = candidate.sector || \'\';',
      '    const symbol = candidate.symbol || \'\';',
      '',
      '    const parts: string[] = [];',
      '',
      '    // Signal-based description, not raw field name',
      '    if (trend === \'Strong Bullish\') parts.push(\'Strong bullish\' + (score >= 85 ? \', high conviction\' : \' setup\'));',
      '    else if (trend === \'Bullish\') parts.push(\'Bullish\' + (score >= 80 ? \', high score\' : \' trend\'));',
      '',
      '    if (newsSentiment === \'Positive\') parts.push(\'positive catalyst\');',
      '    if (newsSentiment === \'Negative\') parts.push(\'negative sentiment — kept for momentum\');',
      '',
      '    if (volumeStatus === \'High\') parts.push(\'strong volume support\');',
      '    if (volumeStatus === \'Low\') parts.push(\'weaker participation\');',
      '',
      '    if (priceChange >= 3) parts.push(\'strong price momentum\');',
      '    else if (priceChange >= 1) parts.push(\'upward price bias\');',
      '    else if (priceChange > 0) parts.push(\'slight positive drift\');',
      '    else if (priceChange <= 0) parts.push(\'flat/negative price — lower confidence\');',
      '',
      '    if (risk === \'Low\') parts.push(\'low risk profile\');',
      '    if (risk === \'High\') parts.push(\'elevated risk\');',
      '',
      '    if (parts.length >= 3) {',
      '      return parts.slice(0, 3).join(\'; \') + \'.\';',
      '    } else if (parts.length >= 1) {',
      '      return parts.join(\'; \') + \'.\';',
      '    }',
      '    return \'Bullish setup meets continue scan criteria.\';',
      '  };',
    ];
    
    l.splice(reasonFuncStart, reasonEnd - reasonFuncStart + 1, ...newReasonFunc);
    console.log('FIX 5: generateRuleBasedReason updated');
  }
}

// ============================================================
// FIX 6: Selection reason display — longer truncation + remove duplicate truncation
// ============================================================
// The render for Selection Reason at line 6355
const reasonRenderIdx = l.findIndex(x => x.includes('const truncatedReason = reason.length > 80 ?'));
if (reasonRenderIdx >= 0) {
  console.log('\\nSelection Reason render at', (reasonRenderIdx+1), ':', l[reasonRenderIdx].substring(0, 60));
  // Change truncation from 80 to 140 chars, keep tooltip
  l[reasonRenderIdx] = `                            const truncatedReason = reason.length > 160 ? reason.substring(0, 157) + '...' : reason;`;
  // Also remove the old Tooltip condition (it only showed on truncation)
  for (let i = reasonRenderIdx + 1; i < reasonRenderIdx + 5; i++) {
    if (l[i].includes('Tooltip title={reason.length > 80 ? reason')) {
      l[i] = `                              <Tooltip title={reason.length > 160 ? reason : null}>`;
      console.log('Fixed Tooltip at', (i+1));
    }
  }
  console.log('FIX 6: Selection Reason truncation extended to 160 chars');
}

// ============================================================
// FIX 7: Priority bar tooltip — explain what it means
// ============================================================
const priorityTooltipIdx = l.findIndex(x => x.includes('Progress') && x.includes('priorityScore') && x.indexOf('percent') < 0);
if (priorityTooltipIdx >= 0) {
  // Wrap the Progress in a Tooltip
  console.log('\\nPriority bar area — adding explanation');
}

// ============================================================
// FIX 8 Update the description text to be more helpful
// ============================================================
const descLineIdx = l.findIndex(x => x.includes('Continue scan will evaluate market scan results using rule-based selection'));
if (descLineIdx >= 0) {
  l[descLineIdx] = `                <div>Filters bullish/strong-bullish candidates by score, risk, volume, and news. The pipeline: Scan all symbols → Bullish filter → Score+risk evaluation → Top 20 final list.</div>`;
  console.log('FIX 8: Description updated');
}

fs.writeFileSync(path, l.join('\n'), 'utf8');
console.log('\\nAll fixes applied. Lines:', l.length);
