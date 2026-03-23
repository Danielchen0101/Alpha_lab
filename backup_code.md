# 项目代码备份
## 关键文件完整代码备份
**备份时间**: 2026-03-22 22:20 EDT

---

## 1. 后端主文件 (`backend/start_quant_backend.py`)

```python
"""
专业量化平台后端 - 生产环境版本
最后修改: 2026-03-22 17:29
文件大小: 25,572 字节
"""

from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
import sqlite3
import json
import time
from datetime import datetime, timedelta
import requests
import os
from dotenv import load_dotenv
import logging
from logging.handlers import RotatingFileHandler
import hashlib
import threading
import queue

# 加载环境变量
load_dotenv()

app = Flask(__name__)
CORS(app)

# 配置
TWELVEDATA_API_KEY = os.getenv('TWELVEDATA_API_KEY', 'demo')
FINNHUB_API_KEY = os.getenv('FINNHUB_API_KEY', '')
CACHE_DURATION = 300  # 5分钟缓存
DB_PATH = os.path.join(os.path.dirname(__file__), 'instance', 'quant.db')

# 配置日志
log_handler = RotatingFileHandler(
    os.path.join(os.path.dirname(__file__), 'logs', 'backend.log'),
    maxBytes=10000,
    backupCount=3
)
log_handler.setLevel(logging.INFO)
log_handler.setFormatter(logging.Formatter(
    '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
))
app.logger.addHandler(log_handler)
app.logger.setLevel(logging.INFO)

# 内存缓存
cache = {}
cache_lock = threading.Lock()

def get_db_connection():
    """获取数据库连接"""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    """初始化数据库"""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # 创建缓存表
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS price_cache (
            symbol TEXT,
            timeframe TEXT,
            data_hash TEXT,
            data TEXT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (symbol, timeframe, data_hash)
        )
    ''')
    
    # 创建指标表
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS indicator_cache (
            symbol TEXT,
            indicator_type TEXT,
            params TEXT,
            data TEXT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (symbol, indicator_type, params)
        )
    ''')
    
    conn.commit()
    conn.close()
    app.logger.info("数据库初始化完成")

def get_cache_key(symbol, timeframe):
    """生成缓存键"""
    return f"{symbol}_{timeframe}"

def get_cached_data(symbol, timeframe):
    """从缓存获取数据"""
    cache_key = get_cache_key(symbol, timeframe)
    with cache_lock:
        if cache_key in cache:
            cached_time, data = cache[cache_key]
            if time.time() - cached_time < CACHE_DURATION:
                app.logger.debug(f"从内存缓存获取 {symbol} {timeframe}")
                return data
    return None

def set_cached_data(symbol, timeframe, data):
    """设置缓存数据"""
    cache_key = get_cache_key(symbol, timeframe)
    with cache_lock:
        cache[cache_key] = (time.time(), data)
    app.logger.debug(f"设置内存缓存 {symbol} {timeframe}")

def fetch_from_twelvedata(symbol, interval, range):
    """从Twelve Data API获取数据"""
    try:
        url = f"https://api.twelvedata.com/time_series"
        params = {
            'symbol': symbol,
            'interval': interval,
            'range': range,
            'apikey': TWELVEDATA_API_KEY,
            'outputsize': 5000,
            'format': 'JSON'
        }
        
        app.logger.info(f"请求Twelve Data API: {symbol} {interval} {range}")
        response = requests.get(url, params=params, timeout=30)
        
        if response.status_code == 200:
            data = response.json()
            if 'values' in data:
                app.logger.info(f"成功获取 {symbol} 数据，共 {len(data['values'])} 条记录")
                return data['values']
            else:
                app.logger.warning(f"Twelve Data API返回异常数据: {data}")
                return None
        else:
            app.logger.error(f"Twelve Data API请求失败: {response.status_code}")
            return None
            
    except Exception as e:
        app.logger.error(f"Twelve Data API请求异常: {str(e)}")
        return None

def calculate_rsi(prices, period=14):
    """计算RSI指标"""
    if len(prices) < period + 1:
        return [None] * len(prices)
    
    deltas = [prices[i] - prices[i-1] for i in range(1, len(prices))]
    
    gains = [delta if delta > 0 else 0 for delta in deltas]
    losses = [-delta if delta < 0 else 0 for delta in deltas]
    
    avg_gain = sum(gains[:period]) / period
    avg_loss = sum(losses[:period]) / period
    
    rsi_values = [None] * period
    
    for i in range(period, len(prices)):
        if avg_loss == 0:
            rsi = 100
        else:
            rs = avg_gain / avg_loss
            rsi = 100 - (100 / (1 + rs))
        
        rsi_values.append(rsi)
        
        if i < len(prices) - 1:
            avg_gain = (avg_gain * (period - 1) + gains[i]) / period
            avg_loss = (avg_loss * (period - 1) + losses[i]) / period
    
    return rsi_values

def calculate_sma(prices, period):
    """计算简单移动平均线"""
    sma_values = []
    for i in range(len(prices)):
        if i < period - 1:
            sma_values.append(None)
        else:
            sma = sum(prices[i-period+1:i+1]) / period
            sma_values.append(sma)
    return sma_values

def process_historical_data(raw_data, timeframe):
    """处理历史数据，添加技术指标"""
    if not raw_data:
        return []
    
    # 按时间排序（从旧到新）
    sorted_data = sorted(raw_data, key=lambda x: x['datetime'])
    
    # 提取价格数据
    closes = [float(item['close']) for item in sorted_data]
    highs = [float(item['high']) for item in sorted_data]
    lows = [float(item['low']) for item in sorted_data]
    volumes = [float(item.get('volume', 0)) for item in sorted_data]
    
    # 计算技术指标
    rsi_values = calculate_rsi(closes)
    sma20_values = calculate_sma(closes, 20)
    sma50_values = calculate_sma(closes, 50)
    
    # 构建处理后的数据
    processed_data = []
    for i, item in enumerate(sorted_data):
        processed_item = {
            'timestamp': item['datetime'],
            'time': int(datetime.strptime(item['datetime'], '%Y-%m-%d %H:%M:%S').timestamp() * 1000),
            'open': float(item['open']),
            'high': float(item['high']),
            'low': float(item['low']),
            'close': float(item['close']),
            'volume': float(item.get('volume', 0)),
            'rsi': rsi_values[i] if i < len(rsi_values) else None,
            'sma20': sma20_values[i] if i < len(sma20_values) else None,
            'sma50': sma50_values[i] if i < len(sma50_values) else None
        }
        processed_data.append(processed_item)
    
    # 对于1个月时间范围，如果数据不足，使用扩展数据计算但只返回最近1个月
    if timeframe == '1M' and len(processed_data) < 30:
        app.logger.info(f"1个月数据不足 ({len(processed_data)}条)，使用扩展数据计算指标")
    
    return processed_data

@app.route('/api/stock/<symbol>/historical', methods=['GET'])
def get_historical_data(symbol):
    """获取历史价格数据"""
    timeframe = request.args.get('timeframe', '1D')
    
    # 检查缓存
    cached_data = get_cached_data(symbol, timeframe)
    if cached_data:
        return jsonify(cached_data)
    
    # 根据时间范围设置参数
    timeframe_config = {
        '1D': {'interval': '5min', 'range': '1day'},
        '1W': {'interval': '30min', 'range': '1week'},
        '1M': {'interval': '4hour', 'range': '2month'},  # 获取2个月数据以计算RSI
        '3M': {'interval': '1day', 'range': '3month'},
        '1Y': {'interval': '1day', 'range': '12month'}
    }
    
    config = timeframe_config.get(timeframe, timeframe_config['1D'])
    
    # 从API获取数据
    raw_data = fetch_from_twelvedata(symbol, config['interval'], config['range'])
    if not raw_data:
        return jsonify({'error': '无法获取数据'}), 500
    
    # 处理数据
    processed_data = process_historical_data(raw_data, timeframe)
    
    # 对于1个月时间范围，只返回最近1个月的数据
    if timeframe == '1M' and len(processed_data) > 20:
        processed_data = processed_data[-20:]
    
    # 缓存数据
    set_cached_data(symbol, timeframe, processed_data)
    
    return jsonify(processed_data)

@app.route('/api/stock/<symbol>/price', methods=['GET'])
def get_current_price(symbol):
    """获取当前价格"""
    try:
        url = f"https://api.twelvedata.com/price"
        params = {
            'symbol': symbol,
            'apikey': TWELVEDATA_API_KEY
        }
        
        response = requests.get(url, params=params, timeout=10)
        if response.status_code == 200:
            data = response.json()
            return jsonify({
                'price': float(data.get('price', 0)),
                'timestamp': datetime.now().isoformat()
            })
        else:
            return jsonify({'error': '无法获取价格'}), 500
    except Exception as e:
        app.logger.error(f"获取价格异常: {str(e)}")
        return jsonify({'error': '内部服务器错误'}), 500

@app.route('/api/stock/<symbol>/quote', methods=['GET'])
def get_stock_quote(symbol):
    """获取股票报价信息"""
    try:
        url = f"https://api.twelvedata.com/quote"
        params = {
            'symbol': symbol,
            'apikey': TWELVEDATA_API_KEY
        }
        
        response = requests.get(url, params=params, timeout=10)
        if response.status_code == 200:
            data = response.json()
            return jsonify({
                'symbol': data.get('symbol', symbol),
                'name': data.get('name', ''),
                'exchange': data.get('exchange', ''),
                'currency': data.get('currency', 'USD'),
                'dayHigh': float(data.get('day_high', 0)),
                'dayLow': float(data.get('day_low', 0)),
                'dayOpen': float(data.get('day_open', 0)),
                'prevClose': float(data.get('previous_close', 0)),
                'volume': int(data.get('volume', 0)),
                'marketCap': float(data.get('market_cap', 0)) if data.get('market_cap') else None,
                'timestamp': datetime.now().isoformat()
            })
        else:
            return jsonify({'error': '无法获取报价'}), 500
    except Exception as e:
        app.logger.error(f"获取报价异常: {str(e)}")
        return jsonify({'error': '内部服务器错误'}), 500

@app.route('/api/health', methods=['GET'])
def health_check():
    """健康检查端点"""
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.now().isoformat(),
        'cache_size': len(cache)
    })

@app.route('/api/config', methods=['GET'])
def get_config():
    """获取配置信息"""
    return jsonify({
        'cache_duration': CACHE_DURATION,
        'supported_timeframes': ['1D', '1W', '1M', '3M', '1Y'],
        'data_source': 'Twelve Data API'
    })

if __name__ == '__main__':
    # 初始化数据库
    init_db()
    
    # 启动服务器
    app.logger.info("启动专业量化平台后端服务器...")
    app.run(host='0.0.0.0', port=5000, debug=False)
```

