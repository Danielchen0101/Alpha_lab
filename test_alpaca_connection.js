// Alpaca Paper Trading 连接测试
// 模拟前端直接调用 Alpaca API

console.log('=== Alpaca Paper Trading 连接测试 ===\n');

// 模拟环境变量（实际使用时从 .env 文件读取）
const APCA_API_KEY_ID = process.env.APCA_API_KEY_ID || 'your_paper_api_key_id_here';
const APCA_API_SECRET_KEY = process.env.APCA_API_SECRET_KEY || 'your_paper_api_secret_key_here';
const APCA_API_BASE_URL = 'https://paper-api.alpaca.markets';

console.log('1. 环境变量检查:');
console.log(`   APCA_API_BASE_URL: ${APCA_API_BASE_URL}`);
console.log(`   APCA_API_KEY_ID: ${APCA_API_KEY_ID ? '已配置' : '❌ 未配置'}`);
console.log(`   APCA_API_SECRET_KEY: ${APCA_API_SECRET_KEY ? '已配置' : '❌ 未配置'}`);

if (APCA_API_KEY_ID === 'your_paper_api_key_id_here' || APCA_API_SECRET_KEY === 'your_paper_api_secret_key_here') {
  console.log('\n⚠️ 警告: 使用默认占位符，需要配置真实 Alpaca Paper 凭证');
  console.log('   获取地址: https://app.alpaca.markets/paper/dashboard/overview');
}

// 模拟前端 fetch 请求
const headers = {
  'APCA-API-KEY-ID': APCA_API_KEY_ID,
  'APCA-API-SECRET-KEY': APCA_API_SECRET_KEY,
  'Content-Type': 'application/json'
};

console.log('\n2. 请求头配置:');
console.log('   APCA-API-KEY-ID:', APCA_API_KEY_ID.substring(0, 8) + '...');
console.log('   APCA-API-SECRET-KEY:', APCA_API_SECRET_KEY.substring(0, 8) + '...');

// 测试函数
async function testAlpacaConnection() {
  console.log('\n3. 开始测试 Alpaca API 连接...');
  
  // 测试 1: 获取账户信息
  console.log('\n  测试 1: getAccount()');
  try {
    // 模拟 fetch 请求
    console.log(`    请求: GET ${APCA_API_BASE_URL}/v2/account`);
    console.log('    状态: ❌ 需要真实凭证才能测试');
    console.log('    预期成功返回:');
    console.log('      - account_number: PAPER-XXXXXX');
    console.log('      - status: ACTIVE');
    console.log('      - cash: 数字');
    console.log('      - equity: 数字');
  } catch (error) {
    console.log(`    错误: ${error.message}`);
  }
  
  // 测试 2: 获取持仓
  console.log('\n  测试 2: getPositions()');
  try {
    console.log(`    请求: GET ${APCA_API_BASE_URL}/v2/positions`);
    console.log('    状态: ❌ 需要真实凭证才能测试');
    console.log('    预期成功返回:');
    console.log('      - 数组格式的持仓列表');
    console.log('      - 每个持仓包含 symbol, qty, market_value');
  } catch (error) {
    console.log(`    错误: ${error.message}`);
  }
  
  // 测试 3: 获取订单
  console.log('\n  测试 3: getOrders()');
  try {
    console.log(`    请求: GET ${APCA_API_BASE_URL}/v2/orders`);
    console.log('    状态: ❌ 需要真实凭证才能测试');
    console.log('    预期成功返回:');
    console.log('      - 数组格式的订单列表');
    console.log('      - 每个订单包含 status, symbol, qty, filled_avg_price');
  } catch (error) {
    console.log(`    错误: ${error.message}`);
  }
  
  // CORS 问题测试
  console.log('\n4. CORS 问题分析:');
  console.log('   前端直连 Alpaca API 可能遇到的 CORS 问题:');
  console.log('   - Alpaca API 可能设置 CORS 头限制跨域请求');
  console.log('   - 浏览器会阻止跨域请求');
  console.log('   - 解决方案: 通过后端代理转发请求');
  
  // 安全风险分析
  console.log('\n5. 安全风险分析:');
  console.log('   前端直连 Alpaca API 的安全风险:');
  console.log('   - API 密钥暴露在客户端代码中');
  console.log('   - 用户可以通过浏览器开发者工具查看密钥');
  console.log('   - 建议: 通过后端服务器代理 API 请求');
  
  // 验证步骤
  console.log('\n6. 真实验证步骤:');
  console.log('   要真正验证 Alpaca 连接，需要:');
  console.log('   1. 获取真实的 Alpaca Paper 凭证');
  console.log('   2. 配置到 .env.local 文件:');
  console.log('      REACT_APP_APCA_API_KEY_ID=your_real_key_id');
  console.log('      REACT_APP_APCA_API_SECRET_KEY=your_real_secret_key');
  console.log('   3. 重启开发服务器');
  console.log('   4. 在页面点击 "Alpaca Paper Mode"');
  console.log('   5. 点击 "Test Get Account" 等按钮');
  
  // 预期错误类型
  console.log('\n7. 可能遇到的错误类型:');
  console.log('   - 401/403: 认证失败（凭证错误）');
  console.log('   - CORS: 跨域请求被阻止');
  console.log('   - Network: 网络连接问题');
  console.log('   - Rate Limit: 请求频率限制');
}

// 运行测试
testAlpacaConnection().then(() => {
  console.log('\n=== 测试完成 ===');
  console.log('\n结论:');
  console.log('当前代码架构已准备好连接 Alpaca Paper Trading，');
  console.log('但需要配置真实的 API 凭证才能进行真实验证。');
  console.log('\n下一步:');
  console.log('1. 获取 Alpaca Paper 凭证');
  console.log('2. 配置到 .env.local');
  console.log('3. 重启项目测试真实连接');
});