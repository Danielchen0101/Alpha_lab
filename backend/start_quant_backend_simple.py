"""
简化版后端 - 只包含AI分析和新闻接口
"""
from flask import Flask, request, jsonify
from flask_cors import CORS
import time
import requests
import json
import os
import sys
from datetime import datetime, timedelta

app = Flask(__name__)
CORS(app)

# ==================== 配置 ====================
try:
    sys.path.append(os.path.dirname(os.path.abspath(__file__)))
    import config as config_module
    from config import (
        FINNHUB_API_KEY,
        FINNHUB_BASE_URL,
        ALPACA_API_KEY,
        ALPACA_API_SECRET,
        DEFAULT_SYMBOLS
    )
    print(f"[配置加载] Finnhub API Key: {FINNHUB_API_KEY[:10]}...")
    print(f"[配置加载] Alpaca API Key: {ALPACA_API_KEY[:10]}...")
except ImportError as e:
    print(f"[警告] 无法导入配置: {e}")
    FINNHUB_API_KEY = "d6qsdcpr01qgdhqc82hgd6qsdcpr01qgdhqc82i0"
    FINNHUB_BASE_URL = "https://finnhub.io/api/v1"
    DEFAULT_SYMBOLS = ["AAPL", "MSFT", "TSLA", "NVDA", "JPM", "JNJ", "XOM", "WMT", "UNH", "V"]

# ==================== AI 配置 ====================
ai_provider_config_state = {
    'provider': 'DeepSeek',
    'apiKey': 'sk-83365246617844178bf8d1e121b7279f',
    'baseURL': 'https://api.deepseek.com',
    'model': 'deepseek-chat'
}

# ==================== 辅助函数 ====================
def analyze_news_sentiment(news_items):
    """分析新闻情绪"""
    if not news_items:
        return 'Neutral'
    
    positive_keywords = ['up', 'gain', 'rise', 'beat', 'positive', 'bullish', 'strong', 'raise']
    negative_keywords = ['down', 'fall', 'drop', 'miss', 'negative', 'bearish', 'weak', 'cut']
    
    positive_count = 0
    negative_count = 0
    
    for news in news_items[:5]:  # 只分析前5条新闻
        title = (news.get('headline') or news.get('title') or '').lower()
        if any(word in title for word in positive_keywords):
            positive_count += 1
        elif any(word in title for word in negative_keywords):
            negative_count += 1
    
    if positive_count > negative_count:
        return 'Positive'
    elif negative_count > positive_count:
        return 'Negative'
    else:
        return 'Neutral'

def select_top_news(news_items):
    """选择最重要的新闻作为topNews"""
    if not news_items:
        return None
    
    # 选择最新的新闻
    latest_news = news_items[0]
    
    return {
        'title': latest_news.get('headline', 'No title'),
        'summary': latest_news.get('summary', ''),
        'source': latest_news.get('source', 'Unknown'),
        'published': latest_news.get('datetime') or latest_news.get('time'),
        'url': latest_news.get('url', ''),
        'sentiment': latest_news.get('sentiment', 'Neutral')
    }

