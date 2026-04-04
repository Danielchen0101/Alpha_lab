# Portfolio 下半页重做计划

## 需要重做的模块

### 1. Paper Trading Control Panel (最优先)
- 当前问题：信息分散，测试感强，布局混乱
- 目标：合并成清晰的 2-3 个 section，像专业控制台
- 重做要点：
  - 状态信息区（模式、策略、参数）
  - 控制按钮区（Start/Stop/Batch）
  - 设置区（slippage/commission/risk）

### 2. Session 相关区块
- Session Summary
- Comparison
- Session Insights
- Preset Summary
- Experiment Ranking
- 目标：统一卡片风格，统一空状态，统一数字展示

### 3. Positions / Sector Allocation / Trades
- Current Positions 表格
- Sector Allocation 图表
- Recent Trades 表格
- 目标：专业表格样式，统一数字格式，优化列宽

## 设计系统应用

使用上一轮建立的 DESIGN_SYSTEM：
- 颜色：primary(#1890ff), success(#52c41a), error(#ff4d4f), warning(#faad14)
- 间距：xs(8px), sm(16px), md(24px), lg(32px), xl(48px)
- 卡片：圆角8px，阴影0 2px 8px rgba(0,0,0,0.06)，边框#f0f0f0

## 实施步骤
1. 先重做 Control Panel
2. 再重做 Session 区块
3. 最后重做表格和图表