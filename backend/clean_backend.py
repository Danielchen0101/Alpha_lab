#!/usr/bin/env python3
"""
干净的AI分析后端 - 只包含必要的功能
"""

from flask import Flask, request, jsonify
import json
import os
import time
import requests
from datetime import datetime, timedelta

app = Flask(__name__)

# ==================== 配置 ====================

# 从配置文件加载AI配置
def load_ai_config():
    """从配置文件加载AI配置"""
    config_file = 'ai_provider_config.json'
    if os.path.exists(config_file):
        try:
            with open(config_file, 'r', encoding='utf-8') as f:
                config = json.load(f)
            print(f"[AI配置] 从配置文件加载: {config_file}")
            return config
        except Exception as e:
            print(f"[AI配置] 加载配置文件失败: {str(e)}")
    
    # 默认配置
    return {
        'provider': 'DeepSeek',
        'apiKey': '',
        'baseURL': 'https://api.deepseek.com',
        'model': 'deepseek-chat'
    }

# 初始化AI配置
ai_config = load_ai_config()
ai_provider_config_state = {
    'provider': ai_config.get('provider', 'DeepSeek'),
    'apiKey': ai_config.get('apiKey', ''),  # 从配置文件读取
    'baseURL': ai_config.get('baseURL', 'https://api.deepseek.com'),
    'model': ai_config.get('model', 'deepseek-chat')
}

# ==================== 辅助函数 ====================

def fetch_finnhub_news(symbol):
    """从Finnhub获取股票新闻"""
    try:
        print(f'[Finnhub新闻] 获取 {symbol} 新闻')
        
        # 从config.py导入配置
        try:
            from config import FINNHUB_API_KEY, FINNHUB_BASE_URL
        except ImportError:
            print('[Finnhub新闻] 无法导入config.py，使用默认值')
            FINNHUB_API_KEY = "d7apg21r01qtpbh9ck9gd7apg21r01qtpbh9cka0"
            FINNHUB_BASE_URL = "https://finnhub.io/api/v1"
        
        if not FINNHUB_API_KEY:
            print(f'[Finnhub新闻] Finnhub API密钥未配置')
            return None
        
        # 设置日期范围（最近7天）
        to_date = datetime.now()
        from_date = to_date - timedelta(days=7)
        from_str = from_date.strftime('%Y-%m-%d')
        to_str = to_date.strftime('%Y-%m-%d')
        
        # 调用API
        url = f'{FINNHUB_BASE_URL}/company-news'
        params = {
            'symbol': symbol,
            'from': from_str,
            'to': to_str,
            'token': FINNHUB_API_KEY
        }
        
        response = requests.get(url, params=params, timeout=10)
        
        if response.status_code == 200:
            news_data = response.json()
            print(f'[Finnhub新闻] 获取到 {len(news_data)} 条新闻')
            return news_data
        else:
            print(f'[Finnhub新闻] API调用失败: {response.status_code}')
            return None
            
    except Exception as e:
        print(f'[Finnhub新闻] 异常: {str(e)}')
        return None

def analyze_news_for_stock(symbol):
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
        }

