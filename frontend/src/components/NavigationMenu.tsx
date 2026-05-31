import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, Tag, Tooltip, Modal, Input, Typography, Alert } from 'antd';
import {
  DashboardOutlined,
  LineChartOutlined,
  BarChartOutlined,
  TrophyOutlined,
  UnorderedListOutlined,
  SwapOutlined,
  RocketOutlined,
  PieChartOutlined,
  RobotOutlined,
  SettingOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import { useLanguage } from '../contexts/LanguageContext';
import { useTradeMode } from '../contexts/TradeModeContext';
import styles from './NavigationMenu.module.css';

const { Text } = Typography;

interface NavigationMenuProps {
  collapsed?: boolean;
}

const NavigationMenu: React.FC<NavigationMenuProps> = ({ collapsed }) => {
  const { t } = useLanguage();
  const { tradeMode, setTradeMode } = useTradeMode();
  const location = useLocation();
  const [realModalOpen, setRealModalOpen] = useState(false);
  const [realConfirmText, setRealConfirmText] = useState('');
  const [realSwitchError, setRealSwitchError] = useState<string | null>(null);

  // Map routes to menu keys
  const routeToKey: Record<string, string> = {
    '/dashboard': '1',
    '/market': '2',
    '/watchlist': '3',
    '/backtest': '4',
    '/optimize': '5',
    '/compare': '6',
    '/ranking': '7',
    '/agent': '10',
    '/trade': '11',
    '/portfolio': '13',
    '/settings': '12',
  };

  const selectedKey = routeToKey[location.pathname]
    || Object.entries(routeToKey).find(([path]) => location.pathname.startsWith(path + '/'))?.[1]
    || '1';

  const handleRealModeClick = () => {
    if (tradeMode === 'real') return;
    setRealModalOpen(true);
    setRealConfirmText('');
    setRealSwitchError(null);
  };

  const handleRealConfirm = () => {
    if (realConfirmText.trim() !== 'REAL') {
      setRealSwitchError(t.navigation.typeRealValidation);
      return;
    }
    setTradeMode('real');
    setRealModalOpen(false);
    setRealConfirmText('');
    setRealSwitchError(null);
  };

  const handleRealModalCancel = () => {
    setRealModalOpen(false);
    setRealConfirmText('');
    setRealSwitchError(null);
  };

  return (
    <div className={styles.navigationMenuContainer}>
      <div className={styles.menuScrollArea}>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[selectedKey]}
          className={styles.sidebarMenu}
        >
          {/* RESEARCH GROUP */}
          {!collapsed && <div className={styles.menuDivider}>{t.navigation.researchGroup}</div>}
          <Menu.Item key="1" icon={<DashboardOutlined />} title={collapsed ? t.navigation.dashboard : undefined}>
            <Link to="/dashboard">{t.navigation.dashboard}</Link>
          </Menu.Item>
          <Menu.Item key="2" icon={<LineChartOutlined />} title={collapsed ? t.navigation.market : undefined}>
            <Link to="/market">{t.navigation.market}</Link>
          </Menu.Item>
          <Menu.Item key="3" icon={<UnorderedListOutlined />} title={collapsed ? t.navigation.watchlist : undefined}>
            <Link to="/watchlist">{t.navigation.watchlist}</Link>
          </Menu.Item>

          {/* STRATEGY GROUP */}
          {!collapsed && <div className={styles.menuDivider}>{t.navigation.strategyGroup}</div>}
          <Menu.Item key="4" icon={<BarChartOutlined />} title={collapsed ? t.navigation.backtest : undefined}>
            <Link to="/backtest">{t.navigation.backtest}</Link>
          </Menu.Item>
          <Menu.Item key="5" icon={<RocketOutlined />} title={collapsed ? t.navigation.parameterOptimization : undefined}>
            <Link to="/optimize">{t.navigation.parameterOptimization}</Link>
          </Menu.Item>
          <Menu.Item key="6" icon={<SwapOutlined />} title={collapsed ? t.navigation.strategyComparison : undefined}>
            <Link to="/compare">{t.navigation.strategyComparison}</Link>
          </Menu.Item>
          <Menu.Item key="7" icon={<TrophyOutlined />} title={collapsed ? t.navigation.strategyRanking : undefined}>
            <Link to="/ranking">{t.navigation.strategyRanking}</Link>
          </Menu.Item>

          {/* TRADING GROUP */}
          {!collapsed && <div className={styles.menuDivider}>{t.navigation.tradingGroup}</div>}

          {/* TRADE MODE TOGGLE */}
          {!collapsed && (
            <div className={styles.tradeModeSection}>
              <div className={styles.tradeModeHeader}>
                <span className={styles.statusLabel}>{t.navigation.tradeMode}</span>
              </div>
              <div className={styles.tradeModeToggle}>
                <button
                  className={`${styles.tradeModeBtn} ${tradeMode === 'paper' ? styles.tradeModeBtnActive : ''}`}
                  onClick={() => setTradeMode('paper')}
                  type="button"
                >
                  <span className={styles.modeDot} style={{ backgroundColor: '#1890ff', opacity: tradeMode === 'paper' ? 1 : 0.2 }} />
                  {t.navigation.paperMode}
                </button>
                <button
                  className={`${styles.tradeModeBtn} ${tradeMode === 'real' ? styles.tradeModeBtnRealActive : ''}`}
                  onClick={handleRealModeClick}
                  type="button"
                >
                  <span className={styles.modeDot} style={{ backgroundColor: '#ff4d4f', opacity: tradeMode === 'real' ? 1 : 0.2 }} />
                  {t.navigation.realMode}
                </button>
              </div>
            </div>
          )}

          <Menu.Item key="10" icon={<RobotOutlined />} title={collapsed ? t.navigation.agent : undefined}>
            <Link to="/agent">{t.navigation.agent}</Link>
          </Menu.Item>
          <Menu.Item key="11" icon={<SwapOutlined />} title={collapsed ? t.navigation.trade : undefined}>
            <Link to="/trade">{t.navigation.trade}</Link>
          </Menu.Item>
          <Menu.Item key="13" icon={<PieChartOutlined />} title={collapsed ? t.navigation.portfolio : undefined}>
            <Link to="/portfolio">{t.navigation.portfolio}</Link>
          </Menu.Item>

          {/* SYSTEM GROUP */}
          {!collapsed && <div className={styles.menuDivider}>{t.navigation.systemGroup}</div>}
          <Menu.Item key="12" icon={<SettingOutlined />} title={collapsed ? t.navigation.settings : undefined}>
            <Link to="/settings">{t.navigation.settings}</Link>
          </Menu.Item>
        </Menu>
      </div>

      {/* Real Mode Confirmation Modal */}
      <Modal
        title={
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <WarningOutlined style={{ color: '#ff4d4f', fontSize: 20 }} />
            {t.navigation.switchToRealTrading}
          </span>
        }
        open={realModalOpen}
        onOk={handleRealConfirm}
        onCancel={handleRealModalCancel}
        okText={t.navigation.switchToRealMode}
        cancelText={t.navigation.stayInPaperMode}
        okButtonProps={{ danger: true, disabled: realConfirmText.trim() !== 'REAL' }}
        width={520}
        destroyOnClose
      >
        <Alert
          message={t.navigation.realTradingWarning}
          description={t.navigation.realTradingWarningDesc}
          type="error"
          showIcon
          icon={<WarningOutlined />}
          style={{ marginBottom: 16, borderRadius: 8 }}
        />
        <div style={{ marginBottom: 8 }}>
          <Text strong type="danger">{t.navigation.typeRealToConfirm}</Text>
        </div>
        <Input
          value={realConfirmText}
          onChange={(e) => {
            setRealConfirmText(e.target.value);
            setRealSwitchError(null);
          }}
          onPressEnter={handleRealConfirm}
          placeholder={t.navigation.typeRealPlaceholder}
          style={{ textTransform: 'uppercase', fontWeight: 700 }}
          autoFocus
        />
        {realSwitchError && (
          <Text type="danger" style={{ display: 'block', marginTop: 8, fontSize: 12 }}>{realSwitchError}</Text>
        )}
      </Modal>

      {/* BOTTOM UTILITY AREA */}
      <div className={styles.sidebarFooter}>
        {collapsed ? (
          <Tooltip title={t.navigation.checkConnectionStatus}>
            <div className={styles.collapsedStatus}>
              <div className={styles.statusDot} style={{ backgroundColor: '#faad14', color: '#faad14' }} />
            </div>
          </Tooltip>
        ) : (
          <div className={styles.expandedStatus}>
            <div className={styles.statusRow}>
              <span className={styles.statusLabel}>{t.navigation.configLabel}</span>
              <Tag color="gold" className={styles.statusTag}>{t.navigation.settingsLabel}</Tag>
            </div>
            <div className={styles.statusInfo}>
              <div className={styles.statusDot} style={{ backgroundColor: '#faad14', color: '#faad14' }} />
              <span className={styles.statusText}>{t.navigation.verifyConnections}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default NavigationMenu;
