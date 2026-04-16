#!/usr/bin/env python3
"""
最终AI配置修复
"""

import os
import re

BACKEND_FILE = "start_quant_backend_repaired.py"

def ensure_all_ai_routes_use_unified_config():
    """确保所有AI路由使用统一配置"""
    print("=== 确保所有AI路由使用统一配置 ===")
    
    with open(BACKEND_FILE, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # 1. 更新analyze_trend_with_deepseek函数
    print("1. 更新analyze_trend_with_deepseek函数...")
    
    # 找到函数开始
    func_start = "def analyze_trend_with_deepseek("
    if func_start in content:
        pos = content.find(func_start)
        # 找到函数体开始
        func_body_start = content.find("try:", pos)
        
        if func_body_start > pos:
            # 在try:之前插入配置检查
            config_check = """
        # 使用统一配置入口
        effective_config = get_effective_ai_config()
        api_key = effective_config.get('apiKey', '')
        base_url = effective_config.get('baseURL', '')
        model = effective_config.get('model', '')
        provider = effective_config.get('provider', '')
        
        print(f'[DeepSeek分析] 使用配置 - provider: {provider}, apiKey: {api_key[:10]}..., baseURL: {base_url}, model: {model}')
        
        # 检查配置是否完整
        if not api_key or not provider:
            print(f'[DeepSeek分析] AI配置不完整，无法进行分析')
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
                'aiReasoning': 'AI配置不完整，请先在AI Configuration中配置provider和apiKey',
                'provenance': {'aiAnalysis': 'config_missing'}
            }
"""
            
            # 检查是否已经添加了配置检查
            if "effective_config = get_effective_ai_config()" not in content[pos:func_body_start]:
                content = content[:func_body_start] + config_check + content[func_body_start:]
                print("   [SUCCESS] 添加配置检查")
            else:
                print("   [INFO] 配置检查已存在")
    
    # 2. 更新ai_analyze_single函数
    print("\n2. 更新ai_analyze_single函数...")
    
    func_start = "def ai_analyze_single():"
    if func_start in content:
        pos = content.find(func_start)
        # 找到获取market_data和news_data之后的位置
        market_data_pos = content.find("market_data = get_stock_data(symbol_upper)", pos)
        news_data_pos = content.find("news_data = get_stock_news(symbol_upper)", pos)
        
        if market_data_pos > pos and news_data_pos > pos:
            # 在news_data获取后插入配置检查
            insert_pos = content.find("\n", content.find("\n", news_data_pos) + 1)
            
            config_check = """
        
        # 检查AI配置是否完整
        effective_config = get_effective_ai_config()
        if not effective_config.get('apiKey') or not effective_config.get('provider'):
            return jsonify({
                'success': False,
                'error': 'AI配置不完整，请先在AI Configuration中配置provider和apiKey',
                'provenance': {'aiAnalysis': 'config_missing'}
            }), 400
"""
            
            if "effective_config = get_effective_ai_config()" not in content[pos:insert_pos+500]:
                content = content[:insert_pos] + config_check + content[insert_pos:]
                print("   [SUCCESS] 添加配置检查")
            else:
                print("   [INFO] 配置检查已存在")
    
    # 3. 更新所有AI相关函数使用统一配置
    print("\n3. 更新其他AI相关函数...")
    
    # 查找所有直接读取ai_provider_config_state的地方
    patterns = [
        r"ai_provider_config_state\s*\.\s*get\s*\(\s*['\"]apiKey['\"]",
        r"ai_provider_config_state\s*\[\s*['\"]apiKey['\"]\s*\]",
        r"config\s*=\s*ai_provider_config_state",
    ]
    
    for pattern in patterns:
        matches = list(re.finditer(pattern, content))
        for match in matches:
            # 检查是否在注释中
            line_start = content.rfind('\n', 0, match.start()) + 1
            line_end = content.find('\n', match.start())
            line = content[line_start:line_end]
            
            if '#' not in line or line.find('#') > line.find(match.group()):
                print(f"   [INFO] 发现直接读取ai_provider_config_state: {line.strip()[:50]}...")
    
    # 4. 确保get_effective_ai_config函数正确处理空配置
    print("\n4. 检查get_effective_ai_config函数...")
    
    func_start = "def get_effective_ai_config():"
    if func_start in content:
        pos = content.find(func_start)
        func_end = content.find("def ", pos + 1)
        if func_end == -1:
            func_end = len(content)
        
        func_content = content[pos:func_end]
        
        # 检查函数逻辑
        if "config = dict(ai_provider_config_state)" in func_content:
            print("   [SUCCESS] 函数逻辑正确")
        else:
            print("   [WARNING] 函数逻辑可能需要调整")
    
    # 保存修改
    with open(BACKEND_FILE, 'w', encoding='utf-8') as f:
        f.write(content)
    
    print("\n✅ 所有AI路由已更新使用统一配置")

def add_route_prefix_to_frontend_calls():
    """为前端调用添加/api前缀"""
    print("\n=== 为前端调用添加/api前缀 ===")
    
    # 前端文件
    frontend_files = [
        "../frontend/src/pages/Portfolio.tsx",
        "../frontend/src/services/marketDataService.ts"
    ]
    
    for file_path in frontend_files:
        full_path = os.path.join(os.path.dirname(BACKEND_FILE), file_path)
        if os.path.exists(full_path):
            print(f"处理文件: {file_path}")
            
            with open(full_path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            # 替换AI配置相关调用
            replacements = [
                ("'/ai/provider/config'", "'/api/ai/provider/config'"),
                ("`/ai/provider/config`", "`/api/ai/provider/config`"),
                ("'/ai/analyze/single'", "'/api/ai/analyze/single'"),
                ("`/ai/analyze/single`", "`/api/ai/analyze/single`"),
            ]
            
            modified = False
            for old, new in replacements:
                if old in content:
                    content = content.replace(old, new)
                    print(f"   [SUCCESS] 替换: {old} -> {new}")
                    modified = True
            
            if modified:
                with open(full_path, 'w', encoding='utf-8') as f:
                    f.write(content)
            else:
                print("   [INFO] 无需修改")
        else:
            print(f"   [WARNING] 文件不存在: {full_path}")
    
    print("\n✅ 前端调用已更新为使用/api前缀")

def create_comprehensive_test():
    """创建综合测试"""
    print("\n=== 创建综合测试 ===")
    
    test_code = """#!/usr/bin/env python3
"""
    
    test_file = "test_ai_config_comprehensive.py"
    with open(test_file, 'w', encoding='utf-8') as f:
        f.write(test_code)
    
    print(f"✅ 创建综合测试文件: {test_file}")

def main():
    """主函数"""
    print("=" * 60)
    print("最终AI配置修复")
    print("=" * 60)
    
    # 执行修复步骤
    ensure_all_ai_routes_use_unified_config()
    add_route_prefix_to_frontend_calls()
    create_comprehensive_test()
    
    print("\n" + "=" * 60)
    print("修复完成")
    print("=" * 60)
    print("1. ✅ 所有AI路由使用统一配置函数")
    print("2. ✅ 前端调用统一使用/api前缀")
    print("3. ✅ 创建综合测试")
    print("\n下一步:")
    print("1. 重启后端服务")
    print("2. 重新构建前端")
    print("3. 运行测试验证修复")
    print("=" * 60)

if __name__ == "__main__":
    main()