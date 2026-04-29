import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu } from 'antd';
import {
  DashboardOutlined,
  LineChartOutlined,
  BarChartOutlined,
  UserOutlined,
  TrophyOutlined,
  UnorderedListOutlined,
  SwapOutlined,
  RocketOutlined,
  AreaChartOutlined,
  PieChartOutlined,
  ExperimentOutlined,
  RobotOutlined,
  SettingOutlined
} from '@ant-design/icons';
import { useLanguage } from '../contexts/LanguageContext';
import styles from './NavigationMenu.module.css';

const NavigationMenu: React.FC = () => {
  const { t } = useLanguage();
  const location = useLocation();

  // Determine selected key from current path
  const getSelectedKey = () => {
    const path = location.pathname;
    if (path === '/') return '1';
    if (path === '/market') return '2';
    if (path === '/watchlist') return '3';
    if (path === '/backtest') return '4';
    if (path === '/optimize') return '5';
    if (path === '/compare') return '6';
    if (path === '/ranking') return '7';
    if (path === '/local-paper-trading') return '8';
    if (path === '/analytics') return '9';
    if (path === '/ai-trading') return '10';
    if (path === '/portfolio') return '11';
    if (path.startsWith('/settings')) return '12';
    return '1';
  };

  const createMenuItem = (key: string, icon: React.ReactNode, text: string, to: string) => (
    <Menu.Item key={key} icon={icon}>
      <Link to={to}>{text}</Link>
    </Menu.Item>
  );

  return (
    <div className={styles.navigationMenu}>
      <Menu
        theme="dark"
        mode="inline"
        selectedKeys={[getSelectedKey()]}
        style={{
          backgroundColor: '#001529',
          borderRight: 'none',
        }}
      >
        {createMenuItem('1', <DashboardOutlined />, t.navigation.dashboard, '/')}
        {createMenuItem('2', <LineChartOutlined />, t.navigation.market, '/market')}
        {createMenuItem('3', <UnorderedListOutlined />, t.navigation.watchlist, '/watchlist')}
        {createMenuItem('4', <BarChartOutlined />, t.navigation.backtest, '/backtest')}
        {createMenuItem('5', <RocketOutlined />, t.navigation.parameterOptimization, '/optimize')}
        {createMenuItem('6', <SwapOutlined />, t.navigation.strategyComparison, '/compare')}
        {createMenuItem('7', <TrophyOutlined />, t.navigation.strategyRanking, '/ranking')}
        {createMenuItem('8', <PieChartOutlined />, 'Local Paper Trading', '/local-paper-trading')}
        {createMenuItem('9', <AreaChartOutlined />, t.navigation.analytics, '/analytics')}
        {createMenuItem('10', <RobotOutlined />, 'Alpaca Trade', '/ai-trading')}
        {createMenuItem('11', <PieChartOutlined />, 'AI Agent', '/portfolio')}
        {createMenuItem('12', <SettingOutlined />, 'Settings', '/settings')}
      </Menu>
    </div>
  );
};

export default NavigationMenu;