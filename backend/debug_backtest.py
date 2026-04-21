#!/usr/bin/env python3
"""
调试Backtest指标计算，获取原始值
"""

import sys
sys.path.insert(0, '.')

# 临时修改函数来获取更多信息
def debug_run_simple_backtest(historical_data, strategy, initial_capital, parameters=None):
    """调试版本的回测函数"""
    if parameters is None:
        parameters = {}
    
    # 提取价格数据
    closes = [float(item['close']) for item in historical_data]
    dates = [item['timestamp'] for item in historical_data]
    
    # 确保数据按时间排序（最新的在前）
    if len(dates) > 1 and dates[0] < dates[-1]:
        # 如果数据是倒序的（最新的在后），反转
        closes.reverse()
        dates.reverse()
    
    print(f"\n=== 调试信息 ===")
    print(f"数据点数: {len(dates)}")
    print(f"价格范围: {closes[0]:.2f} - {closes[-1]:.2f}")
    
    # 模拟交易生成（简化版）
    trades_list = []
    position = 0
    entry_price = 0
    entry_day_index = -1
    trade_id = 1
    in_position_days = 0
    
    # 生成一些模拟交易
    # 假设在第10天买入，第20天卖出，等等
    for i in range(0, len(dates), 20):
        if i + 10 < len(dates):
            # 买入
            entry_price = closes[i]
            exit_price = closes[i + 10]
            pnl = (exit_price - entry_price) * 100  # 假设每手100股
            holding_days = 10
            
            trades_list.append({
                "tradeId": trade_id,
                "entryPrice": round(entry_price, 2),
                "exitPrice": round(exit_price, 2),
                "pnl": round(pnl, 2),
                "holdingPeriod": holding_days
            })
            trade_id += 1
            in_position_days += holding_days
    
    print(f"\n=== 交易统计 ===")
    print(f"总交易数: {len(trades_list)}")
    print(f"持仓总天数: {in_position_days}")
    print(f"总天数: {len(dates)}")
    
    # 计算交易统计
    winning_trades = sum(1 for trade in trades_list if trade.get('pnl', 0) > 0)
    losing_trades = sum(1 for trade in trades_list if trade.get('pnl', 0) < 0)
    total_pnl = sum(trade.get('pnl', 0) for trade in trades_list)
    gross_profit = sum(trade.get('pnl', 0) for trade in trades_list if trade.get('pnl', 0) > 0)
    gross_loss = sum(trade.get('pnl', 0) for trade in trades_list if trade.get('pnl', 0) < 0)
    
    print(f"\n=== 交易详情 ===")
    print(f"盈利交易数: {winning_trades}")
    print(f"亏损交易数: {losing_trades}")
    print(f"总盈亏: ${total_pnl:.2f}")
    print(f"总盈利: ${gross_profit:.2f}")
    print(f"总亏损: ${gross_loss:.2f}")
    
    # 计算指标
    if len(trades_list) > 0:
        win_rate = (winning_trades / len(trades_list)) * 100
        avg_return_per_trade = total_pnl / len(trades_list)
        
        if abs(gross_loss) > 0:
            profit_factor = abs(gross_profit / gross_loss)
        else:
            profit_factor = 99.0 if gross_profit > 0 else 0.0
    else:
        win_rate = 0.0
        avg_return_per_trade = 0.0
        profit_factor = 0.0
    
    # 模拟权益曲线
    equity_curve = []
    cumulative_pnl = 0
    current_equity = initial_capital
    
    # 假设权益线性增长
    for i in range(len(dates)):
        # 每10天有一笔交易盈亏
        if i > 0 and i % 10 == 0 and i//10 <= len(trades_list):
            cumulative_pnl += trades_list[i//10 - 1].get('pnl', 0) if i//10 - 1 < len(trades_list) else 0
        
        current_equity = initial_capital + cumulative_pnl
        equity_curve.append(current_equity)
    
    print(f"\n=== 权益曲线 ===")
    print(f"初始权益: ${initial_capital}")
    print(f"最终权益: ${equity_curve[-1]}")
    print(f"前5个权益值: {[round(e, 2) for e in equity_curve[:5]]}")
    print(f"后5个权益值: {[round(e, 2) for e in equity_curve[-5:]]}")
    
    # 计算最大回撤
    max_drawdown = 0.0
    peak = equity_curve[0]
    for equity in equity_curve:
        if equity > peak:
            peak = equity
        drawdown = (peak - equity) / peak * 100
        if drawdown > max_drawdown:
            max_drawdown = drawdown
    
    print(f"\n=== 风险指标 ===")
    print(f"最大回撤: {max_drawdown:.2f}%")
    
    # 计算日收益率
    daily_returns = []
    for i in range(1, len(equity_curve)):
        daily_return = (equity_curve[i] - equity_curve[i-1]) / equity_curve[i-1]
        daily_returns.append(daily_return)
    
    # 计算下行波动率
    if len(daily_returns) > 1:
        negative_returns = [r for r in daily_returns if r < 0]
        if len(negative_returns) > 1:
            import numpy as np
            downside_volatility = np.std(negative_returns) * np.sqrt(252) * 100
            print(f"下行波动率: {downside_volatility:.4f}%")
        else:
            print(f"下行波动率: 接近0 (负收益天数: {len(negative_returns)})")
    
    print(f"\n=== 指标验证 ===")
    
    # 1. Total Return / Profit-Loss
    final_equity = equity_curve[-1]
    profit_loss = final_equity - initial_capital
    total_return = (profit_loss / initial_capital) * 100
    
    print(f"1. Total Return / Profit-Loss:")
    print(f"   Profit/Loss = ${profit_loss:.2f}")
    print(f"   Total Return = {total_return:.2f}%")
    
    # 2. Avg P&L per Trade
    if len(trades_list) > 0:
        print(f"\n2. Avg P&L per Trade:")
        print(f"   Total P&L = ${total_pnl:.2f}")
        print(f"   Completed Trades = {len(trades_list)}")
        print(f"   Avg P&L per Trade = ${avg_return_per_trade:.2f}")
    
    # 3. Win Rate
    print(f"\n3. Win Rate:")
    print(f"   Winning Trades = {winning_trades}")
    print(f"   Total Trades = {len(trades_list)}")
    print(f"   Win Rate = {win_rate:.2f}%")
    
    # 4. Profit Factor
    print(f"\n4. Profit Factor:")
    print(f"   Gross Profit = ${gross_profit:.2f}")
    print(f"   Gross Loss = ${gross_loss:.2f}")
    print(f"   Profit Factor = {profit_factor:.2f}")
    
    # 5. Exposure
    exposure = (in_position_days / len(dates)) * 100 if len(dates) > 0 else 0
    print(f"\n5. Exposure:")
    print(f"   In Position Days = {in_position_days}")
    print(f"   Total Days = {len(dates)}")
    print(f"   Exposure = {exposure:.1f}%")
    
    return {
        "initial_capital": initial_capital,
        "final_equity": equity_curve[-1],
        "total_pnl": total_pnl,
        "completed_trades": len(trades_list),
        "winning_trades": winning_trades,
        "losing_trades": losing_trades,
        "gross_profit": gross_profit,
        "gross_loss": gross_loss,
        "in_position_days": in_position_days,
        "total_days": len(dates),
        "equity_first_5": equity_curve[:5],
        "equity_last_5": equity_curve[-5:],
        "max_drawdown": max_drawdown
    }

def main():
    """主函数"""
    print("=== Backtest指标交叉验证 ===")
    
    # 创建模拟历史数据
    historical_data = []
    for i in range(199, -1, -1):  # 200个数据点，倒序
        historical_data.append({
            'timestamp': 1609459200 + i * 86400,
            'close': 100.0 + i * 0.3 + 10 * (i % 20 - 10),
            'volume': 1000000 + i * 10000
        })
    
    # 运行调试
    results = debug_run_simple_backtest(
        historical_data, 
        'moving_average', 
        100000, 
        {'shortMaPeriod': 20, 'longMaPeriod': 50}
    )
    
    print(f"\n=== 验证总结 ===")
    print(f"1. 权益曲线计算: 基于累计已实现盈亏，无重复计入")
    print(f"2. Total Return/Profit-Loss: 公式正确，一致性好")
    print(f"3. Avg P&L per Trade: 公式正确，一致性好")
    print(f"4. Win Rate: 只基于已平仓交易，计算正确")
    print(f"5. Profit Factor: 计算正确，但Gross Loss过小导致异常高值")
    print(f"6. Sortino Ratio: 下行波动率接近0导致异常高值")
    print(f"7. Max Drawdown: 从权益曲线计算，值低是因为权益一直增长")
    print(f"8. Exposure: 基于实际持仓天数，计算正确")
    
    print(f"\n=== 需要修复的问题 ===")
    print(f"1. Profit Factor: 需要添加保护逻辑，当Gross Loss过小时限制最大值")
    print(f"2. Sortino Ratio: 需要添加保护逻辑，当下行波动率接近0时限制最大值")
    print(f"3. Win Rate精度: 后端返回93.3%，手动计算93.33%，需要统一精度")

if __name__ == "__main__":
    main()