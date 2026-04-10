#!/usr/bin/env python3
"""
测试当前后端逻辑，模拟移动平均策略响应
"""
import math

def simulate_current_backend_logic():
    """模拟当前后端逻辑"""
    # 固定参数
    initial_capital = 100000
    total_return = 15.5  # 百分比
    days_diff = 90
    strategy = "moving_average"
    
    # 模拟交易数据 - trades=1
    trades_count = 24  # 移动平均策略默认
    real_trades = 1    # 但实际生成只有1笔
    
    # 预期总盈利
    expected_profit_loss = initial_capital * (total_return / 100)  # $15,500
    
    # 模拟1笔交易
    trades_list = []
    
    # 生成1笔交易
    import random
    base_price = 150.0
    entry_price = round(base_price * (0.9 + random.random() * 0.2), 2)
    
    # 这笔交易应该是盈利的（因为total_return > 0）
    return_pct = 15.5  # 与total_return一致
    pnl = entry_price * 100 * (return_pct / 100)  # 假设100股
    
    trades_list.append({
        "tradeId": 1,
        "symbol": "AAPL",
        "pnl": round(pnl, 2),
        "returnPct": round(return_pct, 2)
    })
    
    # 计算统计
    real_total_pnl = sum(trade.get('pnl', 0) for trade in trades_list)
    
    print(f"初始计算:")
    print(f"- 预期总盈利: ${expected_profit_loss:.2f}")
    print(f"- 实际总盈利: ${real_total_pnl:.2f}")
    
    # 缩放因子计算
    scaling_factor = expected_profit_loss / real_total_pnl if real_total_pnl != 0 else 1
    print(f"- 缩放因子: {scaling_factor:.4f}")
    
    # 应用缩放
    if abs(scaling_factor - 1.0) > 0.1:
        print(f"- 需要缩放: 是 (差异 > 10%)")
        for trade in trades_list:
            trade['pnl'] = round(trade['pnl'] * scaling_factor, 2)
        
        # 重新计算
        real_total_pnl = sum(trade.get('pnl', 0) for trade in trades_list)
        print(f"- 缩放后总盈利: ${real_total_pnl:.2f}")
    else:
        print(f"- 需要缩放: 否")
    
    # 计算其他指标
    if real_trades == 1:
        if real_total_pnl > 0:
            real_win_rate = 100.0
            profit_factor = 99.0
            expectancy_pct = (real_total_pnl / initial_capital) * 100
        else:
            real_win_rate = 0.0
            profit_factor = 0.0
            expectancy_pct = (real_total_pnl / initial_capital) * 100
        
        real_avg_pnl = real_total_pnl
    else:
        # 不会执行，因为real_trades=1
        pass
    
    # 年化收益率
    annualized_return = ((1 + total_return/100) ** (252/days_diff) - 1) * 100
    
    # 最大回撤
    max_drawdown = -abs(total_return * 0.6)
    max_drawdown = max(min(max_drawdown, -2.0), -30.0)
    
    # Calmar Ratio
    calmar_ratio = annualized_return / abs(max_drawdown) if abs(max_drawdown) > 0 else 0
    
    # 构建响应
    response = {
        "totalReturn": round(total_return, 2),
        "annualizedReturn": round(annualized_return, 1),
        "profitLoss": round(real_total_pnl, 2),
        "trades": real_trades,
        "avgReturnPerTrade": round(real_avg_pnl, 2),
        "winRate": round(real_win_rate, 1),
        "profitFactor": round(profit_factor, 2),
        "expectancy": round(expectancy_pct, 2),
        "maxDrawdown": round(max_drawdown, 1),
        "calmarRatio": round(calmar_ratio, 2)
    }
    
    return response

# 运行测试
print("=== 测试当前后端逻辑 ===")
response = simulate_current_backend_logic()

print(f"\n模拟响应:")
for key, value in response.items():
    print(f"{key}: {value}")

print(f"\n与页面显示对比:")
print(f"页面显示:")
print(f"- Avg P&L per Trade: 0.00 (应为: ${response['avgReturnPerTrade']:,.2f})")
print(f"- Win Rate: 0.0% (应为: {response['winRate']}%)")
print(f"- Profit Factor: 99.00 (应为: {response['profitFactor']})")
print(f"- Expectancy: +15.50% (应为: {response['expectancy']}%)")
print(f"- Calmar Ratio: 1.12 (应为: {response['calmarRatio']})")

# 检查问题
print(f"\n问题分析:")
if response['avgReturnPerTrade'] == 0:
    print("❌ avgReturnPerTrade 为 0，可能缩放因子计算有问题")
else:
    print(f"✅ avgReturnPerTrade 正确: ${response['avgReturnPerTrade']:,.2f}")

if response['winRate'] == 0:
    print("❌ winRate 为 0%，应为 100%")
else:
    print(f"✅ winRate 正确: {response['winRate']}%")

# 计算预期的Calmar Ratio
expected_calmar = response['annualizedReturn'] / abs(response['maxDrawdown'])
if abs(response['calmarRatio'] - expected_calmar) > 0.01:
    print(f"❌ Calmar Ratio 计算错误: {response['calmarRatio']} (应为: {expected_calmar:.2f})")
else:
    print(f"✅ Calmar Ratio 正确: {response['calmarRatio']}")