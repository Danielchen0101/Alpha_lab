# ==================== Block 3: AI Chat 接口 ====================

# AI Chat 历史存储
ai_chat_history = []

@app.route('/api/ai/chat', methods=['POST'])
def ai_chat():
    """AI Chat 接口 - 用户可以与 AI 对话并调整策略"""
    try:
        data = request.json
        user_message = data.get('message', '').strip()
        symbol = data.get('symbol', '')
        chat_history = data.get('history', [])
        
        if not user_message:
            return jsonify({'success': False, 'error': '消息不能为空'})
        
        # 构建 AI 提示
        system_prompt = """你是一个专业的量化交易AI助手。用户可以通过对话调整你的交易策略和行为。
        
        你可以：
        1. 解释你的交易决策
        2. 根据用户要求调整策略（更保守、更激进等）
        3. 回答关于市场、策略、风险的问题
        4. 提供交易建议和理由
        
        请以结构化方式回复，包含：
        - explanation: 对用户问题的解释
        - strategy_adjustment: 策略调整（如果有）
        - recommended_action: 建议的交易行动
        - risk_notes: 风险提示
        
        保持专业、简洁、有帮助。"""
        
        # 构建上下文
        context_parts = []
        
        # 1. 当前账户状态
        try:
            account_response = make_alpaca_request('GET', '/account')
            if account_response and account_response.get('success', False):
                context_parts.append(f"当前账户状态: 现金 ${account_response.get('cash', 0):.2f}, 权益 ${account_response.get('equity', 0):.2f}, 购买力 ${account_response.get('buying_power', 0):.2f}")
        except:
            context_parts.append("当前账户状态: 未知")
        
        # 2. 当前持仓
        try:
            positions_response = make_alpaca_request('GET', '/positions')
            if positions_response and isinstance(positions_response, list):
                if positions_response:
                    positions_info = ', '.join([f"{p.get('symbol', '')} {p.get('qty', 0)}股" for p in positions_response[:3]])
                    context_parts.append(f"当前持仓: {positions_info}")
                else:
                    context_parts.append("当前持仓: 无")
        except:
            context_parts.append("当前持仓: 未知")
        
        # 3. 当前 AI 设置
        context_parts.append(f"当前策略模式: {ai_strategy_state['current_strategy_mode']}")
        context_parts.append(f"交易偏好: {ai_strategy_state['trading_bias']}")
        context_parts.append(f"持仓周期: {ai_strategy_state['holding_horizon']}")
        context_parts.append(f"市场适应: {'开启' if ai_strategy_state['market_regime_adaptation'] else '关闭'}")
        
        # 4. 当前符号（如果提供）
        if symbol:
            context_parts.append(f"当前分析标的: {symbol}")
        
        # 5. 聊天历史（最近3条）
        if chat_history and len(chat_history) > 0:
            recent_history = chat_history[-3:]  # 只取最近3条
            history_context = "最近对话:\n" + "\n".join([f"{msg.get('role', 'user')}: {msg.get('content', '')}" for msg in recent_history])
            context_parts.append(history_context)
        
        # 构建完整上下文
        context = "\n".join(context_parts)
        
        # 构建完整提示
        full_prompt = f"""系统提示: {system_prompt}

当前交易上下文:
{context}

用户消息: {user_message}

请以结构化JSON格式回复，包含以下字段:
- explanation: 对用户问题的解释
- strategy_adjustment: 策略调整（如果有）
- recommended_action: 建议的交易行动
- risk_notes: 风险提示
- confidence: 置信度 (0-1)
- actionable: 是否可执行 (true/false)

只返回JSON，不要包含其他文本。"""
        
        # 调用 DeepSeek
        ai_response = call_deepseek(full_prompt, max_tokens=800)
        
        if 'error' in ai_response:
            # 如果 AI 调用失败，返回模拟响应
            ai_response = {
                'explanation': f'我理解你想说: "{user_message}"。由于技术原因，我无法调用AI模型，但我可以基于现有设置回复。',
                'strategy_adjustment': '无调整',
                'recommended_action': '保持当前策略',
                'risk_notes': '请确保所有交易决策都经过风险检查',
                'confidence': 0.5,
                'actionable': False
            }
        
        # 解析 AI 响应
        try:
            # 确保响应是字典
            if isinstance(ai_response, str):
                # 尝试解析字符串为 JSON
                import json
                ai_response = json.loads(ai_response)
            
            # 确保包含所有必需字段
            required_fields = ['explanation', 'strategy_adjustment', 'recommended_action', 'risk_notes', 'confidence', 'actionable']
            for field in required_fields:
                if field not in ai_response:
                    ai_response[field] = ''
            
            # 如果 AI 建议了策略调整，更新策略状态
            strategy_adjustment = ai_response.get('strategy_adjustment', '')
            if strategy_adjustment and strategy_adjustment != '无调整':
                # 解析策略调整
                if '保守' in strategy_adjustment:
                    ai_strategy_state['current_strategy_mode'] = 'conservative'
                elif '激进' in strategy_adjustment:
                    ai_strategy_state['current_strategy_mode'] = 'aggressive'
                elif '平衡' in strategy_adjustment:
                    ai_strategy_state['current_strategy_mode'] = 'balanced'
                
                if '只做多' in strategy_adjustment or '不做空' in strategy_adjustment:
                    ai_strategy_state['trading_bias'] = 'long_only'
                elif '做多做空' in strategy_adjustment:
                    ai_strategy_state['trading_bias'] = 'long_short'
                
                if '日内' in strategy_adjustment:
                    ai_strategy_state['holding_horizon'] = 'intraday'
                elif '波段' in strategy_adjustment:
                    ai_strategy_state['holding_horizon'] = 'swing'
                
                # 记录策略切换
                ai_strategy_state['last_strategy_switch'] = datetime.now().isoformat()
                ai_strategy_state['switch_reason'] = f'用户通过聊天调整: {user_message[:50]}...'
            
            # 保存聊天记录
            chat_entry = {
                'timestamp': datetime.now().isoformat(),
                'user_message': user_message,
                'ai_response': ai_response,
                'symbol': symbol,
                'strategy_adjustments': strategy_adjustment if strategy_adjustment != '无调整' else None
            }
            ai_chat_history.append(chat_entry)
            
            # 限制历史记录大小
            if len(ai_chat_history) > 100:
                ai_chat_history.pop(0)
            
            return jsonify({
                'success': True,
                'response': ai_response,
                'timestamp': datetime.now().isoformat(),
                'strategy_updated': strategy_adjustment != '无调整',
                'new_strategy_state': ai_strategy_state if strategy_adjustment != '无调整' else None
            })
            
        except Exception as parse_error:
            print(f"解析 AI 响应失败: {parse_error}")
            return jsonify({
                'success': False,
                'error': f'解析 AI 响应失败: {str(parse_error)}',
                'raw_response': ai_response
            })
        
    except Exception as e:
        print(f"AI Chat 接口异常: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/ai/chat/history', methods=['GET'])
def ai_chat_history_endpoint():
    """获取 AI Chat 历史"""
    try:
        limit = request.args.get('limit', 50, type=int)
        symbol = request.args.get('symbol', '')
        
        # 过滤历史记录
        filtered_history = ai_chat_history
        if symbol:
            filtered_history = [h for h in ai_chat_history if h.get('symbol') == symbol]
        
        # 限制返回数量
        recent_history = filtered_history[-limit:] if filtered_history else []
        
        return jsonify({
            'success': True,
            'history': recent_history,
            'total_count': len(filtered_history),
            'symbol_filter': symbol if symbol else 'all'
        })
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/ai/chat/clear', methods=['POST'])
def ai_chat_clear():
    """清空 AI Chat 历史"""
    try:
        symbol = request.json.get('symbol', '')
        
        if symbol:
            # 只清空特定符号的历史
            global ai_chat_history
            ai_chat_history = [h for h in ai_chat_history if h.get('symbol') != symbol]
            cleared_count = len([h for h in ai_chat_history if h.get('symbol') == symbol])
        else:
            # 清空所有历史
            cleared_count = len(ai_chat_history)
            ai_chat_history.clear()
        
        return jsonify({
            'success': True,
            'message': f'已清空 {cleared_count} 条聊天记录',
            'symbol': symbol if symbol else 'all'
        })
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500