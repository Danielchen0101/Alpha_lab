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
            if positions