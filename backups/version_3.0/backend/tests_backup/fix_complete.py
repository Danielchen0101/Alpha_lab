# 修复整个文件的乱码
import re

with open('final_production.py', 'r', encoding='utf-8') as f:
    content = f.read()

# 修复所有乱码
replacements = [
    ('ͼ�����ݣ��޸��棩', '图表数据（修复版）'),
    ('���ݽṹ����', '数据结构错误'),
    ('�쳣', '异常'),
    ('��������ӷֲ�', '处理后分钟分布'),
    ('������ǰ10����', '处理后前10个点'),
    ('��ӡǰ10����', '# 打印前10个点'),
    ('Marketҳ���Dashboard��Ʊ�б��ӿ� - ʹ��Finnhub', 'Market页面和Dashboard股票列表接口 - 使用Finnhub'),
    ('������ (Finnhub)', '请求 (Finnhub)'),
    ('��ȡ����', '# 获取参数'),
]

for old, new in replacements:
    content = content.replace(old, new)

# 写入修复后的文件
with open('final_production.py', 'w', encoding='utf-8') as f:
    f.write(content)

print('修复完成')