import subprocess
import sys
import os

print("启动后端服务 (禁用reloader)")
print("=" * 60)

# 切换到backend目录
os.chdir(r"C:\Users\kexuc\.openclaw\workspace\professional_quant_platform\backend")

# 启动命令 - 禁用reloader，使用debug模式但不要自动重启
cmd = [
    sys.executable,  # 使用当前python解释器
    "quant_backend.py"
]

print(f"启动命令: {' '.join(cmd)}")
print(f"工作目录: {os.getcwd()}")
print(f"禁用reloader: 在代码中设置 debug=False")

# 直接运行，不等待
process = subprocess.Popen(
    cmd,
    stdout=subprocess.PIPE,
    stderr=subprocess.STDOUT,
    text=True,
    encoding='utf-8',
    errors='ignore'
)

print(f"进程已启动，PID: {process.pid}")
print("等待3秒让服务启动...")
import time
time.sleep(3)

# 读取一些输出
print("\n服务输出:")
try:
    for _ in range(5):  # 读取前5行输出
        line = process.stdout.readline()
        if line:
            print(f"  {line.strip()}")
        else:
            break
except:
    pass

print(f"\n服务正在运行，PID: {process.pid}")
print("现在可以测试API了")