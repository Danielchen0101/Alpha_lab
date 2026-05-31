import React from 'react';
import { Button, Dropdown, Tooltip } from 'antd';
import {
  DesktopOutlined,
  MoonOutlined,
  SunOutlined,
} from '@ant-design/icons';
import type { MenuProps } from 'antd';
import { useLanguage } from '../contexts/LanguageContext';
import { ThemeMode, useTheme } from '../contexts/ThemeContext';

const ThemeSwitcher: React.FC = () => {
  const { t } = useLanguage();
  const { themeMode, setThemeMode, resolvedTheme } = useTheme();

  const items: MenuProps['items'] = [
    { key: 'system', icon: <DesktopOutlined />, label: t.common.themeSystem },
    { key: 'light', icon: <SunOutlined />, label: t.common.themeLight },
    { key: 'dark', icon: <MoonOutlined />, label: t.common.themeDark },
  ];

  const handleClick: MenuProps['onClick'] = ({ key }) => {
    setThemeMode(key as ThemeMode);
  };

  return (
    <Tooltip title={t.common.switchTheme}>
      <Dropdown
        menu={{ items, selectedKeys: [themeMode], onClick: handleClick }}
        placement="bottomRight"
        trigger={['click']}
      >
        <Button
          aria-label={t.common.switchTheme}
          icon={resolvedTheme === 'dark' ? <MoonOutlined /> : <SunOutlined />}
          style={{
            width: 32,
            height: 32,
            padding: 0,
            background: 'var(--app-card-bg)',
            color: 'var(--app-text)',
            border: '1px solid var(--app-border)',
            borderRadius: 6,
            boxShadow: 'var(--app-card-shadow)',
          }}
        />
      </Dropdown>
    </Tooltip>
  );
};

export default ThemeSwitcher;