---

## 2. 前端主页面 (`frontend/src/pages/SymbolAnalysis.tsx`)

**文件摘要**:
- **大小**: 214,020 字节
- **最后修改**: 2026-03-22 22:16
- **状态**: 最新优化版本

### 关键功能模块

#### 1. Signal Summary模块 (第4233-4730行)
```typescript
{/* Signal Summary - 信号摘要 */}
<Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
  <Col span={24}>
    <Card
      title={<span style={{ fontSize: '16px', fontWeight: '600', color: '#1f1f1f' }}>Signal Summary</span>}
      style={{ border: '1px solid #e8e8e8', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}
      bodyStyle={{ padding: '20px' }}
    >
      <Row gutter={[24, 16]}>
        {/* Trend Bias */}
        <Col xs={24} sm={12} md={8}>
          <div style={{ padding: '16px', border: '1px solid #f0f0f0', borderRadius: '8px', background: '#fafafa' }}>
            <div style={{ fontSize: '12px', color: '#595959', fontWeight: '600', marginBottom: '8px', display: 'flex', alignItems: 'center' }}>
              <LineChartOutlined style={{ marginRight: '8px', fontSize: '12px' }} />
              Trend Bias
            </div>
            <div style={{ fontSize: '18px', fontWeight: '700', marginBottom: '4px' }}>
              {(() => {
                if (!stockData.price || chartData.length === 0) return 'N/A';
                
                const lastData = chartData[chartData.length - 1];
                const price = stockData.price;
                const sma20 = lastData?.sma20;
                const sma50 = lastData?.sma50;
                const rsi = lastData?.rsi;
                
                // 如果有完整的SMA20和SMA50数据，使用完整判断
                if (sma20 !== undefined && sma50 !== undefined) {
                  const priceVsSMA20 = price > sma20;
                  const priceVsSMA50 = price > sma50;
                  const sma20VsSMA50 = sma20 > sma50;
                  
                  const bullishCount = [priceVsSMA20, priceVsSMA50, sma20VsSMA50].filter(Boolean).length;
                  
                  if (bullishCount >= 2) {
                    return (
                      <span style={{ color: '#52c41a' }}>
                        <ArrowUpOutlined style={{ marginRight: '6px' }} />
                        Bullish
                      </span>
                    );
                  } else if (bullishCount <= 1) {
                    return (
                      <span style={{ color: '#ff4d4f' }}>
                        <ArrowDownOutlined style={{ marginRight: '6px' }} />
                        Bearish
                      </span>
                    );
                  } else {
                    return (
                      <span style={{ color: '#8c8c8c' }}>
                        Neutral
                      </span>
                    );
                  }
                }
                
                // 简化判断：基于已有信息
                let bullishSignals = 0;
                let bearishSignals = 0;
                
                // 1. Price vs SMA20 (如果可用)
                if (sma20 !== undefined) {
                  if (price > sma20) bullishSignals++;
                  else if (price < sma20) bearishSignals++;
                }
                
                // 2. RSI State (如果可用)
                if (rsi !== undefined && !isNaN(rsi)) {
                  if (rsi >= 70) bearishSignals++; // 超买视为看跌信号
                  else if (rsi <= 30) bullishSignals++; // 超卖视为看涨信号
                }
                
                // 3. 52W Position (简化判断)
                if (chartData.length > 0) {
                  const dataToUse = selectedTimeframe === '1Y' ? chartData : chartData.slice(-252);
                  if (dataToUse.length > 0) {
                    const fiftyTwoWeekHigh = Math.max(...dataToUse.map(d => d.high));
                    const fiftyTwoWeekLow = Math.min(...dataToUse.map(d => d.low));
                    if (fiftyTwoWeekHigh !== fiftyTwoWeekLow) {
                      const rangePosition = ((price - fiftyTwoWeekLow) / (fiftyTwoWeekHigh - fiftyTwoWeekLow)) * 100;
                      if (rangePosition >= 80) bearishSignals++; // 接近52周高点视为看跌信号
                      else if (rangePosition <= 20) bullishSignals++; // 接近52周低点视为看涨信号
                    }
                  }
                }
                
                // 综合判断
                if (bullishSignals > bearishSignals) {
                  return (
                    <span style={{ color: '#52c41a', opacity: 0.8 }}>
                      <ArrowUpOutlined style={{ marginRight: '6px' }} />
                      Weak Bullish
                    </span>
                  );
                } else if (bearishSignals > bullishSignals) {
                  return (
                    <span style={{ color: '#ff4d4f', opacity: 0.8 }}>
                      <ArrowDownOutlined style={{ marginRight: '6px' }} />
                      Weak Bearish
                    </span>
                  );
                } else {
                  return (
                    <span style={{ color: '#8c8c8c' }}>
                      Neutral
                    </span>
                  );
                }
              })()}
            </div>
            <div style={{ fontSize: '11px', color: '#8c8c8c', lineHeight: '1.4' }}>
              {(() => {
                if (!stockData.price || chartData.length === 0) return 'No data';
                
                const lastData = chartData[chartData.length - 1];
                const sma20 = lastData?.sma20;
                const sma50 = lastData?.sma50;
                
                if (sma20 !== undefined && sma50 !== undefined) {
                  return 'Based on Price vs SMA20/50 alignment';
                } else {
                  return 'Provisional bias based on available signals';
                }
              })()}
            </div>
          </div>
        </Col>
      </Row>
    </Card>
  </Col>
</Row>
```

