import api from './api';

export const isOperationsArtifactConflict = (error: unknown): boolean => (
  typeof error === 'object'
  && error !== null
  && 'response' in error
  && (error as { response?: { status?: number } }).response?.status === 409
);

export interface OperationsArtifact<T = unknown> {
  id?: string;
  artifactType: string;
  artifactKey: string;
  payload: T;
  version: number;
  createdAt?: string;
  updatedAt?: string;
}

const normalizeArtifact = <T>(raw: any): OperationsArtifact<T> | null => {
  if (!raw || typeof raw !== 'object') return null;
  return {
    id: raw.id,
    artifactType: String(raw.artifactType || raw.artifact_type || ''),
    artifactKey: String(raw.artifactKey || raw.artifact_key || ''),
    payload: raw.payload as T,
    version: Number(raw.version || 0),
    createdAt: raw.createdAt || raw.created_at,
    updatedAt: raw.updatedAt || raw.updated_at,
  };
};

export const operationsArtifactsAPI = {
  get: async <T>(artifactType: string, artifactKey: string): Promise<OperationsArtifact<T> | null> => {
    const response = await api.get('/operations/artifacts', { params: { artifactType, artifactKey } });
    return normalizeArtifact<T>(response.data?.artifact);
  },

  list: async <T>(artifactType: string): Promise<Array<OperationsArtifact<T>>> => {
    const response = await api.get('/operations/artifacts', { params: { artifactType } });
    const values = response.data?.artifacts;
    return Array.isArray(values)
      ? values.map((value) => normalizeArtifact<T>(value)).filter(Boolean) as Array<OperationsArtifact<T>>
      : [];
  },

  put: async <T>(artifactType: string, artifactKey: string, payload: T, expectedVersion?: number): Promise<OperationsArtifact<T> | null> => {
    const response = await api.put('/operations/artifacts', {
      artifactType,
      artifactKey,
      payload,
      ...(typeof expectedVersion === 'number' ? { expectedVersion } : {}),
      idempotencyKey: `${artifactType}:${artifactKey}:${Date.now()}`,
    });
    return normalizeArtifact<T>(response.data?.artifact);
  },

  remove: async (artifactType: string, artifactKey: string, expectedVersion?: number): Promise<void> => {
    await api.delete('/operations/artifacts', {
      data: {
        artifactType,
        artifactKey,
        ...(typeof expectedVersion === 'number' ? { expectedVersion } : {}),
      },
    });
  },
};
