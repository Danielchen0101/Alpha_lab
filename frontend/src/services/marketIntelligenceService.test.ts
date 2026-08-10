import { normalizeEconomicEvents } from './marketIntelligenceService';

describe('normalizeEconomicEvents', () => {
  it('sorts public releases by date and time while preserving market data fields', () => {
    const result = normalizeEconomicEvents([
      { date: '2026-08-07', time: '08:30', name: 'Nonfarm Payrolls', forecast: 180000, importance: 'high' },
      { date: '2026-08-05', time: '10:00', event: 'ISM Services PMI', previous: 51.2 },
      { date: '2026-08-05', time: '08:30', name: 'ADP Employment Change', actual: 125000 },
    ]);

    expect(result.map(event => event.title)).toEqual([
      'ADP Employment Change',
      'ISM Services PMI',
      'Nonfarm Payrolls',
    ]);
    expect(result[2]).toMatchObject({
      dateKey: '2026-08-07',
      forecast: 180000,
      importance: 'high',
    });
  });

  it('keeps undated named events in a visible TBD bucket and drops empty rows', () => {
    const result = normalizeEconomicEvents([
      { name: 'FOMC statement' },
      {},
    ]);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ dateKey: 'TBD', title: 'FOMC statement' });
  });
});
