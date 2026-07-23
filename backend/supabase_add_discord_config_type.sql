-- AlphaLab Discord notifications migration
-- Run this in the Supabase SQL Editor for the project that owns user_api_configs.

-- Optional: inspect the current constraint before changing it.
select conname, pg_get_constraintdef(oid) as definition
from pg_constraint
where conname = 'user_api_configs_config_type_check';

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
