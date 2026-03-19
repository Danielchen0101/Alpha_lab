import psutil
import os

print("检查当前运行的Python进程")
print("=" * 60)

# 查找监听8889端口的进程
for proc in psutil.process_iter(['pid', 'name', 'cmdline']):
    try:
        if proc.info['name'] == 'python.exe':
            pid = proc.info['pid']
            cmdline = proc.info['cmdline']
            if cmdline and len(cmdline) > 1:
                script_path = cmdline[-1]
                print(f"PID: {pid}")
                print(f"脚本: {script_path}")
                print(f"完整命令行: {cmdline}")
                print("-" * 40)
                
                # 检查是否在监听8889端口
                try:
                    connections = proc.connections()
                    for conn in connections:
                        if conn.status == psutil.CONN_LISTEN and conn.laddr.port == 8889:
                            print(f"✅ 此进程正在监听8889端口")
                            print(f"工作目录: {proc.cwd()}")
                            
                            # 读取脚本内容
                            if os.path.exists(script_path):
                                with open(script_path, 'r', encoding='utf-8') as f:
                                    first_lines = [f.readline() for _ in range(10)]
                                print(f"脚本前10行:")
                                for line in first_lines:
                                    print(f"  {line.strip()}")
                            break
                except:
                    pass
    except (psutil.NoSuchProcess, psutil.AccessDenied):
        continue