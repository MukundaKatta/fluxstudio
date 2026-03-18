-- FluxStudio Database Schema

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Generated images table
CREATE TABLE IF NOT EXISTS generated_images (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id UUID NOT NULL,
  url TEXT NOT NULL,
  thumbnail_url TEXT,
  width INTEGER NOT NULL,
  height INTEGER NOT NULL,
  prompt TEXT NOT NULL,
  negative_prompt TEXT DEFAULT '',
  model TEXT NOT NULL,
  seed BIGINT NOT NULL,
  steps INTEGER NOT NULL,
  cfg_scale REAL NOT NULL,
  sampler TEXT NOT NULL,
  scheduler TEXT DEFAULT 'normal',
  backend_type TEXT NOT NULL,
  generation_time_ms INTEGER DEFAULT 0,
  file_size INTEGER DEFAULT 0,
  params JSONB NOT NULL DEFAULT '{}',
  metadata JSONB NOT NULL DEFAULT '{}',
  is_favorite BOOLEAN DEFAULT FALSE,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  tags TEXT[] DEFAULT '{}',
  user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Generation jobs table
CREATE TABLE IF NOT EXISTS generation_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  params JSONB NOT NULL,
  backend_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  progress REAL DEFAULT 0,
  current_step INTEGER,
  total_steps INTEGER,
  preview_image TEXT,
  error TEXT,
  priority INTEGER DEFAULT 0,
  user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

-- Models table
CREATE TABLE IF NOT EXISTS models (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  filename TEXT NOT NULL,
  type TEXT NOT NULL,
  hash TEXT,
  size BIGINT DEFAULT 0,
  base_model TEXT DEFAULT 'SD 1.5',
  description TEXT,
  thumbnail_url TEXT,
  download_url TEXT,
  civitai_id TEXT,
  tags TEXT[] DEFAULT '{}',
  is_downloaded BOOLEAN DEFAULT FALSE,
  local_path TEXT,
  user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Node graphs (pipelines)
CREATE TABLE IF NOT EXISTS node_graphs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  graph_data JSONB NOT NULL,
  is_template BOOLEAN DEFAULT FALSE,
  user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Batch configs
CREATE TABLE IF NOT EXISTS batch_configs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  base_params JSONB NOT NULL,
  sweeps JSONB NOT NULL DEFAULT '[]',
  total_combinations INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending',
  completed_count INTEGER DEFAULT 0,
  user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Training configs
CREATE TABLE IF NOT EXISTS training_configs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  config JSONB NOT NULL,
  status TEXT DEFAULT 'idle',
  current_epoch INTEGER,
  current_step INTEGER,
  total_steps INTEGER,
  loss REAL,
  output_path TEXT,
  user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Extensions
CREATE TABLE IF NOT EXISTS extensions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  version TEXT NOT NULL,
  description TEXT,
  author TEXT,
  homepage TEXT,
  is_enabled BOOLEAN DEFAULT TRUE,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Prompt templates
CREATE TABLE IF NOT EXISTS prompt_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  prompt TEXT NOT NULL,
  negative_prompt TEXT DEFAULT '',
  tags TEXT[] DEFAULT '{}',
  user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_images_created_at ON generated_images(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_images_favorite ON generated_images(is_favorite) WHERE is_favorite = TRUE;
CREATE INDEX IF NOT EXISTS idx_images_rating ON generated_images(rating) WHERE rating IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_images_tags ON generated_images USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_images_model ON generated_images(model);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON generation_jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_created ON generation_jobs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_models_type ON models(type);
CREATE INDEX IF NOT EXISTS idx_models_downloaded ON models(is_downloaded);

-- RLS Policies
ALTER TABLE generated_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE generation_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE models ENABLE ROW LEVEL SECURITY;
ALTER TABLE node_graphs ENABLE ROW LEVEL SECURITY;
ALTER TABLE batch_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_configs ENABLE ROW LEVEL SECURITY;

-- Allow all operations for authenticated users on their own data
CREATE POLICY "Users manage own images" ON generated_images
  FOR ALL USING (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Users manage own jobs" ON generation_jobs
  FOR ALL USING (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Users manage own models" ON models
  FOR ALL USING (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Users manage own graphs" ON node_graphs
  FOR ALL USING (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Users manage own batches" ON batch_configs
  FOR ALL USING (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Users manage own training" ON training_configs
  FOR ALL USING (auth.uid() = user_id OR user_id IS NULL);

-- Public read access for extensions
ALTER TABLE extensions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read extensions" ON extensions FOR SELECT USING (true);
CREATE POLICY "Auth manage extensions" ON extensions FOR ALL USING (true);
