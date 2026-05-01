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
  config_type TEXT NOT NULL CHECK (config_type IN ('ai_provider', 'alpaca', 'finnhub')),
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
