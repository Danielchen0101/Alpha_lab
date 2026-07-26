(function bootstrapTheme(root, applyTheme) {
  if (typeof module === 'object' && module.exports) {
    module.exports = applyTheme;
    return;
  }
  applyTheme(root);
}(typeof window !== 'undefined' ? window : this, function applyTheme(root) {
  var LIGHT_COLOR = '#f7f6f1';
  var DARK_COLOR = '#121114';
  var STORAGE_KEY = 'alphaLabThemeMode';
  var VERSION_KEY = 'alphaLabThemeModeVersion';
  var VERSION = '2';
  var mode = 'light';

  try {
    var storage = root && root.localStorage;
    if (storage && storage.getItem(VERSION_KEY) === VERSION) {
      var savedMode = storage.getItem(STORAGE_KEY);
      if (savedMode === 'light' || savedMode === 'dark' || savedMode === 'system') {
        mode = savedMode;
      }
    }
  } catch (_storageError) {
    mode = 'light';
  }

  var resolvedTheme = mode === 'dark' ? 'dark' : 'light';
  if (mode === 'system') {
    try {
      resolvedTheme = root.matchMedia
        && root.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light';
    } catch (_mediaError) {
      resolvedTheme = 'light';
    }
  }

  var doc = root && root.document;
  if (!doc || !doc.documentElement) return resolvedTheme;

  doc.documentElement.setAttribute('data-theme', resolvedTheme);
  var themeColorMeta = doc.querySelector('meta[name="theme-color"]');
  if (!themeColorMeta && doc.head) {
    themeColorMeta = doc.createElement('meta');
    themeColorMeta.setAttribute('name', 'theme-color');
    doc.head.appendChild(themeColorMeta);
  }
  if (themeColorMeta) {
    themeColorMeta.setAttribute('content', resolvedTheme === 'dark' ? DARK_COLOR : LIGHT_COLOR);
  }

  return resolvedTheme;
}));