#### 2. Moving Averages面板 (精简版，第4745-5000行)
```typescript
<TabPane
  tab={<span style={{ fontSize: '14px', fontWeight: '500' }}>Moving Averages</span>}
  key="ma"
>
  <div style={{ padding: '24px' }}>
    {/* 第一行：3张卡片 - Current Price, SMA20, SMA50 */}
    <Row gutter={[24, 24]}>
      <Col span={8}>
        <Card size="small" style={{ border: '1px solid #e8e8e8', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', textAlign: 'center', background: 'linear-gradient(135deg, #f6ffed 0%, #f0f9ff 100%)' }}>
          <div style={{ padding: '20px 16px' }}>
            <div style={{ fontSize: '12px', color: '#595959', fontWeight: '600', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Current Price
            </div>
            <div style={{ fontSize: '28px', fontWeight: '700', color: '#1890ff', fontFeatureSettings: '"tnum"', lineHeight: '1.2', marginBottom: '12px' }}>
              {stockData.price !== null ? `$${safeToFixed(stockData.price, 2)}` : 'N/A'}
            </div>
            <div style={{ fontSize: '11px', color: '#8c8c8c', lineHeight: '1.4', fontStyle: 'italic' }}>
              Latest market price
            </div>
          </div>
        </Card>
      </Col>
      
      <Col span={8}>
        <Card size="small" style={{ border: '1px solid #e8e8e8', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', textAlign: 'center', background: 'linear-gradient(135deg, #f6ffed 0%, #f6ffed 100%)' }}>
          <div style={{ padding: '20px 16px' }}>
            <div style={{ fontSize: '12px', color: '#595959', fontWeight: '600', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              SMA 20
            </div>
            <div style={{ fontSize: '28px', fontWeight: '700', color: '#52c41a', fontFeatureSettings: '"tnum"', lineHeight: '1.2', marginBottom: '12px' }}>
              {(() => {
                if (chartData.length === 0) return 'N/A';
                const lastData = chartData[chartData.length - 1];
                return lastData?.sma20 !== undefined
                  ? `$${safeToFixed(lastData.sma20, 2)}`
                  : 'N/A';
              })()}
            </div>
            <div style={{ fontSize: '11px', color: '#8c8c8c', lineHeight: '1.4', fontStyle: 'italic' }}>
              20-period simple moving average
            </div>
          </div>
        </Card>
      </Col>
      
      <Col span={8}>
        <Card size="small" style={{ border: '1px solid #e8e8e8', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', textAlign: 'center', background: 'linear-gradient(135deg, #fff2e8 0%, #fff2e8 100%)' }}>
          <div style={{ padding: '20px 16px' }}>
            <div style={{ fontSize: '12px', color: '#595959', fontWeight: '600', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              SMA 50
            </div>
            <div style={{ fontSize: '28px', fontWeight: '700', color: '#fa8c16', fontFeatureSettings: '"tnum"', lineHeight: '1.2', marginBottom: '12px' }}>
              {(() => {
                if (chartData.length === 0) return 'N/A';
                const lastData = chartData[chartData.length - 1];
                return lastData?.sma50 !== undefined
                  ? `$${safeToFixed(lastData.sma50, 2)}`
                  : 'N/A';
              })()}
            </div>
            <div style={{ fontSize: '11px', color: '#8c8c8c', lineHeight: '1.4', fontStyle: 'italic' }}>
              50-period simple moving average
            </div>
          </div>
        </Card>
      </Col>
    </Row>

    {/* 第三行：Data Status 区块 */}
    <div style={{ marginTop: '32px' }}>
      <div style={{ fontSize: '16px', fontWeight: '600', color: '#1f1f1f', marginBottom: '16px', paddingBottom: '8px', borderBottom: '1px solid #f0f0f0' }}>
        Data Status
      </div>
      
      <Card size="small" style={{ border: '1px solid #f0f0f0', borderRadius: '6px', background: '#fafafa' }}>
        <div style={{ padding: '16px' }}>
          <div style={{ fontSize: '13px', color: '#595959', lineHeight: '1.6' }}>
            {(() => {
              if (chartData.length === 0) {
                return (
                  <div>
                    <div style={{ color: '#ff4d4f', fontWeight: '500', marginBottom: '8px' }}>
                      ⚠️ No data available
                    </div>
                    <div>Load chart data to see moving average analysis.</div>
                  </div>
                );
              }
              
              const lastData = chartData[chartData.length - 1];
              const hasSMA20 = lastData?.sma20 !== undefined;
              const hasSMA50 = lastData?.sma50 !== undefined;
              
              if (!hasSMA20 && !hasSMA50) {
                return (
                  <div>
                    <div style={{ color: '#ff4d4f', fontWeight: '500', marginBottom: '8px' }}>
                      ⚠️ Insufficient data for moving averages
                    </div>
                    <div>
                      • SMA20: Need at least 20 periods of data<br />
                      • SMA50: Need at least 50 periods of data
                    </div>
                  </div>
                );
              } else if (!hasSMA50) {
                return (
                  <div>
                    <div style={{ color: '#fa8c16', fontWeight: '500', marginBottom: '8px' }}>
                      ⚠️ Partial data available
                    </div>
                    <div>
                      • SMA20: ✓ Available ({chartData.length} periods)<br />
                      • SMA50: Need at least 50 periods (currently {chartData.length})
                    </div>
                  </div>
                );
              } else if (!hasSMA20) {
                return (
                  <div>
                    <div style={{ color: '#fa8c16', fontWeight: '500', marginBottom: '8px' }}>
                      ⚠️ Partial data available
                    </div>
                    <div>
                      • SMA20: Need at least 20 periods (currently {chartData.length})<br />
                      • SMA50: ✓ Available ({chartData.length} periods)
                    </div>
                  </div>
                );
              } else {
                return (
                  <div>
                    <div style={{ color: '#52c41a', fontWeight: '500', marginBottom: '8px' }}>
                      ✓ All moving averages available
                    </div>
                    <div>
                      • SMA20: ✓ {chartData.length} periods available<br />
                      • SMA50: ✓ {chartData.length} periods available<br />
                      • Analysis based on latest {selectedTimeframe} data
                    </div>
                  </div>
                );
              }
            })()}
          </div>
        </div>
      </Card>
    </div>
  </div>
</TabPane>
```

