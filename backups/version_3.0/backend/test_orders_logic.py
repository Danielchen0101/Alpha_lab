import json

# 模拟 make_alpaca_request 返回的数据
mock_orders_data = {
    'success': True,
    'data': [
        {
            'id': '6cb570f1-f1ea-45c8-9ca5-9fa6b0d5011b',
            'symbol': 'AAPL',
            'side': 'buy',
            'qty': '1',
            'filled_qty': '0',
            'type': 'market',
            'time_in_force': 'gtc',
            'status': 'accepted',
            'created_at': '2026-04-05T17:34:34.287930777Z',
            'filled_at': None,
            'limit_price': None,
            'stop_price': None
        }
    ]
}

# 模拟 orders 接口的处理逻辑
def process_orders_data(orders_data):
    """模拟 orders 接口的处理逻辑"""
    print(f"orders_data 类型: {type(orders_data)}")
    print(f"orders_data 键: {list(orders_data.keys())}")
    
    if orders_data and orders_data.get('success', False):
        print("success 为 True")
        
        # 实际数据在 'data' 字段中
        actual_orders = []
        if isinstance(orders_data, dict) and 'data' in orders_data:
            actual_orders = orders_data['data']
            print(f"从 'data' 字段提取订单数据，长度: {len(actual_orders)}")
        
        print(f"actual_orders 类型: {type(actual_orders)}")
        
        # 格式化返回数据给前端
        orders = []
        for order in actual_orders:
            # 解析时间字段
            created_at = order.get('created_at', '')
            filled_at = order.get('filled_at', '')
            
            # 确保时间格式正确
            if filled_at == '' or filled_at is None:
                filled_at = None
            
            orders.append({
                'orderId': order.get('id', ''),
                'symbol': order.get('symbol', ''),
                'side': order.get('side', ''),
                'quantity': float(order.get('qty', 0)),
                'type': order.get('type', ''),
                'timeInForce': order.get('time_in_force', ''),
                'status': order.get('status', ''),
                'createdAt': created_at,
                'filledAt': filled_at,
                'filledQty': float(order.get('filled_qty', 0)),
                'limitPrice': float(order.get('limit_price', 0)) if order.get('limit_price') else None,
                'stopPrice': float(order.get('stop_price', 0)) if order.get('stop_price') else None
            })
        
        print(f"成功处理 {len(orders)} 条订单")
        return {'success': True, 'data': orders}
    else:
        print("success 为 False 或 orders_data 为空")
        return {'success': True, 'data': []}

# 测试
print("测试 orders 接口逻辑:")
result = process_orders_data(mock_orders_data)
print(f"\n最终结果: {json.dumps(result, indent=2)}")