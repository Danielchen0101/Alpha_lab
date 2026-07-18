import { SharedDataService } from './sharedDataService';
import { getStocks } from './marketDataService';

jest.mock('./marketDataService', () => ({
  getStocks: jest.fn(),
}));

const mockedGetStocks = getStocks as jest.MockedFunction<typeof getStocks>;

describe('SharedDataService', () => {
  beforeEach(() => {
    mockedGetStocks.mockReset();
  });

  it('shares one in-flight request and rejects every waiter when it fails', async () => {
    const service = new SharedDataService();
    mockedGetStocks.mockRejectedValueOnce(new Error('offline'));

    const first = service.getStocks();
    const second = service.getStocks();

    await expect(first).rejects.toThrow('offline');
    await expect(second).rejects.toThrow('offline');
    expect(mockedGetStocks).toHaveBeenCalledTimes(1);

    mockedGetStocks.mockResolvedValueOnce([{ symbol: 'AAPL' } as any]);
    await expect(service.getStocks()).resolves.toEqual([{ symbol: 'AAPL' }]);
    expect(mockedGetStocks).toHaveBeenCalledTimes(2);
  });

  it('marks an explicit refresh so the backend cache is bypassed', async () => {
    const service = new SharedDataService();
    mockedGetStocks.mockResolvedValueOnce([{ symbol: 'MSFT' } as any]);

    await service.refreshStocks();

    expect(mockedGetStocks).toHaveBeenCalledWith(undefined, false, true);
  });
});
