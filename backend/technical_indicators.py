"""
技术指标计算模块
为Market Scanner提供完整的技术指标计算
"""

def calculate_technical_indicators(symbol, historical_bars, current_price=None):
    """
    计算技术指标
    historical_bars: 历史bars数据，至少包含['t', 'o', 'h', 'l', 'c', 'v']
    current_price: 当前价格（可选，如果不提供则使用最后一个bar的收盘价）
    """
    try:
        if not historical_bars or len(historical_bars) < 50:
            print(f'[技术指标] {symbol}: 历史数据不足，至少需要50个bars，当前{len(historical_bars) if historical_bars else 0}')
            return None
        
        print(f'[技术指标] {symbol}: 开始计算技术指标，历史数据长度: {len(historical_bars)}')
        
        # 提取价格和成交量序列
        closes = [bar.get('c', 0) for bar in historical_bars]
        highs = [bar.get('h', 0) for bar in historical_bars]
        lows = [bar.get('l', 0) for bar in historical_bars]
        volumes = [bar.get('v', 0) for bar in historical_bars]
        
        # 使用当前价格或最后一个收盘价
        if current_price is not None:
            latest_price = current_price
        else:
            latest_price = closes[-1] if closes else 0
        
        # 1. 计算EMA
        def calculate_ema(prices, period):
            if len(prices) < period:
                return None
            ema = []
            multiplier = 2 / (period + 1)
            # 初始EMA为前period个价格的简单平均
            sma = sum(prices[:period]) / period
            ema.append(sma)
            
            for price in prices[period:]:
                ema_value = (price - ema[-1]) * multiplier + ema[-1]
                ema.append(ema_value)
            return ema
        
        ema20 = calculate_ema(closes, 20)
        ema50 = calculate_ema(closes, 50)
        ema200 = calculate_ema(closes, 200)
        
        # 2. 计算RSI
        def calculate_rsi(prices, period=14):
            if len(prices) < period + 1:
                return None
            gains = []
            losses = []
            
            for i in range(1, len(prices)):
                change = prices[i] - prices[i-1]
                if change > 0:
                    gains.append(change)
                    losses.append(0)
                else:
                    gains.append(0)
                    losses.append(abs(change))
            
            # 计算平均增益和平均损失
            avg_gain = sum(gains[:period]) / period
            avg_loss = sum(losses[:period]) / period
            
            rsi_values = []
            for i in range(period, len(gains)):
                if i > period:
                    avg_gain = (avg_gain * (period - 1) + gains[i]) / period
                    avg_loss = (avg_loss * (period - 1) + losses[i]) / period
                
                if avg_loss == 0:
                    rsi = 100
                else:
                    rs = avg_gain / avg_loss
                    rsi = 100 - (100 / (1 + rs))
                rsi_values.append(rsi)
            
            return rsi_values
        
        rsi = calculate_rsi(closes)
        
        # 3. 计算MACD
        def calculate_macd(prices, fast_period=12, slow_period=26, signal_period=9):
            if len(prices) < slow_period:
                return None, None, None
            
            # 计算EMA
            ema_fast = calculate_ema(prices, fast_period)
            ema_slow = calculate_ema(prices, slow_period)
            
            if not ema_fast or not ema_slow:
                return None, None, None
            
            # MACD线 = EMA12 - EMA26
            macd_line = []
            for i in range(len(ema_slow)):
                if i >= len(ema_fast) - len(ema_slow):
                    j = i - (len(ema_fast) - len(ema_slow))
                    macd_line.append(ema_fast[len(ema_fast) - len(ema_slow) + j] - ema_slow[i])
            
            # 信号线 = MACD线的EMA9
            signal_line = calculate_ema(macd_line, signal_period) if macd_line else None
            
            # 柱状图 = MACD线 - 信号线
            histogram = []
            if signal_line and len(macd_line) >= len(signal_line):
                offset = len(macd_line) - len(signal_line)
                for i in range(len(signal_line)):
                    histogram.append(macd_line[offset + i] - signal_line[i])
            
            return macd_line, signal_line, histogram
        
        macd_line, signal_line, histogram = calculate_macd(closes)
        
        # 4. 计算ATR（平均真实波幅）
        def calculate_atr(highs, lows, closes, period=14):
            if len(highs) < period + 1:
                return None
            
            tr_values = []
            for i in range(1, len(highs)):
                hl = highs[i] - lows[i]
                hc = abs(highs[i] - closes[i-1])
                lc = abs(lows[i] - closes[i-1])
                tr = max(hl, hc, lc)
                tr_values.append(tr)
            
            # 初始ATR为前period个TR的平均值
            atr = sum(tr_values[:period]) / period
            atr_values = [atr]
            
            # 计算后续ATR
            for i in range(period, len(tr_values)):
                atr = (atr * (period - 1) + tr_values[i]) / period
                atr_values.append(atr)
            
            return atr_values
        
        atr = calculate_atr(highs, lows, closes)
        
        # 5. 计算收益率
        def calculate_returns(prices, period):
            if len(prices) < period:
                return None
            return (prices[-1] - prices[-period]) / prices[-period] * 100
        
        return_5d = calculate_returns(closes, 5)
        return_10d = calculate_returns(closes, 10)
        return_20d = calculate_returns(closes, 20)
        
        # 6. 计算相对成交量
        avg_volume = sum(volumes[-20:]) / 20 if len(volumes) >= 20 else sum(volumes) / len(volumes)
        current_volume = volumes[-1] if volumes else 0
        relative_volume = current_volume / avg_volume if avg_volume > 0 else 1
        
        # 7. 计算近期高点和低点
        recent_high_20d = max(closes[-20:]) if len(closes) >= 20 else max(closes)
        recent_low_20d = min(closes[-20:]) if len(closes) >= 20 else min(closes)
        recent_high_50d = max(closes[-50:]) if len(closes) >= 50 else max(closes)
        recent_low_50d = min(closes[-50:]) if len(closes) >= 50 else min(closes)
        
        # 8. 判断higher highs / higher lows
        def check_higher_highs_lows(prices, lookback=20):
            if len(prices) < lookback * 2:
                return None, None
            
            # 检查最近lookback期是否形成higher highs
            recent_highs = []
            for i in range(-lookback, 0):
                if i == -lookback:
                    recent_highs.append(prices[i])
                elif prices[i] > max(prices[i-lookback:i]):
                    recent_highs.append(prices[i])
            
            higher_highs = len(recent_highs) > lookback * 0.3  # 30%的周期形成新高
            
            # 检查最近lookback期是否形成higher lows
            recent_lows = []
            for i in range(-lookback, 0):
                if i == -lookback:
                    recent_lows.append(prices[i])
                elif prices[i] < min(prices[i-lookback:i]):
                    recent_lows.append(prices[i])
            
            higher_lows = len(recent_lows) > lookback * 0.3  # 30%的周期形成新低
            
            return higher_highs, higher_lows
        
        higher_highs, higher_lows = check_higher_highs_lows(closes)
        
        # 9. 判断是否接近近期高点/低点
        near_20d_high = (latest_price >= recent_high_20d * 0.98) if recent_high_20d > 0 else False
        near_20d_low = (latest_price <= recent_low_20d * 1.02) if recent_low_20d > 0 else False
        near_50d_high = (latest_price >= recent_high_50d * 0.98) if recent_high_50d > 0 else False
        near_50d_low = (latest_price <= recent_low_50d * 1.02) if recent_low_50d > 0 else False
        
        # 10. 判断突破/跌破
        breakout_above_20d_high = latest_price > recent_high_20d if recent_high_20d > 0 else False
        breakdown_below_20d_low = latest_price < recent_low_20d if recent_low_20d > 0 else False
        
        # 11. 判断区间震荡
        range_bound = (recent_high_20d / recent_low_20d < 1.1) if recent_low_20d > 0 else False  # 20天内波动小于10%
        
        # 12. 计算EMA斜率
        def calculate_slope(values, period=5):
            if not values or len(values) < period:
                return 0
            recent = values[-period:]
            x = list(range(len(recent)))
            y = recent
            
            # 简单线性回归计算斜率
            n = len(x)
            sum_x = sum(x)
            sum_y = sum(y)
            sum_xy = sum(x[i] * y[i] for i in range(n))
            sum_x2 = sum(x[i] * x[i] for i in range(n))
            
            slope = (n * sum_xy - sum_x * sum_y) / (n * sum_x2 - sum_x * sum_x) if (n * sum_x2 - sum_x * sum_x) != 0 else 0
            return slope
        
        ema20_slope = calculate_slope(ema20[-10:]) if ema20 and len(ema20) >= 10 else 0
        ema50_slope = calculate_slope(ema50[-10:]) if ema50 and len(ema50) >= 10 else 0
        
        # 13. 判断EMA排列
        ema_alignment = "mixed"
        # 确保EMA变量有默认值
        latest_ema20 = ema20[-1] if ema20 else 0
        latest_ema50 = ema50[-1] if ema50 else 0
        latest_ema200 = ema200[-1] if ema200 else 0
        
        if ema20 and ema50 and ema200:
            if latest_ema20 > latest_ema50 > latest_ema200:
                ema_alignment = "bullish"
            elif latest_ema20 < latest_ema50 < latest_ema200:
                ema_alignment = "bearish"
        
        # 14. 价格相对于EMA的位置
        price_vs_ema20 = (latest_price - latest_ema20) / latest_ema20 * 100 if latest_ema20 > 0 else 0
        price_vs_ema50 = (latest_price - latest_ema50) / latest_ema50 * 100 if latest_ema50 > 0 else 0
        price_vs_ema200 = (latest_price - latest_ema200) / latest_ema200 * 100 if latest_ema200 > 0 else 0
        
        # 15. 波动率指标
        volatility_regime = "normal"
        if atr and latest_price > 0:
            atr_percent = atr[-1] / latest_price * 100 if atr else 0
            if atr_percent > 3:
                volatility_regime = "high"
            elif atr_percent < 1:
                volatility_regime = "low"
        
        # 16. 成交量状态（原始指标，由AI判断）
        volume_spike = relative_volume > 1.5
        dollar_volume = latest_price * current_volume if latest_price > 0 and current_volume > 0 else 0
        
        # 整理结果
        technical_indicators = {
            # 价格信息
            'current_price': latest_price,
            'price_vs_ema20_pct': price_vs_ema20,
            'price_vs_ema50_pct': price_vs_ema50,
            'price_vs_ema200_pct': price_vs_ema200,
            
            # EMA信息
            'ema20': latest_ema20 if ema20 else None,
            'ema50': latest_ema50 if ema50 else None,
            'ema200': latest_ema200 if ema200 else None,
            'ema20_slope': ema20_slope,
            'ema50_slope': ema50_slope,
            'ema_alignment': ema_alignment,
            
            # 动量指标
            'rsi': rsi[-1] if rsi else None,
            'macd_line': macd_line[-1] if macd_line else None,
            'signal_line': signal_line[-1] if signal_line else None,
            'macd_histogram': histogram[-1] if histogram else None,
            'return_5d_pct': return_5d,
            'return_10d_pct': return_10d,
            'return_20d_pct': return_20d,
            
            # 波动率指标
            'atr': atr[-1] if atr else None,
            'atr_percent': atr[-1] / latest_price * 100 if atr and latest_price > 0 else None,
            'volatility_regime': volatility_regime,
            
            # 成交量指标
            'current_volume': current_volume,
            'avg_volume_20d': avg_volume,
            'relative_volume': relative_volume,
            'volume_spike': volume_spike,
            'dollar_volume': dollar_volume,
            
            # 结构指标
            'recent_high_20d': recent_high_20d,
            'recent_low_20d': recent_low_20d,
            'recent_high_50d': recent_high_50d,
            'recent_low_50d': recent_low_50d,
            'higher_highs': higher_highs,
            'higher_lows': higher_lows,
            'near_20d_high': near_20d_high,
            'near_20d_low': near_20d_low,
            'near_50d_high': near_50d_high,
            'near_50d_low': near_50d_low,
            'breakout_above_20d_high': breakout_above_20d_high,
            'breakdown_below_20d_low': breakdown_below_20d_low,
            'range_bound': range_bound,
            
            # 数据质量
            'data_points': len(historical_bars),
            'calculation_success': True
        }
        
        print(f'[技术指标] {symbol}: 技术指标计算完成')
        return technical_indicators
        
    except Exception as e:
        print(f'[技术指标] {symbol}: 计算技术指标时发生错误: {str(e)}')
        return None


