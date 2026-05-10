import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { useLanguage } from '../contexts/LanguageContext';

const termsContentEN = [
  {
    title: '1. Acceptance of Terms',
    body: 'Welcome to AlphaLab. By creating an account, accessing the platform, or using any AlphaLab feature, you agree to these Terms of Service. If you do not agree, you should not use the platform.',
  },
  {
    title: '2. Platform Description',
    body: 'AlphaLab is an AI-powered quantitative trading research and automation platform. The platform may provide market scanning, strategy backtesting, portfolio analysis, AI-generated trading insights, entry planning, exit planning, paper trading workflows, and integrations with third-party services such as Alpaca, Finnhub, Supabase, and AI providers.\n\nAlphaLab is intended to support research, education, simulation, and user-directed trading workflows. AlphaLab does not guarantee profits, investment performance, trading outcomes, or uninterrupted service availability.',
  },
  {
    title: '3. No Investment Advice',
    body: 'AlphaLab does not provide financial, investment, legal, tax, or brokerage advice. Any market analysis, AI-generated signal, entry plan, exit plan, risk label, position sizing suggestion, backtest result, or trading workflow shown on the platform is provided for informational and educational purposes only.\n\nYou are solely responsible for evaluating all trading decisions. You should consult a qualified financial professional before making investment decisions.',
  },
  {
    title: '4. Trading and Market Risk',
    body: 'Trading stocks, ETFs, leveraged ETFs, options, crypto assets, or other financial instruments involves substantial risk. You may lose some or all of your capital. Past performance, backtest results, historical simulations, and AI-generated analysis do not guarantee future results.\n\nLeveraged products, including leveraged ETFs, may amplify gains and losses and may not be suitable for all users. Short-term trading, day trading, margin trading, and automated trading can involve additional risk.',
  },
  {
    title: '5. User Responsibility',
    body: 'You are responsible for:\n- Reviewing all AI-generated recommendations before acting on them\n- Understanding the risks of each trade\n- Configuring API keys and trading permissions correctly\n- Monitoring all orders, positions, and account activity\n- Ensuring that your use of the platform complies with applicable laws and brokerage rules\n- Keeping your login credentials and API credentials secure',
  },
  {
    title: '6. Paper Trading and Live Trading',
    body: 'AlphaLab may support both paper trading and live trading modes. Paper trading is simulated and may not reflect real market conditions, execution quality, liquidity, slippage, commissions, exchange fees, or order rejection behavior.\n\nLive trading uses real brokerage accounts and may result in real financial gains or losses. If you enable live trading or automated execution, you acknowledge that orders may be submitted according to your configuration and platform settings.',
  },
  {
    title: '7. AI and Automation Limitations',
    body: 'AlphaLab uses algorithmic logic and AI-generated analysis. AI systems can be incomplete, inaccurate, delayed, inconsistent, or wrong. AI-generated output may misunderstand market conditions, fail to account for news or events, or produce recommendations that are unsuitable for your situation.\n\nYou should not rely solely on AI-generated recommendations. You remain responsible for all decisions and outcomes.',
  },
  {
    title: '8. Third-Party Services',
    body: 'AlphaLab integrates with third-party services, including but not limited to brokerage APIs, market data providers, AI providers, authentication providers, and cloud infrastructure services. Your use of those services may be subject to separate terms, privacy policies, fees, restrictions, and account requirements.\n\nAlphaLab is not responsible for third-party outages, data errors, API changes, order rejections, account restrictions, or service interruptions.',
  },
  {
    title: '9. Account Security',
    body: 'You are responsible for maintaining the confidentiality of your account credentials. You agree to notify us promptly if you believe your account has been compromised.\n\nWe may suspend or restrict access if we detect suspicious activity, misuse, abuse, or security risk.',
  },
  {
    title: '10. API Keys and Configuration',
    body: 'If you connect API keys or third-party credentials, you are responsible for ensuring that they are valid, authorized, and used in accordance with the third-party provider\'s terms. AlphaLab may store sensitive credentials in encrypted form when supported by the platform.\n\nYou should never share your API keys publicly or commit them to source control.',
  },
  {
    title: '11. Prohibited Use',
    body: 'You agree not to:\n- Use the platform for illegal activity\n- Attempt to bypass security controls\n- Reverse engineer, scrape, overload, or attack the platform\n- Use the platform to manipulate markets or violate trading rules\n- Share unauthorized access with others\n- Upload malicious code or harmful content\n- Misrepresent AlphaLab as a licensed broker, advisor, or financial institution',
  },
  {
    title: '12. Service Availability',
    body: 'AlphaLab may change, suspend, or discontinue features at any time. We do not guarantee that the platform will be error-free, uninterrupted, or available at all times.',
  },
  {
    title: '13. Limitation of Liability',
    body: 'To the maximum extent permitted by law, AlphaLab and its contributors are not liable for trading losses, lost profits, data loss, service interruptions, missed opportunities, API failures, incorrect analysis, or any indirect, incidental, consequential, or special damages arising from your use of the platform.',
  },
  {
    title: '14. No Warranty',
    body: 'The platform is provided "as is" and "as available." We make no warranties regarding accuracy, reliability, availability, merchantability, fitness for a particular purpose, or suitability for trading.',
  },
  {
    title: '15. Changes to Terms',
    body: 'We may update these Terms from time to time. Continued use of the platform after changes are posted means you accept the updated Terms.',
  },
  {
    title: '16. Contact',
    body: 'If you have questions about these Terms, contact the AlphaLab project owner through the official project communication channel.',
  },
];

