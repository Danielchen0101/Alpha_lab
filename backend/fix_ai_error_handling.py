"""
修复AI调用链路的错误处理
"""

import re

def fix_ai_analyze_single_error_handling():
    """修复ai_analyze_single函数的错误处理"""
    
    with open('start_quant_backend_repaired.py', 'r', encoding='utf-8') as f:
        content = f.read()
    
    # 找到ai_analyze_single函数的结尾
    # 搜索函数定义
    func_start = content.find('def ai_analyze_single():')
    if func_start == -1:
        print("未找到ai_analyze_single函数")
        return
    
    # 找到函数结尾（下一个def或文件结尾）
    func_end = content.find('\ndef ', func_start + 1)
    if func_end == -1:
        func_end = len(content)
    
    func_content = content[func_start:func_end]
    
    # 查找函数中的except块
    except_pattern = r'except Exception as e:\s*\n\s*print\(f.*?\)\s*\n\s*return jsonify\(\{'
    
    # 检查是否有多个except块
    except_matches = list(re.finditer(r'except Exception as e:', func_content))
    
    if len(except_matches) > 1:
        print(f"找到{len(except_matches)}个except块")
        
        # 获取最后一个except块（函数级别的错误处理）
        last_except = except_matches[-1]
        except_start = last_except.start()
        
        # 找到这个except块的结束
        # 查找return jsonify的结束
        return_start = func_content.find('return jsonify({', except_start)
        if return_start != -1:
            # 找到匹配的}
            brace_count = 1
            pos = return_start + len('return jsonify({')
            while brace_count > 0 and pos < len(func_content):
                if func_content[pos] == '{':
                    brace_count += 1
                elif func_content[pos] == '}':
                    brace_count -= 1
                pos += 1
            
            except_end = pos
            
            # 提取except块内容
            except_block = func_content[except_start:except_end]
            print(f"当前except块内容:\n{except_block}")
            
            # 创建新的错误处理块，包含详细错误信息
            new_except_block = '''    except Exception as e:
        import traceback
        error_detail = traceback.format_exc()
        print(f'[AI调用链路] {symbol_upper} 分析过程发生异常: {str(e)}')
        print(f'[AI调用链路] 异常详情: {error_detail}')
        
        # 返回详细的错误信息，而不是静默返回null
        return jsonify({
            'success': False,
            'symbol': symbol_upper,
            'error': f'AI分析过程异常: {str(e)}',
            'error_type': type(e).__name__,
            'stage': 'ai_analysis_process',
            'has_market_data': market_data is not None,
            'has_company_info': company_info is not None,
            'has_news_data': news_data is not None,
            'timestamp': int(time.time()),
            'responseTime': round(time.time() - start_time, 3),
            'message': f'AI分析失败: {str(e)[:100]}'
        }), 500'''
            
            # 替换except块
            new_func_content = func_content[:except_start] + new_except_block + func_content[except_end:]
            
            # 更新整个内容
            new_content = content[:func_start] + new_func_content + content[func_start + len(func_content):]
            
            # 写回文件
            with open('start_quant_backend_repaired.py', 'w', encoding='utf-8') as f:
                f.write(new_content)
            
            print("已修复ai_analyze_single函数的错误处理")
        else:
            print("未找到return jsonify语句")
    else:
        print("只找到一个except块或未找到except块")

def fix_analyze_trend_with_deepseek_error_handling():
    """修复analyze_trend_with_deepseek函数的错误处理"""
    
    with open('start_quant_backend_repaired.py', 'r', encoding='utf-8') as f:
        content = f.read()
    
    # 找到analyze_trend_with_deepseek函数的结尾
    func_start = content.find('def analyze_trend_with_deepseek(')
    if func_start == -1:
        print("未找到analyze_trend_with_deepseek函数")
        return
    
    # 找到函数结尾（下一个def或文件结尾）
    func_end = content.find('\ndef ', func_start + 1)
    if func_end == -1:
        func_end = len(content)
    
    func_content = content[func_start:func_end]
    
    # 查找API调用失败的错误处理
    api_fail_pattern = r'print\(f.*DeepSeek API调用失败.*?\)\s*\n\s*return \{'
    
    if re.search(api_fail_pattern, func_content):
        # 找到API调用失败的处理
        match = re.search(r'print\(f.*DeepSeek API调用失败.*?\)\s*\n\s*return \{', func_content, re.DOTALL)
        if match:
            fail_start = match.start()
            
            # 找到return语句的结束
            return_start = func_content.find('return {', fail_start)
            brace_count = 1
            pos = return_start + len('return {')
            while brace_count > 0 and pos < len(func_content):
                if func_content[pos] == '{':
                    brace_count += 1
                elif func_content[pos] == '}':
                    brace_count -= 1
                pos += 1
            
            fail_end = pos
            
            # 创建新的错误处理
            new_fail_block = '''            print(f'DeepSeek API调用失败: {response.status_code}，返回详细错误信息')
            return {
                'trendLabel': None,
                'trendScore': None,
                'trendConfidence': None,
                'scannerReason': f'API调用失败: HTTP {response.status_code}',
                'trendScoreDetail': None,
                'momentumScore': None,
                'volumeScore': None,
                'volatilityScore': None,
                'structureScore': None,
                'newsScore': None,
                'aiReasoning': f'DeepSeek API调用失败: HTTP {response.status_code} - {response.text[:200] if response.text else "无响应内容"}',
                'api_error': True,
                'http_status': response.status_code,
                'error_message': response.text[:500] if response.text else 'No response body'
            }'''
            
            # 替换错误处理块
            new_func_content = func_content[:fail_start] + new_fail_block + func_content[fail_end:]
            
            # 更新整个内容
            new_content = content[:func_start] + new_func_content + content[func_start + len(func_content):]
            
            # 写回文件
            with open('start_quant_backend_repaired.py', 'w', encoding='utf-8') as f:
                f.write(new_content)
            
            print("已修复analyze_trend_with_deepseek函数的API失败处理")
    else:
        print("未找到DeepSeek API调用失败的处理块")

def add_detailed_logging():
    """添加详细的调试日志"""
    
    with open('start_quant_backend_repaired.py', 'r', encoding='utf-8') as f:
        content = f.read()
    
    # 在ai_analyze_single函数中添加详细日志
    func_start = content.find('def ai_analyze_single():')
    if func_start == -1:
        print("未找到ai_analyze_single函数")
        return
    
    # 找到try块开始
    try_start = content.find('try:', func_start)
    if try_start == -1:
        print("未找到try块")
        return
    
    # 在try块后添加详细日志
    insert_pos = try_start + len('try:') + 1
    
    # 准备要插入的日志代码
    logging_code = '''
        # 详细日志记录开始
        import time
        total_start_time = time.time()
        stage_times = {}
        
        print(f"[AI调用链路] === 开始处理 {symbol_upper} ===")
        print(f"[AI调用链路] 请求时间: {time.strftime('%Y-%m-%d %H:%M:%S')}")
        print(f"[AI调用链路] 请求数据: {data}")
    '''
    
    # 插入日志代码
    new_content = content[:insert_pos] + logging_code + content[insert_pos:]
    
    # 写回文件
    with open('start_quant_backend_repaired.py', 'w', encoding='utf-8') as f:
        f.write(new_content)
    
    print("已添加详细日志记录")

if __name__ == "__main__":
    print("开始修复AI调用链路的错误处理...")
    
    # 修复错误处理
    fix_ai_analyze_single_error_handling()
    fix_analyze_trend_with_deepseek_error_handling()
    
    # 添加详细日志
    add_detailed_logging()
    
    print("修复完成！")