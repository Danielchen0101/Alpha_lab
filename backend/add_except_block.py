"""
添加顶层except块到analyze_trend_with_deepseek函数
"""

import re

def add_top_level_except():
    """添加顶层except块"""
    file_path = "start_quant_backend_repaired.py"
    
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # 查找模式：函数的最后一个返回语句后跟多个空行，然后是下一个函数定义
    pattern = r'(\s*\}\s*\n\s*\n\s*\n\s*\n)(def analyze_trend_locally)'
    
    # 替换内容
    replacement = r'''    }
    
    except Exception as e:
        print(f'[DeepSeek分析] 外层异常: {str(e)}')
        return {
            'trendLabel': None,
            'trendScore': None,
            'trendConfidence': None,
            'scannerReason': None,
            'trendScoreDetail': None,
            'momentumScore': None,
            'volumeScore': None,
            'volatilityScore': None,
            'structureScore': None,
            'newsScore': None,
            'aiReasoning': f'分析异常: {str(e)}'
        }


\2'''
    
    # 执行替换
    new_content = re.sub(pattern, replacement, content, flags=re.DOTALL)
    
    if new_content != content:
        # 创建备份
        backup_path = file_path + '.except_backup'
        with open(backup_path, 'w', encoding='utf-8') as f:
            f.write(content)
        
        # 写入新内容
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(new_content)
        
        print(f"已创建备份: {backup_path}")
        print("已添加顶层except块")
        return True
    else:
        print("未找到匹配的模式")
        return False

def check_syntax():
    """检查语法"""
    import subprocess
    
    try:
        result = subprocess.run(
            ['python', '-m', 'py_compile', 'start_quant_backend_repaired.py'],
            capture_output=True,
            text=True,
            timeout=10
        )
        
        if result.returncode == 0:
            print("语法检查通过!")
            return True
        else:
            print(f"语法错误:\n{result.stderr}")
            return False
    except Exception as e:
        print(f"语法检查失败: {e}")
        return False

def main():
    print("开始添加顶层except块...")
    
    if add_top_level_except():
        if check_syntax():
            print("\n修复成功! 现在可以尝试启动后端:")
            print("python start_quant_backend_repaired.py")
        else:
            print("\n语法检查失败，请手动修复")
    else:
        print("添加except块失败")

if __name__ == "__main__":
    main()