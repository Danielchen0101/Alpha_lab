# 修复第2500-2530行区域
import re

with open('final_production.py', 'r', encoding='utf-8') as f:
    content = f.read()

# 查找并修复这个区域
# 模式：从"处理后前10个点:"到"except Exception as e:"
pattern = r'(print\(f"\[Twelve Data\] 处理后前10个点:"\).*?)(except Exception as e:)'

def fix_region(match):
    region = match.group(1)
    
    # 修复乱码
    region = region.replace('ͼ�����ݣ��޸��棩', '图表数据（修复版）')
    region = region.replace('���ݽṹ����', '数据结构错误')
    
    return region + match.group(2)

# 使用DOTALL标志匹配多行
fixed_content = re.sub(pattern, fix_region, content, flags=re.DOTALL)

with open('final_production.py', 'w', encoding='utf-8') as f:
    f.write(fixed_content)

print('修复完成')