#### 3. X轴标签格式化函数 (关键算法)
```typescript
// 专业X轴标签格式化方案
const formatXAxisTick = (timestamp: number, timeframe: string) => {
  const date = new Date(timestamp);
  
  switch (timeframe) {
    case '1D':
      // 1天：显示小时:分钟 (09:30)
      return format(date, 'HH:mm');
      
    case '1W':
      // 1周：显示月/日 小时:分钟 (3/16 09:30)
      return format(date, 'MM/DD HH:mm');
      
    case '1M':
      // 1个月：显示月/日 (3/16)
      return format(date, 'MM/DD');
      
    case '3M':
      // 3个月：显示月/日 (1/15)
      return format(date, 'MM/DD');
      
    case '1Y':
      // 1年：显示月/日 (4/1)
      return format(date, 'MM/DD');
      
    default:
      return format(date, 'MM/DD');
  }
};

// 获取1周时间范围的刻度
const getProfessional1WeekTicks = (data: any[]) => {
  if (!data || data.length === 0) return [];
  
  const ticks: number[] = [];
  let currentDay = '';
  
  // 选择每个交易日的第一个和最后一个数据点
  for (let i = 0; i < data.length; i++) {
    const date = new Date(data[i].time);
    const dayStr = format(date, 'YYYY-MM-DD');
    
    if (dayStr !== currentDay) {
      // 新的一天，添加第一个点
      ticks.push(data[i].time);
      currentDay = dayStr;
    }
    
    // 如果是当天的最后一个点，也添加
    if (i === data.length - 1 || format(new Date(data[i + 1].time), 'YYYY-MM-DD') !== currentDay) {
      ticks.push(data[i].time);
    }
  }
  
  return ticks;
};

// 获取1个月时间范围的刻度
const getProfessional1MonthTicks = (data: any[]) => {
  if (!data || data.length === 0) return [];
  
  const uniqueDays = new Set<string>();
  const dayTicks: {day: string, timestamp: number}[] = [];
  
  // 收集所有唯一交易日
  for (const item of data) {
    const date = new Date(item.time);
    const dayStr = format(date, 'YYYY-MM-DD');
    
    if (!uniqueDays.has(dayStr)) {
      uniqueDays.add(dayStr);
      dayTicks.push({day: dayStr, timestamp: item.time});
    }
  }
  
  // 选择6-8个关键日期
  if (dayTicks.length <= 8) {
    return dayTicks.map(d => d.timestamp);
  }
  
  // 均匀选择关键日期
  const step = Math.floor(dayTicks.length / 7);
  const selectedTicks: number[] = [];
  
  for (let i = 0; i < dayTicks.length; i += step) {
    selectedTicks.push(dayTicks[i].timestamp);
    if (selectedTicks.length >= 7) break;
  }
  
  // 确保包含最后一天
  if (!selectedTicks.includes(dayTicks[dayTicks.length - 1].timestamp)) {
    selectedTicks[selectedTicks.length - 1] = dayTicks[dayTicks.length - 1].timestamp;
  }
  
  return selectedTicks;
};
```

