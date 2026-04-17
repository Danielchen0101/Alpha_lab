"""
修复后端启动问题
"""

import os
import re

def fix_indentation_issues():
    """修复缩进问题"""
    file_path = "start_quant_backend_repaired.py"
    
    if not os.path.exists(file_path):
        print(f"文件不存在: {file_path}")
        return False
    
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # 修复1: 第10199行附近的缩进
    lines = content.split('\n')
    
    # 查找并修复缩进问题
    for i, line in enumerate(lines):
        # 修复 if not api_key or not provider: 后面的缩进
        if 'if not api_key or not provider:' in line and i < len(lines) - 1:
            # 确保下一行有正确的缩进
            if lines[i+1].strip() and not lines[i+1].startswith('    '):
                # 添加缩进
                lines[i+1] = '    ' + lines[i+1]
    
    # 修复2: 删除多余的prompt字符串
    fixed_content = '\n'.join(lines)
    
    # 查找并删除重复的prompt结束部分
    pattern = r'}}"""\s*\n\s*"volumeScore":.*?\n\s*}}"""'
    fixed_content = re.sub(pattern, '}}"""', fixed_content, flags=re.DOTALL)
    
    # 修复3: 确保try-except匹配
    # 统计try和except的数量
    try_count = fixed_content.count('\ntry:')
    except_count = fixed_content.count('\nexcept')
    
    print(f"try数量: {try_count}, except数量: {except_count}")
    
    if try_count != except_count:
        print(f"警告: try-except不匹配 (try: {try_count}, except: {except_count})")
    
    # 保存修复后的文件
    backup_path = file_path + '.backup'
    with open(backup_path, 'w', encoding='utf-8') as f:
        f.write(content)
    
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(fixed_content)
    
    print(f"已创建备份: {backup_path}")
    print(f"已修复文件: {file_path}")
    
    return True

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
    print("开始修复后端启动问题...")
    
    # 1. 修复缩进问题
    if not fix_indentation_issues():
        print("修复缩进问题失败")
        return
    
    # 2. 检查语法
    if not check_syntax():
        print("语法检查失败，请手动修复")
        return
    
    print("\n修复完成!")
    print("现在可以尝试启动后端:")
    print("python start_quant_backend_repaired.py")

if __name__ == "__main__":
    main()