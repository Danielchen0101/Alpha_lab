#!/usr/bin/env python3
"""
启动新的后端服务
"""

import os
import sys
import logging

# 设置环境变量
os.environ['FLASK_ENV'] = 'development'
os.environ['PORT'] = '8890'  # 使用不同的端口避免冲突
os.environ['HOST'] = '0.0.0.0'

# 确保使用正确的配置文件
config_path = os.path.join(os.path.dirname(__file__), '.env')
if os.path.exists(config_path):
    print(f"✅ 使用配置文件: {config_path}")
    
    # 读取环境变量
    with open(config_path, 'r') as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#'):
                key, value = line.split('=', 1)
                os.environ[key] = value
                print(f"   {key} = {'*' * len(value) if 'SECRET' in key or 'KEY' in key else value}")
else:
    print(f"❌ 配置文件不存在: {config_path}")
    sys.exit(1)

# 启动应用
if __name__ == '__main__':
    try:
        from app import app
        
        print("\n🚀 启动专业量化平台后端服务 (重构版本)")
        print("=" * 50)
        print(f"环境: {os.getenv('FLASK_ENV', 'development')}")
        print(f"地址: http://{os.getenv('HOST', '0.0.0.0')}:{os.getenv('PORT', '8890')}")
        print(f"市场数据: Polygon.io")
        print(f"交易执行: Alpaca Markets")
        print("=" * 50)
        
        # 启动Flask应用
        app.run(
            host=os.getenv('HOST', '0.0.0.0'),
            port=int(os.getenv('PORT', '8890')),
            debug=True,
            use_reloader=False
        )
    except Exception as e:
        print(f"❌ 启动失败: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)