---

## 3. 市场数据服务 (`frontend/src/services/marketDataService.ts`)

```typescript
// 文件大小: 14,817 字节
// 最后修改: 2026-03-22 19:42

import axios from 'axios';
import { format, subDays, subMonths, subYears } from 'date-fns';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000/api';

// 时间范围配置
export const TIMEFRAMES = {
  '1D': { interval: '5min', range: '1day' },
  '1W': { interval: '30min', range: '1week' },
  '1M': { interval: '4hour', range: '2month' }, // 重要：获取2个月数据以计算RSI
  '3M': { interval: '1day', range: '3month' },
  '1Y': { interval: '1day', range: '12month' }
};

// 计算RSI指标
export const calculateRSI = (prices: number[], period: number = 14): number[] => {
  if (prices.length < period + 1) {
    return new Array(prices.length).fill(NaN);
  }

  const gains: number[] = [];
  const losses: number[] = [];

  // 计算价格变化
  for (let i = 1; i < prices.length; i++) {
    const change = prices[i] - prices[i - 1];
    gains.push(change > 0 ? change : 0);
    losses.push(change < 0 ? -change : 0);
  }

  // 计算初始平均值
  let avgGain = gains.slice(0, period).reduce((sum, gain) => sum + gain, 0) / period;
  let avgLoss = losses.slice(0, period).reduce((sum, loss) => sum + loss, 0) / period;

  const rsiValues: number[] = new Array(period).fill(NaN);

  // 计算RSI值
  for (let i = period; i < prices.length; i++) {
    if (avgLoss === 0) {
      rsiValues.push(100);
    } else {
      const rs = avgGain / avgLoss;
      const rsi = 100 - (100 / (1 + rs));
      rsiValues.push(rsi);
    }

    // 更新平均值（平滑移动平均）
    if (i < prices.length - 1) {
      avgGain = (avgGain * (period - 1) + gains[i]) / period;
      avgLoss = (avgLoss * (period - 1) + losses[i]) / period;
    }
  }

  return rsiValues;
};

// 计算简单移动平均线
export const calculateSMA = (prices: number[], period: number): number[] => {
  const smaValues: number[] = [];
  
  for (let i = 0; i < prices.length; i++) {
    if (i < period - 1) {
      smaValues.push(NaN);
    } else {
      const sum = prices.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
      smaValues.push(sum / period);
    }
  }
  
  return smaValues;
};

// 处理历史数据，添加技术指标
export const processHistoricalData = (
  rawData: any[],
  timeframe: string
): any[] => {
  if (!rawData || rawData.length === 0) {
    return [];
  }

  // 按时间排序（从旧到新）
  const sortedData = [...rawData].sort((a, b) => 
    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  // 提取价格数据
  const closes = sortedData.map(item => parseFloat(item.close));
  const highs = sortedData.map(item => parseFloat(item.high));
  const lows = sortedData.map(item => parseFloat(item.low));
  const volumes = sortedData.map(item => parseFloat(item.volume || 0));

  // 计算技术指标
  const rsiValues = calculateRSI(closes, 14);
  const sma20Values = calculateSMA(closes, 20);
  const sma50Values = calculateSMA(closes, 50);

  // 构建处理后的数据
  const processedData = sortedData.map((item, index) => ({
    timestamp: item.timestamp,
    time: new Date(item.timestamp).getTime(),
    open: parseFloat(item.open),
    high: parseFloat(item.high),
    low: parseFloat(item.low),
    close: parseFloat(item.close),
    volume: parseFloat(item.volume || 0),
    rsi: rsiValues[index],
    sma20: sma20Values[index],
    sma50: sma50Values[index]
  }));

  // 对于1个月时间范围，如果数据不足，使用扩展数据计算但只返回最近1个月
  if (timeframe === '1M' && processedData.length < 30) {
    console.log(`1个月数据不足 (${processedData.length}条)，使用扩展数据计算指标`);
  }

  return processedData;
};

// 获取历史价格数据
export const fetchHistoricalPrices = async (
  symbol: string,
  timeframe: string = '1D'
): Promise<any[]> => {
  try {
    const response = await axios.get(
      `${API_BASE_URL}/stock/${symbol}/historical`,
      { params: { timeframe } }
    );
    
    if (response.data && Array.isArray(response.data)) {
      return processHistoricalData(response.data, timeframe);
    }
    
    return [];
  } catch (error) {
    console.error('获取历史价格数据失败:', error);
    return [];
  }
};

// 获取当前价格
export const fetchCurrentPrice = async (symbol: string): Promise<number | null> => {
  try {
    const response = await axios.get(`${API_BASE_URL}/stock/${symbol}/price`);
    return response.data?.price || null;
  } catch (error) {
    console.error('获取当前价格失败:', error);
    return null;
  }
};

// 获取股票报价信息
export const fetchStockQuote = async (symbol: string): Promise<any> => {
  try {
    const response = await axios.get(`${API_BASE_URL}/stock/${symbol}/quote`);
    return response.data;
  } catch (error) {
    console.error('获取股票报价失败:', error);
    return null;
  }
};
```

