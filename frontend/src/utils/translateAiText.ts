/**
 * Frontend-side display translator for AI-generated English text.
 * Does NOT call any AI API — purely dictionary/phrase replacement.
 * Only activates when language === 'zh-CN'.
 */

// Common financial / market terms → Chinese
const TERM_MAP: [RegExp, string][] = [
  // Trend / direction
  [/\bStrong Bullish\b/gi, '强烈看涨'],
  [/\bStrongly Bullish\b/gi, '强烈看涨'],
  [/\bBullish\b/gi, '看涨'],
  [/\bStrong Bearish\b/gi, '强烈看跌'],
  [/\bStrongly Bearish\b/gi, '强烈看跌'],
  [/\bBearish\b/gi, '看跌'],
  [/\bNeutral\b/gi, '中性'],
  [/\bModerately\b/gi, '温和地'],
  [/\bSlightly\b/gi, '略微'],

  // Momentum / trend words
  [/\bmomentum\b/gi, '动量'],
  [/\buptrend\b/gi, '上升趋势'],
  [/\bdowntrend\b/gi, '下降趋势'],
  [/\btrend\b/gi, '趋势'],
  [/\breversal\b/gi, '反转'],
  [/\bbreakout\b/gi, '突破'],
  [/\bbreakdown\b/gi, '跌破'],
  [/\bconsolidation\b/gi, '盘整'],
  [/\bpullback\b/gi, '回调'],
  [/\brally\b/gi, '反弹'],
  [/\bselloff\b/gi, '抛售'],
  [/\bsurge\b/gi, '暴涨'],
  [/\bplunge\b/gi, '暴跌'],
  [/\bvolatile\b/gi, '波动剧烈'],
  [/\bvolatility\b/gi, '波动率'],
  [/\bstable\b/gi, '稳定'],
  [/\bstability\b/gi, '稳定性'],

  // Volume / liquidity
  [/\bvolume\b/gi, '成交量'],
  [/\bhigh volume\b/gi, '高成交量'],
  [/\blow volume\b/gi, '低成交量'],
  [/\bnormal volume\b/gi, '正常成交量'],
  [/\bliquidity\b/gi, '流动性'],
  [/\bliquid\b/gi, '流动性好'],

  // Price
  [/\bcurrent price\b/gi, '当前价格'],
  [/\bprice target\b/gi, '目标价'],
  [/\bsupport level\b/gi, '支撑位'],
  [/\bresistance level\b/gi, '阻力位'],
  [/\boverbought\b/gi, '超买'],
  [/\boversold\b/gi, '超卖'],
  [/\bhigh\b(?!\s*:)/gi, '高'],
  [/\blow\b(?!\s*:)/gi, '低'],

  // Risk
  [/\brisk\b/gi, '风险'],
  [/\bevent risk\b/gi, '事件风险'],
  [/\bhigh risk\b/gi, '高风险'],
  [/\bmedium risk\b/gi, '中等风险'],
  [/\blow risk\b/gi, '低风险'],
  [/\brisk gate\b/gi, '风险门控'],

  // Sentiment
  [/\bsentiment\b/gi, '情绪'],
  [/\bpositive sentiment\b/gi, '正面情绪'],
  [/\bnegative sentiment\b/gi, '负面情绪'],
  [/\bmixed sentiment\b/gi, '混合情绪'],
  [/\bpositive\b/gi, '正面'],
  [/\bnegative\b/gi, '负面'],
  [/\bmixed\b/gi, '混合'],
  [/\boptimistic\b/gi, '乐观'],
  [/\bpessimistic\b/gi, '悲观'],
  [/\bcautious\b/gi, '谨慎'],

  // News
  [/\bnews\b/gi, '新闻'],
  [/\bheadline\b/gi, '头条'],
  [/\breport\b/gi, '报告'],
  [/\bearnings\b/gi, '财报'],
  [/\bFDA\b/g, 'FDA'],
  [/\bapproval\b/gi, '批准'],
  [/\bupgrade\b/gi, '上调评级'],
  [/\bdowngrade\b/gi, '下调评级'],
  [/\binitiated\b/gi, '首次覆盖'],

  // Action / recommendation
  [/\bbuy\b/gi, '买入'],
  [/\bsell\b/gi, '卖出'],
  [/\bhold\b/gi, '持有'],
  [/\bwatch\b/gi, '观察'],
  [/\bcontinue\b(?!\s*scan)/gi, '继续'],
  [/\bconfirmed\b/gi, '已确认'],
  [/\brejected\b/gi, '已拒绝'],
  [/\brecommended\b/gi, '建议'],
  [/\brecommendation\b/gi, '建议'],

  // Score / metrics
  [/\bscore\b/gi, '评分'],
  [/\bconfidence\b/gi, '置信度'],
  [/\bsharpe ratio\b/gi, '夏普比率'],
  [/\bdrawdown\b/gi, '回撤'],
  [/\bwin rate\b/gi, '胜率'],
  [/\bprofit factor\b/gi, '盈利因子'],
  [/\bbacktest\b/gi, '回测'],

  // Market structure
  [/\bsector\b/gi, '板块'],
  [/\bindustry\b/gi, '行业'],
  [/\bmarket cap\b/gi, '市值'],
  [/\bIPO\b/g, 'IPO'],
  [/\bETF\b/g, 'ETF'],
  [/\bindex\b/gi, '指数'],

  // Time references
  [/\bshort.term\b/gi, '短期'],
  [/\bmedium.term\b/gi, '中期'],
  [/\blong.term\b/gi, '长期'],
  [/\b24h\b/g, '24小时'],
  [/\b7d\b/g, '7天'],
  [/\b30d\b/g, '30天'],

  // Common phrases
  [/\bStrong bullish momentum\b/gi, '强劲看涨动量'],
  [/\bbullish momentum\b/gi, '看涨动量'],
  [/\bbearish momentum\b/gi, '看跌动量'],
  [/\bwith a\b/gi, '伴随'],
  [/\bsurge in\b/gi, '激增'],
  [/\bdriven by\b/gi, '受…推动'],
  [/\bsupported by\b/gi, '受…支撑'],
  [/\bdue to\b/gi, '由于'],
  [/\bin spite of\b/gi, '尽管'],
  [/\bdespite\b/gi, '尽管'],
  [/\bhowever\b/gi, '然而'],
  [/\bmoreover\b/gi, '此外'],
  [/\bmeanwhile\b/gi, '与此同时'],
  [/\bin the last\b/gi, '在过去'],
  [/\bover the past\b/gi, '在过去'],
  [/\btop gainers\b/gi, '涨幅最大的股票'],
  [/\btop losers\b/gi, '跌幅最大的股票'],
  [/\bgainers\b/gi, '上涨股'],
  [/\blosers\b/gi, '下跌股'],
  [/\bsession\b/gi, '交易时段'],
  [/\btrading day\b/gi, '交易日'],
  [/\bmarket\b/gi, '市场'],
  [/\bstock\b/gi, '股票'],
  [/\bshares?\b/gi, '股票'],
  [/\bcandidate\b/gi, '候选'],
  [/\banalysis\b/gi, '分析'],
  [/\bdetailed\b/gi, '详细'],
  [/\bavailable\b/gi, '可用'],
  [/\bunavailable\b/gi, '不可用'],
  [/\bsignals?\b/gi, '信号'],
  [/\bindicators?\b/gi, '指标'],
  [/\bpattern\b/gi, '形态'],
  [/\bsetup\b/gi, '设置'],
  [/\btrigger\b/gi, '触发'],
  [/\bentry\b/gi, '入场'],
  [/\bexit\b/gi, '出场'],
  [/\bprofit\b/gi, '盈利'],
  [/\bloss\b/gi, '亏损'],
  [/\breturn\b/gi, '收益'],
];

/**
 * Translate an English AI text string to Chinese using dictionary replacement.
 * Only activates for zh-CN language. Returns original text for en-US.
 */
export function translateAiTextToZh(text: string | null | undefined, language: string): string {
  if (!text) return text || '';
  if (language !== 'zh-CN') return text;

  let result = text;
  for (const [pattern, replacement] of TERM_MAP) {
    result = result.replace(pattern, replacement);
  }
  return result;
}
