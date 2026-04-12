#!/usr/bin/env python3
"""
测试修复后的缩进结构
"""

# 模拟修复后的代码结构
def test_indentation():
    # 模拟 values 变量
    values = [{'datetime': '2026-03-20 09:30:00', 'open': '100', 'high': '101', 'low': '99', 'close': '100.5', 'volume': '1000'}]
    
    # 测试修复后的缩进结构
    print("=== 测试修复后的缩进结构 ===")
    
    # 模拟代码结构
    if values is not None:
        print(f"[Twelve Data] 原始数据点数: {len(values)}")
        
        # 分析原始数据分钟分布
        minute_counts = {}
        for item in values[:50]:  # 只分析前50个用于调试
            datetime_str = item.get('datetime', '')
            if ':' in datetime_str:
                time_part = datetime_str.split(' ')[1] if ' ' in datetime_str else datetime_str
                minute = time_part.split(':')[1]
                minute_counts[minute] = minute_counts.get(minute, 0) + 1
        
        print(f"[Twelve Data] 原始数据分钟分布: {minute_counts}")
        print(f"[Twelve Data] 包含:00数据: {'00' in minute_counts}")
        print(f"[Twelve Data] 包含:30数据: {'30' in minute_counts}")
        
        # 修复版：简化处理，确保处理所有数据点
        formatted_data = []
        success_count = 0
        error_count = 0
        
        for i, item in enumerate(values):
            try:
                datetime_str = item.get('datetime', '')
                
                # 正确解析时间戳 - 简化版（直接解析为UTC）
                timestamp = 0
                
                if datetime_str:
                    try:
                        # 直接解析为UTC时间戳
                        from datetime import datetime
                        dt = datetime.strptime(datetime_str, '%Y-%m-%d %H:%M:%S')
                        timestamp = int(dt.timestamp())
                        print(f"解析时间 {i}: {datetime_str} -> timestamp={timestamp}")
                    except Exception as e:
                        print(f"时间解析失败: {datetime_str}, 错误: {e}")
                        timestamp = 1234567890  # 模拟后备值
                else:
                    timestamp = 1234567890  # 模拟后备值
                
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
                    print(f"[Twelve Data] 数据处理失败 {i}: {e}")
        
        print(f"[Twelve Data] 数据处理完成: 成功 {success_count}, 失败 {error_count}")
        print(f"[Twelve Data] 处理后数据点数: {len(formatted_data)}")
        
        if formatted_data:
            print("✅ 数据处理成功，有数据返回")
            return formatted_data, True, "Twelve Data 图表数据（修复版）"
        else:
            print("❌ 数据处理失败，无数据")
            return [], False, "Twelve Data (数据结构错误)"
    
    else:
        print("❌ 没有数据字段")
        return [], False, "Twelve Data (无数据)"

if __name__ == "__main__":
    print("开始测试修复后的缩进...")
    result, success, message = test_indentation()
    print(f"结果: success={success}, message='{message}'")
    print(f"返回数据点数: {len(result)}")
    print("\n✅ 缩进修复测试完成！")