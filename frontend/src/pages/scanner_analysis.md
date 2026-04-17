# Market Scanner 当前流程分析

## 当前扫描流程

### 1. 扫描方式
**批量并发扫描 (10个一批)**
- `BATCH_SIZE = 10` (第627行)
- 每批10个symbols并发处理
- 使用`Promise.allSettled`等待整批完成
- **问题**: 高并发可能导致API限流和数据丢失

### 2. 渲染方式
**每批完成后立即渲染**
- 每批10个symbols处理完成后
- 将整批结果追加到`marketScannerResults`
- 触发React重新渲染
- **问题**: 可能渲染不完整的数据

### 3. 进度条更新
**每处理一个symbol更新一次**
- 在`batchPromises.map`中每个symbol处理时更新
- 更新`scannedSymbols`和`progress`
- **良好**: 已经实现了symbol级别的进度更新

### 4. 数据校验和重试
**基本没有校验和重试机制**
- 只有基本的错误捕获
- 没有symbol级别的数据完整性检查
- 没有重试机制
- 失败的结果直接进入batch
- **问题**: 可能渲染不完整或错误的数据

### 5. 当前代码结构

```typescript
// 当前流程 (简化版)
const scanSymbols = async (symbols: string[]) => {
  const BATCH_SIZE = 10;
  
  for (let batchIndex = 0; batchIndex < symbols.length; batchIndex += BATCH_SIZE) {
    const batchSymbols = symbols.slice(batchIndex, batchIndex + BATCH_SIZE);
    const batchResults = [];
    
    // 1. 并发处理10个symbols
    const batchPromises = batchSymbols.map(async (symbol, i) => {
      // 更新进度
      setMarketScannerStatus(prev => ({ ...prev, scannedSymbols: globalIndex + 1 }));
      
      // 获取数据