"""
测试技术指标计算模块
"""

import sys
import os

# 添加当前目录到Python路径
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# 导入技术指标模块
from technical_indicators import calculate_technical_indicators, analyze_news_for_scanner

def test_technical_indicators():
    """测试技术指标计算"""
    print("=== 测试技术指标计算 ===")
    
    # 创建模拟历史数据
    historical_bars = []
    base_price = 100.0
    
    # 生成60天的模拟数据
    for i in range(60):
        bar = {
            't': f'2024-01-{i+1:02d}T00:00:00Z',
            'o': base_price + i * 0.5,  # 缓慢上涨
            'h': base_price + i * 0.5 + 2.0,  # 高点
            'l': base_price + i * 0.5 - 1.0,  # 低点
            'c': base_price + i * 0.5 + 0.5,  # 收盘价
            'v': 1000000 + i * 10000  # 成交量逐渐增加
        }
        historical_bars.append(bar)
    
    # 测试技术指标计算
    print(f"历史数据长度: {len(historical_bars)}")
    technical_indicators = calculate_technical_indicators("TEST", historical_bars, current_price=130.0)
    
    if technical_indicators:
        print("技术指标计算成功!")
        print(f"当前价格: {technical_indicators.get('current_price')}")
        print(f"EMA20: {technical_indicators.get('ema20')}")
        print(f"EMA50: {technical_indicators.get('ema50')}")
        print(f"EMA200: {technical_indicators.get('ema200')}")
        print(f"RSI: {technical_indicators.get('rsi')}")
        print(f"MACD线: {technical_indicators.get('macd_line')}")
        print(f"ATR: {technical_indicators.get('atr')}")
        print(f"相对成交量: {technical_indicators.get('relative_volume'):.2f}x")
        print(f"20日高点: {technical_indicators.get('recent_high_20d')}")
        print(f"20日低点: {technical_indicators.get('recent_low_20d')}")
        print(f"Higher Highs: {technical_indicators.get('higher_highs')}")
        print(f"Higher Lows: {technical_indicators.get('higher_lows')}")
        print(f"EMA排列: {technical_indicators.get('ema_alignment')}")
        print(f"波动率状态: {technical_indicators.get('volatility_regime')}")
    else:
        print("技术指标计算失败!")

def test_news_analysis():
    """测试新闻分析"""
    print("\n=== 测试新闻分析 ===")
    
    # 创建模拟新闻数据
    news_items = [
        {
            'headline': 'Company reports strong Q1 earnings, beats estimates',
            'summary': 'The company reported earnings of $1.50 per share, beating analyst estimates of $1.30.',
            'category': 'earnings',
            'datetime': '2024-01-15T10:00:00Z',
            'sentiment_score': 0.8
        },
        {
            'headline': 'Analyst upgrades stock to Buy with $150 target price',
            'summary': 'Goldman Sachs upgrades the stock from Neutral to Buy with a price target of $150.',
            'category': 'analyst',
            'datetime': '2024-01-14T09:30:00Z',
            'sentiment_score': 0.7
        },
        {
            'headline': 'New product launch expected next quarter',
            'summary': 'The company announced it will launch a new product line in Q2 2024.',
            'category': 'product',
            'datetime': '2024-01-13T14:00:00Z',
            'sentiment_score': 0.6
        }
    ]
    
    # 测试新闻分析
    structured_news = analyze_news_for_scanner(news_items)
    
    if structured_news:
        print("新闻分析成功!")
        print(f"新闻数量: {structured_news.get('news_count')}")
        print(f"标题: {structured_news.get('headlines')}")
        print(f"事件标签: {structured_news.get('event_tags')}")
    else:
        print("新闻分析失败!")

def test_ai_prompt_generation():
    """测试AI prompt生成"""
    print("\n=== 测试AI prompt生成 ===")
    
    # 模拟技术指标
    technical_indicators = {
        'current_price': 130.0,
        'price_vs_ema20_pct': 2.5,
        'price_vs_ema50_pct': 5.0,
        'price_vs_ema200_pct': 10.0,
        'ema20': 126.8,
        'ema50': 123.8,
        'ema200': 118.0,
        'ema20_slope': 0.15,
        'ema50_slope': 0.12,
        'ema_alignment': 'bullish',
        'rsi': 65.0,
        'macd_line': 1.5,
        'signal_line': 1.2,
        'macd_histogram': 0.3,
        'return_5d_pct': 3.2,
        'return_10d_pct': 5.8,
        'return_20d_pct': 8.5,
        'atr': 2.1,
        'atr_percent': 1.6,
        'volatility_regime': 'normal',
        'current_volume': 1500000,
        'avg_volume_20d': 1200000,
        'relative_volume': 1.25,
        'volume_spike': True,
        'dollar_volume': 195000000,
        'recent_high_20d': 132.0,
        'recent_low_20d': 125.0,
        'recent_high_50d': 135.0,
        'recent_low_50d': 120.0,
        'higher_highs': True,
        'higher_lows': True,
        'near_20d_high': True,
        'near_20d_low': False,
        'near_50d_high': False,
        'near_50d_low': False,
        'breakout_above_20d_high': False,
        'breakdown_below_20d_low': False,
        'range_bound': False,
        'calculation_success': True
    }
    
    # 模拟结构化新闻
    structured_news = {
        'news_count': 3,
        'headlines': ['Strong earnings', 'Analyst upgrade', 'Product launch'],
        'summaries': ['Beat estimates', 'Upgraded to Buy', 'New product Q2'],
        'categories': ['earnings', 'analyst', 'product'],
        'event_tags': [['earnings'], ['analyst_action'], ['product']]
    }
    
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

股票: TEST (Test Company Inc.)
价格: $130.00 (+2.50%)
成交量: 1,500,000
板块: Technology

{technical_section if technical_section else "技术指标: 数据不足"}

新闻摘要:
- 情绪: Positive
- 事件风险: Low
- 主要催化剂: Strong earnings
- 新闻数量: 3

{news_section if news_section else ""}

请基于以下6个维度给出详细分析..."""
    
    print("生成的prompt长度:", len(prompt))
    print("prompt前500字符:", prompt[:500])
    print("\n技术指标部分包含:", "是" if technical_section else "否")
    print("新闻分析部分包含:", "是" if news_section else "否")

if __name__ == "__main__":
    print("开始测试技术指标模块...")
    test_technical_indicators()
    test_news_analysis()
    test_ai_prompt_generation()
    print("\n测试完成!")