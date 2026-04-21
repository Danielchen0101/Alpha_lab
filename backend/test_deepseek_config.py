#!/usr/bin/env python3
"""
娴嬭瘯DeepSeek API閰嶇疆
"""

import requests
import json
import os

def test_deepseek_api_key(api_key, base_url="https://api.deepseek.com", model="deepseek-chat"):
    """娴嬭瘯DeepSeek API瀵嗛挜鏄惁鏈夋晥"""
    print(f"娴嬭瘯DeepSeek API閰嶇疆:")
    print(f"  API瀵嗛挜: {api_key[:10]}... (闀垮害: {len(api_key)})")
    print(f"  Base URL: {base_url}")
    print(f"  Model: {model}")
    print("-" * 60)
    
    headers = {
        'Authorization': f'Bearer {api_key}',
        'Content-Type': 'application/json'
    }
    
    payload = {
        'model': model,
        'messages': [{'role': 'user', 'content': 'Hello, just testing API connectivity. Respond with "API test successful" if you can read this.'}],
        'max_tokens': 50,
        'temperature': 0.1
    }
    
    try:
        response = requests.post(
            f'{base_url}/chat/completions',
            headers=headers,
            json=payload,
            timeout=10
        )
        
        print(f"鍝嶅簲鐘舵€佺爜: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            print(f"[OK] API娴嬭瘯鎴愬姛!")
            print(f"   鍝嶅簲: {result.get('choices', [{}])[0].get('message', {}).get('content', 'No content')}")
            return True
        elif response.status_code == 401:
            print(f"鉂?API瀵嗛挜鏃犳晥 (401 Unauthorized)")
            print(f"   鍝嶅簲: {response.text[:200]}")
            return False
        elif response.status_code == 429:
            print(f"鈿狅笍  璇锋眰棰戠巼闄愬埗 (429 Too Many Requests)")
            return False
        else:
            print(f"鉂?鍏朵粬閿欒: {response.status_code}")
            print(f"   鍝嶅簲: {response.text[:200]}")
            return False
            
    except requests.exceptions.Timeout:
        print(f"鉂?璇锋眰瓒呮椂")
        return False
    except Exception as e:
        print(f"鉂?寮傚父: {str(e)}")
        return False

def check_config_files():
    """妫€鏌ラ厤缃枃浠?""
    print("妫€鏌ラ厤缃枃浠?")
    print("-" * 60)
    
    # 妫€鏌i_provider_config.json
    config_file = 'ai_provider_config.json'
    if os.path.exists(config_file):
        with open(config_file, 'r', encoding='utf-8') as f:
            config = json.load(f)
        print(f"[OK] 鎵惧埌 {config_file}:")
        print(f"   Provider: {config.get('provider')}")
        print(f"   API瀵嗛挜: {config.get('apiKey', '')[:10]}... (闀垮害: {len(config.get('apiKey', ''))})")
        print(f"   Base URL: {config.get('baseURL')}")
        print(f"   Model: {config.get('model')}")
        return config
    else:
        print(f"鉂?鏈壘鍒?{config_file}")
        return None

def check_hardcoded_keys():
    """妫€鏌ョ‖缂栫爜鐨凙PI瀵嗛挜"""
    print("\n妫€鏌ヤ唬鐮佷腑鐨勭‖缂栫爜瀵嗛挜:")
    print("-" * 60)
    
    # 浠巗tart_quant_backend_fixed.py涓彁鍙栫‖缂栫爜瀵嗛挜
    try:
        with open('start_quant_backend_fixed.py', 'r', encoding='utf-8') as f:
            content = f.read()
            
        # 鏌ユ壘ai_provider_config_state瀹氫箟
        import re
        pattern = r"ai_provider_config_state\s*=\s*\{[^}]+'apiKey'\s*:\s*'([^']+)'"
        match = re.search(pattern, content)
        
        if match:
            hardcoded_key = match.group(1)
            print(f"鉁?鎵惧埌纭紪鐮丄PI瀵嗛挜:")
            print(f"   瀵嗛挜: {hardcoded_key[:10]}... (闀垮害: {len(hardcoded_key)})")
            return hardcoded_key
        else:
            print("鉂?鏈壘鍒扮‖缂栫爜API瀵嗛挜")
            return None
            
    except Exception as e:
        print(f"鉂?璇诲彇鏂囦欢閿欒: {str(e)}")
        return None

def main():
    """涓诲嚱鏁?""
    print("="*60)
    print("DeepSeek API閰嶇疆璇婃柇")
    print("="*60)
    
    # 1. 妫€鏌ラ厤缃枃浠?    config = check_config_files()
    
    # 2. 妫€鏌ョ‖缂栫爜瀵嗛挜
    hardcoded_key = check_hardcoded_keys()
    
    # 3. 娴嬭瘯閰嶇疆鏂囦欢涓殑瀵嗛挜
    if config:
        print(f"\n娴嬭瘯閰嶇疆鏂囦欢涓殑API瀵嗛挜:")
        config_key = config.get('apiKey')
        if config_key:
            test_deepseek_api_key(
                api_key=config_key,
                base_url=config.get('baseURL', 'https://api.deepseek.com'),
                model=config.get('model', 'deepseek-chat')
            )
        else:
            print("鉂?閰嶇疆鏂囦欢涓病鏈堿PI瀵嗛挜")
    
    # 4. 娴嬭瘯纭紪鐮佸瘑閽?    if hardcoded_key:
        print(f"\n娴嬭瘯纭紪鐮丄PI瀵嗛挜:")
        test_deepseek_api_key(api_key=hardcoded_key)
    
    # 5. 寤鸿
    print(f"\n" + "="*60)
    print("淇寤鸿:")
    print("="*60)
    
    if config and config.get('apiKey'):
        print("1. 鉁?閰嶇疆鏂囦欢涓湁鏈夋晥鐨凙PI瀵嗛挜")
        print("2. 鉂?浠ｇ爜涓娇鐢ㄧ殑鏄‖缂栫爜鐨勬棤鏁堝瘑閽?)
        print("3. 馃敡 淇鏂规: 淇敼浠ｇ爜浠庨厤缃枃浠惰鍙朅PI瀵嗛挜")
    else:
        print("1. 鉂?閰嶇疆鏂囦欢涓病鏈堿PI瀵嗛挜鎴栨枃浠朵笉瀛樺湪")
        print("2. 鉂?浠ｇ爜涓娇鐢ㄧ殑鏄‖缂栫爜鐨勬棤鏁堝瘑閽?)
        print("3. 馃敡 淇鏂规:")
        print("   a. 鑾峰彇鏈夋晥鐨凞eepSeek API瀵嗛挜")
        print("   b. 鏇存柊閰嶇疆鏂囦欢")
        print("   c. 淇敼浠ｇ爜浠庨厤缃枃浠惰鍙?)

if __name__ == '__main__':
    main()
