#!/usr/bin/env python3
"""
技术指标计算模块
为AI分析提供真实的技术指标数据
"""

import numpy as np
from typing import Dict, List, Optional, Tuple

def calculate_simple_technical_indicators(price_data: Dict) -> Dict:
    """
    基于价格数据计算简单的技术指标
    参数:
        price_data: 包含价格信息的字典，至少需要:
            - price: 当前价格
            - changePercent: 涨跌幅
            - volume: 成交量
            - dayHigh: 当日最高价
            - dayLow: 当日最低价
            - open: 开盘价
    返回:
        包含技术指标的字典
    """
    try:
        indicators = {}
        
        # 提取数据
        current_price = price_data.get('price')
        change_pct = price_data.get('changePercent', 0)
        volume = price_data.get('volume', 0)
        day_high = price_data.get('dayHigh')
        day_low = price_data.get('dayLow')
        open_price = price_data.get('open')
        
        # 1. 价格相对位置
        if day_high and day_low and current_price:
            price_range = day_high - day_low
            if price_range > 0:
                price_position = (current_price - day_low) / price_range * 100
                indicators['pricePosition'] = round(price_position, 2)  # 0-100，越高越接近当日高点
            else:
                indicators['pricePosition'] = 50.0
        else:
            indicators['pricePosition'] = 50.0
        
        # 2. 涨跌幅分析
        if change_pct is not None:
            indicators['changePct'] = round(change_pct, 2)
            # 涨跌幅强度
            if abs(change_pct) > 5:
                change_strength = 'Strong'
            elif abs(change_pct) > 2:
                change_strength = 'Moderate'
            else:
                change_strength = 'Weak'
            indicators['changeStrength'] = change_strength
        else:
            indicators['changePct'] = 0.0
            indicators['changeStrength'] = 'Unknown'
        
        # 3. 成交量分析（简单版）
        if volume:
            # 假设正常成交量为100万
            normal_volume = 1000000
            volume_ratio = volume / normal_volume
            indicators['volumeRatio'] = round(volume_ratio, 2)
            
            if volume_ratio > 2:
                volume_status = 'High'
            elif volume_ratio > 0.5:
                volume_status = 'Normal'
            else:
                volume_status = 'Low'
            indicators['volumeStatus'] = volume_status
        else:
            indicators['volumeRatio'] = 0.0
            indicators['volumeStatus'] = 'Unknown'
        
        # 4. 波动率分析
        if day_high and day_low and current_price:
            daily_range = day_high - day_low
            if current_price > 0:
                daily_volatility = (daily_range / current_price) * 100
                indicators['dailyVolatility'] = round(daily_volatility, 2)
                
                if daily_volatility > 5:
                    volatility_level = 'High'
                elif daily_volatility > 2:
                    volatility_level = 'Medium'
                else:
                    volatility_level = 'Low'
                indicators['volatilityLevel'] = volatility_level
            else:
                indicators['dailyVolatility'] = 0.0
                indicators['volatilityLevel'] = 'Unknown'
        else:
            indicators['dailyVolatility'] = 0.0
            indicators['volatilityLevel'] = 'Unknown'
        
        # 5. 价格结构分析
        if current_price and open_price:
            if current_price > open_price:
                structure = 'Bullish'
            elif current_price < open_price:
                structure = 'Bearish'
            else:
                structure = 'Neutral'
            indicators['priceStructure'] = structure
            
            # 计算相对强度
            if open_price > 0:
                intraday_change = ((current_price - open_price) / open_price) * 100
                indicators['intradayChange'] = round(intraday_change, 2)
            else:
                indicators['intradayChange'] = 0.0
        else:
            indicators['priceStructure'] = 'Unknown'
            indicators['intradayChange'] = 0.0
        
        # 6. 动量分析
        if change_pct is not None:
            if change_pct > 2:
                momentum = 'Strong Bullish'
            elif change_pct > 0.5:
                momentum = 'Bullish'
            elif change_pct < -2:
                momentum = 'Strong Bearish'
            elif change_pct < -0.5:
                momentum = 'Bearish'
            else:
                momentum = 'Neutral'
            indicators['momentum'] = momentum
        else:
            indicators['momentum'] = 'Unknown'
        
        print(f"[技术指标] 计算完成: {indicators}")
        return indicators
        
    except Exception as e:
        print(f"[技术指标] 计算错误: {str(e)}")
        return {
            'pricePosition': 50.0,
            'changePct': 0.0,
            'changeStrength': 'Unknown',
            'volumeRatio': 0.0,
            'volumeStatus': 'Unknown',
            'dailyVolatility': 0.0,
            'volatilityLevel': 'Unknown',
            'priceStructure': 'Unknown',
            'intradayChange': 0.0,
            'momentum': 'Unknown'
        }

def generate_technical_summary(indicators: Dict) -> str:
    """
    基于技术指标生成文本摘要
    """
    summary_parts = []
    
    # 价格位置
    price_pos = indicators.get('pricePosition', 50)
    if price_pos > 70:
        summary_parts.append(f"价格位于当日高位 ({price_pos}%)")
    elif price_pos < 30:
        summary_parts.append(f"价格位于当日低位 ({price_pos}%)")
    else:
        summary_parts.append(f"价格位于当日中位 ({price_pos}%)")
    
    # 涨跌幅
    change_pct = indicators.get('changePct', 0)
    change_str = indicators.get('changeStrength', 'Unknown')
    if change_pct != 0:
        direction = "上涨" if change_pct > 0 else "下跌"
        summary_parts.append(f"{direction} {abs(change_pct):.2f}% ({change_str})")
    
    # 成交量
    volume_status = indicators.get('volumeStatus', 'Unknown')
    volume_ratio = indicators.get('volumeRatio', 0)
    if volume_status != 'Unknown':
        summary_parts.append(f"成交量: {volume_status} (相对倍数: {volume_ratio:.1f}x)")
    
    # 波动率
    volatility = indicators.get('volatilityLevel', 'Unknown')
    daily_vol = indicators.get('dailyVolatility', 0)
    if volatility != 'Unknown':
        summary_parts.append(f"日内波动率: {volatility} ({daily_vol:.1f}%)")
    
    # 价格结构
    structure = indicators.get('priceStructure', 'Unknown')
    intraday_change = indicators.get('intradayChange', 0)
    if structure != 'Unknown':
        summary_parts.append(f"日内结构: {structure} ({intraday_change:+.2f}%)")
    
    # 动量
    momentum = indicators.get('momentum', 'Unknown')
    if momentum != 'Unknown':
        summary_parts.append(f"动量: {momentum}")
    
    return " | ".join(summary_parts)

if __name__ == '__main__':
    # 测试代码
    test_data = {
        'price': 175.25,
        'changePercent': 1.5,
        'volume': 1500000,
        'dayHigh': 176.50,
        'dayLow': 174.80,
        'open': 175.00
    }
    
    print("测试技术指标计算:")
    indicators = calculate_simple_technical_indicators(test_data)
    print(f"技术指标: {indicators}")
    
    summary = generate_technical_summary(indicators)
    print(f"技术摘要: {summary}")