def analyze_trend_with_deepseek(symbol, market_data, news_data, company_info):
    """使用DeepSeek分析趋势"""
    try:
        symbol_upper = symbol.upper()
        print(f'[DeepSeek分析] 开始分析 {symbol_upper}')
        
        # 检查是否有有效的API密钥
        api_key = ai_provider_config_state.get('apiKey', '')
        if not api_key:
            print(f'[DeepSeek分析] API密钥为空')
            return None
        
        print(f'[DeepSeek分析] API密钥: "{api_key[:10]}..." (长度: {len(api_key)})')
        
        # 构建分析提示
        price = market_data.get('price', 0) if market_data else 0
        change_percent = market_data.get('changePercent', 0) if market_data else 0
        volume = market_data.get('volume', 0) if market_data else 0
        
        prompt = f"""分析股票 {symbol_upper} 的投资趋势。

当前数据:
- 价格: ${price:.2f}
- 涨跌幅: {change_percent:.2f}%
- 成交量: {volume:,}

新闻情绪: {news_data.get('sentiment', 'Neutral') if news_data else 'No news'}
新闻摘要: {news_data.get('newsSummary', 'No news available') if news_data else 'No news'}

请分析以下6个维度:
1. 趋势 (Trend): 上涨/下跌/盘整
2. 动量 (Momentum): 强/中/弱
3. 波动性 (Volatility): 高/中/低
4. 成交量/流动性 (Volume/Liquidity): 高/正常/低
5. 结构 (Structure): 健康/警告/危险
6. 新闻/事件 (News/Event): 正面/中性/负面

请以JSON格式返回分析结果，包含以下字段:
- trendLabel: 趋势标签
- trendScore: 趋势分数 (0-100)
- momentumLabel: 动量标签
- momentumScore: 动量分数 (0-100)
- volatilityLabel: 波动性标签
- volatilityScore: 波动性分数 (0-100)
- volumeLabel: 成交量标签
- volumeScore: 成交量分数 (0-100)
- structureLabel: 结构标签
- structureScore: 结构分数 (0-100)
- newsLabel: 新闻标签
- newsScore: 新闻分数 (0-100)
- riskLevel: 风险等级 (Low/Medium/High)
- overallScore: 总体分数 (0-100)
- aiReasoning: AI推理过程
- conciseReason: 简洁原因"""
        
        # 调用DeepSeek API
        headers = {
            'Authorization': f'Bearer {api_key}',
            'Content-Type': 'application/json'
        }
        
        payload = {
            'model': ai_provider_config_state.get('model', 'deepseek-chat'),
            'messages': [{'role': 'user', 'content': prompt}],
            'max_tokens': 1000,
            'temperature': 0.3
        }
        
        base_url = ai_provider_config_state.get('baseURL', 'https://api.deepseek.com')
        response = requests.post(
            f'{base_url}/chat/completions',
            headers=headers,
            json=payload
        )
        
        print(f'[DeepSeek分析] API响应状态码: {response.status_code}')
        
        if response.status_code == 200:
            result = response.json()
            content = result.get('choices', [{}])[0].get('message', {}).get('content', '')
            
            # 尝试解析JSON
            try:
                import re
                # 查找JSON部分
                json_match = re.search(r'\{.*\}', content, re.DOTALL)
                if json_match:
                    ai_result = json.loads(json_match.group())
                    print(f'[DeepSeek分析] 成功解析AI响应')
                    return ai_result
                else:
                    print(f'[DeepSeek分析] 未找到JSON响应，使用默认值')
            except Exception as e:
                print(f'[DeepSeek分析] 解析JSON失败: {str(e)}')
            
            # 返回默认分析
            return {
                'trendLabel': 'Neutral',
                'trendScore': 50,
                'momentumLabel': 'Medium',
                'momentumScore': 50,
                'volatilityLabel': 'Medium',
                'volatilityScore': 50,
                'volumeLabel': 'Normal',
                'volumeScore': 50,
                'structureLabel': 'Healthy',
                'structureScore': 60,
                'newsLabel': 'Neutral',
                'newsScore': 50,
                'riskLevel': 'Low',
                'overallScore': 52,
                'aiReasoning': content[:200] if content else 'AI analysis completed',
                'conciseReason': 'AI analysis based on available data'
            }
        else:
            print(f'[DeepSeek分析] API调用失败: {response.status_code}')
            print(f'[DeepSeek分析] 响应: {response.text[:200]}')
            return None
            
    except Exception as e:
        print(f'[DeepSeek分析] 异常: {str(e)}')
        return None

def analyze_trend_locally(symbol, market_data, news_data, company_info):
    """本地规则分析（降级方案）"""
    print(f'[本地规则分析] 开始分析 {symbol}')
    
    # 简单的规则分析
    price = market_data.get('price', 0) if market_data else 0
    change_percent = market_data.get('changePercent', 0) if market_data else 0
    
    # 基于价格变化判断趋势
    if change_percent > 2:
        trend = 'Bullish'
        trend_score = 70
    elif change_percent < -2:
        trend = 'Bearish'
        trend_score = 30
    else:
        trend = 'Neutral'
        trend_score = 50
    
    # 基于新闻情绪
    news_sentiment = news_data.get('sentiment', 'Neutral') if news_data else 'Neutral'
    if news_sentiment == 'Positive':
        news_score = 70
    elif news_sentiment == 'Negative':
        news_score = 30
    else:
        news_score = 50
    
    # 计算总体分数
    overall_score = (trend_score + news_score) // 2
    
    return {
        'trend': trend,
        'overallScore': overall_score,
        'confidence': 0.6,
        'trendScore': trend_score,
        'momentumScore': 50,
        'volumeScore': 50,
        'volatilityScore': 50,
        'structureScore': 50,
        'newsScore': news_score,
        'scannerReason': 'Local rules analysis (fallback)',
        'aiReasoning': f'Local analysis based on price change ({change_percent:.2f}%) and news sentiment ({news_sentiment})'
    }