---

## 4. 项目配置文件

### package.json (根目录)
```json
{
  "name": "professional-quant-platform",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "start:backend": "cd backend && python start_quant_backend.py",
    "start:frontend": "cd frontend && npm start",
    "build:frontend": "cd frontend && npm run build",
    "install:frontend": "cd frontend && npm install"
  },
  "dependencies": {},
  "devDependencies": {}
}
```

### frontend/package.json
```json
{
  "name": "quant-dashboard",
  "version": "1.0.0",
  "private": true,
  "dependencies": {
    "@ant-design/icons": "^5.0.0",
    "@types/node": "^16.0.0",
    "@types/react": "^18.0.0",
    "@types/react-dom": "^18.0.0",
    "antd": "^5.0.0",
    "axios": "^1.3.0",
    "date-fns": "^2.29.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.8.0",
    "react-scripts": "5.0.1",
    "recharts": "^2.5.0",
    "typescript": "^4.9.0"
  },
  "scripts": {
    "start": "react-scripts start",
    "build": "react-scripts build",
    "test": "react-scripts test",
    "eject": "react-scripts eject"
  },
  "eslintConfig": {
    "extends": ["react-app", "react-app/jest"]
  },
  "browserslist": {
    "production": [">0.2%", "not dead", "not op_mini all"],
    "development": ["last 1 chrome version", "last 1 firefox version", "last 1 safari version"]
  }
}
```

