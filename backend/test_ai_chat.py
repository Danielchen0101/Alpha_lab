from flask import Flask, request, jsonify
from datetime import datetime

app = Flask(__name__)

ai_chat_history = []

@app.route('/api/ai/chat', methods=['POST'])
def ai_chat():
    data = request.json
    user_message = data.get('message', '').strip()
    
    if not user_message:
        return jsonify({'success': False, 'error': '消息不能为空'})
    
    ai_response = {
        'explanation': f'我理解你想说: "{user_message}"',
        'strategy_adjustment': '无调整',
        'recommended_action': '保持当前策略',
        'confidence': 0.7
    }
    
    chat_entry = {
        'timestamp': datetime.now().isoformat(),
        'user_message': user_message,
        'ai_response': ai_response
    }
    ai_chat_history.append(chat_entry)
    
    return jsonify({
        'success': True,
        'response': ai_response
    })

@app.route('/api/ai/chat/history', methods=['GET'])
def ai_chat_history_endpoint():
    return jsonify({
        'success': True,
        'history': ai_chat_history,
        'total_count': len(ai_chat_history)
    })

if __name__ == "__main__":
    print("测试 AI Chat 后端启动 - 端口 8890")
    app.run(host='127.0.0.1', port=8890, debug=False)