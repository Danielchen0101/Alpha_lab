import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Typography, Divider, Space } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { useLanguage } from '../contexts/LanguageContext';

const { Title, Paragraph, Text } = Typography;

const About: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();

  return (
    <div style={{ minHeight: '100vh', background: 'var(--app-bg)', color: 'var(--app-text)' }}>
      <div style={{ maxWidth: 800, margin: '0 auto', padding: '40px 24px' }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/')} style={{ marginBottom: 24 }}>{t.about.backToHome}</Button>

        <Title>{t.about.title}</Title>
        <Paragraph>{t.about.intro}</Paragraph>

        <Divider />

        <Title level={2}>{t.about.workflowTitle}</Title>
        <div style={{ background: 'var(--app-card-bg)', padding: 24, borderRadius: 8, marginBottom: 24 }}>
          <Paragraph>
            <Text strong>{t.about.workflowScannerTitle}</Text> — {t.about.workflowScannerDesc}
          </Paragraph>
          <Paragraph>
            <Text strong>{t.about.workflowContinueTitle}</Text> — {t.about.workflowContinueDesc}
          </Paragraph>
          <Paragraph>
            <Text strong>{t.about.workflowFineTitle}</Text> — {t.about.workflowFineDesc}
          </Paragraph>
          <Paragraph>
            <Text strong>{t.about.workflowValidationTitle}</Text> — {t.about.workflowValidationDesc}
          </Paragraph>
          <Paragraph>
            <Text strong>{t.about.workflowEntryTitle}</Text> — {t.about.workflowEntryDesc}
          </Paragraph>
          <Paragraph>
            <Text strong>{t.about.workflowWatchlistTitle}</Text> — {t.about.workflowWatchlistDesc}
          </Paragraph>
        </div>

        <Divider />

        <Title level={2}>{t.about.tradingModesTitle}</Title>
        <Paragraph>{t.about.tradingModesDesc}</Paragraph>

        <Divider />

        <Title level={2}>{t.about.apiTitle}</Title>
        <Paragraph>{t.about.apiDesc}</Paragraph>

        <Divider />

        <Title level={2}>{t.about.riskTitle}</Title>
        <Paragraph>{t.about.riskDesc}</Paragraph>
        <ul style={{ lineHeight: 2 }}>
          <li>{t.about.riskPositionSizing}</li>
          <li>{t.about.riskConcentration}</li>
          <li>{t.about.riskDailyLoss}</li>
          <li>{t.about.riskAiAssessment}</li>
          <li>{t.about.riskBacktest}</li>
        </ul>

        <Divider />

        <Title level={2}>{t.about.disclaimerTitle}</Title>
        <Paragraph type="warning">{t.about.disclaimerDesc}</Paragraph>

        <div style={{ textAlign: 'center', marginTop: 40 }}>
          <Space>
            <Button type="primary" onClick={() => navigate('/signup')}>{t.about.getStarted}</Button>
            <Button onClick={() => navigate('/')}>{t.about.backToHome}</Button>
          </Space>
        </div>
      </div>
    </div>
  );
};

export default About;