# ==================== Finnhub 新闻 ====================
def fetch_finnhub_news(symbol):
    """从Finnhub获取股票新闻"""
    try:
        print(f'[Finnhub新闻] 尝试获取 {symbol} 的新闻')
        
        if not FINNHUB_API_KEY:
            print(f'[Finnhub新闻] Finnhub API密钥未配置')
            return None
        
        # 设置时间范围（最近7天）
        to_date = datetime.utcnow()
        from_date = to_date - timedelta(days=7)
        
        # 格式化日期
        from_str = from_date.strftime('%Y-%m-%d')
        to_str = to_date.strftime('%Y-%m-%d')
        
        # Finnhub News API URL
        url = f'{FINNHUB_BASE_URL}/company-news'
        
        params = {
            'symbol': symbol,
            'from': from_str,
            'to': to_str,
            'token': FINNHUB_API_KEY
        }
        
        response = requests.get(url, params=params, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            
            if data and len(data) > 0:
                print(f'[Finnhub新闻] 成功获取 {len(data)} 条新闻')
                
                # 格式化新闻数据
                formatted_news = []
                for item in data[:10]:  # 限制最多10条
                    formatted_news.append({
                        'headline': item.get('headline', 'No title'),
                        'summary': item.get('summary', ''),
                        'source': item.get('source', 'Finnhub'),
                        'datetime': item.get('datetime', int(time.time())),
                        'url': item.get('url', ''),
                        'sentiment': 'Neutral'
                    })
                
                return formatted_news
            else:
                print(f'[Finnhub新闻] 没有找到新闻')
                return None
        else:
            print(f'[Finnhub新闻] API请求失败: {response.status_code}')
            return None
            
    except Exception as e:
        print(f'[Finnhub新闻] 获取新闻时发生错误: {str(e)}')
        return None

# ==================== Alpaca 新闻 ====================
def get_alpaca_news_data(symbol):
    """从Alpaca获取股票新闻数据"""
    try:
        print(f'[Alpaca新闻] 尝试获取 {symbol} 的新闻')
        
        # 检查Alpaca配置
        alpaca_api_key = ALPACA_API_KEY
        alpaca_secret_key = ALPACA_API_SECRET
        
        if not alpaca_api_key or not alpaca_secret_key:
            print(f'[Alpaca新闻] Alpaca API密钥未配置')
            return None
        
        # 设置时间范围（最近7天）
        end_date = datetime.utcnow()
        start_date = end_date - timedelta(days=7)
        
        # 格式化日期
        start_str = start_date.strftime('%Y-%m-%dT%H:%M:%SZ')
        end_str = end_date.strftime('%Y-%m-%dT%H:%M:%SZ')
        
        # Alpaca News API URL
        url = f'https://data.alpaca.markets/v1beta1/news'
        
        headers = {
            'APCA-API-KEY-ID': alpaca_api_key,
            'APCA-API-SECRET-KEY': alpaca_secret_key
        }
        
        params = {
            'symbols': symbol,
            'start': start_str,
            'end': end_str,
            'limit': 10,
            'sort': 'desc'
        }
        
        response = requests.get(url, headers=headers, params=params, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            news_items = data.get('news', [])
            
            if news_items:
                print(f'[Alpaca新闻] 成功获取 {len(news_items)} 条新闻')
                
                # 分析新闻情绪
                sentiment = analyze_news_sentiment(news_items)
                
                # 选择最重要的新闻作为topNews
                top_news = select_top_news(news_items)
                
                return {
                    'success': True,
                    'symbol': symbol,
                    'sentiment': sentiment,
                    'eventRisk': 'Low',
                    'topNews': top_news,
                    'news': news_items,
                    'source': 'alpaca'
                }
            else:
                print(f'[Alpaca新闻] 没有找到新闻')
                return {
                    'success': True,
                    'symbol': symbol,
                    'sentiment': 'Neutral',
                    'eventRisk': 'Low',
                    'topNews': None,
                    'news': [],
                    'source': 'alpaca'
                }
        else:
            print(f'[Alpaca新闻] API请求失败: {response.status_code}')
            return None
            
    except Exception as e:
        print(f'[Alpaca新闻] 获取新闻时发生错误: {str(e)}')
        return None

# ==================== 新闻接口 ====================
@app.route('/api/market/news/<symbol>', methods=['GET'])
@app.route('/market/news/<symbol>', methods=['GET'])
def get_stock_news(symbol):
    """获取股票新闻接口 - 先尝试Alpaca，再尝试Finnhub"""
    print(f'=== 获取股票新闻请求: {symbol} ===')
    start_time = time.time()
    
    try:
        symbol_upper = symbol.upper()
        news_items = []
        source = None
        
        # 1. 先尝试Alpaca新闻API
        try:
            print(f'[新闻接口] 尝试Alpaca新闻API: {symbol_upper}')
            alpaca_news = get_alpaca_news_data(symbol_upper)
            if alpaca_news and alpaca_news.get('success') and alpaca_news.get('news'):
                news_items = alpaca_news.get('news', [])
                source = 'alpaca'
                print(f'[新闻接口] Alpaca新闻获取成功: {len(news_items)}条新闻')
            else:
                print(f'[新闻接口] Alpaca新闻获取失败或无新闻')
        except Exception as alpaca_error:
            print(f'[新闻接口] Alpaca新闻API错误: {alpaca_error}')
        
        # 2. 如果Alpaca没有新闻，尝试Finnhub
        if not news_items:
            try:
                print(f'[新闻接口] 尝试Finnhub新闻API: {symbol_upper}')
                finnhub_news = fetch_finnhub_news(symbol_upper)
                if finnhub_news:
                    news_items = finnhub_news
                    source = 'finnhub'
                    print(f'[新闻接口] Finnhub新闻获取成功: {len(news_items)}条新闻')
                else:
                    print(f'[新闻接口] Finnhub新闻获取失败或无新闻')
            except Exception as finnhub_error:
                print(f'[新闻接口] Finnhub新闻API错误: {finnhub_error}')
        
        # 3. 如果都没有新闻，返回"No recent news available"
        if not news_items:
            print(f'[新闻接口] 没有找到新闻，返回空数据')
            return jsonify({
                'success': True,
                'symbol': symbol_upper,
                'sentiment': 'Neutral',
                'eventRisk': 'Low',
                'topNews': None,
                'news': [],
                'source': 'none',
                'hasNews': False,
                'newsCount': 0
            })
        
        # 4. 分析新闻数据
        # 选择最重要的一条新闻
        top_news = None
        if news_items and len(news_items) > 0:
            # 按时间排序，选择最新的
            sorted_news = sorted(news_items, 
                               key=lambda x: x.get('datetime') or x.get('time', 0), 
                               reverse=True)
            top_news = sorted_news[0]
            
            # 格式化top_news
            formatted_top_news = {
                'title': top_news.get('headline') or top_news.get('title') or 'No title',
                'source': top_news.get('source') or source.capitalize(),
                'published': top_news.get('datetime') or top_news.get('time'),
                'summary': top_news.get('summary') or '',
                'url': top_news.get('url') or '',
                'provider': source
            }
            
            # 分析新闻情绪
            sentiment = 'Neutral'
            if 'sentiment' in top_news:
                sentiment = top_news.get('sentiment', 'Neutral')
            else:
                title = (top_news.get('headline') or top_news.get('title') or '').lower()
                if any(word in title for word in ['up', 'gain', 'rise', 'beat', 'positive', 'bullish', 'strong', 'raise']):
                    sentiment = 'Positive'
                elif any(word in title for word in ['down', 'fall', 'drop', 'miss', 'negative', 'bearish', 'weak', 'cut']):
                    sentiment = 'Negative'
            
            # 判断事件风险
            title_summary = (formatted_top_news['title'] + ' ' + formatted_top_news['summary']).lower()
            high_risk_keywords = ['lawsuit', 'investigation', 'recall', 'warning', 'fraud', 'bankruptcy']
            medium_risk_keywords = ['earnings', 'guidance', 'downgrade', 'cut', 'delay']
            
            if any(word in title_summary for word in high_risk_keywords):
                event_risk = 'High'
            elif any(word in title_summary for word in medium_risk_keywords):
                event_risk = 'Medium'
            else:
                event_risk = 'Low'
        else:
            formatted_top_news = None
            sentiment = 'Neutral'
            event_risk = 'Low'
        
        # 5. 返回结果
        response_data = {
            'success': True,
            'symbol': symbol_upper,
            'sentiment': sentiment,
            'eventRisk': event_risk,
            'topNews': formatted_top_news,
            'news': news_items[:5],  # 只返回前5条
            'source': source or 'none',
            'hasNews': len(news_items) > 0,
            'newsCount': len(news_items),
            'responseTime': round(time.time() - start_time, 3)
        }
        
        print(f'[新闻接口] 返回数据: {response_data}')
        return jsonify(response_data)
        
    except Exception as e:
        print(f'[新闻接口] 异常: {str(e)}')
        import traceback
        traceback.print_exc()
        
        return jsonify({
            'success': False,
            'error': f'新闻获取错误: {str(e)}',
            'symbol': symbol.upper(),
            'responseTime': round(time.time() - start_time, 3)
        }), 500

# ==================== AI 分析函数 ====================
def analyze_trend_with_deepseek(symbol, stock_data, news_data, profile_data):
    """使用DeepSeek分析股票趋势"""
    print(f'[DeepSeek分析] 函数被调用，参数: symbol={symbol}')
    
    try:
        print(f'[DeepSeek分析] 开始分析 {symbol}')
        
        # 检查是否有有效的API密钥
        api_key = ai_provider_config_state.get('apiKey', '')
        print(f'[DeepSeek分析] API密钥: "{api_key[:10]}..." (长度: {len(api_key)})')
        
        # 简化验证逻辑：只要API密钥不为空就尝试使用DeepSeek
        if not api_key:
            print(f'[DeepSeek分析] API密钥为空，返回null数据 {symbol}')
            return {
                'trendLabel': None,
                'trendScore': None,
                'trendConfidence': None,
                'scannerReason': None,
                'trendScoreDetail': None,
                'momentumScore': None,
                'volumeScore': None,
                'volatilityScore': None,
                'structureScore': None,
                'newsScore': None,
                'volumeStatus': None,
                'aiReasoning': None,
                'conciseReasoning': None,
                'detailedReasoning': None
            }
        
        print(f'[DeepSeek分析] 尝试使用DeepSeek API分析 {symbol}')
        
        # 处理可能的None值
        if stock_data is None:
            stock_data = {}
        if news_data is None:
            news_data = {}
        if profile_data is None:
            profile_data = {}
        
        # 准备分析数据
        analysis_context = {
            'symbol': symbol,
            'companyName': profile_data.get('name', f'{symbol} Inc.'),
            'price': stock_data.get('price'),
            'changePercent': stock_data.get('changePercent'),
            'volume': stock_data.get('volume'),
            'sector': profile_data.get('finnhubSector', 'Unknown'),
            'newsSentiment': news_data.get('sentiment', 'Mixed'),
            'eventRisk': news_data.get('eventRisk', 'Low'),
            'topCatalyst': news_data.get('topCatalyst', 'No recent catalyst'),
            'newsCount': news_data.get('newsCount', 0)
        }
        
        # 构建提示
        price_str = f"${analysis_context['price']:.2f}" if analysis_context['price'] is not None else "数据缺失"
        change_str = f"{analysis_context['changePercent']:.2f}%" if analysis_context['changePercent'] is not None else "数据缺失"
        volume_str = f"{analysis_context['volume']:,.0f}" if analysis_context['volume'] is not None else "数据缺失"
        
        # 调用DeepSeek API
        headers = {
            'Authorization': f'Bearer {api_key}',
            'Content-Type': 'application/json'
        }
        
        payload = {
            'model': ai_provider_config_state.get('model', 'deepseek-chat'),
            'messages': [{'role': 'user', 'content': prompt}],
            'max_tokens': 500,
            'temperature': 0.2,
            'response_format': {'type': 'json_object'}
        }
        
        base_url = ai_provider_config_state.get('baseURL', 'https://api.deepseek.com')
        if not base_url.startswith('http'):
            base_url = 'https://' + base_url
        
        response = requests.post(
            f'{base_url}/chat/completions',
            headers=headers,
            json=payload,
            timeout=15
        )
        
        if response.status_code == 200:
            result = response.json()
            ai_response = result['choices'][0]['message']['content']
            
            # 打印AI原始响应以便调试
            print(f'[DeepSeek分析] AI原始响应: {ai_response[:500]}...')
            
            try:
                import json as json_module
                analysis_result = json_module.loads(ai_response)
                
                # 验证必要字段 - 支持新旧两种格式
                required_fields_v2 = ['trendLabel', 'overallScore', 'confidence', 'trendScore', 'momentumScore', 'volumeScore', 'volatilityScore', 'structureScore', 'newsScore', 'volumeStatus', 'eventRisk', 'conciseReasoning', 'detailedReasoning']
                
                # 检查是V2格式
                is_v2_format = all(field in analysis_result for field in ['overallScore', 'trendScore', 'momentumScore'])
                
                if is_v2_format:
                    # V2格式：完整的6维度分析
                    print(f'[DeepSeek分析] 收到V2格式分析结果，包含6维度分数')
                    
                    # 确保所有V2字段都存在
                    for field in required_fields_v2:
                        if field not in analysis_result:
                            if field == 'trendLabel':
                                analysis_result[field] = 'Neutral'
                            elif field in ['overallScore', 'trendScore', 'momentumScore', 'volumeScore', 'volatilityScore', 'structureScore', 'newsScore']:
                                analysis_result[field] = 50
                            elif field == 'confidence':
                                analysis_result[field] = 0.5
                            elif field == 'volumeStatus':
                                analysis_result[field] = 'Normal'
                            elif field == 'eventRisk':
                                analysis_result[field] = 'Low'
                            elif field == 'conciseReasoning':
                                analysis_result[field] = 'AI analysis completed'
                            elif field == 'detailedReasoning':
                                analysis_result[field] = 'AI analysis completed'
                    
                    # 确保有scannerReason字段（前端可能使用）
                    if 'scannerReason' not in analysis_result:
                        analysis_result['scannerReason'] = analysis_result.get('conciseReasoning', 'AI analysis completed')
                    
                    # 确保有aiReasoning字段（前端可能使用）
                    if 'aiReasoning' not in analysis_result:
                        analysis_result['aiReasoning'] = analysis_result.get('detailedReasoning', 'AI analysis completed')
                else:
                    # V1格式：旧格式，只有基本字段
                    print(f'[DeepSeek分析] 收到V1格式分析结果，只有基本字段')
                    
                    required_fields_v1 = ['trendLabel', 'trendScore', 'trendConfidence', 'scannerReason']
                    for field in required_fields_v1:
                        if field not in analysis_result:
                            if field == 'trendLabel':
                                analysis_result[field] = 'Neutral'
                            elif field == 'trendScore':
                                analysis_result[field] = 50
                            elif field == 'trendConfidence':
                                analysis_result[field] = 0.5
                            elif field == 'scannerReason':
                                analysis_result[field] = 'AI analysis completed'
                    
                    # 为V1格式添加缺失的V2字段
                    analysis_result['overallScore'] = analysis_result.get('trendScore', 50)
                    analysis_result['confidence'] = analysis_result.get('trendConfidence', 0.5)
                    analysis_result['volumeStatus'] = 'Normal'
                    analysis_result['eventRisk'] = 'Medium'
                    analysis_result['conciseReasoning'] = analysis_result.get('scannerReason', 'AI analysis completed')
                    analysis_result['detailedReasoning'] = analysis_result.get('scannerReason', 'AI analysis completed')
                    analysis_result['aiReasoning'] = analysis_result.get('scannerReason', 'AI analysis completed')
                
                # 确保volumeStatus存在
                if 'volumeStatus' not in analysis_result:
                    # 根据volumeScore判断volumeStatus
                    volume_score = analysis_result.get('volumeScore', 50)
                    if volume_score >= 70:
                        analysis_result['volumeStatus'] = 'High'
                    elif volume_score >= 40:
                        analysis_result['volumeStatus'] = 'Normal'
                    else:
                        analysis_result['volumeStatus'] = 'Low'
                
                print(f'[DeepSeek分析] {symbol} 完成: {analysis_result["trendLabel"]}, volumeStatus: {analysis_result.get("volumeStatus")}')
                print(f'[DeepSeek分析] 完整分析结果: {analysis_result}')
                return analysis_result
                
            except Exception as e:
                print(f'解析DeepSeek响应失败: {str(e)}，返回null数据')
                return {
                    'trendLabel': None,
                    'trendScore': None,
                    'trendConfidence': None,
                    'scannerReason': None,
                    'trendScoreDetail': None,
                    'momentumScore': None,
                    'volumeScore': None,
                    'volatilityScore': None,
                    'structureScore': None,
                    'newsScore': None,
                    'volumeStatus': None,
                    'aiReasoning': None,
                    'conciseReasoning': None,
                    'detailedReasoning': None
                }
        else:
            print(f'DeepSeek API请求失败: {response.status_code}，返回null数据')
            return {
                'trendLabel': None,
                'trendScore': None,
                'trendConfidence': None,
                'scannerReason': None,
                'trendScoreDetail': None,
                'momentumScore': None,
                'volumeScore': None,
                'volatilityScore': None,
                'structureScore': None,
                'newsScore': None,
                'volumeStatus': None,
                'aiReasoning': None,
                'conciseReasoning': None,
                'detailedReasoning': None
            }
            
    except Exception as e:
        print(f'DeepSeek分析异常: {str(e)}，返回null数据')
        return {
            'trendLabel': None,
            'trendScore': None,
            'trendConfidence': None,
            'scannerReason': None,
            'trendScoreDetail': None,
            'momentumScore': None,
            'volumeScore': None,
            'volatilityScore': None,
            'structureScore': None,
            'newsScore': None,
            'volumeStatus': None,
            'aiReasoning': None,
            'conciseReasoning': None,
            'detailedReasoning': None
        }

# ==================== AI 分析接口 ====================
@app.route('/api/ai/analyze/single', methods=['POST'])
def ai_analyze_single():
    """单只股票AI分析接口"""
    print('=== AI 分析接口请求 ===')
    start_time = time.time()
    
    try:
        data = request.get_json()
        symbol = data.get('symbol', '').upper()
        
        if not symbol:
            return jsonify({
                'success': False,
                'error': '缺少symbol参数',
                'timestamp': int(time.time()),
                'responseTime': round(time.time() - start_time, 3)
            }), 400
        
        print(f'[AI分析接口] 分析 {symbol}')
        
        # 模拟市场数据（简化版）
        market_data = {
            'price': 182.63,
            'changePercent': 1.23,
            'volume': 45000000,
            'dayHigh': 183.50,
            'dayLow': 181.20,
            'previousClose': 180.42,
            'averageVolume': 50000000
        }
        
        # 获取新闻数据
        news_data_response = get_stock_news(symbol)
        if hasattr(news_data_response, 'get_json'):
            news_data = news_data_response.get_json()
        else:
            news_data = news_data_response
        
        # 模拟公司资料
        profile_data = {
            'name': f'{symbol} Corporation',
            'finnhubSector': 'Technology'
        }
        
        # 调用AI分析
        ai_analysis = analyze_trend_with_deepseek(symbol, market_data, news_data, profile_data)
        
        # 调试：打印AI分析结果
        print(f'[AI分析接口] AI分析结果: {ai_analysis}')
        print(f'[AI分析接口] AI分析结果中的volumeStatus: {ai_analysis.get("volumeStatus")}')
        print(f'[AI分析接口] AI分析结果的所有字段: {list(ai_analysis.keys())}')
        
        # 构建响应
        response_data = {
            'success': True,
            'symbol': symbol,
            'trend': ai_analysis.get('trendLabel'),
            'overallScore': ai_analysis.get('overallScore'),
            'confidence': ai_analysis.get('confidence'),
            'trendScore': ai_analysis.get('trendScore'),
            'momentumScore': ai_analysis.get('momentumScore'),
            'volumeScore': ai_analysis.get('volumeScore'),
            'volatilityScore': ai_analysis.get('volatilityScore'),
            'structureScore': ai_analysis.get('structureScore'),
            'newsScore': ai_analysis.get('newsScore'),
            'volumeStatus': ai_analysis.get('volumeStatus', 'Normal'),  # 确保总是有值
            'eventRisk': ai_analysis.get('eventRisk'),
            'aiReasoning': ai_analysis.get('aiReasoning'),
            'conciseReasoning': ai_analysis.get('conciseReasoning'),
            'detailedReasoning': ai_analysis.get('detailedReasoning'),
            'scannerReason': ai_analysis.get('scannerReason'),
            'companyName': profile_data.get('name'),
            'sector': profile_data.get('finnhubSector'),
            'timestamp': int(time.time()),
            'responseTime': round(time.time() - start_time, 3),
            'message': 'AI analysis completed'
        }
        
        print(f'[AI分析接口] 返回数据: {response_data}')
        return jsonify(response_data)
        
    except Exception as e:
        print(f'[AI分析接口] 异常: {str(e)}')
        import traceback
        traceback.print_exc()
        
        return jsonify({
            'success': False,
            'error': f'AI analysis error: {str(e)}',
            'timestamp': int(time.time()),
            'responseTime': round(time.time() - start_time, 3)
        }), 500

# ==================== 主程序 ====================
if __name__ == '__main__':
    print("================================================================================")
    print("简化版后端启动 - 只包含AI分析和新闻接口")
    print("端口: 8889")
    print("包含接口:")
    print("  1. 新闻接口:")
    print("     - GET /api/market/news/<symbol> - 获取股票新闻")
    print("  2. AI分析接口:")
    print("     - POST /api/ai/analyze/single - 单只股票AI分析")
    print("================================================================================")

    print("\n启动中...")
    app.run(host='127.0.0.1', port=8889, debug=True)