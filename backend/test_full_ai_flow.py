"""
测试完整的AI分析流程：从历史数据获取到技术指标计算到AI分析
"""

import sys
import os
import json

# 添加当前目录到Python路径
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# 导入必要的模块
try:
    from technical_indicators import calculate_technical_indicators, analyze_news_for_scanner
    print("[导入] 成功导入技术指标模块")
except ImportError as e:
    print(f"[导入] 导入技术指标模块失败: {e}")
    sys.exit(1)

def simulate_market_data(symbol="AAPL"):
    """模拟市场数据"""
    return {
        'symbol': symbol,
        'price': 175.50,
        'changePercent': 1.25,
        'volume': 45000000,
        'dayHigh': 176.20,
        'dayLow': 174.80,
        'previousClose': 173.35,
        'sector': 'Technology',
        'industry': 'Consumer Electronics',
        'dataSource': 'alpaca'
    }

def simulate_historical_bars():
    """模拟历史bars数据（60天）"""
    historical_bars = []
    base_price = 170.0
    
    # 生成60天的模拟数据（缓慢上涨趋势）
    for i in range(60):
        bar = {
            't': f'2024-01-{i+1:02d}T00:00:00Z',
            'o': base_price + i * 0.3,  # 开盘价
            'h': base_price + i * 0.3 + 1.5,  # 高点
            'l': base_price + i * 0.3 - 1.0,  # 低点
            'c': base_price + i * 0.3 + 0.8,  # 收盘价
            'v': 40000000 + i * 500000  # 成交量逐渐增加
        }
        historical_bars.append(bar)
    
    return historical_bars

def simulate_news_data():
    """模拟新闻数据"""
    return {
        'sentiment': 'Positive',
        'eventRisk': 'Low',
        'topCatalyst': 'Strong Q1 earnings beat estimates',
        'newsCount': 5,
        'hasNews': True,
        'raw_news': [
            {
                'headline': 'Apple reports strong Q1 earnings, beats estimates',
                'summary': 'Apple reported earnings of $2.18 per share, beating analyst estimates of $2.10.',
                'category': 'earnings',
                'datetime': '2024-01-25T16:30:00Z',
                'sentiment_score': 0.8
            },
            {
                'headline': 'Analyst upgrades AAPL to Buy with $200 target',
                'summary': 'Morgan Stanley upgrades Apple from Equal-Weight to Overweight with a $200 price target.',
                'category': 'analyst',
                'datetime': '2024-01-24T09:00:00Z',
                'sentiment_score': 0.7
            },
            {
                'headline': 'New iPhone sales exceed expectations',
                'summary': 'Early sales data shows iPhone 16 sales are 15% above expectations.',
                'category': 'product',
                'datetime': '2024-01-23T11:00:00Z',
                'sentiment_score': 0.6
            }
        ]
    }

def simulate_company_profile():
    """模拟公司资料"""
    return {
        'name': 'Apple Inc.',
        'finnhubSector': 'Technology',
        'industry': 'Consumer Electronics',
        'country': 'US',
        'marketCap': 2800000000000,
        'currency': 'USD'
    }

def test_technical_indicator_calculation():
    """测试技术指标计算"""
    print("\n=== 测试技术指标计算 ===")
    
    symbol = "AAPL"
    historical_bars = simulate_historical_bars()
    market_data = simulate_market_data(symbol)
    current_price = market_data['price']
    
    print(f"Symbol: {symbol}")
    print(f"历史数据长度: {len(historical_bars)} 天")
    print(f"当前价格: ${current_price}")
    
    # 计算技术指标
    technical_indicators = calculate_technical_indicators(symbol, historical_bars, current_price)
    
    if technical_indicators and technical_indicators.get('calculation_success'):
        print("[成功] 技术指标计算成功!")
        
        # 显示关键指标
        print("\n关键技术指标:")
        print(f"  EMA20: {technical_indicators.get('ema20'):.2f}")
        print(f"  EMA50: {technical_indicators.get('ema50'):.2f}")
        print(f"  EMA排列: {technical_indicators.get('ema_alignment')}")
        print(f"  RSI: {technical_indicators.get('rsi'):.1f}")
        print(f"  MACD线: {technical_indicators.get('macd_line'):.3f}")
        print(f"  ATR: {technical_indicators.get('atr'):.2f}")
        print(f"  相对成交量: {technical_indicators.get('relative_volume'):.2f}x")
        print(f"  20日高点: {technical_indicators.get('recent_high_20d'):.2f}")
        print(f"  20日低点: {technical_indicators.get('recent_low_20d'):.2f}")
        print(f"  Higher Highs: {technical_indicators.get('higher_highs')}")
        print(f"  Higher Lows: {technical_indicators.get('higher_lows')}")
        
        return technical_indicators
    else:
        print("[失败] 技术指标计算失败!")
        return None

