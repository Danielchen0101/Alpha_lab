#!/usr/bin/env python3
"""
瀹為檯杩愯Market Scanner娴嬭瘯
鑾峰彇鐪熷疄杩愯缁撴灉锛屾壘鍑虹┖symbol鐨勭湡姝ｅ師鍥?"""

import requests
import json
import time
from datetime import datetime

def test_single_symbol_ai_analysis(symbol):
    """娴嬭瘯鍗曚釜symbol鐨凙I鍒嗘瀽閾捐矾"""
    print(f"\n{'='*80}")
    print(f"娴嬭瘯 {symbol} 鐨凙I鍒嗘瀽閾捐矾")
    print(f"{'='*80}")
    
    start_time = time.time()
    
    # 1. 娴嬭瘯market_data鑾峰彇
    print(f"\n1. 娴嬭瘯market_data鑾峰彇...")
    market_data = None
    try:
        response = requests.get(f'http://127.0.0.1:8889/market/stock/{symbol}', timeout=10)
        if response.status_code == 200:
            market_data = response.json()
            print(f"   [OK] market_data鑾峰彇鎴愬姛")
            print(f"     浠锋牸: {market_data.get('price')}")
            print(f"     娑ㄨ穼骞? {market_data.get('changePercent')}")
            print(f"     鎴愪氦閲? {market_data.get('volume')}")
        else:
            print(f"   鉁?market_data鑾峰彇澶辫触: HTTP {response.status_code}")
            print(f"     鍝嶅簲: {response.text[:200]}")
    except Exception as e:
        print(f"   鉁?market_data鑾峰彇寮傚父: {str(e)}")
    
    # 2. 娴嬭瘯news_data鑾峰彇
    print(f"\n2. 娴嬭瘯news_data鑾峰彇...")
    news_data = None
    try:
        # 鍏堟祴璇旻innhub鏂伴椈API
        response = requests.get(
            f'http://127.0.0.1:8889/api/news/analyze',
            params={'symbol': symbol},
            timeout=10
        )
        if response.status_code == 200:
            news_data = response.json()
            print(f"   鉁?news_data鑾峰彇鎴愬姛")
            print(f"     鏂伴椈鏁伴噺: {news_data.get('newsCount', 0)}")
            print(f"     鎯呯华: {news_data.get('sentiment')}")
            print(f"     鏂伴椈婧? {news_data.get('newsSource')}")
        else:
            print(f"   鉁?news_data鑾峰彇澶辫触: HTTP {response.status_code}")
            print(f"     鍝嶅簲: {response.text[:200]}")
    except Exception as e:
        print(f"   鉁?news_data鑾峰彇寮傚父: {str(e)}")
    
    # 3. 娴嬭瘯瀹屾暣鐨凙I鍒嗘瀽
    print(f"\n3. 娴嬭瘯瀹屾暣鐨凙I鍒嗘瀽...")
    ai_result = None
    try:
        payload = {
            'symbol': symbol,
            'debug': True  # 璇锋眰璋冭瘯淇℃伅
        }
        
        # 璁板綍璇锋眰寮€濮嬫椂闂?        request_start = time.time()
        
        response = requests.post(
            'http://127.0.0.1:8889/ai/analyze/single',
            json=payload,
            timeout=60  # 缁橝I鍒嗘瀽瓒冲鏃堕棿
        )
        
        request_duration = time.time() - request_start
        print(f"   AI鍒嗘瀽璇锋眰鑰楁椂: {request_duration:.2f}绉?)
        
        if response.status_code == 200:
            ai_result = response.json()
            print(f"   鉁?AI鍒嗘瀽鎴愬姛")
            print(f"     success: {ai_result.get('success')}")
            print(f"     trendLabel: {ai_result.get('trendLabel')}")
            print(f"     overallScore: {ai_result.get('overallScore')}")
            print(f"     aiReasoning: {'鏈? if ai_result.get('aiReasoning') else '鏃?}")
            
            # 妫€鏌ユ暟鎹簮淇℃伅
            if 'provenance' in ai_result:
                provenance = ai_result['provenance']
                print(f"     鏁版嵁婧? marketData={provenance.get('marketData')}, "
                      f"news={provenance.get('news')}, "
                      f"aiAnalysis={provenance.get('aiAnalysis')}")
            
            # 妫€鏌ユ槸鍚︽湁璋冭瘯淇℃伅
            if 'debug' in ai_result:
                debug_info = ai_result['debug']
                print(f"     璋冭瘯淇℃伅:")
                print(f"       - 鏄惁鏈堿PI瀵嗛挜: {debug_info.get('api_key_check', {}).get('has_api_key')}")
                print(f"       - 甯傚満鏁版嵁: {'鏈? if debug_info.get('market_data') else '鏃?}")
                print(f"       - 鏂伴椈鏁版嵁: {'鏈? if debug_info.get('news_data') else '鏃?}")
        else:
            print(f"   鉁?AI鍒嗘瀽澶辫触: HTTP {response.status_code}")
            print(f"     鍝嶅簲: {response.text[:500]}")
    except requests.exceptions.Timeout:
        print(f"   鉁?AI鍒嗘瀽瓒呮椂 (60绉?")
    except Exception as e:
        print(f"   鉁?AI鍒嗘瀽寮傚父: {str(e)}")
    
    # 4. 鍒嗘瀽缁撴灉
    print(f"\n4. 缁撴灉鍒嗘瀽:")
    total_duration = time.time() - start_time
    
    if ai_result and ai_result.get('success'):
        print(f"   鉁?{symbol} AI鍒嗘瀽鎴愬姛瀹屾垚")
        print(f"     鎬昏€楁椂: {total_duration:.2f}绉?)
        
        # 妫€鏌ュ叧閿瓧娈垫槸鍚︿负绌?        empty_fields = []
        for field in ['trendLabel', 'trendScore', 'overallScore', 'aiReasoning']:
            if not ai_result.get(field):
                empty_fields.append(field)
        
        if empty_fields:
            print(f"   鈿狅笍  浣嗕互涓嬪瓧娈典负绌? {', '.join(empty_fields)}")
        else:
            print(f"   鉁?鎵€鏈夊叧閿瓧娈甸兘鏈夊€?)
    else:
        print(f"   鉁?{symbol} AI鍒嗘瀽澶辫触鎴栬繑鍥炰笉鎴愬姛")
        print(f"     鎬昏€楁椂: {total_duration:.2f}绉?)
        
        if ai_result:
            print(f"     閿欒淇℃伅: {ai_result.get('error', '鏃犻敊璇俊鎭?)}")
            print(f"     澶辫触闃舵: {ai_result.get('error_stage', '鏈煡')}")
    
    return ai_result

def test_batch_scanner():
    """娴嬭瘯鎵归噺鎵弿鍣?""
    print(f"\n{'='*80}")
    print(f"娴嬭瘯鎵归噺鎵弿鍣?)
    print(f"{'='*80}")
    
    # 浣跨敤甯歌鐨勬祴璇晄ymbols
    test_symbols = ['AAPL', 'MSFT', 'GOOGL', 'TSLA', 'NVDA', 'AMZN', 'META', 'JPM', 'JNJ', 'V']
    
    results = {}
    empty_symbols = []
    
    for i, symbol in enumerate(test_symbols, 1):
        print(f"\n[{i}/{len(test_symbols)}] 娴嬭瘯 {symbol}")
        
        result = test_single_symbol_ai_analysis(symbol)
        results[symbol] = result
        
        # 妫€鏌ユ槸鍚︿负绌?        if not result or not result.get('success') or not result.get('trendLabel'):
            empty_symbols.append(symbol)
        
        # 鎵规闂村欢杩燂紝妯℃嫙鍓嶇300ms寤惰繜
        if i < len(test_symbols):
            time.sleep(0.3)
            print(f"\n{'路'*40} 鎵规闂?00ms寤惰繜 {'路'*40}")
    
    # 杈撳嚭鎬荤粨
    print(f"\n{'='*80}")
    print(f"鎵归噺鎵弿娴嬭瘯鎬荤粨")
    print(f"{'='*80}")
    
    print(f"\n娴嬭瘯symbols: {len(test_symbols)}涓?)
    print(f"鎴愬姛symbols: {len([r for r in results.values() if r and r.get('success')])}涓?)
    print(f"绌簊ymbols: {len(empty_symbols)}涓?)
    
    if empty_symbols:
        print(f"\n绌簊ymbol鍒楄〃:")
        for symbol in empty_symbols:
            result = results[symbol]
            print(f"  鈥?{symbol}:")
            if result:
                print(f"     success: {result.get('success')}")
                print(f"     trendLabel: {result.get('trendLabel')}")
                print(f"     error: {result.get('error', '鏃犻敊璇俊鎭?)}")
                print(f"     error_stage: {result.get('error_stage', '鏈煡')}")
            else:
                print(f"     缁撴灉涓虹┖")
    
    # 鍒嗘瀽澶辫触鍘熷洜
    print(f"\n澶辫触鍘熷洜鍒嗘瀽:")
    failure_reasons = {}
    for symbol, result in results.items():
        if not result or not result.get('success'):
            error = result.get('error', '鏈煡閿欒') if result else '璇锋眰澶辫触'
            error_stage = result.get('error_stage', '鏈煡闃舵') if result else '璇锋眰闃舵'
            
            key = f"{error_stage}: {error[:50]}"
            failure_reasons[key] = failure_reasons.get(key, 0) + 1
    
    for reason, count in failure_reasons.items():
        print(f"  鈥?{reason}: {count}涓猻ymbol")
    
    return results, empty_symbols

def check_backend_status():
    """妫€鏌ュ悗绔湇鍔＄姸鎬?""
    print(f"妫€鏌ュ悗绔湇鍔＄姸鎬?..")
    
    try:
        # 妫€鏌ュ仴搴风鐐?        response = requests.get('http://127.0.0.1:8889/health', timeout=5)
        if response.status_code == 200:
            health_data = response.json()
            print(f"  鉁?鍚庣鏈嶅姟杩愯姝ｅ父")
            print(f"     鐘舵€? {health_data.get('status')}")
            print(f"     鏃堕棿: {health_data.get('timestamp')}")
            return True
        else:
            print(f"  鉁?鍚庣鏈嶅姟鍝嶅簲寮傚父: HTTP {response.status_code}")
            return False
    except Exception as e:
        print(f"  鉁?鍚庣鏈嶅姟杩炴帴澶辫触: {str(e)}")
        return False

def main():
    """涓诲嚱鏁?""
    print(f"Market Scanner鐪熷疄杩愯娴嬭瘯")
    print(f"寮€濮嬫椂闂? {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"{'='*80}")
    
    # 妫€鏌ュ悗绔湇鍔?    if not check_backend_status():
        print(f"\n閿欒: 鍚庣鏈嶅姟涓嶅彲鐢紝鏃犳硶杩涜娴嬭瘯")
        return
    
    # 娴嬭瘯鎵归噺鎵弿鍣?    results, empty_symbols = test_batch_scanner()
    
    # 淇濆瓨缁撴灉鍒版枃浠?    output_file = 'scanner_test_results.json'
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump({
            'test_time': datetime.now().isoformat(),
            'total_symbols': len(results),
            'empty_symbols': empty_symbols,
            'results': results
        }, f, indent=2, ensure_ascii=False)
    
    print(f"\n娴嬭瘯缁撴灉宸蹭繚瀛樺埌: {output_file}")
    print(f"娴嬭瘯瀹屾垚鏃堕棿: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

if __name__ == '__main__':
    main()