def analyze_news_for_scanner(news_items):
    """
    为scanner分析新闻数据，返回结构化输入
    news_items: Finnhub新闻数据
    """
    try:
        if not news_items:
            return {
                'news_count': 0,
                'headlines': [],
                'summaries': [],
                'categories': [],
                'timestamps': [],
                'raw_news': []
            }
        
        # 提取新闻信息
        headlines = []
        summaries = []
        categories = []
        timestamps = []
        
        for news in news_items[:10]:  # 只取最近10条新闻
            headlines.append(news.get('headline', ''))
            summaries.append(news.get('summary', ''))
            categories.append(news.get('category', 'general'))
            timestamps.append(news.get('datetime', ''))
        
        # 识别事件类型（原始标签，由AI判断）
        event_tags = []
        for headline, summary in zip(headlines, summaries):
            text = (headline + ' ' + summary).lower()
            tags = []
            
            # 识别事件类型
            if any(word in text for word in ['earnings', 'q1', 'q2', 'q3', 'q4', 'quarter']):
                tags.append('earnings')
            if any(word in text for word in ['upgrade', 'downgrade', 'analyst', 'target price']):
                tags.append('analyst_action')
            if any(word in text for word in ['lawsuit', 'investigation', 'regulatory']):
                tags.append('legal')
            if any(word in text for word in ['merger', 'acquisition', 'm&a']):
                tags.append('m&a')
            if any(word in text for word in ['product launch', 'new product', 'release']):
                tags.append('product')
            if any(word in text for word in ['guidance', 'forecast', 'outlook']):
                tags.append('guidance')
            
            event_tags.append(tags)
        
        return {
            'news_count': len(news_items),
            'headlines': headlines,
            'summaries': summaries,
            'categories': categories,
            'timestamps': timestamps,
            'event_tags': event_tags,
            'raw_news': news_items[:10]  # 原始新闻数据
        }
        
    except Exception as e:
        print(f'[新闻分析] 分析新闻时发生错误: {str(e)}')
        return {
            'news_count': 0,
            'headlines': [],
            'summaries': [],
            'categories': [],
            'timestamps': [],
            'event_tags': [],
            'raw_news': []
        }