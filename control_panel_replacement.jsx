      {/* ========== Trading Control Panel ========== */}
      <div style={{ marginBottom: DESIGN_SYSTEM.spacing.lg }}>
        <h2 style={styles.sectionTitle}>Trading Control Panel</h2>
        
        {/* Section 1: Current Status */}
        <Card style={{ ...styles.card, marginBottom: DESIGN_SYSTEM.spacing.sm }}>
          <h3 style={styles.subsectionTitle}>Current Status</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: DESIGN_SYSTEM.spacing.xs }}>
            <Tag style={{ 
              backgroundColor: DESIGN_SYSTEM.colors.primary + '15',
              color: DESIGN_SYSTEM.colors.primary,
              border: 'none',
              borderRadius: '12px',
              padding: '2px 8px',
              fontSize: '12px',
              fontWeight: 500
            }}>
              Mode: {paperTradingConfig.mode || 'LOCAL'}
            </Tag>
            <Tag style={{ 
              backgroundColor: DESIGN_SYSTEM.colors.success + '15',
              color: DESIGN_SYSTEM.colors.success,
              border: 'none',
              borderRadius: '12px',
              padding: '2px 8px',
              fontSize: '12px',
              fontWeight: 500
            }}>
              Strategy: {paperTradingConfig.strategy || 'MA Crossover'}
            </Tag>
            {paperTradingConfig.shortMaPeriod && paperTradingConfig.longMaPeriod && (
              <Tag style={{ 
                backgroundColor: DESIGN_SYSTEM.colors.warning + '15',
                color: DESIGN_SYSTEM.colors.warning,
                border: 'none',
                borderRadius: '12px',
                padding: '2px 8px',
                fontSize: '12px',
                fontWeight: 500
              }}>
                MA: {paperTradingConfig.shortMaPeriod}/{paperTradingConfig.longMaPeriod}
              </Tag>
            )}
            <Tag style={{ 
              backgroundColor: paperTradingConfig.status === 'RUNNING' ? DESIGN_SYSTEM.colors.success + '15' : DESIGN_SYSTEM.colors.error + '15',
              color: paperTradingConfig.status === 'RUNNING' ? DESIGN_SYSTEM.colors.success : DESIGN_SYSTEM.colors.error,
              border: 'none',
              borderRadius: '12px',
              padding: '2px 8px',
              fontSize: '12px',
              fontWeight: 500
            }}>
              Status: {paperTradingConfig.status === 'RUNNING' ? 'Running' : 'Stopped'}
            </Tag>
          </div>
        </Card>

        {/* Section 2: Actions */}
        <Card style={{ ...styles.card, marginBottom: DESIGN_SYSTEM.spacing.sm }}>
          <h3 style={styles.subsectionTitle}>Actions</h3>
          <div style={{ display: 'flex', gap: DESIGN_SYSTEM.spacing.sm, flexWrap: 'wrap' }}>
            <Button 
              type="primary"
              style={{ 
                backgroundColor: paperTradingConfig.status === 'RUNNING' ? DESIGN_SYSTEM.colors.error : DESIGN_SYSTEM.colors.success,
                border: 'none',
                fontWeight: 500,
                minWidth: '120px'
              }}
              onClick={paperTradingConfig.status === 'RUNNING' ? stopPaperTrading : startPaperTrading}
              disabled={batchRunning}
              icon={paperTradingConfig.status === 'RUNNING' ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
            >
              {paperTradingConfig.status === 'RUNNING' ? 'Stop' : 'Start'}
            </Button>
            
            <Button 
              type="primary"
              style={{ 
                backgroundColor: batchRunning ? DESIGN_SYSTEM.colors.error : DESIGN_SYSTEM.colors.primary,
                border: 'none',
                fontWeight: 500,
                minWidth: '120px'
              }}
              onClick={batchRunning ? stopBatchExperiment : startBatchExperiment}
              disabled={paperTradingConfig.status === 'RUNNING'}
              icon={batchRunning ? <PauseCircleOutlined /> : <FolderOpenOutlined />}
            >
              {batchRunning ? 'Stop Batch' : 'Run Batch'}
            </Button>
            
            <Button 
              type="default"
              onClick={() => {
                setPaperTradingConfig(DEFAULT_PAPER_TRADING_CONFIG);
                message.info('Settings reset to defaults');
              }}
              disabled={paperTradingConfig.status === 'RUNNING' || batchRunning}
              style={{ fontWeight: 500, minWidth: '120px' }}
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

        {/* Section 3: Settings */}
        <Card style={styles.card}>
          <h3 style={styles.subsectionTitle}>Settings</h3>
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: DESIGN_SYSTEM.spacing.sm 
          }}>
            <div>
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
            </div>
            
            <div>
              <div style={styles.statTitle}>Shares per Trade</div>
              <InputNumber
                min={1}
                max={100}
                style={{ width: '100%' }}
                value={paperTradingConfig.sharesPerTrade}
                onChange={(value) => value && setPaperTradingConfig(prev => ({ ...prev, sharesPerTrade: value }))}
                disabled={paperTradingConfig.status === 'RUNNING'}
              />
            </div>
            
            <div>
              <div style={styles.statTitle}>Interval (seconds)</div>
              <InputNumber
                min={1}
                max={60}
                style={{ width: '100%' }}
                value={paperTradingConfig.intervalSeconds}
                onChange={(value) => value && setPaperTradingConfig(prev => ({ ...prev, intervalSeconds: value }))}
                disabled={paperTradingConfig.status === 'RUNNING'}
              />
            </div>
            
            <div>
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
            </div>
            
            <div>
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
            </div>
          </div>
        </Card>
      </div>