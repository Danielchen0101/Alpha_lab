import re

# 读取备份文件
with open('backups/version_3.0/backend/start_quant_backend_backup.py', 'r', encoding='utf-8') as f:
    content = f.read()

# 找到run_backtest函数的开始和结束
start = content.find('@app.route(\'/backtest/run\'')
end = content.find('@app.route(\'/backtest/results/\'', start)
if end == -1:
    # 如果找不到，找下一个def
    end = content.find('def ', start + 1000)
    # 找到这个def的结束（下一个def的开始）
    end = content.find('def ', end + 1)

backtest_code = content[start:end]

print(f"提取的Backtest代码长度: {len(backtest_code)}")
print("=" * 80)
print(backtest_code[:500])
print("..." if len(backtest_code) > 500 else "")
print("=" * 80)

# 保存到文件
with open('backtest_restored.py', 'w', encoding='utf-8') as f:
    f.write(backtest_code)

print("已保存到 backtest_restored.py")