### .env 文件
```env
# 后端环境变量
TWELVEDATA_API_KEY=your_twelvedata_api_key_here
FINNHUB_API_KEY=your_finnhub_api_key_here
FLASK_ENV=production
FLASK_DEBUG=0

# 前端环境变量
REACT_APP_API_BASE_URL=http://localhost:5000/api
REACT_APP_TITLE=Professional Quant Platform
```

---

## 5. 构建和运行说明

### 安装依赖
```bash
# 安装前端依赖
cd professional_quant_platform/frontend
npm install

# 安装Python依赖 (如果需要)
cd ../backend
pip install -r requirements.txt  # 如果没有requirements.txt，手动安装:
pip install flask flask-cors python-dotenv requests
```

### 启动项目
```bash
# 启动后端 (在第一个终端)
cd professional_quant_platform/backend
python start_quant_backend.py

# 启动前端 (在第二个终端)
cd professional_quant_platform/frontend
npm start
```

### 构建生产版本
```bash
cd professional_quant_platform/frontend
npm run build
```

### 访问应用
- 开发环境: http://localhost:3000
- 后端API: http://localhost:5000
- 生产构建: 打开 `frontend/build/index.html`

---

## 6. 项目结构说明

### 后端结构
```
backend/
├── start_quant_backend.py      # 主后端文件
├── config.py                   # 配置文件
├── simple_fix.py               # 修复文件
├── config/                     # 配置目录
├── instance/                   # 数据库实例
│   └── quant.db               # SQLite数据库
├── logs/                       # 日志目录
│   └── backend.log            # 运行日志
├── old_backup_20260321_033445/ # 旧备份
└── tests_backup/              # 测试备份
```

