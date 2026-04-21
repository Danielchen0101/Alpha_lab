// 模拟前端analyzeTrend函数如何处理AI响应
function simulateAnalyzeTrend(aiResponse) {
  // 模拟前端analyzeTrend函数的逻辑
  const response = {
    data: aiResponse
  };
  
  console.log(`=== 模拟analyzeTrend处理 ${aiResponse.symbol} ===`);
  console.log('AI响应success:', response.data.success);
  console.log('AI响应trend:', response.data.trend);
  console.log('AI响应overallScore:', response.data.overallScore);
  console.log('AI响应confidence:', response.data.confidence);
  
  // 前端analyzeTrend函数的逻辑（根据代码分析）
  let trendAnalysis = {
    trendLabel: null,
    trendScore: null,
    trendConfidence: null,
    companyName: null,
    newsSentiment: null,
    eventRisk: null,
    sector: null,
    scannerReason: null,
    trendScoreDetail: null,
    momentumScore: null,
    volumeScore: null,
    volatilityScore: null,
    structureScore: null,
    newsScore: null,
    volumeStatus: null,
    aiReasoning: null,
    conciseReasoning: null,
    detailedReasoning: null,
    topNews: null,
    dataSource: 'Unknown'
  };
  
  if (response.data.success) {
    // 成功时合并数据
    trendAnalysis = {
      ...trendAnalysis,
      trendLabel: response.data.trend || null,
      trendScore: response.data.overallScore || response.data.trendScore || null,
      trendConfidence: response.data.confidence || null,
      companyName: response.data.companyName || null,
      newsSentiment: response.data.newsSentiment || null,
      eventRisk: response.data.eventRisk || null,
      sector: response.data.sector || null,
      scannerReason: response.data.scannerReason || response.data.conciseReasoning || null,
      trendScoreDetail: response.data.trendScoreDetail || response.data.trendScore || null,
      momentumScore: response.data.momentumScore || null,
      volumeScore: response.data.volumeScore || null,
      volatilityScore: response.data.volatilityScore || null,
      structureScore: response.data.structureScore || null,
      newsScore: response.data.newsScore || null,
      volumeStatus: response.data.volumeStatus || null,
      aiReasoning: response.data.aiReasoning || response.data.detailedReasoning || response.data.scannerReason,
      conciseReasoning: response.data.conciseReasoning || response.data.scannerReason,
      detailedReasoning: response.data.detailedReasoning || response.data.aiReasoning || response.data.scannerReason,
      topNews: response.data.topNews || null,
      dataSource: response.data.dataSource || 'Unknown'
    };
  }
  
  console.log('处理后trendLabel:', trendAnalysis.trendLabel);
  console.log('处理后trendScore:', trendAnalysis.trendScore);
  console.log('处理后trendConfidence:', trendAnalysis.trendConfidence);
  console.log('处理后aiReasoning:', trendAnalysis.aiReasoning ? '有值' : 'null');
  console.log('处理后volumeStatus:', trendAnalysis.volumeStatus);
  console.log('---');
  
  return trendAnalysis;
}

// 测试数据
const testCases = [
  {
    symbol: 'NVDA',
    success: true,
    trend: 'Bullish',
    overallScore: 68,
    confidence: 0.75,
    volumeStatus: 'Normal',
    conciseReasoning: 'Bullish trend driven by positive price momentum...',
    aiReasoning: 'Price movement analysis: NVDA at $198.46...'
  },
  {
    symbol: 'TSLA',
    success: true,
    trend: null,
    overallScore: null,
    confidence: null,
    volumeStatus: null,
    conciseReasoning: null,
    aiReasoning: null
  },
  {
    symbol: 'AAPL',
    success: true,
    trend: 'Bullish',
    overallScore: 78,
    confidence: 0.8,
    volumeStatus: 'High',
    conciseReasoning: 'Strong bullish momentum...',
    aiReasoning: 'AAPL shows strong technical indicators...'
  },
  {
    symbol: 'XOM',
    success: true,
    trend: null,
    overallScore: null,
    confidence: null,
    volumeStatus: null,
    conciseReasoning: null,
    aiReasoning: null
  }
];

console.log('=== 前端analyzeTrend函数处理测试 ===\n');

testCases.forEach(testCase => {
  simulateAnalyzeTrend(testCase);
});

// 分析问题
console.log('\n=== 问题分析 ===');
console.log('1. TSLA和XOM的AI响应中trend为null，导致前端trendLabel为null');
console.log('2. 即使success: true，如果trend为null，前端也会显示N/A');
console.log('3. 这解释了为什么有些symbol随机显示N/A：AI返回了success但trend为null');
console.log('4. 响应时间极慢（22-27秒），可能导致前端超时或并发问题');
console.log('5. 慢响应可能导致前端在等待时超时，然后使用null值');