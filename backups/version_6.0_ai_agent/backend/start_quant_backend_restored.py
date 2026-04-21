# 这是恢复后的Backtest函数，使用4月5日的版本
@app.route('/backtest/run', methods=['POST'])
@app.route('/api/backtest/run', methods=['POST'])
def run_backtest():
    """运行回测 - 优化版，添加详细耗时日志"""
    total_start = time.time()
    
    try:
        data = request.get_json()
        print(f"[Backtest] 收到回测请求: {data}")
        
        # 提取配置
        user_input = data.get('symbol', 'AAPL')
        strategy = data.get('strategy', 'moving_average')
        start_date = data.get('startDate', '2024-01-01')
        end_date = data.get('endDate', '2024-12-31')
        initial_capital = data.get('initialCapital', 10000)
        data_mode = data.get('dataMode', 'real')
        parameters = data.get('parameters', {})
        
        # 生成backtest ID
        import uuid
        backtest_id = str(uuid.uuid4())[:8]
        
        print(f"[Backtest] 开始处理，ID: {backtest_id}")
        
        # 阶段1: symbol验证
        stage1_start = time.time()
        print(f"[Backtest] 阶段1: 验证股票输入")
        
        # 简单的symbol验证
        symbol = user_input.upper().strip()
        if not symbol or len(symbol) > 10:
            validation_message = f"无效的股票代码: '{user_input}'"
            print(f"[Backtest] 股票输入无效: {validation_message}")
            return jsonify({
                "success": False,
                "error": validation_message,
                "backtestId": backtest_id,
                "results": None,
                "chartData": None,
                "trades": None,
                "parameters": {
                    "symbol": "",
                    "symbols": [],
                    "strategy": strategy,
                    "startDate": start_date,
                    "endDate": end_date,
                    "period": f"{start_date} to {end_date}",
                    "initialCapital": initial_capital,
                    "dataMode": "real",
                    "dataModeDisplay": "Real Data",
                    "dataSource": "Invalid input"
                }
            }), 200
        
        stage1_time = time.time() - stage1_start
        print(f"[Backtest] 阶段1完成，耗时: {stage1_time:.2f}秒")
        
        # 只支持真实数据模式
        print(f"[Backtest] 使用真实数据模式")
        
        # 阶段2: 获取历史数据
        stage2_start = time.time()
        print(f"[Backtest] 阶段2: 获取历史数据")
        
        # 只使用Twelve Data获取历史数据
        historical_data = None
        data_source = None
        data_mode_display = "Real Data"
        data_source_note = ""
        
        # 使用日线数据
        interval = "1day"
        
        # 1. 使用Twelve Data日期范围API（精确匹配回测日期范围）
        print(f"[Backtest] 使用Twelve Data获取历史数据: {symbol}, start={start_date}, end={end_date}")
        
        try:
            # 直接使用start_date和end_date作为参数
            historical_data, success, data_source_note = get_twelvedata_history(
                symbol, interval, f"{start_date} to {end_date}"
            )
            
            # 如果Twelve Data失败，尝试使用Finnhub作为备选
            if not success or not historical_data:
                print(f"[Backtest] Twelve Data获取失败，尝试Finnhub备选方案: {data_source_note}")
                historical_data, success, data_source_note = get_finnhub_history(
                    symbol, interval, f"{start_date} to {end_date}"
                )
            
            if success and historical_data:
                data_source = data_source_note
                print(f"[Backtest] 获取历史数据成功 ({data_source}): {len(historical_data)} 个数据点")
            else:
                print(f"[Backtest] 获取历史数据失败: {data_source_note}")
                return jsonify({
                    "success": False,
                    "error": f"无法获取历史数据: {data_source_note}",
                    "backtestId": backtest_id,
                    "results": None,
                    "chartData": None,
                    "trades": None,
                    "parameters": {
                        "symbol": symbol,
                        "symbols": [symbol],
                        "strategy": strategy,
                        "startDate": start_date,
                        "endDate": end_date,
                        "period": f"{start_date} to {end_date}",
                        "initialCapital": initial_capital,
                        "dataMode": "real",
                        "dataModeDisplay": "Real Data",
                        "dataSource": data_source_note
                    }
                }), 200
                
        except Exception as e:
            print(f"[Backtest] 获取历史数据异常: {str(e)}")
            return jsonify({
                "success": False,
                "error": f"获取历史数据异常: {str(e)}",
                "backtestId": backtest_id,
                "results": None,
                "chartData": None,
                "trades": None,
                "parameters": {
                    "symbol": symbol,
                    "symbols": [symbol],
                    "strategy": strategy,
                    "startDate": start_date,
                    "endDate": end_date,
                    "period": f"{start_date} to {end_date}",
                    "initialCapital": initial_capital,
                    "dataMode": "real",
                    "dataModeDisplay": "Real Data",
                    "dataSource": "Twelve Data (异常)"
                }
            }), 200
        
        stage2_time = time.time() - stage2_start
        print(f"[Backtest] 阶段2完成，耗时: {stage2_time:.2f}秒")
        
        # 阶段3: 执行回测逻辑
        stage3_start = time.time()
        print(f"[Backtest] 阶段3: 执行回测逻辑")
        
        # 简化回测逻辑 - 基于历史数据生成模拟结果
        if historical_data and len(historical_data) > 0:
            # 计算基本统计
            first_close = historical_data[0]['close']
            last_close = historical_data[-1]['close']
            price_change = last_close - first_close
            price_change_pct = (price_change / first_close) * 100 if first_close > 0 else 0
            
            # 生成模拟交易
            trades = []
            equity_curve = []
            
            # 基于移动平均线的简单交易策略
            position = 0
            cash = initial_capital
            equity = initial_capital
            
            # 计算移动平均线
            prices = [point['close'] for point in historical_data]
            sma_short = []
            sma_long = []
            
            for i in range(len(prices)):
                if i >= 10:
                    sma_short.append(sum(prices[i-10:i]) / 10)
                else:
                    sma_short.append(prices[i])
                
                if i >= 30:
                    sma_long.append(sum(prices[i-30:i]) / 30)
                else:
                    sma_long.append(prices[i])
            
            # 执行交易策略
            for i, data_point in enumerate(historical_data):
                date = data_point['timestamp']
                price = data_point['close']
                
                # 交易信号
                if i >= 30:
                    # 短期均线上穿长期均线 - 买入信号
                    if sma_short[i] > sma_long[i] and (i == 0 or sma_short[i-1] <= sma_long[i-1]):
                        if cash > 0 and position == 0:
                            shares_to_buy = cash // price
                            if shares_to_buy > 0:
                                cost = shares_to_buy * price
                                cash -= cost
                                position = shares_to_buy
                                trades.append({
                                    'entryDate': date,
                                    'exitDate': None,
                                    'entryPrice': price,
                                    'exitPrice': None,
                                    'pnl': 0,
                                    'returnPct': 0,
                                    'holdingPeriod': 0,
                                    'position': 1,
                                    'action': 'BUY',
                                    'quantity': shares_to_buy,
                                    'symbol': symbol
                                })
                    
                    # 短期均线下穿长期均线 - 卖出信号
                    elif sma_short[i] < sma_long[i] and (i == 0 or sma_short[i-1] >= sma_long[i-1]):
                        if position > 0:
                            value = position * price
                            cash += value
                            # 更新最近一次交易的退出信息
                            for trade in reversed(trades):
                                if trade.get('exitDate') is None and trade.get('action') == 'BUY':
                                    entry_price = trade['entryPrice']
                                    pnl = (price - entry_price) * trade['quantity']
                                    return_pct = ((price - entry_price) / entry_price) * 100 if entry_price > 0 else 0
                                    
                                    trade['exitDate'] = date
                                    trade['exitPrice'] = price
                                    trade['pnl'] = round(pnl, 2)
                                    trade['returnPct'] = round(return_pct, 2)
                                    trade['holdingPeriod'] = i - (historical_data.index(next(p for p in historical_data if p['timestamp'] == trade['entryDate'])) if any(p['timestamp'] == trade['entryDate'] for p in historical_data) else i)
                                    break
                            position = 0
                
                # 计算当前权益
                equity = cash + (position * price)
                equity_curve.append({
                    'date': date,
                    'equity': equity,
                    'price': price
                })
            
            # 计算最终结果
            final_equity = equity
            total_return = ((final_equity - initial_capital) / initial_capital) * 100
            profit_loss = final_equity - initial_capital
            
            # 计算最大回撤
            max_drawdown = 0
            peak = initial_capital
            for point in equity_curve:
                equity_val = point['equity']
                if equity_val > peak:
                    peak = equity_val
                drawdown = (peak - equity_val) / peak * 100
                if drawdown > max_drawdown:
                    max_drawdown = drawdown
            
            # 计算交易统计
            completed_trades = [t for t in trades if t.get('exitDate') is not None]
            winning_trades = [t for t in completed_trades if t.get('pnl', 0) > 0]
            losing_trades = [t for t in completed_trades if t.get('pnl', 0) <= 0]
            
            win_rate = (len(winning_trades) / len(completed_trades) * 100) if completed_trades else 0
            avg_win = sum(t.get('pnl', 0) for t in winning_trades) / len(winning_trades) if winning_trades else 0
            avg_loss = sum(t.get('pnl', 0) for t in losing_trades) / len(losing_trades) if losing_trades else 0
            total_win = sum(t.get('pnl', 0) for t in winning_trades) if winning_trades else 0
            total_loss = abs(sum(t.get('pnl', 0) for t in losing_trades)) if losing_trades else 0
            
            profit_factor = total_win / total_loss if total_loss > 0 else (total_win if total_win > 0 else 1)
            expectancy = ((win_rate / 100) * avg_win) - ((1 - win_rate / 100) * abs(avg_loss)) if completed_trades else 0
            
            # 计算波动率（基于权益曲线）
            equity_values = [point['equity'] for point in equity_curve]
            if len(equity_values) > 1:
                returns = [(equity_values[i] - equity_values[i-1]) / equity_values[i-1] for i in range(1, len(equity_values))]
                volatility = (sum((r - sum(returns)/len(returns))**2 for r in returns) / len(returns))**0.5 * 100 if returns else 0
            else:
                volatility = 0
            
            # 计算风险调整收益
            sharpe_ratio = (total_return / 100) / (volatility / 100) if volatility > 0 else 0
            sortino_ratio = (total_return / 100) / (volatility / 100) if volatility > 0 else 0
            
            # 计算年化收益
            from datetime import datetime
            start_dt = datetime.strptime(start_date, "%Y-%m-%d")
            end_dt = datetime.strptime(end_date, "%Y-%m-%d")
            days_diff = (end_dt - start_dt).days
            annualized_return = ((1 + total_return/100) ** (365/days_diff) - 1) * 100 if days_diff > 0 else total_return
            
            # 计算Calmar比率
            calmar_ratio = annualized_return / max_drawdown if max_drawdown > 0 else 0
            
            # 计算平均每笔交易收益
            avg_return_per_trade = profit_loss / len(completed_trades) if completed_trades else 0
            
            # 计算暴露度（平均持仓比例）
            exposure = (sum(point['equity'] for point in equity_curve) / len(equity_curve)) / initial_capital * 100 if equity_curve else 0
            
            # 构建结果
            results = {
                "totalReturn": round(total_return, 2),
                "profitLoss": round(profit_loss, 2),
                "annualizedReturn": round(annualized_return, 2),
                "maxDrawdown": round(max_drawdown, 2),
                "volatility": round(volatility, 2),
                "sharpeRatio": round(sharpe_ratio, 2),
                "sortinoRatio": round(sortino_ratio, 2),
                "calmarRatio": round(calmar_ratio, 2),
                "winRate": round(win_rate, 2),
                "trades": len(completed_trades),
                "avgReturnPerTrade": round(avg_return_per_trade, 2),
                "profitFactor": round(profit_factor, 2),
                "expectancy": round(expectancy, 2),
                "exposure": round(exposure, 2),
                "chartData": equity_curve,
                "tradesList": completed_trades,
                "avgWin": round(avg_win, 2) if winning_trades else 0,
                "avgLoss": round(avg_loss, 2) if losing_trades else 0
            }
            
            print(f"[Backtest] 回测完成: totalReturn={total_return:.2f}%, trades={len(completed_trades)}")
            
        else:
            # 如果没有历史数据，返回空结果
            print(f"[Backtest] 没有历史数据，返回空结果")
            results = {
                "totalReturn": 0.0,
                "profitLoss": 0.0,
                "annualizedReturn": 0.0,
                "maxDrawdown": 0.0,
                "volatility": 0.0,
                "sharpeRatio": 0.0,
                "sortinoRatio": 0.0,
                "calmarRatio": 0.0,
                "winRate": 0.0,
                "trades": 0,
                "avgReturnPerTrade": 0.0,
                "profitFactor": 0.0,
                "expectancy": 0.0,
                "exposure": 0.0,
                "chartData": [],
                "tradesList": [],
                "avgWin": 0.0,
                "avgLoss": 0.0
            }
        
        stage3_time = time.time() - stage3_start
        print(f"[Backtest] 阶段3完成，耗时: {stage3_time:.2f}秒")
        
        total_time = time.time() - total_start
        print(f"[Backtest] 全部完成，总耗时: {total_time:.2f}秒")
        
        # 返回成功结果
        return jsonify({
            "success": True,
            "error": None,
            "backtestId": backtest_id,
            "results": results,
            "chartData": results.get("chartData", []),
            "trades": results.get("tradesList", []),
            "parameters": {
                "symbol": symbol,
                "symbols": [symbol],
                "strategy": strategy,
                "startDate": start_date,
                "endDate": end_date,
                "period": f"{start_date} to {end_date}",
                "initialCapital": initial_capital,
                "dataMode": "real",
                "dataModeDisplay": "Real Data",
                "dataSource": data_source if data_source else "Twelve Data"
            }
        }), 200
        
    except Exception as e:
        print(f"[Backtest] 回测处理异常: {str(e)}")
        import traceback
        traceback.print_exc()
        
        return jsonify({
            "success": False,
            "error": f"回测处理异常: {str(e)}",
            "backtestId": backtest_id if 'backtest_id' in locals() else "unknown",
            "results": None,
            "chartData": None,
            "trades": None,
            "parameters": {
                "symbol": user_input if 'user_input' in locals() else "",
                "symbols": [],
                "strategy": strategy if 'strategy' in locals() else "",
                "startDate": start_date if 'start_date' in locals() else "",
                "endDate": end_date if 'end_date' in locals() else "",
                "period": "",
                "initialCapital": initial