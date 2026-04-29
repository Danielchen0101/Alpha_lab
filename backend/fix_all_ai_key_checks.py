#!/usr/bin/env python3
"""
修复所有AI key检查点
"""

import re

def fix_ai_key_checks():
    """修复所有AI key检查点"""
    input_file = 'start_quant_backend.py'
    
    with open(input_file, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # 查找所有api_key = ai_provider_config_state.get('apiKey', '')模式
    pattern = r"api_key\s*=\s*ai_provider_config_state\.get\('apiKey',\s*''\)"
    
    # 统计找到的数量
    matches = list(re.finditer(pattern, content))
    print(f"找到 {len(matches)} 个API key检查点")
    
    # 修改每个检查点，添加严格的用户key验证
    for i, match in enumerate(matches):
        start = match.start()
        end = match.end()
        
        # 获取上下文
        context_start = max(0, start - 100)
        context_end = min(len(content), end + 100)
        context = content[context_start:context_end]
        
        print(f"\n=== 检查点 {i+1} ===")
        print(f"位置: {start}-{end}")
        print(f"上下文: ...{context}...")
    
    # 由于文件较大，我们直接修改关键函数
    # 1. 修改analyze_trend_with_deepseek函数中的key检查
    old_check = """        # 检查是否有用户配置的API密钥
        api_key = ai_provider_config_state.get('apiKey', '')
        
        print(f'[DeepSeek分析] API密钥检查: 长度={len(api_key)}, 前10位={api_key[:10] if api_key else "N/A"}')
        print(f'[DeepSeek分析] AI配置状态: {ai_provider_config_state}')

        # 严格验证：必须由用户在AI Configuration页面配置API密钥
        if not api_key or api_key.strip() == '':
            print(f'[DeepSeek分析] 错误: 用户未在AI Configuration页面配置API密钥 {symbol}')
            return {
                'error': 'No user-provided AI API key found',
                'stage': 'ai_config',
                'provider': ai_provider_config_state.get('provider', 'DeepSeek'),
                'trendLabel': None,"""
    
    new_check = """        # 检查是否有用户配置的API密钥 - 必须由用户在AI Configuration页面输入
        api_key = ai_provider_config_state.get('apiKey', '')
        
        print(f'[DeepSeek分析] API密钥检查: 长度={len(api_key)}, 前10位={api_key[:10] if api_key else "N/A"}')
        print(f'[DeepSeek分析] AI配置状态: {ai_provider_config_state}')

        # 严格验证：必须由用户在AI Configuration页面配置API密钥
        # 禁止使用任何默认/硬编码/配置文件中的key
        if not api_key or api_key.strip() == '':
            print(f'[DeepSeek分析] 错误: 用户未在AI Configuration页面配置API密钥 {symbol}')
            print(f'[DeepSeek分析] 用户必须在AI Configuration页面输入并保存自己的DeepSeek API密钥')
            return {
                'error': 'No user-provided AI API key found. Please configure your API key in the AI Configuration page.',
                'stage': 'ai_config',
                'provider': ai_provider_config_state.get('provider', 'DeepSeek'),
                'trendLabel': None,"""
    
    if old_check in content:
        content = content.replace(old_check, new_check)
        print("\n✅ 已修改analyze_trend_with_deepseek函数的key检查")
    else:
        print("\n⚠️  未找到analyze_trend_with_deepseek函数的key检查，可能已被修改")
    
    # 2. 修改其他AI分析函数中的key检查
    # 查找其他可能的地方
    other_patterns = [
        r"ai_api_key\s*=\s*ai_provider_config_state\.get\('apiKey',\s*''\)",
        r"apiKey.*=.*ai_provider_config_state\.get\('apiKey'"
    ]
    
    for pattern in other_patterns:
        matches = list(re.finditer(pattern, content))
        if matches:
            print(f"\n找到 {len(matches)} 个其他API key检查点: {pattern}")
            for match in matches:
                print(f"  位置: {match.start()}-{match.end()}")
    
    # 保存修改
    output_file = 'start_quant_backend_fixed_keys.py'
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write(content)
    
    print(f"\n✅ 修改已保存到: {output_file}")
    
    # 检查语法
    import subprocess
    result = subprocess.run(['py', '-m', 'py_compile', output_file], 
                          capture_output=True, text=True)
    
    if result.returncode == 0:
        print("✅ 语法检查: 通过")
    else:
        print("❌ 语法检查: 失败")
        print(f"错误: {result.stderr[:200]}")

if __name__ == '__main__':
    fix_ai_key_checks()