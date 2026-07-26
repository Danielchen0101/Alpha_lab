import type { ScannerStoreState } from '../services/scannerStateStore';
import {
  buildReviewArtifacts,
  marketSelectionScore,
  RESEARCH_FUNNEL_STAGE_ORDER,
  reviewMetricForStage,
} from './ResearchWorkspace';

describe('ResearchWorkspace stage semantics', () => {
  it('keeps the review funnel aligned with the seven backend pipeline stages', () => {
    expect(RESEARCH_FUNNEL_STAGE_ORDER).toEqual([
      'market',
      'fine',
      'validation',
      'admission',
      'entry',
      'execution',
      'exit',
    ]);
  });

  it('uses only the Market Scanner selection score for candidate ranking', () => {
    expect(marketSelectionScore({ selectionScore: 91, validationScore: 99 })).toBe(91);
    expect(marketSelectionScore({ overallScore: 88, trendScore: 84, confidence: 96 })).toBeNull();
  });

  it('selects one explicitly named metric per downstream stage', () => {
    const record = {
      fineScanScore: 61,
      validationScore: 72,
      admissionScore: 83,
      confidence: 74,
      aiExitReview: { confidence: 65 },
    };

    expect(reviewMetricForStage(record, 'fine')).toEqual({ value: 61, kind: 'fineScore', unit: '/100' });
    expect(reviewMetricForStage(record, 'validation')).toEqual({ value: 72, kind: 'validationScore', unit: '/100' });
    expect(reviewMetricForStage(record, 'admission')).toEqual({ value: 83, kind: 'admissionScore', unit: '/100' });
    expect(reviewMetricForStage(record, 'entry')).toEqual({ value: 74, kind: 'entryConfidence', unit: '%' });
    expect(reviewMetricForStage(record, 'execution')).toEqual({ value: 74, kind: 'planConfidence', unit: '%' });
    expect(reviewMetricForStage(record, 'exit')).toEqual({ value: 65, kind: 'exitConfidence', unit: '%' });
    expect(reviewMetricForStage({ validationScore: 99 }, 'fine').value).toBeNull();
  });

  it('includes position-and-exit evidence in the unified review artifacts', () => {
    const snapshot = {
      fineScan: { results: [], lastUpdated: null },
      deeperValidation: { results: [], lastUpdated: null },
      admission: { results: [], lastUpdated: null },
      entryPlan: { results: [], lastUpdated: null },
      aiExecutionCandidates: [],
      exitScan: {
        results: [{
          symbol: 'intc',
          exitDecision: 'manual_review',
          reason: 'Protection is missing',
          aiExitReview: { confidence: 67 },
        }],
        lastUpdated: '2026-07-25T12:00:00.000Z',
      },
    } as unknown as ScannerStoreState;

    expect(buildReviewArtifacts(snapshot)).toMatchObject([{
      symbol: 'INTC',
      stage: 'exit',
      decision: 'manual_review',
      metric: { value: 67, kind: 'exitConfidence', unit: '%' },
      reason: 'Protection is missing',
      updatedAt: '2026-07-25T12:00:00.000Z',
    }]);
  });
});
