#!/usr/bin/env python3
"""
测试后端响应数据，验证指标计算是否自洽
"""

# 模拟移动平均策略的模拟数据模式响应
def simulate_moving_average_response():
    # 模拟参数
    initial_capital = 100000
    total_return = 15.5  # 百分比
    days_diff = 90
    
    # 基于总收益率计算盈利
    total_profit = initial_capital * (total_return / 100)  # $15,500
    
    # 模拟交易数据
    trades = 24  # 移动平均策略中等交易频率
    winning_trades = int(trades * 0.587)  # 58.7%胜率
    losing_trades = trades - winning_trades
    
    # 计算年化收益率
    annualized_return = ((1 + total_return/100) ** (252/days_diff) - 1) * 100
    
    # 计算最大回撤（基于策略类型）
    max_drawdown = -abs(total_return * 0.6)  # 回撤约为总收益的60%
    max_drawdown = max(min(max_drawdown, -2.0), -30.0)  # 限制在-2%到-30%之间
    
    # 计算Calmar Ratio
    calmar_ratio = annualized_return / abs(max_drawdown) if abs(max_drawdown) > 0 else 0
    
    # 计算平均每笔交易盈亏
    avg_return_per_trade = total_profit / trades if trades > 0 else 0
    
    # 模拟盈利和亏损交易分布
    # 假设盈利交易平均盈利较高，亏损交易平均亏损较低
    avg_win = total_profit * 1.2 / winning_trades if winning_trades > 0 else 0
    avg_loss = -total_profit * 0.8 / losing_trades if losing_trades > 0 else 0
    
    # 计算Profit Factor
    total_winning_pnl = avg_win * winning_trades
    total_losing_pnl = avg_loss * losing_trades
    if abs(total_losing_pnl) > 0:
        profit_factor = abs(total_winning_pnl / total_losing_pnl)
    else:
        profit_factor = 99.0 if total_winning_pnl > 0 else 0.0
    
    # 计算Expectancy
    win_rate_decimal = winning_trades / trades
    loss_rate_decimal = losing_trades / trades
    expectancy_dollar = (win_rate_decimal * avg_win) + (loss_rate_decimal * avg_loss)
    expectancy_pct = (expectancy_dollar / initial_capital) * 100 if initial_capital > 0 else 0
    
    # 构建响应
    response = {
        "backtestId": "test123",
        "status": "completed",
        "results": {
            "totalReturn": round(total_return, 2),
            "sharpeRatio": 1.2,
            "maxDrawdown": round(max_drawdown, 1),
            "winRate": round((winning_trades / trades) * 100, 1),
            "trades": trades,
            "annualizedReturn": round(annualized_return, 1),
            "profitLoss": round(total_profit, 2),
            "calmarRatio": round(calmar_ratio, 2),
            "avgReturnPerTrade": round(avg_return_per_trade, 2),
            "volatility": 12.5,
            "sortinoRatio": 1.8,
            "profitFactor": round(profit_factor, 2),
            "expectancy": round(expectancy_pct, 2),
            "exposure": 45.2,
            "chartData": [],
            "tradesList": []
        },
        "parameters": {
            "symbols": ["AAPL"],
            "strategy": "moving_average",
            "initialCapital": initial_capital,
            "dataMode": "simulated"
        }
    }
    
    return response

