# ==================== 新闻接口 ====================

@app.route('/api/market/news/<symbol>', methods=['GET'])
@app.route('/market/news/<symbol>', methods=['GET'])
def get_stock_news(symbol):
    """获取股票新闻接口 - 优先Alpaca，fallback到Finnhub"""
    print(f'=== 获取股票新闻请求: {symbol} ===')
    start_time = time.time()
    
    try:
        symbol_upper = symbol.upper()
        
        # 1. 首先尝试获取Alpaca新闻
        alpaca_news = None
        alpaca_error = None
        
        try:
            print(f'[新闻接口] 尝试获取Alpaca新闻: {symbol_upper}')
            # 检查Alpaca配置
            environment = alpaca_config_state.get('environment', 'paper')
            if environment == 'paper':
                api_key = alpaca_config_state.get('paper_api_key')
                api_secret = alpaca_config_state.get('paper_api_secret')
            else:
                api_key = alpaca_config_state.get('live_api_key')
                api_secret = alpaca_config_state.get('live_api_secret')
            
            if api_key and api_secret:
                # 尝试调用Alpaca新闻API
                # Alpaca新闻API端点: https://data.alpaca.markets/v1beta1/news
                import requests
                market_headers = {
                    'APCA-API-KEY-ID': api_key,
                    'APCA-API-SECRET-KEY': api_secret
                }
                
                # 构建Alpaca新闻请求URL
                news_url = f'https://data.alpaca.markets/v1beta1/news'
                params = {
                    'symbols': symbol_upper,
                    'limit': 10,  # 获取最近10条新闻
                    'start': (datetime.datetime.now() - datetime.timedelta(days=7)).strftime('%Y-%m-%dT%H:%M:%SZ'),
                    'end': datetime.datetime.now().strftime('%Y-%m-%dT%H:%M:%SZ')
                }
                
                print(f'[新闻接口] 调用Alpaca新闻API: {news_url}')
                response = requests.get(news_url, headers=market_headers, params=params, timeout=10)
                
                if response.status_code == 200:
                    news_data = response.json()
                    if news_data.get('news') and len(news_data['news']) > 0:
                        alpaca_news = news_data['news']
                        print(f'[新闻接口] Alpaca新闻获取成功: {len(alpaca_news)} 条新闻')
                    else:
                        alpaca_error = 'Alpaca返回空新闻数据'
                        print(f'[新闻接口] Alpaca返回空新闻数据')
                else:
                    alpaca_error = f'Alpaca新闻API失败: {response.status_code}'
                    print(f'[新闻接口] Alpaca新闻API失败: {response.status_code}')
            else:
                alpaca_error = 'Alpaca API密钥未配置'
                print(f'[新闻接口] Alpaca API密钥未配置')
                
        except Exception as e:
            alpaca_error = f'Alpaca新闻获取异常: {str(e)}'
            print(f'[新闻接口] Alpaca新闻获取异常: {str(e)}')
        
        # 2. 如果Alpaca没有新闻，fallback到Finnhub
        if not alpaca_news:
            print(f'[新闻接口] Alpaca新闻不可用，尝试Finnhub: {alpaca_error}')
            finnhub_news, finnhub_error = fetch_finnhub_company_news(symbol_upper, days_back=7)
            
            if finnhub_error or not finnhub_news:
                print(f'[新闻接口] Finnhub新闻也失败: {finnhub_error}')
                # 两个来源都失败，返回空数据
                return jsonify({
                    'success': True,
                    'symbol': symbol_upper,
                    'news': [],
                    'topNews': None,
                    'sentiment': None,
                    'eventRisk': None,
                    'newsCount': 0,
                    'source': 'none',
                    'hasNews': False,
                    'timestamp': int(time.time()),
                    'responseTime': round(time.time() - start_time, 3),
                    'message': 'No recent news available from Alpaca or Finnhub'
                })
            else:
                # 使用Finnhub新闻
                news_items = finnhub_news
                source = 'finnhub'
                print(f'[新闻接口] 使用Finnhub新闻: {len(news_items)} 条')
        else:
            # 使用Alpaca新闻
            news_items = alpaca_news
            source = 'alpaca'
            print(f'[新闻接口] 使用Alpaca新闻: {len(news_items)} 条')
        
        # 3. 分析新闻数据
        # 选择最重要的一条新闻
        top_news = None
        if news_items and len(news_items) > 0:
            # 按时间排序，选择最新的
            sorted_news = sorted(news_items, 
                               key=lambda x: x.get('published_at') or x.get('datetime') or x.get('time', 0), 
                               reverse=True)
            top_news = sorted_news[0]
            
            # 格式化top_news
            formatted_top_news = {
                'title': top_news.get('headline') or top_news.get('title') or 'No title',
                'source': top_news.get('source') or source.capitalize(),
                'published': top_news.get('published_at') or top_news.get('datetime') or top_news.get('time'),
                'summary': top_news.get('summary') or top_news.get('content', '')[:200] + '...',
                'url': top_news.get('url') or top_news.get('link'),
                'provider': source
            }
            
            # 分析新闻情绪（简化版）
            sentiment = 'Neutral'
            event_risk = 'Low'
            
            if source == 'finnhub':
                # Finnhub提供情绪分数
                sentiment_score = top_news.get('sentiment_score', 0)
                if sentiment_score > 0.1:
                    sentiment = 'Positive'
                elif sentiment_score < -0.1:
                    sentiment = 'Negative'
                else:
                    sentiment = 'Neutral'
            else:
                # Alpaca新闻，基于标题关键词判断
                title = (top_news.get('headline') or '').lower()
                if any(word in title for word in ['up', 'gain', 'rise', 'beat', 'positive', 'bullish']):
                    sentiment = 'Positive'
                elif any(word in title for word in ['down', 'fall', 'drop', 'miss', 'negative', 'bearish']):
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
            sentiment = None
            event_risk = None
        
        # 4. 构建响应
        response_data = {
            'success': True,
            'symbol': symbol_upper,
            'news': news_items[:5],  # 返回前5条新闻
            'topNews': formatted_top_news,
            'sentiment': sentiment,
            'eventRisk': event_risk,
            'newsCount': len(news_items),
            'source': source,
            'hasNews': len(news_items) > 0,
            'timestamp': int(time.time()),
            'responseTime': round(time.time() - start_time, 3),
            'message': f'Found {len(news_items)} news items from {source.capitalize()}'
        }
        
        return jsonify(response_data)
        
    except Exception as e:
        print(f'[新闻接口] 异常: {str(e)}')
        import traceback
        traceback.print_exc()
        
        return jsonify({
            'success': False,
            'symbol': symbol.upper(),
            'error': f'News API error: {str(e)}',
            'timestamp': int(time.time()),
            'responseTime': round(time.time() - start_time, 3)
        }), 500