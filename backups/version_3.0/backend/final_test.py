import requests
import json

# 测试 Alpaca API 直接调用
print("1. 直接调用 Alpaca API:")
ALPACA_API_KEY = 'PK47HFNRVYZ7XZLLLYUULBIY4R'
ALPACA_API_SECRET = '6CgiJaMDvref9uoHRUph8qMyBKJyHbRxPrGHgKYq2T5g'
ALPACA_BASE_URL = 'https://paper-api.alpaca.markets/v2'

url = f"{ALPACA_BASE_URL}/orders?status