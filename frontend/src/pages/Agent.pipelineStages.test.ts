import { RESEARCH_PIPELINE_STAGES } from './Agent';

describe('Research pipeline stage contract', () => {
  test('uses the same ordered seven-stage contract as backend automation', () => {
    expect(RESEARCH_PIPELINE_STAGES.map((stage) => stage.key)).toEqual([
      'market_scanner',
      'fine_scan',
      'deeper_validation',
      'admission',
      'entry_plan',
      'execution',
      'exit_scan',
    ]);
    expect(RESEARCH_PIPELINE_STAGES.map((stage) => stage.label)).toEqual([
      'Market Scanner',
      'Fine Scan',
      'Deeper Validation',
      'Portfolio Admission',
      'Entry Plan',
      'Execution',
      'Position & Exit',
    ]);
  });
});
