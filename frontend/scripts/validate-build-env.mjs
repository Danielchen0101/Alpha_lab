export const PRODUCTION_SITE_URL = 'https://www.alphalabquant.com';
export const PRODUCTION_API_BASE_URL = 'https://api.alphalabquant.com/api';
export const PRODUCTION_SUPABASE_URL = 'https://nwpxjqgqegxttucsmvmp.supabase.co';

const validateRequiredValue = (name, value) => {
  if (!value?.trim()) return `${name} is required`;
  if (value !== value.trim()) return `${name} must not contain leading or trailing whitespace`;
  return '';
};

const validateExactHttpsUrl = (name, value, expected) => {
  const requiredError = validateRequiredValue(name, value);
  if (requiredError) return requiredError;

  try {
    const url = new URL(value);
    if (url.protocol !== 'https:') return `${name} must use HTTPS`;
    if (url.username || url.password) return `${name} must not contain credentials`;
    if (value !== expected) return `${name} must equal ${expected}`;
    return '';
  } catch {
    return `${name} must be a valid HTTPS URL`;
  }
};

const validateApiBaseUrl = (value, cloudflarePages) => {
  const requiredError = validateRequiredValue('REACT_APP_API_BASE_URL', value);
  if (requiredError) return requiredError;

  if (!cloudflarePages && value === '/api') return '';
  if (cloudflarePages && value === '/api') {
    return `REACT_APP_API_BASE_URL must equal ${PRODUCTION_API_BASE_URL}`;
  }
  return validateExactHttpsUrl(
    'REACT_APP_API_BASE_URL',
    value,
    PRODUCTION_API_BASE_URL,
  );
};

export const validateProductionBuildEnv = (environment) => {
  const cloudflarePages = environment.CF_PAGES === '1';
  const productionBuild = environment.REACT_APP_ENV === 'production';
  if (!cloudflarePages && !productionBuild) return [];

  return [
    validateExactHttpsUrl(
      'REACT_APP_SITE_URL',
      environment.REACT_APP_SITE_URL,
      PRODUCTION_SITE_URL,
    ),
    validateApiBaseUrl(environment.REACT_APP_API_BASE_URL, cloudflarePages),
    validateExactHttpsUrl(
      'REACT_APP_SUPABASE_URL',
      environment.REACT_APP_SUPABASE_URL,
      PRODUCTION_SUPABASE_URL,
    ),
    validateRequiredValue(
      'REACT_APP_SUPABASE_ANON_KEY',
      environment.REACT_APP_SUPABASE_ANON_KEY,
    ),
    validateRequiredValue(
      'REACT_APP_TURNSTILE_SITE_KEY',
      environment.REACT_APP_TURNSTILE_SITE_KEY,
    ),
  ].filter(Boolean);
};

const errors = validateProductionBuildEnv(process.env);
if (errors.length > 0) {
  console.error('[build-env] Production frontend configuration is invalid:');
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else if (process.env.REACT_APP_ENV === 'production' || process.env.CF_PAGES === '1') {
  console.log('[build-env] Production public authentication configuration is valid.');
}
