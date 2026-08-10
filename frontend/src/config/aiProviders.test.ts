import { DEEPSEEK_DEFAULT_MODEL, DEEPSEEK_MODELS, normalizeAIModel } from './aiProviders';

describe('DeepSeek model configuration', () => {
  it('uses V4 Flash as the first and default model', () => {
    expect(DEEPSEEK_DEFAULT_MODEL).toBe('deepseek-v4-flash');
    expect(DEEPSEEK_MODELS[0]).toBe(DEEPSEEK_DEFAULT_MODEL);
  });

  it.each(['deepseek-chat', 'deepseek-coder', 'deepseek-reasoner'])('migrates retired model %s to V4 Flash', (model) => {
    expect(normalizeAIModel('DeepSeek', model)).toBe(DEEPSEEK_DEFAULT_MODEL);
  });

  it('preserves current and custom model identifiers', () => {
    expect(normalizeAIModel('DeepSeek', 'deepseek-v4-pro')).toBe('deepseek-v4-pro');
    expect(normalizeAIModel('Custom', 'deepseek-chat')).toBe('deepseek-chat');
  });
});
