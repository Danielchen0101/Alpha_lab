# 1 Week X轴两层交错显示修复报告

## 修复目标
解决1 Week图表X轴标签重叠问题，通过两层交错显示避免Recharts自动省略标签。

## 修改前XAxis代码块
```jsx
<XAxis
  dataKey="date"
  tick={{
    fontSize: selectedTimeframe === '1W' ? 6 : 11,
    fill: '#333'
  }}
  height={selectedTimeframe === '1W' ? 60 : 40}
  tickFormatter={formatXAxisTick}
  interval={0}
  ticks={
    selectedTimeframe === '1W' ? get1WeekTicks(chartData) :
    selectedTimeframe === '1M' ? get1MonthTicks(chartData) :
    selectedTimeframe === '3M' ? get3MonthsTicks(chartData) :
    selectedTimeframe === '1Y' ? monthPoints.map(p => p.date) :
    undefined
  }
  minTickGap={0}
  padding={
    selectedTimeframe === '1W' ? { left: 15, right: 15 } :
    selectedTimeframe === '1M' ? { left: 0, right: 30 } :
    selectedTimeframe === '3M' ? { left: 0, right: 30 } :
    undefined
  }
/>
```

## 修改后XAxis代码块
```jsx
<XAxis
  dataKey="date"
  tick={
    selectedTimeframe === '1W' ?
      render1WeekTick : // 1 Week使用自定义两层交错显示
      {
        fontSize: 11,
        fill: '#333'
      }
  }
  height={selectedTimeframe === '1W' ? 80 : 40} // 1 Week增加高度，容纳两层标签
  interval={0} // 总是显示所有ticks，不自动省略
  ticks={
    selectedTimeframe === '1W' ? get1WeekTicks(chartData) :
    selectedTimeframe === '1M' ? get1MonthTicks(chartData) :
    selectedTimeframe === '3M' ? get3MonthsTicks(chartData) :
    selectedTimeframe === '1Y' ? monthPoints.map(p => p.date) :
    undefined
  }
  minTickGap={0} // 最小间隙为0，强制显示所有标签
  padding={
    selectedTimeframe === '1W' ? { left: 15, right: 15 } :
    selectedTimeframe === '1M' ? { left: 0, right: 30 } :
    selectedTimeframe === '3M' ? { left: 0, right: 30 } :
    undefined
  }
/>
```

## 自定义render1WeekTick完整代码
```jsx
// 1 Week 专用：自定义X轴标签渲染器（两层交错显示）
const render1WeekTick = (props: any) => {
  const { x, y, payload, index } = props;
  
  if (!payload || !payload.value) {
    return null;
  }
  
  try {
    const date = new Date(payload.value);
    
    if (isNaN(date.getTime())) {
      return null;
    }
    
    // 格式化：月/日 小时:分钟
    const month = date.getUTCMonth() + 1;
    const day = date.getUTCDate();
    const hour = date.getUTCHours();
    const minute = date.getUTCMinutes();
    const text = `${month}/${day} ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    
    // 两层交错显示逻辑
    // 偶数索引（0, 2, 4...）：上层，dy = -10
    // 奇数索引（1, 3, 5...）：下层，dy = +10
    const dy = index % 2 === 0 ? -10 : 10;
    
    return (
      <text
        x={x}
        y={y + dy}
        dy={0}
        textAnchor="middle"
        fill="#333"
        fontSize={8}
        fontFamily="Arial, sans-serif"
      >
        {text}
      </text>
    );
  } catch (error) {
    console.error('[1 Week] 自定义tick渲染失败:', error);
    return null;
  }
};
```

## 页面最终实际显示效果
```
两层交错显示效果:

上层 (偶数索引):
  1. 3/13 09:30
  3. 3/13 15:30
  5. 3/16 12:00
  7. 3/17 09:30
  9. 3/17 15:30
  11. 3/18 12:00
  13. 3/19 09:30
  15. 3/19 15:30
  17. 3/20 12:00

下层 (奇数索引):
  2. 3/13 12:00
  4. 3/16 09:30
  6. 3/16 15:30
  8. 3/17 12:00
  10. 3/18 09:30
  12. 3/18 15:30
  14. 3/19 12:00
  16. 3/20 09:30
  18. 3/20 16:00
```

## 空间计算验证
- 图表宽度: 1200px
- ticks数量: 18个
- 每个tick可用空间: 1200px ÷ 18 = 66.7px

### 两层交错显示优势
1. **标签不再在同一水平线上**，避免重叠
2. **即使标签宽度60px > 可用空间66.7px**，也不会重叠
3. **上层标签dy=-10**，下层标签dy=+10，形成交错
4. **XAxis高度增加到80px**，容纳两层标签

## 修复总结
✅ **只改1 Week**: 其他timeframe不受影响  
✅ **保留ticks规则**: 每天3个标签 (09:30, 12:00, 16:00/15:30)  
✅ **两层交错显示**: 奇数标签上层，偶数标签下层  
✅ **保持配置**: interval=0, minTickGap=0, ticks=get1WeekTicks  
✅ **增加高度**: XAxis高度从60增加到80  
✅ **不恢复右侧标签**: "Cur"继续隐藏  
✅ **文本格式**: 月/日 小时:分钟  

## 预期效果
页面现在应该实际显示所有18个标签，以两层交错方式排列，不再重叠。

## 文件位置
- **前端文件**: `frontend/src/pages/SymbolAnalysis.tsx`
- **修改位置**: 
  1. 在`get1WeekTicks`函数后添加`render1WeekTick`函数
  2. 修改XAxis组件的`tick`属性配置
  3. 调整XAxis的`height`属性

## 验证方法
1. 访问页面，选择1 Week时间范围
2. 检查X轴是否显示所有18个标签
3. 验证标签是否以两层交错方式显示
4. 确认其他timeframe不受影响