#!/usr/bin/env python3
"""
修复DeepSeek API密钥和新闻数据问题
"""

import json
import os

def load_ai_config():
    """加载AI配置文件"""
    config_file = 'ai_provider_config.json'
    if os.path.exists(config_file):
        with open(config_file, 'r', encoding='utf-8') as f:
            return json.load(f)
    return None

def fix_deepseek_config():
    """修复DeepSeek配置"""
    print("修复DeepSeek API配置...")
    
    # 1. 加载配置文件
    config = load_ai_config()
    if not config:
        print("[FAIL] 无法加载AI配置文件")
        return False
    
    # 2. 读取原始后端文件
    input_file = 'start_quant_backend_fixed.py'
    output_file = 'start_quant_backend_fixed_deepseek.py'
    
    with open(input_file, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # 3. 替换硬编码的API密钥为从配置文件读取
    # 找到ai_provider_config_state定义
    old_config = """ai_provider_config_state = {

    'provider': 'DeepSeek',

    'apiKey': 'sk-83365246617844178bf8d1e121b7279f',  # 硬编码API密钥用于测试

    'baseURL': 'https://api.deepseek.com',

    'model': 'deepseek-chat'

}"""
    
    new_config = f"""# AI Provider 配置状态 - 从配置文件读取
ai_provider_config_state = {{
    'provider': '{config.get('provider', 'DeepSeek')}',
    'apiKey': '{config.get('apiKey', '')}',  # 从配置文件读取
    'baseURL': '{config.get('baseURL', 'https://api.deepseek.com')}',
    'model': '{config.get('model', 'deepseek-chat')}'
}}"""
    
    if old_config in content:
        content = content.replace(old_config, new_config)
        print("[OK] 已替换硬编码API密钥为配置文件密钥")
    else:
        print("[WARN] 未找到硬编码配置，可能已修复")
    
    # 4. 保存修复后的文件
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write(content)
    
    print(f"[OK] 修复后的文件已保存: {output_file}")
    return True

def fix_news_function():
    """修复新闻分析函数"""
    print("\n修复新闻分析函数...")
    
    # 读取原始文件
    input_file = 'start_quant_backend_fixed.py'
    output_file = 'start_quant_backend_fixed_news.py'
    
    with open(input_file, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # 找到analyze_news_for_stock函数
    old_function_start = "def analyze_news_for_stock(symbol):\n\n    \"\"\"分析股票的新闻数据 - 返回模拟数据用于测试\"\"\""
    
    if old_function_start in content:
        # 创建新的函数
        new_function = '''def analyze_news_for_stock(symbol):
    """分析股票的新闻数据 - 使用真实Finnhub API"""
    try:
        symbol_upper = symbol.upper()
        
        print(f'[新闻分析] 开始获取真实新闻数据: {symbol_upper}')
        
        # 调用真实Finnhub API
        from . import fetch_finnhub_news
        
        finnhub_news = fetch_finnhub_news(symbol_upper)
        
        if finnhub_news and isinstance(finnhub_news, list) and len(finnhub_news) > 0:
            print(f'[新闻分析] 获取到 {len(finnhub_news)} 条真实新闻')
            
            # 分析新闻情绪
            sentiment_scores = []
            valid_news = []
            
            for news_item in finnhub_news[:10]:  # 最多分析10条新闻
                try:
                    sentiment = news_item.get('sentiment', 0)
                    if isinstance(sentiment, (int, float)):
                        sentiment_scores.append(sentiment)
                        valid_news.append(news_item)
                except:
                    continue
            
            if sentiment_scores:
                avg_sentiment = sum(sentiment_scores) / len(sentiment_scores)
                if avg_sentiment > 0.1:
                    sentiment_label = 'Positive'
                elif avg_sentiment < -0.1:
                    sentiment_label = 'Negative'
                else:
                    sentiment_label = 'Neutral'
                
                # 获取最重要的新闻
                top_news = None
                if valid_news:
                    # 按相关性排序
                    sorted_news = sorted(valid_news, key=lambda x: abs(x.get('sentiment', 0)), reverse=True)
                    top_news = sorted_news[0].get('headline', 'No headline') if sorted_news else 'No news'
                
                return {
                    'sentiment': sentiment_label,
                    'eventRisk': 'Low' if abs(avg_sentiment) < 0.3 else 'Medium',
                    'topCatalyst': top_news or 'No significant news',
                    'newsCount': len(valid_news),
                    'newsSource': 'Finnhub',
                    'hasNews': True,
                    'newsSummary': f'Found {len(valid_news)} news items with average sentiment {avg_sentiment:.2f}'
                }
        
        # 如果没有新闻或分析失败
        print(f'[新闻分析] 无真实新闻数据: {symbol_upper}')
        return {
            'sentiment': 'Neutral',
            'eventRisk': 'Low',
            'topCatalyst': 'No recent news available',
            'newsCount': 0,
            'newsSource': 'None',
            'hasNews': False,
            'newsSummary': 'No recent news data available from Finnhub'
        }
        
    except Exception as e:
        print(f'[新闻分析] 新闻分析异常: {str(e)}')
        return {
            'sentiment': 'Neutral',
            'eventRisk': 'Low',
            'topCatalyst': f'News analysis error: {str(e)[:50]}',
            'newsCount': 0,
            'newsSource': 'Error',
            'hasNews': False,
            'newsSummary': f'Error analyzing news: {str(e)[:100]}'
        }'''
        
        # 替换函数
        # 需要找到函数的完整范围，这里简化处理
        print("[OK] 已创建新的新闻分析函数（需要手动替换）")
        print("新函数使用真实Finnhub API，不再返回模拟数据")
        
        # 保存新函数到单独文件供参考
        with open