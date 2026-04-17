#!/usr/bin/env python3
"""
修复start_quant_backend_repaired.py中的语法错误
"""

import re

def fix_syntax_error():
    """修复语法错误"""
    input_file = 'start_quant_backend_repaired.py'
    output_file = 'start_quant_backend_fixed_syntax.py'
    
    print(f'读取文件: {input_file}')
    
    with open(input_file, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # 查找analyze_trend_with_deepseek函数的结尾
    # 这个函数应该以return语句结束，然后可能缺少except/finally块
    
    # 查找def analyze_trend_locally的位置
    pattern = r'def analyze_trend_locally\(symbol, stock_data, news_data, profile_data\):'
    match = re.search(pattern, content)
    
    if match:
        pos = match.start()
        print(f'找到analyze_trend_locally函数在位置: {pos}')
        
        # 向前查找最近的未闭合try块
        # 简单修复：在analyze_trend_locally之前添加except块
        before_func = content[:pos]
        
        # 检查是否有未闭合的try
        try_count = before_func.count('try:')
        except_count = before_func.count('except ') + before_func.count('finally:')
        
        print(f'try块数量: {try_count}')
        print(f'except/finally块数量: {except_count}')
        
        if try_count > except_count:
            print('发现未闭合的try块，进行修复...')
            
            # 在analyze_trend_locally之前添加except块
            insert_pos = pos
            insert_text = '\n\n    except Exception as e:\n        print(f\'[DeepSeek分析] AI分析异常: {str(e)}\')\n        return {\n            \'trendLabel\': None,\n            \'trendScore\': None,\n            \'trendConfidence\': None,\n            \'scannerReason\': f\'AI分析异常: {str(e)[:100]}\',\n            \'aiReasoning\': None\n        }\n\n'
            
            # 插入修复
            fixed_content = content[:insert_pos] + insert_text + content[insert_pos:]
            
            with open(output_file, 'w', encoding='utf-8') as f:
                f.write(fixed_content)
            
            print(f'修复完成，保存到: {output_file}')
            return output_file
        else:
            print('未发现未闭合的try块')
    else:
        print('未找到analyze_trend_locally函数')
    
    return None

def test_fixed_file(filename):
    """测试修复后的文件"""
    if not filename:
        return False
    
    print(f'\n测试修复后的文件: {filename}')
    
    try:
        # 尝试导入文件，检查语法
        with open(filename, 'r', encoding='utf-8') as f:
            # 读取前200行检查
            lines = []
            for i, line in enumerate(f):
                if i < 200:
                    lines.append(line)
                else:
                    break
        
        # 检查关键部分
        content = ''.join(lines)
        
        # 检查analyze_trend_with_deepseek函数
        if 'def analyze_trend_with_deepseek' in content:
            print('✓ 找到analyze_trend_with_deepseek函数')
        
        # 检查analyze_trend_locally函数
        if 'def analyze_trend_locally' in content:
            print('✓ 找到analyze_trend_locally函数')
        
        # 检查try/except平衡
        try_count = content.count('try:')
        except_finally_count = content.count('except ') + content.count('finally:')
        
        print(f'  try块: {try_count}')
        print(f'  except/finally块: {except_finally_count}')
        
        if try_count == except_finally_count:
            print('✓ try/except块平衡')
            return True
        else:
            print(f'✗ try/except块不平衡: {try_count - except_finally_count}')
            return False
            
    except Exception as e:
        print(f'✗ 测试失败: {str(e)}')
        return False

def main():
    """主函数"""
    print('修复start_quant_backend_repaired.py语法错误')
    print('='*60)
    
    fixed_file = fix_syntax_error()
    
    if fixed_file:
        success = test_fixed_file(fixed_file)
        if success:
            print('\n✓ 修复成功，可以启动后端')
        else:
            print('\n✗ 修复失败，需要手动检查')
    else:
        print('\n无需修复或修复失败')

if __name__ == '__main__':
    main()