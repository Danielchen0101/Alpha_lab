/**
 * 共享数据服务 - 避免Dashboard和Market重复请求相同数据
 */

import { StockData } from './marketDataService';

// 共享数据缓存
interface SharedCache {
  stocks: StockData[];
  timestamp: number;
  isFetching: boolean;
}

export class SharedDataService {
  private cache: SharedCache = {
    stocks: [],
    timestamp: 0,
    isFetching: false
  };
  
  private listeners: Array<(stocks: StockData[]) => void> = [];
  private inFlightRequest: Promise<StockData[]> | null = null;
  
  /**
   * 获取股票数据（共享缓存）
   */
  async getStocks(forceRefresh = false): Promise<StockData[]> {
    // Keep the last successful snapshot for the browser session. Navigating
    // away and back must not silently turn into another full-market request.
    if (!forceRefresh && this.cache.stocks.length > 0) {
      if (process.env.NODE_ENV !== 'production') console.log('[SharedDataService] 使用缓存数据');
      return this.cache.stocks;
    }

    // 如果已经在获取中，等待
    if (this.inFlightRequest) {
      if (process.env.NODE_ENV !== 'production') console.log('[SharedDataService] 数据获取中，等待...');
      return this.inFlightRequest;
    }
    
    // 开始获取数据
    this.cache.isFetching = true;
    
    const request = (async () => {
      try {
        if (process.env.NODE_ENV !== 'production') console.log('[SharedDataService] 从后端获取数据...');

        // 动态导入marketDataService以避免循环依赖
        const { getStocks } = await import('./marketDataService');

        // 获取数据
        const stocks = await getStocks(undefined, false, forceRefresh); // 不使用dashboard模式

        // 更新缓存
        this.cache.stocks = stocks;
        this.cache.timestamp = Date.now();

        // 通知所有监听器
        this.notifyListeners(stocks);

        return stocks;
      } catch (error) {
        if (process.env.NODE_ENV !== 'production') console.error('[SharedDataService] 获取数据失败:', error);
        throw error;
      } finally {
        this.cache.isFetching = false;
      }
    })();
    this.inFlightRequest = request;
    try {
      return await request;
    } finally {
      if (this.inFlightRequest === request) {
        this.inFlightRequest = null;
      }
    }
  }
  
  /**
   * 强制刷新数据
   */
  async refreshStocks(): Promise<StockData[]> {
    if (process.env.NODE_ENV !== 'production') console.log('[SharedDataService] 强制刷新数据');
    this.cache.timestamp = 0; // 使缓存失效
    return this.getStocks(true);
  }
  
  /**
   * 获取缓存数据（不触发请求）
   */
  getCachedStocks(): StockData[] {
    return this.cache.stocks;
  }
  
  /**
   * 检查缓存是否有效
   */
  isCacheValid(): boolean {
    return this.cache.stocks.length > 0;
  }
  
  /**
   * 添加数据变化监听器
   */
  addListener(listener: (stocks: StockData[]) => void): void {
    this.listeners.push(listener);
  }
  
  /**
   * 移除监听器
   */
  removeListener(listener: (stocks: StockData[]) => void): void {
    const index = this.listeners.indexOf(listener);
    if (index > -1) {
      this.listeners.splice(index, 1);
    }
  }
  
  /**
   * 通知所有监听器
   */
  private notifyListeners(stocks: StockData[]): void {
    this.listeners.forEach(listener => {
      try {
        listener(stocks);
      } catch (error) {
        if (process.env.NODE_ENV !== 'production') console.error('[SharedDataService] 监听器执行错误:', error);
      }
    });
  }

  /**
   * 清空缓存
   */
  clearCache(): void {
    this.cache = {
      stocks: [],
      timestamp: 0,
      isFetching: false
    };
    this.inFlightRequest = null;
    if (process.env.NODE_ENV !== 'production') console.log('[SharedDataService] 缓存已清空');
  }
}

// 导出单例实例
export const sharedDataService = new SharedDataService();