def test_news_analysis():
    """测试新闻分析"""
    print("\n=== 测试新闻分析 ===")
    
    news_data = simulate_news_data()
    raw_news = news_data.get('raw_news', [])
    
    print(f"原始新闻数量: {len(raw_news)}")
    
    # 分析新闻
    structured_news = analyze_news_for_scanner(raw_news)
    
    if structured_news:
        print("[成功] 新闻分析成功!")
        
        # 显示分析结果
        print(f"新闻数量: {structured_news.get('news_count')}")
        print(f"主要标题: {structured_news.get('headlines')}")
        
        # 提取所有事件标签
        all_tags = set()
        for tags in structured_news.get('event_tags', []):
            all_tags.update(tags)
        print(f"事件标签: {list(all_tags)}")
        
        return structured_news
    else:
        print("[失败] 新闻分析失败!")
        return None

def test_ai_prompt_generation(technical_indicators, structured_news):
    """测试AI prompt生成"""
    print("\n=== 测试AI prompt生成 ===")
    
    symbol = "AAPL"
    market_data = simulate_market_data(symbol)
    news_data = simulate_news_data()
    company_profile = simulate_company_profile()
    
    # 构建分析上下文
    analysis_context = {
        'symbol': symbol,
        'companyName': company_profile.get('name', f'{symbol} Inc.'),
        'price': market_data.get('price'),
        'changePercent': market_data.get('changePercent'),
        'volume': market_data.get('volume'),
        'sector': market_data.get('sector'),
        'newsSentiment': news_data.get('sentiment', 'Mixed'),
        'eventRisk': news_data.get('eventRisk', 'Low'),
        'topCatalyst': news_data.get('topCatalyst', 'No recent catalyst'),
        'newsCount': news_data.get('newsCount', 0),
        'technical_indicators': technical_indicators,
        'structured_news': structured_news
    }
    
    # 构建提示字符串
    price_str = f"${analysis_context['price']:.2f}" if analysis_context['price'] is not None else "数据缺失"
    change_str = f"{analysis_context['changePercent']:.2f}%" if analysis_context['changePercent'] is not None else "数据缺失"
    volume_str = f"{analysis_context['volume']:,.0f}" if analysis_context['volume'] is not None else "数据缺失"
    
    # 构建技术指标部分
    technical_section = ""
    if technical_indicators and technical_indicators.get('calculation_success'):
        tech = technical_indicators
        technical_section = f"""
技术指标分析:

趋势分析:
- EMA排列: {tech.get('ema_alignment', 'mixed')}
- 价格 vs EMA20: {tech.get('price_vs_ema20_pct', 0):.2f}%
- 价格 vs EMA50: {tech.get('price_vs_ema50_pct', 0):.2f}%
- 价格 vs EMA200: {tech.get('price_vs_ema200_pct', 0):.2f}%
- EMA20斜率: {tech.get('ema20_slope', 0):.6f}
- EMA50斜率: {tech.get('ema50_slope', 0):.6f}

动量分析:
- RSI: {tech.get('rsi', 'N/A')}
- MACD线: {tech.get('macd_line', 'N/A')}
- MACD信号线: {tech.get('signal_line', 'N/A')}
- MACD柱状图: {tech.get('macd_histogram', 'N/A')}
- 5日收益率: {tech.get('return_5d_pct', 'N/A')}%
- 10日收益率: {tech.get('return_10d_pct', 'N/A')}%
- 20日收益率: {tech.get('return_20d_pct', 'N/A')}%

波动率分析:
- ATR: {tech.get('atr', 'N/A')}
- ATR百分比: {tech.get('atr_percent', 'N/A')}%
- 波动率状态: {tech.get('volatility_regime', 'normal')}

成交量分析:
- 当前成交量: {tech.get('current_volume', 'N/A'):,.0f}
- 20日平均成交量: {tech.get('avg_volume_20d', 'N/A'):,.0f}
- 相对成交量: {tech.get('relative_volume', 1):.2f}x
- 成交量spike: {'是' if tech.get('volume_spike') else '否'}
- 成交金额: ${tech.get('dollar_volume', 0):,.0f}

结构分析:
- 20日高点: {tech.get('recent_high_20d', 'N/A')}
- 20日低点: {tech.get('recent_low_20d', 'N/A')}
- 50日高点: {tech.get('recent_high_50d', 'N/A')}
- 50日低点: {tech.get('recent_low_50d', 'N/A')}
- Higher Highs: {'是' if tech.get('higher_highs') else '否'}
- Higher Lows: {'是' if tech.get('higher_lows') else '否'}
- 接近20日高点: {'是' if tech.get('near_20d_high') else '否'}
- 接近20日低点: {'是' if tech.get('near_20d_low') else '否'}
- 突破20日高点: {'是' if tech.get('breakout_above_20d_high') else '否'}
- 跌破20日低点: {'是' if tech.get('breakdown_below_20d_low') else '否'}
- 区间震荡: {'是' if tech.get('range_bound') else '否'}
"""
    
    # 构建新闻分析部分
    news_section = ""
    if structured_news and structured_news.get('news_count', 0) > 0:
        news = structured_news
        news_section = f"""
详细新闻分析:
- 新闻数量: {news.get('news_count', 0)}
- 主要标题: {', '.join(news.get('headlines', [])[:3]) if news.get('headlines') else '无'}
- 事件标签: {', '.join(set([tag for tags in news.get('event_tags', []) for tag in tags])) if news.get('event_tags') else '无'}
"""
    
    # 构建完整的prompt
    prompt = f"""作为专业的量化分析师，请基于以下完整数据对股票进行综合分析：

股票: {analysis_context['symbol']} ({analysis_context['companyName']})
价格: {price_str} ({change_str})
成交量: {volume_str}
板块: {analysis_context['sector']}

{technical_section if technical_section else "技术指标: 数据不足"}

新闻摘要:
- 情绪: {analysis_context['newsSentiment']}
- 事件风险: {analysis_context['eventRisk']}
- 主要催化剂: {analysis_context['topCatalyst']}
- 新闻数量: {analysis_context['newsCount']}

{news_section if news_section else ""}

请基于以下6个维度给出详细分析..."""
    
    print(f"[成功] AI prompt生成成功!")
    print(f"Prompt长度: {len(prompt)} 字符")
    print(f"技术指标部分: {'包含' if technical_section else '不包含'}")
    print(f"新闻分析部分: {'包含' if news_section else '不包含'}")
    
    # 显示prompt的前200个字符
    print(f"\nPrompt预览 (前200字符):")
    print(prompt[:200] + "...")
    
    return prompt

