-- Alpha_lab Supabase Schema
-- ============================================================
-- THIS FILE MUST BE RUN MANUALLY IN SUPABASE SQL EDITOR
-- Go to: https://supabase.com/dashboard → your project → SQL Editor → New Query
-- Paste this entire file and click "Run"
-- ============================================================

-- User API configs (one row per user per config type)
CREATE TABLE IF NOT EXISTS user_api_configs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  config_type TEXT NOT NULL CHECK (config_type IN ('ai_provider', 'alpaca', 'finnhub', 'discord')),
  config JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, config_type)
);

-- RLS: users can only read/write their own rows
ALTER TABLE user_api_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own configs" ON user_api_configs
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own configs" ON user_api_configs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own configs" ON user_api_configs
  FOR UPDATE USING (auth.uid() = user_id);

-- Pipeline Auto Configs (one row per user)
CREATE TABLE IF NOT EXISTS user_pipeline_auto_configs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  config_type TEXT NOT NULL DEFAULT 'pipeline_auto',
  config JSONB NOT NULL DEFAULT '{}',
  enabled BOOLEAN DEFAULT FALSE,
  interval_minutes INTEGER DEFAULT 0,
  mode TEXT DEFAULT 'hybrid',
  last_run_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ,
  last_decision TEXT,
  last_summary JSONB,
  last_error TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE user_pipeline_auto_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own pipeline auto config" ON user_pipeline_auto_configs
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own pipeline auto config" ON user_pipeline_auto_configs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own pipeline auto config" ON user_pipeline_auto_configs
  FOR UPDATE USING (auth.uid() = user_id);

-- Pipeline Auto Run History
CREATE TABLE IF NOT EXISTS user_pipeline_auto_runs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  trigger_type TEXT DEFAULT 'auto_market_session',
  status TEXT,
  reason TEXT,
  market_open BOOLEAN,
  market_status TEXT,
  market_status_source TEXT,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  duration_seconds NUMERIC,
  interval_minutes INTEGER,
  mode TEXT,
  summary JSONB,
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE user_pipeline_auto_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own pipeline auto runs" ON user_pipeline_auto_runs
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own pipeline auto runs" ON user_pipeline_auto_runs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