# ==================== API 端点 ====================

@app.route('/health', methods=['GET'])
def health():
    """健康检查"""
    return jsonify({
        'status': 'healthy',
        'timestamp': int(time.time()),
        'service': 'AI Analysis Backend'
    })

@app.route('/system/status', methods=['GET'])
def system_status():
    """系统状态"""
    return jsonify({
        'success': True,
        'status': 'running',
        'timestamp': int(time.time()),
        'backend': 'clean_ai_backend',
        'port': 8889
    })

@app.route('/ai/analyze/single', methods=['POST'])
def ai_analyze_single():
    """单只股票AI分析接口"""
    start_time = time.time()
    
    try:
        # 解析请求数据
        data = request.get_json()
        if not data:
            return jsonify({
                'success': False,
                'error': 'No JSON data provided',
                'timestamp': int(time.time())
            }), 400
        
        symbol = data.get('symbol')
        if not symbol:
            return jsonify({
                'success': False,
                'error': 'Symbol is required',
                'timestamp': int(time.time())
            }), 400
        
        symbol_upper = symbol.upper()
        print(f'\n=== 单只股票AI分析开始: {symbol_upper} ===')
        
        # 1. 获取新闻数据（使用真实Finnhub API）
        print(f'[AI分析接口] 获取新闻数据')
        news_data = analyze_news_for_stock(symbol_upper)
        print(f'[AI分析接口] 新闻数据: {news_data.get("newsSource")}, 情绪: {news_data.get("sentiment")}')
        
        # 2. 模拟市场数据（简化版）
        market_data = {
            'price': 150.25,  # 模拟数据
            'changePercent': 1.5,
            'volume': 5000000,
            'dataSource': 'simulated'
        }
        
        # 3. 模拟公司信息
        company_info = {
            'name': f'{symbol_upper} Inc.',
            'finnhubIndustry': 'Technology'
        }
        
        # 4. 尝试AI分析
        print(f'[AI分析接口] 尝试DeepSeek AI分析')
        ai_analysis = analyze_trend_with_deepseek(symbol_upper, market_data, news_data, company_info)
        
        if ai_analysis:
            print(f'[AI分析接口] DeepSeek AI分析成功')
            
            response_data = {
                'success': True,
                'symbol': symbol_upper,
                'trend': ai_analysis.get('trendLabel', 'Neutral'),
                'overallScore': ai_analysis.get('overallScore', 50),
                'confidence': 0.8,
                'trendScore': ai_analysis.get('trendScore', 50),
                'momentumScore': ai_analysis.get('momentumScore', 50),
                'volumeScore': ai_analysis.get('volumeScore', 50),
                'volatilityScore': ai_analysis.get('volatilityScore', 50),
                'structureScore': ai_analysis.get('structureScore', 50),
                'newsScore': ai_analysis.get('newsScore', 50),
                'scannerReason': ai_analysis.get('conciseReason', 'AI analysis completed'),
                'aiReasoning': ai_analysis.get('aiReasoning', 'AI analysis based on available data'),
                'newsSentiment': news_data.get('sentiment'),
                'eventRisk': news_data.get('eventRisk'),
                'topNews': news_data.get('topCatalyst'),
                'companyName': company_info.get('name'),
                'sector': company_info.get('finnhubIndustry'),
                'provenance': {
                    'marketData': 'simulated',
                    'companyInfo': 'simulated',
                    'news': news_data.get('newsSource', 'none'),
                    'aiAnalysis': 'deepseek'
                },
                'hasAiData': True,
                'timestamp': int(time.time()),
                'responseTime': round(time.time() - start_time, 3),
                'message': 'AI analysis successful'
            }
            
        else:
            print(f'[AI分析接口] DeepSeek AI分析失败，尝试本地规则降级')
            
            # 本地规则降级分析
            local_analysis = analyze_trend_locally(symbol_upper, market_data, news_data, company_info)
            
            response_data = {
                'success