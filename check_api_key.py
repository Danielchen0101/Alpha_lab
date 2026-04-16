#!/usr/bin/env python3
"""
检查API密钥
"""

import requests
import json

def check_api_key():
    """检查API密钥"""
    print("Checking API Key")
    print("=" * 80)
    
    base_url = "http://127.0.0.1:8889"
    
    try:
        response = requests.get(
            f"{base_url}/api/ai/provider/config",
            timeout=10
        )
        
        print(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            config = response.json()
            ai_config = config.get('config', {})
            
            # 直接打印整个响应
            print(f"\nFull Response:")
            print(json.dumps(config, indent=2))
            
            api_key = ai_config.get('apiKey', '')
            if api_key:
                print(f"\n✅ API Key is configured")
                print(f"Length: {len(api_key)}")
                print(f"First 10 chars: {api_key[:10]}")
                print(f"Last 10 chars: {api_key[-10:]}")
            else:
                print(f"\n❌ API Key is empty!")
        else:
            print(f"Error: {response.text}")
    except Exception as e:
        print(f"Error: {e}")
    
    print(f"\n{'='*80}")
    print("Check Complete")

if __name__ == "__main__":
    check_api_key()