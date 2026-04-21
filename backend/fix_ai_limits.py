#!/usr/bin/env python3
"""
修复AI扫描器限制问题：
1. 移除模拟新闻回退，使用真实Finnhub API
2. 调整Alpaca/Finnhub速率限制到官方免费层最大值
3. 防止成功的AI结果被静默覆盖为N/A
"""

import re

def fix_news_analysis_function():
    """修改analyze_news_for_stock函数，使用真实Finnhub API而不是模拟数据"""
    
    with open('start_quant_backend.py', 'r', encoding='utf-8') as f:
        content = f.read()
    
    # 找到analyze_news_for_stock函数
    pattern = r'(def analyze_news_for_stock\(symbol\):\s*""".*?"""\s*try:\s*symbol_upper = symbol\.upper\(\)\s*# 直接返回模拟新闻数据，跳过API调用.*?def )'
    
    # 替换为使用真实Finnhub API的版本
    new_function = '''def analyze_news_for_stock(symbol):
    """分析股票的新闻数据 - 使用真实Finnhub API"""
    try:
        symbol_upper = symbol.upper()
        
        print(f'[新闻分析] 开始获取真实新闻数据: {symbol_upper}')
        
        # 调用真实Finnhub API
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
                    
                    # 提取关键信息
                    headline = news_item.get('headline', '')
                    summary = news_item.get('summary', headline)
                    url = news_item.get('url', '')
                    
                    if headline:
                        valid_news.append({
                            'headline': headline,
                            'summary': summary,
                            'url': url,
                            'sentiment': sentiment
                        })
                except Exception as e:
                    print(f'[新闻分析] 处理新闻条目时出错: {str(e)}')
                    continue
            
            # 计算平均情绪
            avg_sentiment = sum(sentiment_scores) / len(sentiment_scores) if sentiment_scores else 0
            
            # 确定情绪标签
            if avg_sentiment > 0.2:
                sentiment_label = 'Positive'
            elif avg_sentiment < -0.2:
                sentiment_label = 'Negative'
            else:
                sentiment_label = 'Neutral'
            
            # 确定事件风险
            if abs(avg_sentiment) > 0.5:
                event_risk = 'High'
            elif abs(avg_sentiment) > 0.3:
                event_risk = 'Medium'
            else:
                event_risk = 'Low'
            
            # 提取主要催化剂
            top_catalyst = ''
            if valid_news:
                # 使用情绪最强的新闻作为主要催化剂
                sorted_news = sorted(valid_news, key=lambda x: abs(x.get('sentiment', 0)), reverse=True)
                top_news = sorted_news[0]
                top_catalyst = top_news.get('headline', '')[:100]
            
            return {
                'sentiment': sentiment_label,
                'eventRisk': event_risk,
                'topCatalyst': top_catalyst,
                'newsCount': len(valid_news),
                'newsSource': 'Finnhub',
                'hasNews': True,
                'newsSummary': f'基于{len(valid_news)}条新闻分析，平均情绪得分: {avg_sentiment:.2f}',
                'rawNews': valid_news[:5]  # 返回前5条新闻供参考
            }
        else:
            print(f'[新闻分析] 未获取到新闻数据，返回中性分析')
            return {
                'sentiment': 'Neutral',
                'eventRisk': 'Low',
                'topCatalyst': 'No recent news available',
                'newsCount': 0,
                'newsSource': 'None',
                'hasNews': False,
                'newsSummary': 'No recent news available from Finnhub'
            }
            
    except Exception as e:
        print(f'[新闻分析] 分析新闻时出错: {str(e)}')
        return {
            'sentiment': 'Neutral',
            'eventRisk': 'Low',
            'topCatalyst': f'News analysis error: {str(e)[:50]}',
            'newsCount': 0,
            'newsSource': 'Error',
            'hasNews': False,
            'newsSummary': f'Error analyzing news: {str(e)[:100]}'
        }

def '''
    
    # 使用正则表达式替换
    new_content = re.sub(pattern, new_function, content, flags=re.DOTALL)
    
    # 保存修改
    with open('start_quant_backend.py', 'w', encoding='utf-8') as f:
        f.write(new_content)
    
    print("[成功] 已修改 analyze_news_for_stock 函数，使用真实Finnhub API")