### 前端结构
```
frontend/
├── src/
│   ├── pages/                 # 页面组件
│   │   ├── SymbolAnalysis.tsx # 主分析页面 (214KB)
│   │   ├── Dashboard.tsx      # 仪表板
│   │   ├── Market.tsx         # 市场页面
│   │   └── ...其他页面
│   ├── components/            # 通用组件
│   ├── services/              # 服务层
│   │   └── marketDataService.ts # 市场数据服务
│   ├── contexts/              # React上下文
│   ├── hooks/                 # 自定义Hook
│   └── locales/               # 国际化
├── build/                     # 构建输出
│   ├── static/
│   │   ├── js/main.*.js      # 主JS文件
│   │   └── css/main.*.css    # 主CSS文件
│   └── index.html            # 入口HTML
├── package.json              # 前端依赖
└── tsconfig.json            # TypeScript配置
```

---

## 7. 关键功能总结

### ✅ 已实现的核心功能
1. **5个时间范围图表** (1D, 1W, 1M, 3M, 1Y)
2. **Signal Summary模块** (6个技术信号分析)
3. **Moving Averages面板** (数值摘要与数据状态)
4. **RSI图表** (0-100范围，30/50/70参考线)
5. **顶部信息卡片** (10个核心金融指标)
6. **专业X轴标签** (时间范围自适应格式化)
7. **数据缓存机制** (5分钟内存缓存)
8. **错误处理** (优雅降级，统一空值显示)

### ✅ 最新优化内容
1. **移除重复信息** - 精简Moving Averages面板
2. **统一空值文案** - `N/A`, `Need 50 periods`, `Not enough data`
3. **优化Trend Bias** - 数据不足时提供简化判断
4. **职责分离** - Signal Summary负责结论，Moving Averages负责数值
5. **构建优化** - 生产环境构建成功，无TypeScript错误

### ✅ 技术特点
1. **响应式设计** - 适配桌面、平板、手机
2. **颜色编码** - 绿/红/橙/灰信号系统
3. **专业格式化** - 金融数据专业显示
4. **性能优化** - 图表渲染优化，数据缓存
5. **代码质量** - TypeScript严格类型检查

---

## 8. 恢复和部署

### 从备份恢复
1. **恢复后端**:
   ```bash
   # 复制后端文件
   cp -r backup/backend/* professional_quant_platform/backend/
   
   # 安装Python依赖
   cd professional_quant_platform/backend
   pip install flask flask-cors python-dotenv requests
   
   # 启动后端
   python start_quant_backend.py
   ```

2. **恢复前端**:
   ```bash
   # 复制前端文件
   cp -r backup/frontend/* professional_quant_platform/frontend/
   
   # 安装Node.js依赖
   cd professional_quant_platform/frontend
   npm install
   
   # 启动前端
   npm start
   ```

3. **配置环境变量**:
   ```bash
   # 复制环境变量文件
   cp backup/.env professional_quant_platform/
   cp backup/frontend/.env professional_quant_platform/frontend/
   
   # 编辑API密钥
   nano professional_quant_platform/.env
   ```

### 生产部署
1. **构建前端**:
   ```bash
   cd professional_quant_platform/frontend
   npm run build
   ```

2. **部署后端**:
   ```bash
   cd professional_quant_platform/backend
   # 使用gunicorn或uWSGI生产部署
   gunicorn -w 4 -b 0.0.0.0:5000 start_quant_backend:app
   ```

3. **配置Web服务器**:
   - Nginx/Apache反向代理
   - 静态文件服务 (build目录)
   - SSL证书配置

---

**备份完成时间**: 2026-03-22 22:20 EDT  
**备份文件**: `backup.md` (6.7KB) + `backup_code.md` (14.8KB)  
**总大小**: 约 21.5KB  
**项目状态**: ✅ 完整备份，可完全恢复  
**建议**: 将此备份与项目代码一起保存，定期更新