const termsContentZH: typeof termsContentEN = [
  {
    title: '1. 接受条款',
    body: '欢迎使用 AlphaLab。创建账户、访问平台或使用任何 AlphaLab 功能，即表示你同意本服务条款。如果你不同意，请不要使用本平台。',
  },
  {
    title: '2. 平台说明',
    body: 'AlphaLab 是一个 AI 驱动的量化交易研究与自动化平台。平台可能提供市场扫描、策略回测、投资组合分析、AI 交易洞察、入场计划、退出计划、模拟交易流程，以及与 Alpaca、Finnhub、Supabase 和 AI 提供商等第三方服务的集成。\n\nAlphaLab 主要用于研究、教育、模拟和用户自主交易流程支持。AlphaLab 不保证盈利、投资表现、交易结果或服务持续可用。',
  },
  {
    title: '3. 非投资建议',
    body: 'AlphaLab 不提供金融、投资、法律、税务或经纪服务建议。平台展示的任何市场分析、AI 信号、入场计划、退出计划、风险标签、仓位建议、回测结果或交易流程，仅供信息和教育用途。\n\n你需要自行评估所有交易决策。在做出投资决定前，建议咨询合格的金融专业人士。',
  },
  {
    title: '4. 交易与市场风险',
    body: '交易股票、ETF、杠杆 ETF、期权、加密资产或其他金融工具具有重大风险。你可能损失部分或全部本金。历史表现、回测结果、模拟结果和 AI 分析都不代表未来表现。\n\n杠杆产品，包括杠杆 ETF，可能放大收益和亏损，并不适合所有用户。短线交易、日内交易、保证金交易和自动化交易可能带来额外风险。',
  },
  {
    title: '5. 用户责任',
    body: '你需要自行负责：\n- 审查所有 AI 生成的建议\n- 理解每笔交易的风险\n- 正确配置 API 密钥和交易权限\n- 监控所有订单、持仓和账户活动\n- 确保自己的使用行为符合适用法律和券商规则\n- 保护登录凭证和 API 凭证安全',
  },
  {
    title: '6. 模拟交易与实盘交易',
    body: 'AlphaLab 可能支持模拟交易和实盘交易。模拟交易是仿真环境，可能无法真实反映市场条件、成交质量、流动性、滑点、佣金、交易所费用或订单拒绝情况。\n\n实盘交易会使用真实券商账户，并可能产生真实收益或亏损。如果你启用实盘交易或自动执行功能，即表示你理解订单可能会根据你的配置和平台设置被提交。',
  },
  {
    title: '7. AI 与自动化限制',
    body: 'AlphaLab 使用算法逻辑和 AI 生成分析。AI 系统可能不完整、不准确、延迟、不一致或出错。AI 输出可能误判市场条件，未能考虑新闻事件，或生成不适合你情况的建议。\n\n你不应完全依赖 AI 建议。你仍然需要对所有决策和结果负责。',
  },
  {
    title: '8. 第三方服务',
    body: 'AlphaLab 会集成第三方服务，包括但不限于券商 API、市场数据提供商、AI 提供商、认证服务商和云基础设施服务。你使用这些服务可能需要遵守对应第三方的条款、隐私政策、费用规则、限制和账户要求。\n\nAlphaLab 不对第三方服务中断、数据错误、API 变化、订单拒绝、账户限制或服务不可用负责。',
  },
  {
    title: '9. 账户安全',
    body: '你需要保护自己的账户凭证。如果你认为账户已被盗用或存在安全风险，应及时通知我们。\n\n如果我们发现可疑活动、滥用行为或安全风险，可能会暂停或限制账户访问。',
  },
  {
    title: '10. API 密钥和配置',
    body: '如果你连接 API 密钥或第三方凭证，你需要确保这些凭证有效、授权，并符合第三方提供商的条款。AlphaLab 会在平台支持的情况下以加密方式存储敏感凭证。\n\n你不应公开分享 API 密钥，也不应将其提交到代码仓库。',
  },
  {
    title: '11. 禁止行为',
    body: '你同意不进行以下行为：\n- 使用平台进行违法活动\n- 绕过安全控制\n- 逆向工程、恶意抓取、攻击或过载平台\n- 使用平台操纵市场或违反交易规则\n- 与未授权人员共享访问权限\n- 上传恶意代码或有害内容\n- 将 AlphaLab 错误描述为持牌券商、投资顾问或金融机构',
  },
  {
    title: '12. 服务可用性',
    body: 'AlphaLab 可能随时变更、暂停或停止部分功能。我们不保证平台始终无错误、不中断或持续可用。',
  },
  {
    title: '13. 责任限制',
    body: '在法律允许的最大范围内，AlphaLab 及其贡献者不对因使用平台产生的交易亏损、利润损失、数据丢失、服务中断、错失机会、API 失败、错误分析或任何间接、附带、特殊或后果性损害承担责任。',
  },
  {
    title: '14. 无担保',
    body: '平台按"现状"和"可用状态"提供。我们不保证准确性、可靠性、可用性、适销性、特定用途适用性或交易适用性。',
  },
  {
    title: '15. 条款变更',
    body: '我们可能不时更新本服务条款。更新发布后继续使用平台，即表示你接受更新后的条款。',
  },
  {
    title: '16. 联系方式',
    body: '如果你对本条款有疑问，请通过 AlphaLab 项目的官方沟通渠道联系项目负责人。',
  },
];

