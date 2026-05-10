import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { useLanguage } from '../contexts/LanguageContext';

const privacyContentEN = [
  {
    title: '1. Introduction',
    body: 'This Privacy Policy explains how AlphaLab collects, uses, stores, and protects information when you use the platform. By using AlphaLab, you agree to the practices described in this Privacy Policy.',
  },
  {
    title: '2. Information We Collect',
    body: 'We may collect the following types of information:\n\nAccount information:\n- Name\n- Email address\n- Authentication provider information\n- Account settings and preferences\n\nPlatform configuration:\n- API provider names\n- Trading mode settings\n- User-selected strategy preferences\n- Watchlists, scanner results, entry plans, exit plans, and portfolio settings\n\nThird-party credentials:\n- API keys or tokens that you choose to save for integrations such as Alpaca, Finnhub, or AI providers\n\nUsage and technical information:\n- Browser type\n- Device information\n- IP address\n- Session information\n- Log data\n- Error reports\n- Feature usage\n\nTrading-related information:\n- Account summary data\n- Positions\n- Orders\n- Portfolio history\n- Market data and analysis results\n- Paper trading and live trading workflow outputs',
  },
  {
    title: '3. How We Use Information',
    body: 'We use information to:\n- Provide and operate the platform\n- Authenticate users\n- Save user preferences and configurations\n- Connect to third-party APIs at your request\n- Display market, portfolio, order, and trading workflow data\n- Generate AI-assisted analysis and trading plans\n- Improve platform reliability, security, and user experience\n- Prevent abuse, fraud, and unauthorized access\n- Debug errors and monitor system performance',
  },
  {
    title: '4. API Keys and Sensitive Credentials',
    body: 'If you choose to store API keys or third-party credentials, AlphaLab may encrypt them before storage when supported by the platform. We use these credentials only to provide the integrations and features you request.\n\nYou should not share API keys publicly. You may remove or rotate API credentials at any time through the relevant provider.',
  },
  {
    title: '5. Third-Party Services',
    body: 'AlphaLab may use third-party services including Supabase, Cloudflare, Alpaca, Finnhub, AI providers, OAuth providers, hosting providers, and analytics or monitoring tools.\n\nWhen you connect or authenticate through third-party services, their own privacy policies and terms may apply. AlphaLab is not responsible for the privacy practices of third-party services.',
  },
  {
    title: '6. AI Providers',
    body: 'If you use AI-powered features, relevant market data, scanner results, prompts, or analysis context may be sent to configured AI providers to generate responses. Do not submit sensitive personal information into AI prompts unless necessary.',
  },
  {
    title: '7. Trading Data',
    body: 'AlphaLab may process trading-related data such as account balances, positions, orders, portfolio value, and historical performance. This information is used to display dashboards, calculate risk, generate entry and exit plans, and support user-directed trading workflows.',
  },
  {
    title: '8. Cookies and Local Storage',
    body: 'AlphaLab may use cookies, browser storage, and local storage to keep users signed in, remember preferences, store interface settings, and improve user experience.',
  },
  {
    title: '9. Data Security',
    body: 'We use reasonable technical and organizational measures to protect user information. However, no system is completely secure. You are responsible for protecting your account credentials and third-party API keys.',
  },
  {
    title: '10. Data Retention',
    body: 'We retain information as long as needed to provide the platform, comply with legal obligations, resolve disputes, maintain security, and improve services. You may request deletion of certain account data where supported.',
  },
  {
    title: '11. Data Sharing',
    body: 'We do not sell your personal information. We may share information with service providers only as needed to operate the platform, comply with legal obligations, protect rights and safety, or provide requested integrations.',
  },
  {
    title: '12. Your Choices',
    body: 'You may:\n- Update account information\n- Remove saved API credentials\n- Change platform preferences\n- Disconnect third-party services\n- Request deletion of certain data where supported\n- Stop using the platform',
  },
  {
    title: '13. Children\'s Privacy',
    body: 'AlphaLab is not intended for children under 13. We do not knowingly collect personal information from children under 13.',
  },
  {
    title: '14. International Users',
    body: 'If you access AlphaLab from outside the United States, you understand that information may be processed in jurisdictions where our service providers operate.',
  },
  {
    title: '15. Changes to This Policy',
    body: 'We may update this Privacy Policy from time to time. Continued use of the platform after changes are posted means you accept the updated policy.',
  },
  {
    title: '16. Contact',
    body: 'If you have questions about this Privacy Policy, contact the AlphaLab project owner through the official project communication channel.',
  },
];

