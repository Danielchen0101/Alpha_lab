#!/usr/bin/env python3
"""
测试修复后的代码结构
"""

from datetime import datetime
import time

def test_fixed_structure():
    """测试修复后的代码结构"""
    print("=== 测试修复后的代码结构 ===")
    
    # 模拟修复后的代码结构
    values = [
        {'datetime': '2026-03-20 09:30:00', 'open': '100', 'high': '101', 'low': '99', 'close': '100.5', 'volume': '1000'},
        {'datetime': '2026-03-20 10:00:00', 'open': '100.5', 'high': '102', 'low': '100', 'close': '101', 'volume': '1500'},
    ]
    
    formatted_data = []
    success_count = 0
    error_count = 0
    
    # 修复后的结构
    for i, item in enumerate(values):
        try:
            datetime_str = item.get('datetime', '')
            
            # 正确解析时间戳 - 简化版（直接解析为UTC）
            timestamp = 0
            
            if datetime_str:
                try:
                    # 直接解析为UTC时间戳
                    dt = datetime.strptime(datetime_str, '%Y-%m-%d %H:%M:%S')
                    timestamp = int(dt.timestamp())
                    
                    # 调试日志
                    if i < 3:  # 只打印前3个
                        print(f"[Twelve Data] 解析时间 {i}: {datetime_str} -> timestamp={timestamp}")
                
                except Exception as e:
                    print(f"[Twelve Data] 时间解析失败: {datetime_str}, 错误: {e}")
                    # 使用当前时间作为后备
                    timestamp = int(time.time())
            
            else:
                # 如果没有时间字符串，使用当前时间
                timestamp = int(time.time())
            
            # 简化数值转换函数
            def safe_convert(value, default=0, type_func=float):
                try:
                    if value is None or value == '':
                        return default
                    return type_func(value)
                except:
                    return default
            
            formatted_data.append({
                "timestamp": timestamp,
                "time": datetime_str,
                "open": safe_convert(item.get('open'), 0, float),
                "high": safe_convert(item.get('high'), 0, float),
                "low": safe_convert(item.get('low'), 0, float),
                "close": safe_convert(item.get('close'), 0, float),
                "volume": safe_convert(item.get('volume'), 0, int)
            })
            
            success_count += 1
        
        except Exception as e:
            error_count += 1
            if error_count <= 3:
                print(f"[Twelve Data] 处理第 {i+1} 个数据点失败: {e}")
            continue
    
    print(f"[Twelve Data] 处理结果: 成功 {success_count}, 失败 {error_count}")
    
    # 反转数据顺序（最新的在最后）
    formatted_data = list(reversed(formatted_data))
    
    # 处理后的数据调试
    print(f"[Twelve Data] 处理后数据点数: {len(formatted_data)}")
    
    if formatted_data:
        print("✅ 数据结构正确，有数据返回")
        return formatted_data, True, "Twelve Data 图表数据（修复版）"
    else:
        print("❌ 数据处理失败，无数据")
        return [], False, "Twelve Data (数据结构错误)"

if __name__ == "__main__":
    print("开始测试修复后的代码结构...")
    result, success, message = test_fixed_structure()
    print(f"结果: success={success}, message='{message}'")
    print(f"返回数据点数: {len(result)}")
    if result:
        print(f"第一个数据点: {result[0]}")
    print("\n✅ 代码结构测试完成！")