import api from './api';
import { isOperationsArtifactConflict, operationsArtifactsAPI } from './operationsArtifactsService';

jest.mock('./api', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
  },
}));

const mockedApi = api as unknown as jest.Mocked<Pick<typeof api, 'get' | 'put' | 'delete'>>;

describe('operationsArtifactsAPI', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('loads an artifact and normalizes database field names', async () => {
    mockedApi.get.mockResolvedValueOnce({
      data: {
        artifact: {
          id: 'artifact-1',
          artifact_type: 'watchlist',
          artifact_key: 'primary',
          payload: { symbols: ['AAPL', 'MSFT'] },
          version: 3,
          created_at: '2026-07-16T12:00:00Z',
          updated_at: '2026-07-16T12:30:00Z',
        },
      },
    } as any);

    await expect(operationsArtifactsAPI.get<{ symbols: string[] }>('watchlist', 'primary')).resolves.toEqual({
      id: 'artifact-1',
      artifactType: 'watchlist',
      artifactKey: 'primary',
      payload: { symbols: ['AAPL', 'MSFT'] },
      version: 3,
      createdAt: '2026-07-16T12:00:00Z',
      updatedAt: '2026-07-16T12:30:00Z',
    });
    expect(mockedApi.get).toHaveBeenCalledWith('/operations/artifacts', {
      params: { artifactType: 'watchlist', artifactKey: 'primary' },
    });
  });

  it('returns only valid artifacts from a list response', async () => {
    mockedApi.get.mockResolvedValueOnce({
      data: {
        artifacts: [
          null,
          { artifactType: 'strategy-blueprints', artifactKey: 'saved', payload: { strategies: [] }, version: 1 },
          'invalid',
        ],
      },
    } as any);

    const artifacts = await operationsArtifactsAPI.list<{ strategies: unknown[] }>('strategy-blueprints');

    expect(artifacts).toHaveLength(1);
    expect(artifacts[0]).toMatchObject({
      artifactType: 'strategy-blueprints',
      artifactKey: 'saved',
      payload: { strategies: [] },
      version: 1,
    });
  });

  it('writes an optimistic version and a unique idempotency key', async () => {
    mockedApi.put.mockResolvedValueOnce({
      data: {
        artifact: {
          artifactType: 'watchlist',
          artifactKey: 'primary',
          payload: { symbols: ['NVDA'] },
          version: 8,
        },
      },
    } as any);
    const now = jest.spyOn(Date, 'now').mockReturnValue(1721131200000);

    const result = await operationsArtifactsAPI.put('watchlist', 'primary', { symbols: ['NVDA'] }, 7);

    expect(mockedApi.put).toHaveBeenCalledWith('/operations/artifacts', {
      artifactType: 'watchlist',
      artifactKey: 'primary',
      payload: { symbols: ['NVDA'] },
      expectedVersion: 7,
      idempotencyKey: 'watchlist:primary:1721131200000',
    });
    expect(result?.version).toBe(8);
    now.mockRestore();
  });

  it('deletes the requested artifact with version protection', async () => {
    mockedApi.delete.mockResolvedValueOnce({ data: { success: true } } as any);

    await operationsArtifactsAPI.remove('watchlist', 'primary', 8);

    expect(mockedApi.delete).toHaveBeenCalledWith('/operations/artifacts', {
      data: { artifactType: 'watchlist', artifactKey: 'primary', expectedVersion: 8 },
    });
  });

  it('recognizes only optimistic-concurrency conflicts', () => {
    expect(isOperationsArtifactConflict({ response: { status: 409 } })).toBe(true);
    expect(isOperationsArtifactConflict({ response: { status: 401 } })).toBe(false);
    expect(isOperationsArtifactConflict(new Error('conflict'))).toBe(false);
  });
});
