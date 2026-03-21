import React, { useState, useEffect } from 'react';
import { Card, Table, Tag, Input, Select, Button, Row, Col, Statistic, Space, Alert, message, Empty, Spin, Skeleton } from 'antd';
import { SearchOutlined, LineChartOutlined, PlayCircleOutlined, BarChartOutlined, ReloadOutlined, EyeOutlined, StarOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import marketDataService, { StockData, formatCurrency, formatPercent, safeNumber, safeToFixed } from '../services/marketDataService';
import { useLanguage } from '../contexts/LanguageContext';
import DataSourceBadge from '../components/DataSourceBadge';

const { Option } = Select;

const Market: React.FC = () => {
  const [stocks, setStocks] = useState<StockData[]>([]);
  const [filteredStocks, setFilteredStocks] = useState<StockData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [searchText, setSearchText] = useState('');
  const [selectedSector, setSelectedSector] = useState<string>('all');
  const [sortField, setSortField] = useState<string>('symbol');
  const [sortOrder, setSortOrder] = useState<'ascend' | 'descend'>('ascend');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [searching, setSearching] = useState(false);
  const [watchlist, setWatchlist] = useState<any[]>([]);
  const navigate = useNavigate();

  const STORAGE_KEY = "quant_watchlist";

  // 默认股票列表
  const DEFAULT_SYMBOLS = ['AAPL', 'MSFT', 'GOOGL', 'TSLA', 'NVDA', 'AMZN', 'META', 'JPM', 'JNJ', 'V'];

  // 格式化市值函数（与Dashboard一致）
  const formatMarketCap = (value: number | null | undefined): string => {
    if (value === null || value === undefined || value === 0) return '--';
    
    const num = Number(value);
    if (isNaN(num)) return '--';
    
    // 万亿 (Trillion) - 1万亿 = 1e12
    if (num >= 1e12) {
      const trillions = num / 1e12;
      // 对于万亿级别，显示1位小数，除非是整数
      return `$${trillions.toFixed(trillions >= 100 ? 0 : trillions >= 10 ? 1 : 2)}T`;
    }
    
    // 十亿 (Billion) - 10亿 = 1e9
    if (num >= 1e9) {
      const billions = num / 1e9;
      // 对于十亿级别，显示1位小数
      return `$${billions.toFixed(billions >= 100 ? 0 : billions >= 10 ? 1 : 2)}B`;
    }
    
    // 百万 (Million) - 1百万 = 1e6
    if (num >= 1e6) {
      const millions = num / 1e6;
      return `$${millions.toFixed(millions >= 10 ? 0 : 1)}M`;
    }
    
    // 千 (Thousand) - 1千 = 1e3
    if (num >= 1e3) {
      const thousands = num / 1e3;
      return `$${thousands.toFixed(thousands >= 100 ? 0 : thousands >= 10 ? 1 : 2)}K`;
    }
    
    return `$${num.toFixed(2)}`;
  };

  // 初始化加载数据
  useEffect(() => {
    fetchMarketData();
    // 从localStorage加载watchlist
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setWatchlist(parsed);
        }
      } catch (err) {
        console.error('Failed to parse watchlist from localStorage:', err);
      }
    }
  }, []);

  // 过滤和排序股票
  useEffect(() => {
    filterAndSortStocks();
  }, [stocks, searchText, selectedSector, sortField, sortOrder]);

  // 监听localStorage变化，实现页面间watchlist同步
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) {
        if (e.newValue) {
          try {
            const parsed = JSON.parse(e.newValue);
            if (Array.isArray(parsed)) {
              setWatchlist(parsed);
            }
          } catch (err) {
            console.error('Failed to parse watchlist from storage event:', err);
          }
        } else {
          setWatchlist([]);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  const filterAndSortStocks = () => {
    let result = [...stocks];

    // 按搜索文本过滤
    if (searchText.trim()) {
      const searchLower = searchText.toLowerCase();
      result = result.filter(stock =>
        stock.symbol.toLowerCase().includes(searchLower) ||
        (stock.name && stock.name.toLowerCase().includes(searchLower))
      );
    }

    // 按行业过滤
    if (selectedSector !== 'all') {
      result = result.filter(stock => stock.sector === selectedSector);
    }

    // 排序
    result.sort((a, b) => {
      const aValue = a[sortField as keyof StockData];
      const bValue = b[sortField as keyof StockData];

      // 处理 null 值
      if (aValue === null || aValue === undefined) return sortOrder === 'ascend' ? -1 : 1;
      if (bValue === null || bValue === undefined) return sortOrder === 'ascend' ? 1 : -1;

      // 数字排序
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortOrder === 'ascend' ? aValue - bValue : bValue - aValue;
      }

      // 字符串排序
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortOrder === 'ascend'
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }

      return 0;
    });

    setFilteredStocks(result);
  };

  const fetchMarketData = async () => {
    try {
      setLoading(true);
      setError('');
      
      console.log('正在从 Finnhub 获取市场数据...');
      const stockData = await marketDataService.getStocks(DEFAULT_SYMBOLS);
      
      if (stockData.length > 0) {
        console.log('=== 市场数据加载成功 ===');
        console.log('数据来源:', stockData[0]?.dataSource || 'Finnhub');
        console.log('股票数量:', stockData.length);
        console.log('第一个股票:', stockData[0]);
        
        // 过滤掉有错误的股票
        const validStocks = stockData.filter(stock => !stock.error);
        
        if (validStocks.length === 0) {
          setError('没有获取到有效的股票数据');
          message.warning('没有获取到有效的股票数据');
        } else {
          setStocks(validStocks);
          setLastUpdated(new Date());
          message.success(`已加载 ${validStocks.length} 只股票数据 (来源: ${stockData[0]?.dataSource || 'Finnhub'})`);
        }
      } else {
        setError('服务器返回的数据格式不正确');
        message.error('数据格式错误');
      }
    } catch (err: any) {
      console.error('从 Finnhub 获取市场数据失败:', err);
      const errorMessage = err.message || '未知错误';
      setError(`获取市场数据失败: ${errorMessage}`);
      message.error('获取市场数据失败');
    } finally {
      setLoading(false);
    }
  };

  const searchStockBySymbol = async (symbol: string) => {
    // 检查是否已经是有效的股票 symbol（全大写字母，长度 1-5）
    const isValidSymbol = /^[A-Z]{1,5}$/.test(symbol);
    if (!isValidSymbol) {
      message.warning(`无效的股票代码: ${symbol}，请输入1-5个大写字母`);
      return false;
    }
    
    // 检查是否已经在 stocks 列表中
    const existingStock = stocks.find(s => s.symbol.toUpperCase() === symbol.toUpperCase());
    if (existingStock) {
      message.info(`${symbol} 已在股票列表中`);
      return true;
    }
    
    try {
      setSearching(true);
      console.log(`正在搜索股票: ${symbol}`);
      
      // 使用市场数据服务搜索股票
      const tickers = await marketDataService.searchStocks(symbol, 10);
      
      if (tickers.length > 0) {
        // 查找精确匹配的股票
        const exactMatch = tickers.find(ticker => 
          ticker.symbol.toUpperCase() === symbol.toUpperCase()
        );
        
        if (exactMatch) {
          // 获取该股票的详细信息
          const stockData = await marketDataService.getStockData(symbol);
          
          // 添加到 stocks 列表
          setStocks(prev => [...prev, stockData]);
          message.success(`已添加 ${symbol} (${stockData.name || '未命名'}) 到市场数据`);
          return true;
        } else {
          // 显示搜索结果供用户选择
          const suggestions = tickers.map(t => `${t.symbol} - ${t.name}`).join(', ');
          message.info(`未找到精确匹配，相关结果: ${suggestions}`);
          return false;
        }
      } else {
        message.warning(`未找到股票: ${symbol}`);
        return false;
      }
    } catch (error: any) {
      console.error(`搜索股票 ${symbol} 失败:`, error);
      const errorMessage = error.message || '未知错误';
      message.error(`搜索失败: ${errorMessage}`);
      return false;
    } finally {
      setSearching(false);
    }
  };

  const handleSearch = async () => {
    const symbol = searchText.trim().toUpperCase();
    if (symbol) {
      await searchStockBySymbol(symbol);
    }
  };

  const handleAnalyze = (symbol: string) => {
    navigate(`/analysis/${symbol}`);
  };

  const handleBacktest = (symbol: string) => {
    navigate('/backtest', { state: { presetSymbol: symbol } });
  };

  const toggleWatchlist = (symbol: string) => {
    setWatchlist(prev => {
      const exists = prev.some(item => item.symbol === symbol);
      let newWatchlist;
      
      if (exists) {
        message.success(`Removed ${symbol} from watchlist`);
        newWatchlist = prev.filter(item => item.symbol !== symbol);
      } else {
        // 从当前stocks数据中查找完整股票信息
        const stock = stocks.find(s => s.symbol === symbol);
        if (stock) {
          // 创建完整的watchlist item
          const watchlistItem = {
            symbol: stock.symbol,
            name: stock.name || `${symbol} Inc.`,
            price: stock.price || 0,
            change: stock.change || 0,
            changePercent: stock.changePercent || 0,
            volume: stock.volume || 0,
            marketCap: stock.marketCap || 0,
            sector: stock.sector || 'Unknown',
            addedAt: new Date().toISOString()
          };
          message.success(`Added ${symbol} to watchlist`);
          newWatchlist = [...prev, watchlistItem];
        } else {
          // 如果没有找到完整信息，至少保存symbol
          message.warning(`Added ${symbol} to watchlist (limited info available)`);
          newWatchlist = [...prev, { 
            symbol, 
            name: `${symbol} Inc.`,
            price: 0,
            change: 0,
            changePercent: 0,
            volume: 0,
            marketCap: 0,
            sector: 'Unknown',
            addedAt: new Date().toISOString() 
          }];
        }
      }
      
      // 保存到localStorage
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newWatchlist));
      return newWatchlist;
    });
  };

  const isInWatchlist = (symbol: string): boolean => {
    return watchlist.some(item => item.symbol === symbol);
  };

  // 获取所有行业
  const getAllSectors = () => {
    const sectors = new Set<string>();
    stocks.forEach(stock => {
      if (stock.sector) {
        sectors.add(stock.sector);
      }
    });
    return Array.from(sectors).sort();
  };

  // 计算市场统计
  const marketStats = {
    totalStocks: stocks.length,
    gainers: stocks.filter(s => safeNumber(s.changePercent) > 0).length,
    losers: stocks.filter(s => safeNumber(s.changePercent) < 0).length,
    unchanged: stocks.filter(s => safeNumber(s.changePercent) === 0).length,
    avgChange: stocks.length > 0 
      ? stocks.reduce((sum, s) => sum + safeNumber(s.changePercent), 0) / stocks.length 
      : 0,
    totalMarketCap: stocks.reduce((sum, s) => sum + safeNumber(s.marketCap), 0),
  };

  // 表格列定义
  const columns = [
    {
      title: 'Symbol',
      dataIndex: 'symbol',
      key: 'symbol',
      width: 130,
      sorter: true,
      render: (symbol: string, record: StockData) => (
        <div>
          <div style={{ fontWeight: '700', fontSize: '16px', letterSpacing: '-0.2px' }}>{symbol}</div>
          <div style={{ fontSize: '12px', color: '#666', fontWeight: 400, marginTop: '2px', lineHeight: 1.3 }}>
            {record.name || symbol}
          </div>
        </div>
      ),
    },
    {
      title: 'Price',
      dataIndex: 'price',
      key: 'price',
      width: 120,
      sorter: true,
      render: (price: number | null) => {
        return (
          <div style={{ 
            fontWeight: '700', 
            fontSize: '16px', 
            fontFeatureSettings: '"tnum"',
            textAlign: 'center',
            lineHeight: '40px'
          }}>
            {price !== null ? `$${safeToFixed(price, 2)}` : '--'}
          </div>
        );
      },
    },

    {
      title: 'Day Low',
      dataIndex: 'dayLow',
      key: 'dayLow',
      width: 110,
      sorter: true,
      render: (dayLow: number | null) => {
        // 只读取dayLow字段，如果没有真实数据就显示--
        if (dayLow === null || dayLow === 0) return <div style={{ fontSize: '13px', fontWeight: 500, color: '#8c8c8c' }}>--</div>;
        return <div style={{ fontSize: '14px', fontWeight: 600, color: '#1f1f1f', fontFeatureSettings: '"tnum"', paddingLeft: '12px', paddingRight: '12px' }}>${safeToFixed(dayLow, 2)}</div>;
      },
    },
    {
      title: 'Day High',
      dataIndex: 'dayHigh',
      key: 'dayHigh',
      width: 110,
      sorter: true,
      render: (dayHigh: number | null) => {
        // 只读取dayHigh字段，如果没有真实数据就显示--
        if (dayHigh === null || dayHigh === 0) return <div style={{ fontSize: '13px', fontWeight: 500, color: '#8c8c8c' }}>--</div>;
        return <div style={{ fontSize: '14px', fontWeight: 600, color: '#1f1f1f', fontFeatureSettings: '"tnum"', paddingLeft: '12px', paddingRight: '12px' }}>${safeToFixed(dayHigh, 2)}</div>;
      },
    },
    {
      title: 'Market Cap',
      dataIndex: 'marketCap',
      key: 'marketCap',
      width: 110,  // 显著减少宽度：120 → 110（与Day High相同）
      sorter: true,
      align: 'right' as const,
      className: 'market-cap-column',
      render: (marketCap: number | null) => {
        const formatted = formatMarketCap(marketCap);
        return <div style={{ fontSize: '14px', fontWeight: 600, color: '#1f1f1f', fontFeatureSettings: '"tnum"', lineHeight: '40px' }}>{formatted}</div>;
      },
    },

    {
      title: 'Change',
      dataIndex: 'change',
      key: 'change',
      width: 100,
      sorter: true,
      render: (change: number | null) => {
        const value = safeNumber(change);
        const isPositive = value > 0;
        const isNegative = value < 0;
        
        return (
          <div style={{ 
            fontSize: '15px', 
            fontWeight: 600, 
            color: isPositive ? '#52c41a' : isNegative ? '#ff4d4f' : '#666',
            fontFeatureSettings: '"tnum"',
            textAlign: 'center',
            lineHeight: '40px'
          }}>
            {value !== 0 ? `${value > 0 ? '+' : ''}${safeToFixed(value, 2)}` : '0.00'}
          </div>
        );
      },
    },
    {
      title: 'Change %',
      dataIndex: 'changePercent',
      key: 'changePercent',
      width: 100,
      sorter: true,
      render: (changePercent: number | null) => {
        const value = safeNumber(changePercent);
        const isPositive = value > 0;
        const isNegative = value < 0;
        
        return (
          <Tag 
            color={isPositive ? 'green' : isNegative ? 'red' : 'default'}
            style={{ 
              margin: 0,
              fontSize: '11px',
              padding: '2px 6px',
              fontWeight: 600,
              borderRadius: '6px',
              textAlign: 'center',
              display: 'inline-block',
              lineHeight: '16px',
              minWidth: '60px'
            }}
          >
            {value !== 0 ? `${value > 0 ? '+' : ''}${safeToFixed(value, 2)}%` : '0.00%'}
          </Tag>
        );
      },
    },
    {
      title: 'Sector',
      dataIndex: 'sector',
      key: 'sector',
      width: 125,
      sorter: true,
      render: (sector: string | null) => (
        <Tag 
          color="default" 
          style={{ 
            margin: 0,
            fontSize: '10px',
            padding: '2px 5px',
            fontWeight: 500,
            borderRadius: '6px',
            backgroundColor: '#f5f5f5',
            color: '#595959',
            border: '1px solid #e8e8e8',
            display: 'inline-block',
            lineHeight: '14px'
          }}
        >
          {sector || 'Other'}
        </Tag>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 150,
      render: (_: any, record: StockData) => (
        <Space size={2} style={{ justifyContent: 'center', width: '100%' }}>
          <Button
            type="primary"
            size="small"
            icon={<LineChartOutlined />}
            onClick={() => handleAnalyze(record.symbol)}
            style={{ fontSize: '14px', fontWeight: 500, padding: '0 12px', height: '32px', minWidth: '78px' }}
          >
            Analyze
          </Button>
          <Button
            size="small"
            icon={<PlayCircleOutlined />}
            onClick={() => handleBacktest(record.symbol)}
            style={{ fontSize: '14px', fontWeight: 500, padding: '0 12px', height: '32px', minWidth: '78px' }}
          >
            Backtest
          </Button>
          <Button
            size="small"
            type={isInWatchlist(record.symbol) ? 'primary' : 'default'}
            icon={<StarOutlined />}
            onClick={() => toggleWatchlist(record.symbol)}
            style={{ minWidth: '32px', width: '32px', height: '32px', padding: '0' }}
          />
        </Space>
      ),
    },
  ];

  // 处理表格排序
  const handleTableChange = (pagination: any, filters: any, sorter: any) => {
    if (sorter.field) {
      setSortField(sorter.field);
      setSortOrder(sorter.order || 'ascend');
    }
  };

  // Market Cap列专用样式 - 显著左移
  const marketCapColumnStyle = `
    .market-cap-column {
      text-align: right !important;
      width: 110px !important;  /* 强制列宽 */
    }
    .market-cap-column .ant-table-cell {
      padding: 0 6px 0 2px !important;  /* 显著左移：右6px，左2px */
      text-align: right !important;
      vertical-align: middle !important;
      width: 110px !important;
    }
    .market-cap-column .ant-table-thead .ant-table-cell {
      padding: 10px 6px 10px 2px !important;  /* 表头显著左移 */
      text-align: right !important;
      background-color: #fafafa !important;
      border-bottom: 2px solid #e8e8e8 !important;
      width: 110px !important;
    }
    /* 确保表格容器不限制列宽 */
    .market-cap-column .ant-table-tbody > tr > td,
    .market-cap-column .ant-table-thead > tr > th {
      width: 110px !important;
      min-width: 110px !important;
      max-width: 110px !important;
    }
  `;

  return (
    <div style={{ padding: '16px' }}>
      <style>{marketCapColumnStyle}</style>
      <Row gutter={[16, 16]}>
        <Col span={24}>
          <Card 
            title="Market Overview"
            extra={
              <Space align="center" size={12}>
                <Button 
                  icon={<ReloadOutlined />} 
                  onClick={fetchMarketData}
                  loading={loading}
                >
                  Refresh
                </Button>
                <DataSourceBadge source="Finnhub" />
              </Space>
            }
            bodyStyle={{ padding: '16px' }}
            headStyle={{ fontSize: '16px', fontWeight: 600 }}
          >
            {error && (
              <Alert
                message="Error"
                description={error}
                type="error"
                showIcon
                style={{ marginBottom: '16px' }}
                action={
                  <Button size="small" onClick={fetchMarketData}>
                    Retry
                  </Button>
                }
              />
            )}

            {/* 搜索和过滤 - 放大优化 */}
            <Row gutter={[12, 12]} style={{ marginBottom: '16px' }}>
              <Col xs={24} sm={12} md={8} lg={6}>
                <Input
                  placeholder="Search symbol or name..."
                  prefix={<SearchOutlined />}
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  onPressEnter={handleSearch}
                  suffix={searching ? <Spin size="small" /> : null}
                />
              </Col>
              <Col xs={24} sm={12} md={8} lg={6}>
                <Select
                  style={{ width: '100%' }}
                  placeholder="Filter by sector"
                  value={selectedSector}
                  onChange={setSelectedSector}
                >
                  <Option value="all">All Sectors</Option>
                  {getAllSectors().map(sector => (
                    <Option key={sector} value={sector}>{sector}</Option>
                  ))}
                </Select>
              </Col>
              <Col xs={24} sm={12} md={8} lg={6}>
                <Button 
                  type="primary" 
                  icon={<SearchOutlined />} 
                  onClick={handleSearch}
                  loading={searching}
                  style={{ width: '100%' }}
                >
                  Search
                </Button>
              </Col>
            </Row>

            {/* 市场统计 - 紧凑专业卡片 */}
            <Row gutter={[12, 12]} style={{ marginBottom: '16px' }}>
              <Col xs={12} sm={6}>
                <Card size="small" bodyStyle={{ padding: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ fontSize: '11px', color: '#8c8c8c', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.3px' }}>Total Stocks</div>
                      <div style={{ fontSize: '26px', fontWeight: 700, color: '#1f1f1f', marginTop: '6px' }}>{marketStats.totalStocks}</div>
                    </div>
                    <EyeOutlined style={{ fontSize: '18px', color: '#bfbfbf', opacity: 0.7 }} />
                  </div>
                </Card>
              </Col>
              <Col xs={12} sm={6}>
                <Card size="small" bodyStyle={{ padding: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ fontSize: '11px', color: '#8c8c8c', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.3px' }}>Gainers</div>
                      <div style={{ fontSize: '26px', fontWeight: 700, color: '#52c41a', marginTop: '6px' }}>{marketStats.gainers}</div>
                    </div>
                    <BarChartOutlined style={{ fontSize: '18px', color: '#52c41a', opacity: 0.7 }} />
                  </div>
                </Card>
              </Col>
              <Col xs={12} sm={6}>
                <Card size="small" bodyStyle={{ padding: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ fontSize: '11px', color: '#8c8c8c', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.3px' }}>Losers</div>
                      <div style={{ fontSize: '26px', fontWeight: 700, color: '#ff4d4f', marginTop: '6px' }}>{marketStats.losers}</div>
                    </div>
                    <BarChartOutlined style={{ fontSize: '18px', color: '#ff4d4f', opacity: 0.7 }} />
                  </div>
                </Card>
              </Col>
              <Col xs={12} sm={6}>
                <Card size="small" bodyStyle={{ padding: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ fontSize: '11px', color: '#8c8c8c', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.3px' }}>Avg Change</div>
                      <div style={{ 
                        fontSize: '26px', 
                        fontWeight: 700, 
                        color: marketStats.avgChange > 0 ? '#52c41a' : marketStats.avgChange < 0 ? '#ff4d4f' : '#666',
                        marginTop: '6px'
                      }}>
                        {safeToFixed(marketStats.avgChange, 2)}%
                      </div>
                    </div>
                    <BarChartOutlined style={{ 
                      fontSize: '18px', 
                      color: marketStats.avgChange > 0 ? '#52c41a' : marketStats.avgChange < 0 ? '#ff4d4f' : '#666',
                      opacity: 0.7 
                    }} />
                  </div>
                </Card>
              </Col>
            </Row>

            {loading ? (
              // 表格骨架屏
              <Card>
                <Skeleton active paragraph={{ rows: 10 }} />
              </Card>
            ) : filteredStocks.length === 0 ? (
              <Empty
                description="No stocks found matching your criteria"
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
            ) : (
              <Table
                columns={columns}
                dataSource={filteredStocks}
                rowKey="symbol"
                size="middle"
                onChange={handleTableChange}
                pagination={{
                  pageSize: 20,
                  showSizeChanger: filteredStocks.length > 20,
                  showQuickJumper: filteredStocks.length > 20,
                  showTotal: filteredStocks.length > 20 ? (total, range) => `${range[0]}-${range[1]} of ${total} stocks` : undefined,
                  size: 'small',
                  hideOnSinglePage: true
                }}
                scroll={{ x: 'max-content' }}
                style={{ marginTop: '8px' }}
                components={{
                  header: {
                    cell: (props: any) => (
                      <th {...props} style={{ 
                        ...props.style, 
                        fontSize: '13px',
                        fontWeight: 500,
                        color: '#595959',
                        padding: '10px 8px',
                        backgroundColor: '#fafafa',
                        borderBottom: '2px solid #e8e8e8'
                      }} />
                    ),
                  },
                }}
              />
            )}

            {lastUpdated && (
              <div style={{ 
                marginTop: '12px', 
                textAlign: 'right', 
                fontSize: '11px', 
                color: '#8c8c8c',
                fontWeight: 500,
                paddingRight: '4px'
              }}>
                Updated: {lastUpdated.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
              </div>
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default Market;
