import enUS from './en-US';
import zhCN from './zh-CN';

type LocaleNode = string | number | boolean | null | LocaleNode[] | {
  [key: string]: LocaleNode;
};

const flatten = (value: LocaleNode, prefix = ''): Map<string, LocaleNode> => {
  const leaves = new Map<string, LocaleNode>();
  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      flatten(item, `${prefix}[${index}]`).forEach((leaf, key) => leaves.set(key, leaf));
    });
    return leaves;
  }
  if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      const childPrefix = prefix ? `${prefix}.${key}` : key;
      flatten(child, childPrefix).forEach((leaf, leafKey) => leaves.set(leafKey, leaf));
    }
    return leaves;
  }
  leaves.set(prefix, value);
  return leaves;
};

describe('locale catalogs', () => {
  const english = flatten(enUS as unknown as LocaleNode);
  const chinese = flatten(zhCN as unknown as LocaleNode);

  it('keeps the English and Chinese key sets identical', () => {
    expect(Array.from(chinese.keys()).sort()).toEqual(Array.from(english.keys()).sort());
  });

  it.each([
    ['English', english],
    ['Chinese', chinese],
  ] as const)('%s copy has no encoding replacement characters or empty leaves', (_name, catalog) => {
    const invalid = Array.from(catalog.entries()).filter(([, value]) => (
      typeof value === 'string'
      && (!value.trim() || value.includes('\uFFFD'))
    ));
    expect(invalid).toEqual([]);
  });
});
