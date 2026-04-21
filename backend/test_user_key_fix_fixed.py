#!/usr/bin/env python3
"""
娴嬭瘯鐢ㄦ埛key淇鏁堟灉
"""

import json
import os

def test_current_config():
    """娴嬭瘯褰撳墠閰嶇疆鐘舵€?""
    print("="*60)
    print("娴嬭瘯鐢ㄦ埛key淇鏁堟灉")
    print("="*60)
    
    # 1. 妫€鏌ュ綋鍓嶅悗绔枃浠朵腑鐨勭‖缂栫爜key
    print("\n1. 妫€鏌ュ悗绔枃浠朵腑鐨勭‖缂栫爜key:")
    with open('start_quant_backend.py', 'r', encoding='utf-8') as f:
        content = f.read()
    
    # 妫€鏌ユ槸鍚﹁繕鏈夌‖缂栫爜鐨剆k-83365246617844178bf8d1e121b7279f
    if 'sk-83365246617844178bf8d1e121b7279f' in content:
        print("  鉂?鍚庣鏂囦欢涓粛鐒跺寘鍚‖缂栫爜鐨勬棤鏁圓PI瀵嗛挜")
        # 鏌ユ壘浣嶇疆
        lines = content.split('\n')
        for i, line in enumerate(lines):
            if 'sk-83365246617844178bf8d1e121b7279f' in line:
                print(f"    绗瑊i+1}琛? {line.strip()[:80]}")
    else:
        print("  鉁?鍚庣鏂囦欢涓凡绉婚櫎纭紪鐮佺殑鏃犳晥API瀵嗛挜")
    
    # 妫€鏌i_provider_config_state鍒濆鍖?    if "'apiKey': 'sk-83365246617844178bf8d1e121b7279f'" in content:
        print("  鉂?ai_provider_config_state浠嶇劧鍖呭惈纭紪鐮乲ey")
    elif "'apiKey': ''" in content or '"apiKey": ""' in content:
        print("  鉁?ai_provider_config_state鐨刟piKey宸叉竻绌?)
    else:
        print("  鈿狅笍  鏃犳硶纭畾ai_provider_config_state鐨刟piKey鐘舵€?)
    
    # 2. 妫€鏌ET閰嶇疆鎺ュ彛
    print("\n2. 妫€鏌ET閰嶇疆鎺ュ彛:")
    if "config_to_return['apiKey'] = 'sk-83365246617844178bf8d1e121b7279f'" in content:
        print("  鉂?GET鎺ュ彛浠嶇劧杩斿洖纭紪鐮乲ey")
    elif "config_to_return['apiKey'] =" in content:
        print("  鈿狅笍  GET鎺ュ彛鍙兘杩樻湁鍏朵粬纭紪鐮侀€昏緫")
    else:
        print("  鉁?GET鎺ュ彛涓嶅啀娣诲姞纭紪鐮乲ey")
    
    # 3. 妫€鏌nalyze_trend_with_deepseek鍑芥暟
    print("\n3. 妫€鏌nalyze_trend_with_deepseek鍑芥暟:")
    if 'No user-provided AI API key found' in content:
        print("  鉁?宸叉坊鍔犵敤鎴穔ey楠岃瘉")
        
        # 妫€鏌ラ敊璇秷鎭?        lines = content.split('\n')
        for i, line in enumerate(lines):
            if 'No user-provided AI API key found' in line:
                print(f"    绗瑊i+1}琛? {line.strip()[:80]}")
    else:
        print("  鉂?鏈壘鍒扮敤鎴穔ey楠岃瘉閫昏緫")
    
    # 4. 妫€鏌i_analyze_single閿欒澶勭悊
    print("\n4. 妫€鏌i_analyze_single閿欒澶勭悊:")
    if 'No user-provided AI API key' in content and 'stage' in content and 'ai_config' in content:
        print("  鉁?宸叉坊鍔犵敤鎴锋湭閰嶇疆key鐨勯敊璇鐞?)
    else:
        print("  鉂?鏈壘鍒扮敤鎴锋湭閰嶇疆key鐨勯敊璇鐞?)
    
    # 5. 妫€鏌ラ厤缃枃浠?    print("\n5. 妫€鏌ラ厤缃枃浠?")
    config_file = 'ai_provider_config.json'
    if os.path.exists(config_file):
        with open(config_file, 'r', encoding='utf-8') as f:
            config = json.load(f)
        
        api_key = config.get('apiKey', '')
        if api_key == 'sk-83365246617844178bf8d1e121b7279f':
            print("  鉂?閰嶇疆鏂囦欢涓粛鐒舵槸纭紪鐮佺殑鏃犳晥key")
        elif api_key == 'sk-13db3058ec9d473f8483f2faceb55727':
            print("  鈿狅笍  閰嶇疆鏂囦欢涓槸鍙︿竴涓祴璇昸ey锛堥渶瑕佺敤鎴疯緭鍏ヨ嚜宸辩殑key锛?)
        elif api_key:
            print(f"  鈿狅笍  閰嶇疆鏂囦欢涓湁key: {api_key[:10]}... (闇€瑕佺‘璁ゆ槸鐢ㄦ埛杈撳叆鐨?")
        else:
            print("  鉁?閰嶇疆鏂囦欢涓殑apiKey涓虹┖锛堟纭紝闇€瑕佺敤鎴疯緭鍏ワ級")
    else:
        print("  鈿狅笍  閰嶇疆鏂囦欢涓嶅瓨鍦?)
    
    # 6. 鎬荤粨
    print("\n" + "="*60)
    print("淇鎬荤粨:")
    print("="*60)
    
    requirements = [
        ("绉婚櫎鎵€鏈夌‖缂栫爜API key", "'sk-83365246617844178bf8d1e121b7279f' not in content"),
        ("ai_provider_config_state apiKey娓呯┖", "'apiKey': '' in content or '\"apiKey\": \"\"' in content"),
        ("GET鎺ュ彛涓嶈繑鍥炵‖缂栫爜key", "config_to_return['apiKey'] = 'sk-83365246617844178bf8d1e121b7279f' not in content"),
        ("娣诲姞鐢ㄦ埛key楠岃瘉", "'No user-provided AI API key found' in content"),
        ("鐢ㄦ埛鏈厤缃甼ey鏃惰繑鍥炴槑纭敊璇?, "'stage' in content and 'ai_config' in content"),
    ]
    
    for req, condition in requirements:
        try:
            if eval(condition):
                print(f"  鉁?{req}")
            else:
                print(f"  鉂?{req}")
        except:
            print(f"  鈿狅笍  {req} (妫€鏌ュけ璐?")
    
    print("\n" + "="*60)
    print("涓嬩竴姝?")
    print("="*60)
    print("1. 鐢ㄦ埛蹇呴』鍦ˋI Configuration椤甸潰杈撳叆骞朵繚瀛樿嚜宸辩殑DeepSeek API瀵嗛挜")
    print("2. 濡傛灉鐢ㄦ埛鏈厤缃甼ey锛孉I鍒嗘瀽灏嗚繑鍥炴槑纭敊璇?")
    print("   {")
    print('     "success": false,')
    print('     "stage": "ai_config",')
    print('     "error": "No user-provided AI API key found",')
    print('     "provider": "DeepSeek"')
    print("   }")
    print("3. 绂佹浣跨敤浠讳綍榛樿/纭紪鐮?閰嶇疆鏂囦欢涓殑key")
    print("4. 鍙湁鐢ㄦ埛杈撳叆鐨刱ey鎵嶄細琚敤浜嶢I鍒嗘瀽")

if __name__ == '__main__':
    test_current_config()
