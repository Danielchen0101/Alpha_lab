const hasUnsafeRedirectCharacter = (value: string) => (
  Array.from(value).some((character) => {
    const codePoint = character.charCodeAt(0);
    return character === '\\' || codePoint <= 31 || codePoint === 127;
  })
);

export const getSafeInternalRedirect = (
  candidate?: string | null,
): string | null => {
  if (!candidate || !candidate.startsWith('/') || candidate.startsWith('//')) return null;
  if (hasUnsafeRedirectCharacter(candidate) || /%5c/i.test(candidate)) return null;

  try {
    const resolved = new URL(candidate, window.location.origin);
    if (resolved.origin !== window.location.origin || !resolved.pathname.startsWith('/')) return null;
    return `${resolved.pathname}${resolved.search}${resolved.hash}`;
  } catch {
    return null;
  }
};
