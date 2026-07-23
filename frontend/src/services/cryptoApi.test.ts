import cryptoAPI, {
  CRYPTO_LEDGER_LIMIT,
  sanitizeCryptoConfigUpdate,
} from './cryptoApi';
import api, { scannerApi } from './api';

jest.mock('./api', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
  },
  scannerApi: {
    post: jest.fn(),
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

    expect(api.put).toHaveBeenCalledWith('/crypto/config', {
      mode: 'live',
      confirmLiveRisk: true,
    });
  });

  it('bounds ledger reads to the backend-supported retention window', () => {
    cryptoAPI.ledger(0);
    cryptoAPI.ledger(CRYPTO_LEDGER_LIMIT + 250);

    expect(api.get).toHaveBeenNthCalledWith(1, '/crypto/ledger', {
      params: { limit: 1 },
    });
    expect(api.get).toHaveBeenNthCalledWith(2, '/crypto/ledger', {
      params: { limit: CRYPTO_LEDGER_LIMIT },
    });
  });

  it('keeps live acknowledgement and cycle mode explicit at API boundaries', () => {
    cryptoAPI.startAutomation('live', true);
    cryptoAPI.runCycle('paper', true);

    expect(api.post).toHaveBeenCalledWith('/crypto/automation/start', {
      mode: 'live',
      acknowledgeRisk: true,
    });
    expect(scannerApi.post).toHaveBeenCalledWith(
      '/crypto/run-cycle',
      { mode: 'paper', dryRun: true },
      { timeout: 4 * 60 * 1000 },
    );
  });

  it('requires explicit confirmation when resetting simulator capital', () => {
    cryptoAPI.simReset(25_000);

    expect(api.post).toHaveBeenCalledWith('/crypto/sim/reset', {
      confirm: true,
      initialCapital: 25_000,
    });
  });
});
