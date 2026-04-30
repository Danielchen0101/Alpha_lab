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

  // Map routes to menu keys
  const routeToKey: Record<string, string> = {
    '/': '1',
    '/market': '2',
    '/watchlist': '3',
    '/backtest': '4',
    '/optimize': '5',
    '/compare': '6',
    '/ranking': '7',
    '/local-paper-trading': '8',
    '/analytics': '9',
    '/ai-trading': '10',
    '/portfolio': '11',
    '/settings': '12',
  };

  // Find selected key: match exact route or prefix (for /settings/configuration)
  const selectedKey = routeToKey[location.pathname]
    || Object.entries(routeToKey).find(([path]) => location.pathname.startsWith(path + '/'))?.[1]
    || '1';

  // 创建菜单项组件的函数，确保所有菜单项使用完全相同的结构
  const createMenuItem = (key: string, icon: React.ReactNode, text: string, to: string) => (
    <Menu.Item
      key={key}
      icon={icon}
    >
      <Link to={to}>{text}</Link>
    </Menu.Item>
  );

  return (
    <div className={styles.navigationMenu}>
      <Menu
        theme="dark"
        mode="inline"
        selectedKeys={[selectedKey]}
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