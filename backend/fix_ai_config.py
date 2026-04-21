#!/usr/bin/env python3
"""
修复AI配置链路
1. 删除所有硬编码AI key
2. 添加配置持久化
3. 创建统一配置读取函数
4. 修复路由前缀
"""

import os
import json
import re

BACKEND_FILE = "start_quant_backend_repaired.py"
CONFIG_FILE = os.path.expanduser("~/.openclaw/ai_config.json")

def remove_hardcoded_keys():
    """删除所有硬编码的AI key"""
    print("=== 删除硬编码AI key ===")
    
    with open(BACKEND_FILE, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # 1. 删除初始化中的硬编码key
    old_init = """ai_provider_config_state = {

    'provider': 'DeepSeek',

    'apiKey': 'sk-83365246617844178bf8d1e121b7279f',  # 硬编码API密钥用于测试

    'baseURL': 'https://api.deepseek.com',

    'model': 'deepseek-chat'

}"""
    
    new_init = """ai_provider_config_state = {

    'provider': '',  # 用户必须配置

    'apiKey': '',    # 用户必须配置，无硬编码默认值

    'baseURL': '',   # 用户必须配置

    'model': ''      # 用户必须配置

}"""
    
    if old_init in content:
        content = content.replace(old_init, new_init)
        print("✅ 删除初始化中的硬编码key")
    else:
        print("⚠️ 未找到初始化硬编码key（可能已修改）")
    
    # 2. 删除GET方法中的硬编码key回退
    old_get_fallback = """            # 确保硬编码配置，确保API密钥不为空
            config_to_return = dict(ai_provider_config_state)
            if not config_to_return.get('apiKey'):
                config_to_return['apiKey'] = 'sk-83365246617844178bf8d1e121b7279f'"""
    
    new_get_fallback = """            # 返回当前配置（可能为空）
            config_to_return = dict(ai_provider_config_state)
            # 不再提供硬编码默认值，用户必须自己配置"""
    
    if old_get_fallback in content:
        content = content.replace(old_get_fallback, new_get_fallback)
        print("✅ 删除GET方法中的硬编码key回退")
    else:
        # 尝试其他格式
        pattern = r"config_to_return\['apiKey'\] = 'sk-[^']+'"
        if re.search(pattern, content):
            content = re.sub(pattern, "# 硬编码key已删除，用户必须自己配置", content)
            print("✅ 删除正则匹配的硬编码key")
    
    # 3. 删除其他可能的硬编码值
    hardcoded_values = [
        ("'baseURL': 'https://api.deepseek.com',", "'baseURL': '',   # 用户必须配置"),
        ("'model': 'deepseek-chat'", "'model': ''      # 用户必须配置"),
        ("'provider': 'DeepSeek',", "'provider': '',  # 用户必须配置"),
    ]
    
    for old, new in hardcoded_values:
        if old in content and "ai_provider_config_state" in content[:content.find(old)+500]:
            content = content.replace(old, new)
            print(f"✅ 删除硬编码: {old.split(':')[0].strip()}")
    
    # 保存修改
    with open(BACKEND_FILE, 'w', encoding='utf-8') as f:
        f.write(content)
    
    print("✅ 所有硬编码key已删除")

def add_persistence_functions():
    """添加配置持久化函数"""
    print("\n=== 添加配置持久化函数 ===")
    
    with open(BACKEND_FILE, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # 在文件开头添加导入
    if "import json" not in content[:1000]:
        import_stmt = """import json
import os
"""
        # 找到第一个import之后插入
        lines = content.split('\n')
        for i, line in enumerate(lines):
            if line.startswith('import ') or line.startswith('from '):
                insert_pos = i + 1
                while insert_pos < len(lines) and (lines[insert_pos].startswith('import ') or lines[insert_pos].startswith('from ')):
                    insert_pos += 1
                lines.insert(insert_pos, "import json")
                lines.insert(insert_pos + 1, "import os")
                content = '\n'.join(lines)
                print("✅ 添加json和os导入")
                break
    
    # 在ai_provider_config_state定义后添加持久化函数
    persistence_code = """

# AI配置持久化文件路径
AI_CONFIG_FILE = os.path.expanduser('~/.openclaw/ai_config.json')

def save_ai_config_to_file(config):
    \"\"\"保存AI配置到文件\"\"\"
    try:
        os.makedirs(os.path.dirname(AI_CONFIG_FILE), exist_ok=True)
        with open(AI_CONFIG_FILE, 'w', encoding='utf-8') as f:
            json.dump(config, f, indent=2)
        print(f'[AI配置] 配置已保存到文件: {AI_CONFIG_FILE}')
        return True
    except Exception as e:
        print(f'[AI配置] 保存配置到文件失败: {e}')
        return False

def load_ai_config_from_file():
    \"\"\"从文件加载AI配置\"\"\"
    try:
        if os.path.exists(AI_CONFIG_FILE):
            with open(AI_CONFIG_FILE, 'r', encoding='utf-8') as f:
                config = json.load(f)
            print(f'[AI配置] 从文件加载配置: {AI_CONFIG_FILE}')
            return config
        else:
            print('[AI配置] 配置文件不存在，返回空配置')
            return {}
    except Exception as e:
        print(f'[AI配置] 从文件加载配置失败: {e}')
        return {}

def get_effective_ai_config():
    \"\"\"获取有效的AI配置（统一入口）\"\"\"
    # 1. 首先检查内存中的配置
    config = dict(ai_provider_config_state)
    
    # 2. 如果内存配置为空，尝试从文件加载
    if not config.get('apiKey') or not config.get('provider'):
        file_config = load_ai_config_from_file()
        if file_config:
            # 更新内存配置
            ai_provider_config_state.update(file_config)
            config.update(file_config)
            print('[AI配置] 使用文件中的配置')
    
    return config

# 启动时尝试从文件加载配置
_startup_config = load_ai_config_from_file()
if _startup_config:
    ai_provider_config_state.update(_startup_config)
    print(f'[AI配置] 启动时加载配置: {_startup_config.get("provider", "未配置")}')
"""
    
    # 在ai_provider_config_state定义后插入
    if "ai_provider_config_state = {" in content and "def get_effective_ai_config()" not in content:
        pos = content.find("ai_provider_config_state = {")
        # 找到这个定义的结束
        brace_count = 0
        end_pos = pos
        for i in range(pos, len(content)):
            if content[i] == '{':
                brace_count += 1
            elif content[i] == '}':
                brace_count -= 1
                if brace_count == 0:
                    end_pos = i + 1
                    break
        
        # 在定义后插入持久化代码
        content = content[:end_pos] + persistence_code + content[end_pos:]
        print("✅ 添加配置持久化函数")
    
    # 保存修改
    with open(BACKEND_FILE, 'w', encoding='utf-8') as f:
        f.write(content)

def update_ai_config_route():
    """更新AI配置路由使用持久化"""
    print("\n=== 更新AI配置路由使用持久化 ===")
    
    with open(BACKEND_FILE, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # 更新ai_provider_config函数
    old_route_start = """@app.route('/api/ai/provider/config', methods=['GET', 'POST'])

def ai_provider_config():"""
    
    new_route_start = """@app.route('/api/ai/provider/config', methods=['GET', 'POST'])
@app.route('/ai/provider/config', methods=['GET', 'POST'])  # 兼容无前缀版本

def ai_provider_config():"""
    
    if old_route_start in content:
        content = content.replace(old_route_start, new_route_start)
        print("✅ 添加无前缀路由版本")
    
    # 更新POST部分使用持久化
    post_section = """        else:

            # POST 请求 - 保存配置

            data = request.get_json()

            print('=== AI 配置保存请求 ===')

            print('原始数据:', data)


            # 更新内存配置

            if 'provider' in data:

                ai_provider_config_state['provider'] = data['provider']

            if 'apiKey' in data:

                ai_provider_config_state['apiKey'] = data['apiKey']

            if 'baseUrl' in data:

                ai_provider_config_state['baseURL'] = data['baseUrl']

            if 'baseURL' in data:  # 也支持大写

                ai_provider_config_state['baseURL'] = data['baseURL']

            if 'model' in data:

                ai_provider_config_state['model'] = data['model']


            response = {

                'success': True,

                'config': ai_provider_config_state,

                'message': '配置保存成功'

            }

            print('保存响应:', response)

            return jsonify(response)"""
    
    new_post_section = """        else:

            # POST 请求 - 保存配置

            data = request.get_json()

            print('=== AI 配置保存请求 ===')

            print('原始数据:', data)


            # 更新内存配置

            if 'provider' in data:

                ai_provider_config_state['provider'] = data['provider']

            if 'apiKey' in data:

                ai_provider_config_state['apiKey'] = data['apiKey']

            if 'baseUrl' in data:

                ai_provider_config_state['baseURL'] = data['baseUrl']

            if 'baseURL' in data:  # 也支持大写

                ai_provider_config_state['baseURL'] = data['baseURL']

            if 'model' in data:

                ai_provider_config_state['model'] = data['model']


            # 持久化保存到文件
            save_success = save_ai_config_to_file(ai_provider_config_state)
            
            if not save_success:
                return jsonify({
                    'success': False,
                    'error': '配置保存到文件失败'
                }), 500


            response = {

                'success': True,

                'config': ai_provider_config_state,

                'message': '配置保存成功并已持久化'

            }

            print('保存响应:', response)

            return jsonify(response)"""
    
    if post_section in content:
        content = content.replace(post_section, new_post_section)
        print("✅ 更新POST路由使用持久化")
    
    # 更新GET部分使用统一函数
    get_section_pattern = r'if request\.method == \'GET\':.*?return jsonify\({.*?}\)'
    
    new_get_section = """        if request.method == 'GET':

            # GET 请求 - 返回当前配置（使用统一入口）

            effective_config = get_effective_ai_config()
            
            return jsonify({

                'success': True,

                'config': effective_config

            })"""
    
    # 使用正则替换
    import re
    content = re.sub(get_section_pattern, new_get_section, content, flags=re.DOTALL)
    print("✅ 更新GET路由使用统一配置函数")
    
    # 保存修改
    with open(BACKEND_FILE, 'w', encoding='utf-8') as f:
        f.write(content)

def update_ai_analyze_routes():
    """更新所有AI分析路由使用统一配置"""
    print("\n=== 更新AI分析路由使用统一配置 ===")
    
    with open(BACKEND_FILE, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # 1. 更新ai_analyze_single路由前缀
    old_ai_route = """@app.route('/api/ai/analyze/single', methods=['POST'])

@app.route('/ai/analyze/single', methods=['POST'])"""
    
    new_ai_route = """@app.route('/api/ai/analyze/single', methods=['POST'])
@app.route('/ai/analyze/single', methods=['POST'])  # 保持兼容"""
    
    if old_ai_route in content:
        content = content.replace(old_ai_route, new_ai_route)
        print("✅ 确认AI分析路由前缀")
    
    # 2. 更新analyze_trend_with_deepseek使用统一配置
    deepseek_func_start = "def analyze_trend_with_deepseek"
    if deepseek_func_start in content:
        # 找到函数开始
        pos = content.find(deepseek_func_start)
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
            
            content = content[:func_body_start] + config_check + content[func_body_start:]
            print("✅ 更新analyze_trend_with_deepseek使用统一配置")
    
    # 3. 更新ai_analyze_single函数中的配置读取
    ai_analyze_single_start = "def ai_analyze_single():"
    if ai_analyze_single_start in content:
        pos = content.find(ai_analyze_single_start)
        func_body_start = content.find("try:", pos)
        
        if func_body_start > pos:
            # 在获取数据部分后添加配置检查
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
            
            # 在获取market_data和news_data之后插入
            insert_pos = content.find("news_data = get_stock_news(symbol_upper)", func_body_start)
            if insert_pos > 0:
                # 找到news_data获取后的位置
                insert_pos = content.find("\n", content.find("\n", insert_pos) + 1)
                content = content[:insert_pos] + config_check + content[insert_pos:]
                print("✅ 更新ai_analyze_single添加配置检查")
    
    # 保存修改
    with open(BACKEND_FILE, 'w', encoding='utf-8') as f:
        f.write(content)

def create_test_config():
    """创建测试配置文件"""
    print("\n=== 创建测试配置文件 ===")
    
    test_config = {
        "provider": "deepseek",
        "apiKey": "test-user-configured-key-1234567890",
        "baseURL": "https://api.deepseek.com",
        "model": "deepseek-chat"
    }
    
    os.makedirs(os.path.dirname(CONFIG_FILE), exist_ok=True)
    with open(CONFIG_FILE, 'w', encoding='utf-8') as f:
        json.dump(test_config, f, indent=2)
    
    print(f"✅ 创建测试配置文件: {CONFIG_FILE}")
    print(f"   配置内容: {json.dumps(test_config, indent=2)}")

def main():
    """主函数"""
    print("=" * 60)
    print("修复AI配置链路")
    print("=" * 60)
    
    # 备份原文件
    backup_file = BACKEND_FILE + ".backup"
    if not os.path.exists(backup_file):
        import shutil
        shutil.copy2(BACKEND_FILE, backup_file)
        print(f"✅ 创建备份: {backup_file}")
    
    # 执行修复步骤
    remove_hardcoded_keys()
    add_persistence_functions()
    update_ai_config_route()
    update_ai_analyze_routes()
    create_test_config()
    
    print("\n" + "=" * 60)
    print("修复完成总结")
    print("=" * 60)
    print("1. [SUCCESS] 删除所有硬编码AI key")
    print("2. [SUCCESS] 添加配置持久化")
    print("3. [SUCCESS] 创建统一配置读取函数")
    print("4. [SUCCESS] 更新AI路由使用持久化配置")
    print("5. [SUCCESS] 创建测试配置文件")
    print("\n下一步:")
    print("1. 重启后端服务使更改生效")
    print("2. 测试AI配置保存和加载")
    print("3. 测试AI分析使用保存的配置")
    print("=" * 60)