const Terms: React.FC = () => {
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  const isCN = language === 'zh-CN';
  const content = isCN ? termsContentZH : termsContentEN;

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: '#020611',
        color: '#e2e8f0',
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Background glow */}
      <div
        style={{
          position: 'absolute',
          top: '10%',
          left: '15%',
          width: '60vw',
          height: '60vw',
          maxWidth: 800,
          maxHeight: 800,
          background:
            'radial-gradient(circle, rgba(24,144,255,0.1) 0%, rgba(3,8,22,0) 70%)',
          filter: 'blur(80px)',
          zIndex: 0,
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: '10%',
          right: '15%',
          width: '50vw',
          height: '50vw',
          maxWidth: 700,
          maxHeight: 700,
          background:
            'radial-gradient(circle, rgba(114,46,209,0.08) 0%, rgba(3,8,22,0) 70%)',
          filter: 'blur(80px)',
          zIndex: 0,
          pointerEvents: 'none',
        }}
      />

      {/* Content */}
      <div style={{ position: 'relative', zIndex: 1, padding: '40px 24px 80px' }}>
        {/* Top bar */}
        <div
          style={{
            maxWidth: 900,
            margin: '0 auto 40px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 16,
          }}
        >
          <img
            src="/brand/alphalab-logo.png"
            alt="AlphaLab"
            style={{
              height: 40,
              width: 'auto',
              objectFit: 'contain',
              cursor: 'pointer',
            }}
            onClick={() => navigate('/')}
          />
          <div style={{ display: 'flex', gap: 24 }}>
            <Link
              to="/signup"
              style={{
                color: '#94a3b8',
                fontSize: '0.9rem',
                fontWeight: 500,
                textDecoration: 'none',
                transition: 'color 0.2s',
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = '#e2e8f0'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = '#94a3b8'; }}
            >
              <ArrowLeftOutlined style={{ marginRight: 4 }} />
              {t.legal.backToSignUp}
            </Link>
            <Link
              to="/"
              style={{
                color: '#94a3b8',
                fontSize: '0.9rem',
                fontWeight: 500,
                textDecoration: 'none',
                transition: 'color 0.2s',
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = '#e2e8f0'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = '#94a3b8'; }}
            >
              {t.legal.backToHome}
            </Link>
          </div>
        </div>

        {/* Content card */}
        <div
          style={{
            maxWidth: 900,
            margin: '0 auto',
            background: 'rgba(17,25,40,0.65)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 24,
            backdropFilter: 'blur(24px)',
            boxShadow: '0 30px 60px -12px rgba(0,0,0,0.8), 0 0 40px rgba(24,144,255,0.05)',
            padding: '48px 48px',
          }}
        >
          {/* Disclaimer */}
          <div
            style={{
              padding: '12px 16px',
              background: 'rgba(255, 193, 7, 0.12)',
              border: '1px solid rgba(255, 193, 7, 0.3)',
              borderRadius: 8,
              color: '#fbbf24',
              fontSize: 13,
              marginBottom: 32,
              textAlign: 'center',
            }}
          >
            {t.legal.disclaimer}
          </div>

          {/* Title */}
          <h1
            style={{
              color: '#fff',
              fontSize: '2rem',
              fontWeight: 700,
              marginBottom: 8,
              letterSpacing: '-0.02em',
            }}
          >
            {t.legal.termsTitle}
          </h1>
          <p style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: 40 }}>
            {t.legal.termsLastUpdated}
          </p>

          {/* Sections */}
          {content.map((section, i) => (
            <div key={i} style={{ marginBottom: 32 }}>
              <h2
                style={{
                  color: '#fff',
                  fontSize: '1.15rem',
                  fontWeight: 600,
                  marginBottom: 10,
                }}
              >
                {section.title}
              </h2>
              {section.body.split('\n\n').map((paragraph, j) => (
                <p
                  key={j}
                  style={{
                    color: '#cbd5e1',
                    fontSize: '0.95rem',
                    lineHeight: 1.7,
                    marginBottom: 8,
                    marginTop: 0,
                  }}
                >
                  {paragraph.split('\n').map((line, k) => (
                    <React.Fragment key={k}>
                      {k > 0 && <br />}
                      {line}
                    </React.Fragment>
                  ))}
                </p>
              ))}
            </div>
          ))}

          {/* Important notice */}
          <div
            style={{
              marginTop: 40,
              padding: '14px 18px',
              background: 'rgba(255, 77, 79, 0.1)',
              border: '1px solid rgba(255, 77, 79, 0.25)',
              borderRadius: 8,
              color: '#ff7875',
              fontSize: 13,
              lineHeight: 1.6,
            }}
          >
            <strong>{isCN ? '重要提示：' : 'Important: '}</strong>
            {t.legal.importantNotice}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Terms;