const privacyContentZH: typeof privacyContentEN = [
  {
    title: '1. 简介',
    body: '本隐私政策说明 AlphaLab 在你使用平台时如何收集、使用、存储和保护信息。使用 AlphaLab 即表示你同意本隐私政策所述的处理方式。',
  },
  {
    title: '2. 我们收集的信息',
    body: '我们可能收集以下信息：\n\n账户信息：\n- 姓名\n- 邮箱地址\n- 第三方登录提供商信息\n- 账户设置和偏好\n\n平台配置：\n- API 提供商名称\n- 交易模式设置\n- 用户选择的策略偏好\n- 自选列表、扫描结果、入场计划、退出计划和投资组合设置\n\n第三方凭证：\n- 你选择保存的 API 密钥或 token，例如 Alpaca、Finnhub 或 AI 提供商凭证\n\n使用与技术信息：\n- 浏览器类型\n- 设备信息\n- IP 地址\n- 会话信息\n- 日志数据\n- 错误报告\n- 功能使用情况\n\n交易相关信息：\n- 账户摘要数据\n- 持仓\n- 订单\n- 投资组合历史\n- 市场数据和分析结果\n- 模拟交易和实盘交易流程输出',
  },
  {
    title: '3. 我们如何使用信息',
    body: '我们使用信息用于：\n- 提供和运行平台\n- 用户认证\n- 保存用户偏好和配置\n- 根据你的请求连接第三方 API\n- 展示市场、投资组合、订单和交易流程数据\n- 生成 AI 辅助分析和交易计划\n- 改善平台可靠性、安全性和用户体验\n- 防止滥用、欺诈和未授权访问\n- 调试错误并监控系统性能',
  },
  {
    title: '4. API 密钥和敏感凭证',
    body: '如果你选择保存 API 密钥或第三方凭证，AlphaLab 会在平台支持的情况下对其进行加密存储。我们仅会将这些凭证用于你请求的集成和功能。\n\n你不应公开分享 API 密钥。你可以通过对应服务提供商随时删除或轮换 API 凭证。',
  },
  {
    title: '5. 第三方服务',
    body: 'AlphaLab 可能使用 Supabase、Cloudflare、Alpaca、Finnhub、AI 提供商、OAuth 登录提供商、托管服务商以及分析或监控工具等第三方服务。\n\n当你连接或通过第三方服务认证时，对方的隐私政策和服务条款可能适用。AlphaLab 不对第三方服务的隐私实践负责。',
  },
  {
    title: '6. AI 提供商',
    body: '如果你使用 AI 功能，相关市场数据、扫描结果、提示词或分析上下文可能会发送给你配置的 AI 提供商以生成回答。除非必要，请不要在 AI 提示词中提交敏感个人信息。',
  },
  {
    title: '7. 交易数据',
    body: 'AlphaLab 可能处理账户余额、持仓、订单、投资组合价值和历史表现等交易相关数据。这些信息用于展示仪表盘、计算风险、生成入场和退出计划，并支持用户自主交易流程。',
  },
  {
    title: '8. Cookie 和本地存储',
    body: 'AlphaLab 可能使用 cookie、浏览器存储和 localStorage 来保持登录状态、记住偏好、保存界面设置并改善用户体验。',
  },
  {
    title: '9. 数据安全',
    body: '我们使用合理的技术和组织措施保护用户信息。但没有任何系统是完全安全的。你需要自行保护账户凭证和第三方 API 密钥。',
  },
  {
    title: '10. 数据保留',
    body: '我们会在提供平台、履行法律义务、解决争议、维护安全和改善服务所需期间保留信息。在平台支持的情况下，你可以请求删除部分账户数据。',
  },
  {
    title: '11. 数据共享',
    body: '我们不会出售你的个人信息。我们可能仅在运行平台、履行法律义务、保护权利与安全或提供你请求的集成所需范围内，与服务提供商共享信息。',
  },
  {
    title: '12. 你的选择',
    body: '你可以：\n- 更新账户信息\n- 删除已保存的 API 凭证\n- 修改平台偏好\n- 断开第三方服务连接\n- 在支持的情况下请求删除部分数据\n- 停止使用平台',
  },
  {
    title: '13. 儿童隐私',
    body: 'AlphaLab 不面向 13 岁以下儿童。我们不会有意收集 13 岁以下儿童的个人信息。',
  },
  {
    title: '14. 国际用户',
    body: '如果你从美国境外访问 AlphaLab，你理解信息可能会在我们的服务提供商运营所在司法辖区进行处理。',
  },
  {
    title: '15. 政策变更',
    body: '我们可能不时更新本隐私政策。更新发布后继续使用平台，即表示你接受更新后的政策。',
  },
  {
    title: '16. 联系方式',
    body: '如果你对本隐私政策有疑问，请通过 AlphaLab 项目的官方沟通渠道联系项目负责人。',
  },
];

const Privacy: React.FC = () => {
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  const isCN = language === 'zh-CN';
  const content = isCN ? privacyContentZH : privacyContentEN;

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
            {t.legal.privacyTitle}
          </h1>
          <p style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: 40 }}>
            {t.legal.privacyLastUpdated}
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

export default Privacy;
