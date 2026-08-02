export const DEEPSEEK_DEFAULT_MODEL = 'deepseek-v4-flash';

export const DEEPSEEK_MODELS = [
  DEEPSEEK_DEFAULT_MODEL,
  'deepseek-v4-pro',
] as const;

const DEEPSEEK_RETIRED_MODELS = new Set([
  'deepseek-chat',
  'deepseek-coder',
  'deepseek-reasoner',
]);

export const normalizeAIModel = (provider: string | undefined, model: string | undefined): string => {
  const normalizedProvider = (provider || '').trim().toLowerCase();
  const normalizedModel = (model || '').trim();

  if (normalizedProvider === 'deepseek' && (!normalizedModel || DEEPSEEK_RETIRED_MODELS.has(normalizedModel.toLowerCase()))) {
    return DEEPSEEK_DEFAULT_MODEL;
  }

  return normalizedModel;
};
