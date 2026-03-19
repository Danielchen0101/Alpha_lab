import React from 'react';
import { Tag, Tooltip, Typography } from 'antd';
import { InfoCircleOutlined } from '@ant-design/icons';

const { Text } = Typography;

interface DataSourceBadgeProps {
  source: string;
  position?: 'bottom-left' | 'bottom-right' | 'top-left' | 'top-right';
  compact?: boolean;
  showIcon?: boolean;
}

const DataSourceBadge: React.FC<DataSourceBadgeProps> = ({
  source,
  position = 'bottom-left',
  compact = false,
  showIcon = true
}) => {
  // 根据数据源确定颜色和标签
  const getSourceInfo = (source: string) => {
    const lowerSource = source.toLowerCase();
    
    if (lowerSource.includes('polygon')) {
      return {
        color: 'blue',
        name: 'Polygon.io',
        description: 'Market data provided by Polygon.io',
        icon: '📊'
      };
    } else if (lowerSource.includes('alpaca')) {
      return {
        color: 'green',
        name: 'Alpaca Markets',
        description: 'Trading data provided by Alpaca Markets',
        icon: '💰'
      };
    } else if (lowerSource.includes('finnhub')) {
      return {
        color: 'purple',
        name: 'Finnhub',
        description: 'Market data provided by Finnhub',
        icon: '📈'
      };
    } else if (lowerSource.includes('yahoo')) {
      return {
        color: 'orange',
        name: 'Yahoo Finance',
        description: 'Historical data provided by Yahoo Finance',
        icon: '📅'
      };
    } else if (lowerSource.includes('simulated') || lowerSource.includes('fallback')) {
      return {
        color: 'gray',
        name: 'Simulated Data',
        description: 'Simulated data for demonstration purposes',
        icon: '🔄'
      };
    } else {
      return {
        color: 'default',
        name: source,
        description: `Data provided by ${source}`,
        icon: '📋'
      };
    }
  };

  const sourceInfo = getSourceInfo(source);
  
  // 位置样式
  const positionStyles = {
    'bottom-left': {
      position: 'fixed' as const,
      bottom: 8,
      left: 8,
      zIndex: 1000
    },
    'bottom-right': {
      position: 'fixed' as const,
      bottom: 8,
      right: 8,
      zIndex: 1000
    },
    'top-left': {
      position: 'fixed' as const,
      top: 8,
      left: 8,
      zIndex: 1000
    },
    'top-right': {
      position: 'fixed' as const,
      top: 8,
      right: 8,
      zIndex: 1000
    }
  };

  const style = {
    ...positionStyles[position],
    opacity: 0.8,
    transition: 'opacity 0.3s',
    ':hover': {
      opacity: 1
    }
  };

  if (compact) {
    return (
      <div style={style}>
        <Tooltip title={sourceInfo.description}>
          <Tag 
            color={sourceInfo.color} 
            style={{ 
              margin: 0,
              fontSize: '11px',
              padding: '2px 6px',
              borderRadius: '10px',
              cursor: 'help'
            }}
          >
            {showIcon && <span style={{ marginRight: 4 }}>{sourceInfo.icon}</span>}
            {sourceInfo.name}
          </Tag>
        </Tooltip>
      </div>
    );
  }

  return (
    <div style={style}>
      <Tooltip title={sourceInfo.description}>
        <div 
          style={{ 
            display: 'flex',
            alignItems: 'center',
            padding: '4px 8px',
            backgroundColor: 'rgba(255, 255, 255, 0.9)',
            borderRadius: '6px',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
            border: '1px solid #f0f0f0',
            cursor: 'help',
            maxWidth: '200px'
          }}
        >
          {showIcon && (
            <span style={{ marginRight: 8, fontSize: '14px' }}>
              {sourceInfo.icon}
            </span>
          )}
          <div>
            <Text type="secondary" style={{ fontSize: '10px', display: 'block' }}>
              Data Source
            </Text>
            <Text strong style={{ fontSize: '12px' }}>
              {sourceInfo.name}
            </Text>
          </div>
          <InfoCircleOutlined 
            style={{ 
              marginLeft: 8, 
              fontSize: '12px', 
              color: '#999' 
            }} 
          />
        </div>
      </Tooltip>
    </div>
  );
};

export default DataSourceBadge;