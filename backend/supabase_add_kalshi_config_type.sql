-- AlphaLab Kalshi personal API configuration migration.
-- Run against the Supabase project that owns public.user_api_configs.

alter table public.user_api_configs
drop constraint if exists user_api_configs_config_type_check;

alter table public.user_api_configs
add constraint user_api_configs_config_type_check
check (config_type in (
  'ai_provider',
  'alpaca',
  'finnhub',
  'discord',
  'kalshi'
));