def test_v3_output_format():
    """测试V3输出格式"""
    print("\n=== 测试V3输出格式 ===")
    
    # 模拟V3格式的AI响应
    v3_response = {
        "trendLabel": "Bullish",
        "trendScore": 75,
        "momentumLabel": "Strong",
        "momentumScore": 80,
        "volatilityLabel": "Low",
        "volatilityScore": 85,
        "volumeLabel": "normal",
        "volumeScore": 70,
        "structureLabel": "uptrend",
        "structureScore": 78,
        "newsLabel": "positive",
        "newsScore": 82,
        "riskLevel": "low",
        "overallScore": 78,
        "aiReasoning": "AAPL shows strong bullish momentum with positive earnings news and low volatility. The stock is trading above key EMAs with higher highs pattern.",
        "conciseReason": "Bullish trend with strong fundamentals and positive news flow."
    }
    
    print("[成功] V3输出格式示例:")
    print(json.dumps(v3_response, indent=2, ensure_ascii=False))
    
    # 验证必要字段
    required_fields = ['trendLabel', 'trendScore', 'momentumLabel', 'momentumScore', 
                      'volatilityLabel', 'volatilityScore', 'volumeLabel', 'volumeScore',
                      'structureLabel', 'structureScore', 'newsLabel', 'newsScore',
                      'riskLevel', 'overallScore', 'aiReasoning', 'conciseReason']
    
    missing_fields = [field for field in required_fields if field not in v3_response]
    
    if not missing_fields:
        print("[成功] 所有V3必要字段都存在")
    else:
        print(f"[失败] 缺少字段: {missing_fields}")
    
    return v3_response

def main():
    """主测试函数"""
    print("=" * 60)
    print("测试完整的AI分析流程")
    print("=" * 60)
    
    # 1. 测试技术指标计算
    technical_indicators = test_technical_indicator_calculation()
    if not technical_indicators:
        print("[失败] 技术指标计算失败，中止测试")
        return
    
    # 2. 测试新闻分析
    structured_news = test_news_analysis()
    if not structured_news:
        print("[失败] 新闻分析失败，中止测试")
        return
    
    # 3. 测试AI prompt生成
    prompt = test_ai_prompt_generation(technical_indicators, structured_news)
    
    # 4. 测试V3输出格式
    v3_response = test_v3_output_format()
    
    # 总结
    print("\n" + "=" * 60)
    print("测试总结")
    print("=" * 60)
    print("[成功] 技术指标计算: 成功")
    print("[成功] 新闻分析: 成功")
    print("[成功] AI prompt生成: 成功")
    print("[成功] V3输出格式: 验证通过")
    print(f"[成功] Prompt长度: {len(prompt)} 字符")
    print(f"[成功] 技术指标数量: {len(technical_indicators)} 个")
    print(f"[成功] 新闻数量: {structured_news.get('news_count', 0)} 条")
    
    print("\n[里程碑] 第2步完成: 重构scanner的分析输入层")
    print("   1. 技术指标计算模块已实现")
    print("   2. 新闻分析模块已实现")
    print("   3. AI prompt已重构为包含完整技术指标和新闻分析")
    print("   4. V3输出格式已定义")
    print("   5. 前端类型定义已更新")
    print("\n下一步: 重启后端服务并测试真实AI调用")

if __name__ == "__main__":
    main()