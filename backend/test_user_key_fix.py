#!/usr/bin/env python3
"""
测试用户key修复效果
"""

import json
import os

def test_current_config():
    """测试当前配置状态"""
    print("="*60)
    print("测试用户key修复效果")
    print("="*60)
    
    # 1. 检查当前后端文件中的硬编码key
    print("\n1. 检查后端文件中的硬编码key:")
    with open('start_quant_backend.py', 'r', encoding='utf-8') as f:
        content = f.read()
    
    # 检查是否还有硬编码的sk-83365246617844178bf8d1e121b7279f
    if 'sk-83365246617844178bf8d1e121b7279f' in content:
        print("  ❌ 后端文件中仍然包含硬编码的无效API密钥")
        # 查找位置
        lines = content.split('\n')
        for i, line in enumerate(lines):
            if 'sk-83365246617844178bf8d1e121b7279f' in line:
                print(f"    第{i+1}行: {line.strip()[:80]}")
    else:
        print("  ✅ 后端文件中已移除硬编码的无效API密钥")
    
    # 检查ai_provider_config_state初始化
    if "'apiKey': 'sk-83365246617844178bf8d1e121b7279f'" in content:
        print("  ❌ ai_provider_config_state仍然包含硬编码key")
    elif "'apiKey': ''" in content or '"apiKey": ""' in content:
        print("  ✅ ai_provider_config_state的apiKey已清空")
    else:
        print("  ⚠️  无法确定ai_provider_config_state的apiKey状态")
    
    # 2. 检查GET配置接口
    print("\n2. 检查GET配置接口:")
    if "config_to_return['apiKey'] = 'sk-83365246617844178bf8d1e121b7279f'" in content:
        print("  ❌ GET接口仍然返回硬编码key")
    elif "config_to_return['apiKey'] =" in content:
        print("  ⚠️  GET接口可能还有其他硬编码逻辑")
    else:
        print("  ✅ GET接口不再添加硬编码key")
    
    # 3. 检查analyze_trend_with_deepseek函数
    print("\n3. 检查analyze_trend_with_deepseek函数:")
    if 'No user-provided AI API key found' in content:
        print("  ✅ 已添加用户key验证")
        
        # 检查错误消息
        lines = content.split('\n')
        for i, line in enumerate(lines):
            if 'No user-provided AI API key found' in line:
                print(f"    第{i+1}行: {line.strip()[:80]}")
    else:
        print("  ❌ 未找到用户key验证逻辑")
    
    # 4. 检查ai_analyze_single错误处理
    print("\n4. 检查ai_analyze_single错误处理:")
    if 'No user-provided AI API key' in content and 'stage' in content and 'ai_config' in content:
        print("  ✅ 已添加用户未配置key的错误处理")
    else:
        print("  ❌ 未找到用户未配置key的错误处理")
    
    # 5. 检查配置文件
    print("\n5. 检查配置文件:")
    config_file = 'ai_provider_config.json'
    if os.path.exists(config_file):
        with open(config_file, 'r', encoding='utf-8') as f:
            config = json.load(f)
        
        api_key = config.get('apiKey', '')
        if api_key == 'sk-83365246617844178bf8d1e121b7279f':
            print("  ❌ 配置文件中仍然是硬编码的无效key")
        elif api_key == 'sk-13db3058ec9d473f8483f2faceb55727':
            print("  ⚠️  配置文件中是另一个测试key（需要用户输入自己的key）")
        elif api_key:
            print(f"  ⚠️  配置文件中有key: {api_key[:10]}... (需要确认是用户输入的)")
        else:
            print("  ✅ 配置文件中的apiKey为空（正确，需要用户输入）")
    else:
        print("  ⚠️  配置文件不存在")
    
    # 6. 总结
    print("\n" + "="*60)
    print("修复总结:")
    print("="*60)
    
    requirements = [
        ("移除所有硬编码API key", "'sk-83365246617844178bf8d1e121b7279f' not in content"),
        ("ai_provider_config_state apiKey清空", "'apiKey': '' in content or '\"apiKey\": \"\"' in content"),
        ("GET接口不返回硬编码key", "config_to_return['apiKey'] = 'sk-83365246617844178bf8d1e121b7279f' not in content"),
        ("添加用户key验证", "'No user-provided AI API key found' in content"),
        ("用户未配置key时返回明确错误", "'stage' in content and 'ai_config' in content"),
    ]
    
    for req, condition in requirements:
        try:
            if eval(condition):
                print(f"  ✅ {req}")
            else:
                print(f"  ❌ {req}")
        except:
            print(f"  ⚠️  {req} (检查失败)")
    
    print("\n" + "="*60)
    print("下一步:")
    print("="*60)
    print("1. 用户必须在AI Configuration页面输入并保存自己的DeepSeek API密钥")
    print("2. 如果用户未配置key，AI分析将返回明确错误:")
    print("   {")
    print('     "success": false,')
    print('     "stage": "ai_config",')
    print('     "error": "No user-provided AI API key found",')
    print('     "provider": "DeepSeek"')
    print("   }")
    print("3. 禁止使用任何默认/硬编码/配置文件中的key")
    print("4. 只有用户输入的key才会被用于AI分析")

if __name__ == '__main__':
    test_current_config()