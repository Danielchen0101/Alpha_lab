#!/usr/bin/env python3
"""
检查AI配置
"""

import requests
import json

def check_ai_config():
    """检查AI配置"""
    print("Checking AI Configuration")
    print("=" * 80)
    
    base_url = "http://127.0.0.1:8889"
    
    # 1. 保存配置
    print(f"\n1. Saving AI configuration...")
    
    ai_config = {
        "provider": "DeepSeek",
        "apiKey": "sk-83365246617844178bf8d1e121b7279f",
        "baseUrl": "https://api.deepseek.com",
        "model": "deepseek-chat"
    }
    
    try:
        response = requests.post(
            f"{base_url}/api/ai/provider/config",
            json=ai_config,
            timeout=10
        )
        
        print(f"Save status: {response.status_code}")
        if response.status_code == 200:
            print(f"Save response: {response.json()}")
    
    except Exception as e:
        print(f"Error saving: {e}")
    
    # 2. 读取配置
    print(f"\n2. Reading AI configuration...")
    
    try:
        response = requests.get(
            f"{base_url}/api/ai/provider/config",
            timeout=10
        )
        
        print(f"Read status: {response.status_code}")
        if response.status_code == 200:
            config = response.json()
            print(f"Config: {config}")
            
            if config.get('success'):
                ai_config = config.get('config', {})
                print(f"\nAI Configuration State:")
                print(f"  provider: {ai_config.get('provider')}")
                print(f"  apiKey length: {len(ai_config.get('apiKey', ''))}")
                print(f"  apiKey (first 10 chars): {ai_config.get('apiKey', '')[:10]}...")
                print(f"  baseURL: {ai_config.get('baseURL')}")
                print(f"  model: {ai_config.get('model')}")
                
                if not ai_config.get('apiKey'):
                    print("\n❌ PROBLEM: API Key is empty!")
                else:
                    print("\n✅ SUCCESS: API Key is saved")
        else:
            print(f"Error: {response.text}")
            
    except Exception as e:
        print(f"Error reading: {e}")
    
    print("\n" + "=" * 80)
    print("Check Complete")

if __name__ == "__main__":
    check_ai_config()