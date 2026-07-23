import cryptoAPI, {
  CRYPTO_LEDGER_LIMIT,
  sanitizeCryptoConfigUpdate,
} from './cryptoApi';

const mockApiGet = jest.fn();
const mockApiPost = jest.fn();
const mockApiPut = jest.fn();
const mockScannerPost = jest.fn();

jest.mock('./api', () => ({
  __esModule: true,
  default: {
    get: mockApiGet,
    post: mockApiPost,
    put: mockApiPut,
  },
  scannerApi: {
    post: mockScannerPost,
  },
}));

describe('crypto API contracts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('does not let ordinary config saves mutate scheduler lifecycle state', () => {
    expect(sanitizeCryptoConfigUpdate({
      mode: 'paper',
      enabled: true,
      killSwitch: true,
      liveAuthorized: false,
      confirmLiveRisk: true,
    })).toEqual({
      mode: 'paper',
      liveAuthorized: false,
      confirmLiveRisk: true,
    });
  });

  it('saves only the sanitized configuration payload', () => {
    cryptoAPI.saveConfig({
      mode: 'live',
      enabled: true,
      killSwitch: false,
      confirmLiveRisk: true,
    });

    expect(mockApiPut).toHaveBeenCalledWith('/crypto/config', {
      mode: 'live',
      confirmLiveRisk: true,
    });
  });

  it('bounds ledger reads to the backend-supported retention window', () => {
    cryptoAPI.ledger(0);
    cryptoAPI.ledger(CRYPTO_LEDGER_LIMIT + 250);

    expect(mockApiGet).toHaveBeenNthCalledWith(1, '/crypto/ledger', {
      params: { limit: 1 },
    });
    expect(mockApiGet).toHaveBeenNthCalledWith(2, '/crypto/ledger', {
      params: { limit: CRYPTO_LEDGER_LIMIT },
    });
  });

  it('keeps live acknowledgement and cycle mode explicit at API boundaries', () => {
    cryptoAPI.startAutomation('live', true);
    cryptoAPI.runCycle('paper', true);

    expect(mockApiPost).toHaveBeenCalledWith('/crypto/automation/start', {
      mode: 'live',
      acknowledgeRisk: true,
    });
    expect(mockScannerPost).toHaveBeenCalledWith(
      '/crypto/run-cycle',
      { mode: 'paper', dryRun: true },
      { timeout: 4 * 60 * 1000 },
    );
  });

  it('requires explicit confirmation when resetting simulator capital', () => {
    cryptoAPI.simReset(25_000);

    expect(mockApiPost).toHaveBeenCalledWith('/crypto/sim/reset', {
      confirm: true,
      initialCapital: 25_000,
    });
  });
});
