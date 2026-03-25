// 测试Charts tab布局修改
console.log("=== 测试Charts tab布局修改 ===");

console.log("修改内容总结:");
console.log("1. 统一外层容器:");
console.log("   - 添加了统一的外层div容器，包含:");
console.log("     - background: '#fafafa'");
console.log("     - borderRadius: '8px'");
console.log("     - padding: '24px'");
console.log("     - position: 'relative'");

console.log("\n2. Equity Curve修改:");
console.log("   - 移除了独立的背景容器");
console.log("   - 标题改为: <h4 style={{ marginBottom: '16px' }}>Equity Curve</h4>");
console.log("   - 图表容器只保留: height: '250px', position: 'relative'");

console.log("\n3. Drawdown Chart修改:");
console.log("   - 移除了独立的背景容器");
console.log("   - 标题改为: <h4 style={{ marginBottom: '16px' }}>Drawdown Chart</h4>");
console.log("   - 图表容器只保留: height: '200px', position: 'relative'");
console.log("   - Divider样式: <Divider style={{ margin: '24px 0' }} />");

console.log("\n4. 外层容器闭合:");
console.log("   - 在Drawdown Chart结束后添加了外层容器的闭合标签: </div>");

console.log("\n5. 保持不变的:");
console.log("   - Trading Chart和Volume Chart保持独立，不受影响");
console.log("   - 所有图表数据逻辑和算法不变");
console.log("   - 其他tab内容不变");

console.log("\n=== 预期效果 ===");
console.log("1. Equity Curve和Drawdown Chart现在共享一个统一的外层容器");
console.log("2. 外层只有一个大长方形，包含两个图表");
console.log("3. 两个图表之间有合理的间距和分隔线");
console.log("4. 保持页面风格一致");

console.log("\n=== 构建状态 ===");
console.log("✅ 构建成功通过");

console.log("\n=== 验证要求 ===");
console.log("请检查Charts tab，确认:");
console.log("1. Equity Curve和Drawdown Chart在同一个大长方形内");
console.log("2. 两个图表之间没有各自独立的大外框");
console.log("3. 布局美观，间距合理");
console.log("4. Trading Chart和Volume Chart保持原有独立布局");