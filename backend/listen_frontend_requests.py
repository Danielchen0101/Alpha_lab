#!/usr/bin/env python3
"""
监听前端请求 - 验证前端实际连接到哪个端口
"""

import http.server
import socketserver
import json
import time

PORT = 8888  # 监听端口

class RequestHandler(http.server.BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        # 自定义日志格式
        print(f"[前端请求] {self.address_string()} - {format % args}")
    
    def do_GET(self):
        print(f"\n[GET请求] 路径: {self.path}")
        print(f"[GET请求] 头部: {dict(self.headers)}")
        
        # 返回简单的响应
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        
        response = {
            'status': 'ok',
            'backend': 'listener',
            'port': PORT,
            'path': self.path,
            'timestamp': int(time.time())
        }
        
        self.wfile.write(json.dumps(response).encode())
    
    def do_POST(self):
        content_length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(content_length) if content_length else b''
        
        print(f"\n[POST请求] 路径: {self.path}")
        print(f"[POST请求] 头部: {dict(self.headers)}")
        
        try:
            if body:
                data = json.loads(body.decode('utf-8'))
                print(f"[POST请求] 请求体: {json.dumps(data, indent=2)}")
        except:
            print(f"[POST请求] 请求体(原始): {body[:500]}")
        
        # 返回简单的响应
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        
        response = {
            'success': True,
            'backend': 'listener',
            'port': PORT,
            'path': self.path,
            'timestamp': int(time.time())
        }
        
        self.wfile.write(json.dumps(response).encode())

def main():
    print(f"启动监听服务器，端口: {PORT}")
    print(f"前端应该通过代理连接到这个端口")
    print(f"如果前端请求到达这里，说明代理配置指向了 {PORT}")
    print(f"按 Ctrl+C 停止\n")
    
    with socketserver.TCPServer(("", PORT), RequestHandler) as httpd:
        print(f"服务器启动在 http://127.0.0.1:{PORT}")
        httpd.serve_forever()

if __name__ == "__main__":
    main()