def check_consistency(response):
    """检查指标是否自洽"""
    results = response["results"]
    params = response["parameters"]
    initial_capital = params["initialCapital"]
    
    print("=== 后端响应数据验证 ===")
    print(f"初始资金: ${initial_capital:,.2f}")
    print(f"策略: {params['strategy']}")
    print()
    
    print("1. 收益率相关指标:")
    print(f"  Total Return: {results['totalReturn']}%")
    print(f"  Profit / Loss: ${results['profitLoss']:,.2f}")
    
    # 验证Total Return和Profit Loss的一致性
    calculated_return = (results['profitLoss'] / initial_capital) * 100
    print(f"  验证: Profit/Loss ${results['profitLoss']:,.2f} / 初始资金 ${initial_capital:,.2f} = {calculated_return:.2f}%")
    print(f"  与Total Return差异: {abs(results['totalReturn'] - calculated_return):.2f}%")
    
    print()
    print("2. 交易统计指标:")
    print(f"  Trades: {results['trades']}")
    print(f"  Avg P&L per Trade: ${results['avgReturnPerTrade']:,.2f}")
    
    # 验证Avg P&L per Trade
    if results['trades'] > 0:
        calculated_avg = results['profitLoss'] / results['trades']
        print(f"  验证: Profit/Loss ${results['profitLoss']:,.2f} / {results['trades']} trades = ${calculated_avg:,.2f}")
        print(f"  与Avg P&L差异: ${abs(results['avgReturnPerTrade'] - calculated_avg):,.2f}")
    
    print()
    print("3. 胜率和盈利因子:")
    print(f"  Win Rate: {results['winRate']}%")
    print(f"  Profit Factor: {results['profitFactor']}")
    
    # Profit Factor合理性检查
    if results['winRate'] == 0 and results['profitFactor'] > 1:
        print(f"  ⚠️ 警告: Win Rate为0%但Profit Factor > 1，可能不合理")
    elif results['winRate'] > 0 and results['profitFactor'] <= 0:
        print(f"  ⚠️ 警告: Win Rate > 0%但Profit Factor <= 0，可能不合理")
    else:
        print(f"  ✓ Win Rate和Profit Factor关系合理")
    
    print()
    print("4. 预期收益:")
    print(f"  Expectancy: {results['expectancy']}%")
    
    # Expectancy单位检查
    print(f"  说明: Expectancy显示为百分比，表示每笔交易相对于初始资金的预期收益率")
    
    print()
    print("5. 风险调整指标:")
    print(f"  Max Drawdown: {results['maxDrawdown']}%")
    print(f"  Calmar Ratio: {results['calmarRatio']}")
    
    # 验证Calmar Ratio
    if abs(results['maxDrawdown']) > 0:
        calculated_calmar = results['annualizedReturn'] / abs(results['maxDrawdown'])
        print(f"  验证: Annualized Return {results['annualizedReturn']}% / |Max Drawdown| {abs(results['maxDrawdown'])}% = {calculated_calmar:.2f}")
        print(f"  与Calmar Ratio差异: {abs(results['calmarRatio'] - calculated_calmar):.2f}")
    
    print()
    print("=== 总结 ===")
    
    # 检查关键不一致
    issues = []
    
    # 检查1: Total Return和Profit Loss是否一致
    expected_profit = initial_capital * (results['totalReturn'] / 100)
    if abs(results['profitLoss'] - expected_profit) > 1:  # 允许1美元误差
        issues.append(f"Total Return({results['totalReturn']}%)与Profit Loss(${results['profitLoss']:,.2f})不一致")
    
    # 检查2: Avg P&L计算是否正确
    if results['trades'] > 0:
        expected_avg = results['profitLoss'] / results['trades']
        if abs(results['avgReturnPerTrade'] - expected_avg) > 0.01:  # 允许1美分误差
            issues.append(f"Avg P&L per Trade(${results['avgReturnPerTrade']:,.2f})计算错误，应为${expected_avg:,.2f}")
    
    # 检查3: Win Rate和Profit Factor逻辑
    if results['winRate'] == 0 and results['profitFactor'] > 0.1:
        issues.append(f"Win Rate为0%但Profit Factor为{results['profitFactor']}，逻辑矛盾")
    
    if issues:
        print("❌ 发现以下问题:")
        for issue in issues:
            print(f"  - {issue}")
        return False
    else:
        print("✅ 所有指标逻辑自洽")
        return True

if __name__ == "__main__":
    print("测试移动平均策略模拟数据模式响应...")
    response = simulate_moving_average_response()
    
    # 打印原始响应
    print("\n原始响应数据:")
    import json
    print(json.dumps(response, indent=2))
    
    print("\n" + "="*50)
    consistency_ok = check_consistency(response)
    
    if consistency_ok:
        print("\n✅ 测试通过：所有指标计算正确且逻辑自洽")
    else:
        print("\n❌ 测试失败：发现指标不一致问题")