// Paper Trading Control Panel 重做版本
const ControlPanelRedesign = () => {
  return (
    {/* ========== Trading Control Panel ========== */}
    <div style={{ marginBottom: DESIGN_SYSTEM.spacing.lg }}>
      <h2 style={styles.sectionTitle}>Trading Control Panel</h2>
      
      {/* 状态信息区 */}
      <Card style={{ ...styles.card, marginBottom: DESIGN_SYSTEM.spacing.sm }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: DESIGN_SYSTEM.spacing.xs }}>
          <h3 style={styles.subsectionTitle}>Current Status</h3>
          <Tag color={paperTradingConfig.status === 'RUNNING' ? 'success' : 'default'}>
            {paperTradingConfig.status === 'RUNNING' ? 'ACTIVE' : 'READY'}
          </Tag>
        </div>
        
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: DESIGN_SYSTEM.spacing.xs }}>
          <Tag style={{ 
            backgroundColor: DESIGN_SYSTEM.colors.primary + '15',
            color: DESIGN_SYSTEM.colors.primary,
            border: 'none'
          }}>
            Mode: {paperTradingConfig.mode || 'LOCAL'}
          </Tag>
          <Tag style={{ 
            backgroundColor: DESIGN_SYSTEM.colors.success + '15',
            color: DESIGN_SYSTEM.colors.success,
            border: 'none'
          }}>
            Strategy: {paperTradingConfig.strategy || 'MA Crossover'}
          </Tag>
          {paperTradingConfig.shortMaPeriod && paperTradingConfig.longMaPeriod && (
            <Tag style={{ 
              backgroundColor: DESIGN_SYSTEM.colors.warning + '15',
              color: DESIGN_SYSTEM.colors.warning,
              border: 'none'
            }}>
              MA: {paperTradingConfig.shortMaPeriod}/{paperTradingConfig.longMaPeriod}
            </Tag>
          )}
          <Tag style={{ 
            backgroundColor: DESIGN_SYSTEM.colors.text.secondary + '15',
            color: DESIGN_SYSTEM.colors.text.secondary,
            border: 'none'
          }}>
            Slippage: {(paperTradingConfig.slippageRate || 0) * 100}%
          </Tag>
          <Tag style={{ 
            backgroundColor: DESIGN_SYSTEM.colors.text.secondary + '15',
            color: DESIGN_SYSTEM.colors.text.secondary,
            border: 'none'
          }}>
            Commission: ${paperTradingConfig.commission || 0}
          </Tag>
        </div>
      </Card>

      {/* 控制按钮区 */}
      <Card style={{ ...styles.card, marginBottom: DESIGN_SYSTEM.spacing.sm }}>
        <h3 style={styles.subsectionTitle}>Trading Controls</h3>
        <div style={{ display: 'flex', gap: DESIGN_SYSTEM.spacing.sm, flexWrap: 'wrap' }}>
          <Button 
            type="primary"
            style={{ 
              backgroundColor: paperTradingConfig.status === 'RUNNING' ? DESIGN_SYSTEM.colors.error : DESIGN_SYSTEM.colors.success,
              border: 'none'
            }}
            onClick={paperTradingConfig.status === 'RUNNING' ? stopPaperTrading : startPaperTrading}
            icon={paperTradingConfig.status === 'RUNNING' ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
          >
            {paperTradingConfig.status === 'RUNNING' ? 'Stop Paper Trading' : 'Start Paper Trading'}
          </Button>
          
          <Button 
            type="primary"
            style={{ 
              backgroundColor: batchRunning ? DESIGN_SYSTEM.colors.error : DESIGN_SYSTEM.colors.primary,
              border: 'none'
            }}
            onClick={batchRunning ? stopBatchExperiment : startBatchExperiment}
            icon={batchRunning ? <PauseCircleOutlined /> : <FolderOpenOutlined />}
          >
            {batchRunning ? 'Stop Batch' : 'Run Batch Experiment'}
          </Button>
          
          <Button 
            type="default"
            onClick={() => {
              setPaperTradingConfig(DEFAULT_PAPER_TRADING_CONFIG);
              message.info('Settings reset to defaults');
            }}
            disabled={paperTradingConfig.status === 'RUNNING'}
          >
            Reset Settings
          </Button>
        </div>
        
        {batchRunning && (
          <div style={{ marginTop: DESIGN_SYSTEM.spacing.sm }}>
            <Text style={styles.description}>
              Batch running: {batchStatus || `Preset ${currentBatchIndex + 1} of ${presetSequence.current.length}`}
            </Text>
            <Progress 
              percent={currentBatchIndex >= 0 ? ((currentBatchIndex + 1) / presetSequence.current.length) * 100 : 0}
              size="small"
              style={{ marginTop: DESIGN_SYSTEM.spacing.xs }}
            />
          </div>
        )}
      </Card>

      {/* 设置区 */}
      <Card style={styles.card}>
        <h3 style={styles.subsectionTitle}>Trading Settings</h3>
        <Row gutter={[DESIGN_SYSTEM.spacing.sm, DESIGN_SYSTEM.spacing.sm]}>
          <Col xs={24} sm={12} md={8}>
            <div style={styles.statTitle}>Symbol</div>
            <Select
              style={{ width: '100%' }}
              value={paperTradingConfig.selectedSymbol}
              onChange={(value) => setPaperTradingConfig(prev => ({ ...prev, selectedSymbol: value }))}
              disabled={paperTradingConfig.status === 'RUNNING'}
            >
              <Select.Option value="AAPL">AAPL</Select.Option>
              <Select.Option value="TSLA">TSLA</Select.Option>
              <Select.Option value="NVDA">NVDA</Select.Option>
              <Select.Option value="GOOGL">GOOGL</Select.Option>
            </Select>
          </Col>
          
          <Col xs={24} sm={12} md={8}>
            <div style={styles.statTitle}>Shares per Trade</div>
            <InputNumber
              min={1}
              max={100}
              style={{ width: '100%' }}
              value={paperTradingConfig.sharesPerTrade}
              onChange={(value) => value && setPaperTradingConfig(prev => ({ ...prev, sharesPerTrade: value }))}
              disabled={paperTradingConfig.status === 'RUNNING'}
            />
          </Col>
          
          <Col xs={24} sm={12} md={8}>
            <div style={styles.statTitle}>Interval (seconds)</div>
            <InputNumber
              min={1}
              max={60}
              style={{ width: '100%' }}
              value={paperTradingConfig.intervalSeconds}
              onChange={(value) => value && setPaperTradingConfig(prev => ({ ...prev, intervalSeconds: value }))}
              disabled={paperTradingConfig.status === 'RUNNING'}
            />
          </Col>
          
          <Col xs={24} sm={12} md={8}>
            <div style={styles.statTitle}>Slippage (%)</div>
            <InputNumber
              min={0}
              max={5}
              step={0.01}
              style={{ width: '100%' }}
              value={paperTradingConfig.slippageRate ? paperTradingConfig.slippageRate * 100 : 0.10}
              onChange={(value) => value && setPaperTradingConfig(prev => ({ ...prev, slippageRate: value / 100 }))}
              disabled={paperTradingConfig.status === 'RUNNING'}
              formatter={(value) => `${value}%`}
            />
          </Col>
          
          <Col xs={24} sm={12} md={8}>
            <div style={styles.statTitle}>Commission ($)</div>
            <InputNumber
              min={0}
              max={10}
              step={0.01}
              style={{ width: '100%' }}
              value={paperTradingConfig.commission || 0}
              onChange={(value) => value && setPaperTradingConfig(prev => ({ ...prev, commission: value }))}
              disabled={paperTradingConfig.status === 'RUNNING'}
              formatter={(value) => `$${value}`}
            />
          </Col>
          
          <Col xs={24} sm={12} md={8}>
            <div style={styles.statTitle}>Strategy</div>
            <Select
              style={{ width: '100%' }}
              value={paperTradingConfig.strategy}
              onChange={(value) => setPaperTradingConfig(prev => ({ ...prev, strategy: value }))}
              disabled={paperTradingConfig.status === 'RUNNING'}
            >
              <Select.Option value="RANDOM_SIGNAL">Random Signal</Select.Option>
              <Select.Option value="SMA_STRATEGY">SMA Strategy</Select.Option>
              <Select.Option value="MA_CROSSOVER">MA Crossover</Select.Option>
            </Select>
          </Col>
        </Row>
      </Card>
    </div>
  );
};