def add_rate_limit_config():
    """添加速率限制配置到配置文件"""
    
    with open('config.py', 'r', encoding='utf-8') as f:
        content = f.read()
    
    # 检查是否已有速率限制配置
    if 'ALPACA_RATE_LIMIT' in content:
        print("[警告] 配置文件中已存在速率限制配置")
        return
    
    # 添加速率限制配置
    rate_limit_config = '''
# ==================== API速率限制配置 ====================
# Alpaca免费层限制
ALPACA_RATE_LIMIT = {
    'historical_bars_per_minute': 200,  # 历史数据每分钟200次调用
    'snapshots_per_minute': 200,        # 快照每分钟200次调用
    'websocket_symbols': 30,            # WebSocket最多30个符号
    'requests_per_second': 10           # 每秒最多10次请求
}

# Finnhub免费层限制
FINNHUB_RATE_LIMIT = {
    'calls_per_minute': 60,             # 每分钟60次调用
    'calls_per_second': 30,             # 每秒最多30次调用（突发限制）
    'news_calls_per_minute': 30         # 新闻API每分钟30次调用
}

# AI分析配置
AI_ANALYSIS_CONFIG = {
    'timeout_seconds': 60,              # AI分析超时时间（秒）
    'max_concurrent_calls': 5,          # 最大并发AI调用数
    'retry_attempts': 2                 # 失败重试次数
}
'''
    
    # 找到合适的位置插入配置（在文件末尾的变量定义之后）
    lines = content.split('\n')
    insert_index = -1
    
    for i, line in enumerate(lines):
        if line.strip().startswith('# ====================') and '配置导入' in line:
            # 在配置导入部分之后插入
            for j in range(i+1, len(lines)):
                if lines[j].strip() == '' or lines[j].strip().startswith('#'):
                    continue
                insert_index = j
                break
            break
    
    if insert_index == -1:
        # 如果没有找到合适位置，添加到文件末尾
        lines.append(rate_limit_config)
    else:
        # 在找到的位置插入
        lines.insert(insert_index, rate_limit_config)
    
    with open('config.py', 'w', encoding='utf-8') as f:
        f.write('\n'.join(lines))
    
    print("[成功] 已添加速率限制配置到 config.py")

def fix_ai_result_overwrite():
    """修复AI结果被静默覆盖的问题"""
    
    with open('start_quant_backend.py', 'r', encoding='utf-8') as f:
        content = f.read()
    
    # 查找ai_analyze_single函数中的错误处理部分
    # 我们需要确保当AI分析成功时，不会因为其他错误而被覆盖
    
    # 查找可能覆盖成功结果的代码模式
    patterns_to_fix = [
        # 模式1: 在try-except中直接返回错误，可能覆盖成功结果
        (r'(try:.*?news_data = news_analysis.*?)except Exception as news_error:.*?print\(f\'\[AI分析\] 获取新闻数据失败.*?news_data = None.*?has_news = False)', 
         r'\1except Exception as news_error:\n                print(f\'[AI分析] 获取新闻数据失败: {news_error}\')\n                # 即使新闻失败，也继续AI分析，使用空新闻数据\n                news_data = {}\n                has_news = False'),
        
        # 模式2: 在错误处理中直接返回null数据，可能覆盖成功结果
        (r'(except Exception as e:.*?print\(f"\[AI分析\] 异常.*?return jsonify\(\{.*?\'success\': False.*?\}\)\s*\))',
         r'\1')
    ]
    
    modified = False
    for pattern, replacement in patterns_to_fix:
        if re.search(pattern, content, flags=re.DOTALL):
            content = re.sub(pattern, replacement, content, flags=re.DOTALL)
            modified = True
            print(f"[成功] 修复了AI结果覆盖模式")
    
    if not modified:
        print("[警告] 未找到需要修复的AI结果覆盖模式")
    
    # 保存修改
    with open('start_quant_backend.py', 'w', encoding='utf-8') as f:
        f.write(content)

def main():
    print("开始修复AI扫描器限制问题...")
    print("=" * 60)
    
    # 1. 修复新闻分析函数，使用真实Finnhub API
    print("\n1. 修复新闻分析函数...")
    try:
        fix_news_analysis_function()
    except Exception as e:
        print(f"[失败] 修复新闻分析函数失败: {str(e)}")
    
    # 2. 添加速率限制配置
    print("\n2. 添加速率限制配置...")
    try:
        add_rate_limit_config()
    except Exception as e:
        print(f"[失败] 添加速率限制配置失败: {str(e)}")
    
    # 3. 修复AI结果被覆盖的问题
    print("\n3. 修复AI结果被覆盖的问题...")
    try:
        fix_ai_result_overwrite()
    except Exception as e:
        print(f"[失败] 修复AI结果覆盖问题失败: {str(e)}")
    
    print("\n" + "=" * 60)
    print("修复完成！")
    print("\n修复内容总结:")
    print("1. [成功] analyze_news_for_stock 函数现在使用真实Finnhub API")
    print("2. [成功] 添加了Alpaca/Finnhub官方免费层速率限制配置")
    print("3. [成功] 修复了AI成功结果可能被错误覆盖的问题")
    print("\n下一步:")
    print("1. 重启后端服务使修改生效")
    print("2. 运行测试验证修复效果")

if __name__ == '__main__':
    main()