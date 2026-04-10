-- =============================================================================
-- Creator Studio — UGC Mode + Prompts Migration
-- =============================================================================
-- Adds:
--   1. prompts table — editable AI prompt templates
--   2. ugc_pipeline_runs table — UGC pipeline execution state
--   3. source/ugc columns on days — unified content model
-- =============================================================================


-- ===========================================================================
-- TABLE: prompts
-- Stores all AI prompt templates (Studio, UGC, Shared).
-- Users can edit templates; default_template preserves factory reset.
-- ===========================================================================
CREATE TABLE IF NOT EXISTS public.prompts (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  slug              TEXT        NOT NULL,
  label             TEXT        NOT NULL,
  category          TEXT        NOT NULL CHECK (category IN ('studio', 'ugc', 'shared')),
  model             TEXT        NOT NULL DEFAULT 'sonnet' CHECK (model IN ('sonnet', 'haiku')),
  template          TEXT        NOT NULL DEFAULT '',
  default_template  TEXT        NOT NULL DEFAULT '',
  variables         JSONB       NOT NULL DEFAULT '[]',
  description       TEXT,

  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT prompts_user_slug_unique UNIQUE (user_id, slug)
);

COMMENT ON TABLE public.prompts IS
  'Editable AI prompt templates. One row per user per prompt slug. Users customize template; default_template allows reset.';

CREATE INDEX IF NOT EXISTS prompts_user_id_idx ON public.prompts (user_id);
CREATE INDEX IF NOT EXISTS prompts_category_idx ON public.prompts (category);

-- RLS
ALTER TABLE public.prompts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "prompts: owner select"
  ON public.prompts FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "prompts: owner insert"
  ON public.prompts FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "prompts: owner update"
  ON public.prompts FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "prompts: owner delete"
  ON public.prompts FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Auto-update trigger
CREATE TRIGGER prompts_set_updated_at
  BEFORE UPDATE ON public.prompts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ===========================================================================
-- TABLE: ugc_pipeline_runs
-- Stores UGC pipeline execution state. Six JSONB columns (one per step)
-- keep the table flat — no junction table needed.
-- ===========================================================================
CREATE TABLE IF NOT EXISTS public.ugc_pipeline_runs (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  persona_id          TEXT        NOT NULL,

  product_url         TEXT,
  product_name        TEXT,
  mode                TEXT        NOT NULL DEFAULT 'hitl' CHECK (mode IN ('auto', 'hitl')),

  -- Pipeline state
  current_step        SMALLINT    NOT NULL DEFAULT 0,
  pipeline_status     TEXT        NOT NULL DEFAULT 'pending'
                      CHECK (pipeline_status IN ('pending', 'running', 'paused', 'completed', 'failed')),

  -- Step outputs (one JSONB per step)
  step_product_intel  JSONB       DEFAULT '{}',
  step_strategy       JSONB       DEFAULT '{}',
  step_script         JSONB       DEFAULT '{}',
  step_visuals        JSONB       DEFAULT '{}',
  step_audio          JSONB       DEFAULT '{}',
  step_metadata       JSONB       DEFAULT '{}',

  -- Step status tracking
  step_statuses       JSONB       NOT NULL DEFAULT '[
    {"name":"product_intel","status":"pending"},
    {"name":"strategy","status":"pending"},
    {"name":"script","status":"pending"},
    {"name":"visuals","status":"pending"},
    {"name":"audio","status":"pending"},
    {"name":"metadata","status":"pending"}
  ]',

  -- Link to created ContentDay
  output_day_id       UUID,
  error_message       TEXT,

  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.ugc_pipeline_runs IS
  'UGC pipeline execution state. Each run produces a content day through 6 AI agent steps.';

-- Indexes
CREATE INDEX IF NOT EXISTS ugc_runs_user_id_idx ON public.ugc_pipeline_runs (user_id);
CREATE INDEX IF NOT EXISTS ugc_runs_persona_id_idx ON public.ugc_pipeline_runs (persona_id);
CREATE INDEX IF NOT EXISTS ugc_runs_status_idx ON public.ugc_pipeline_runs (pipeline_status);
CREATE INDEX IF NOT EXISTS ugc_runs_output_day_idx ON public.ugc_pipeline_runs (output_day_id)
  WHERE output_day_id IS NOT NULL;

-- RLS
ALTER TABLE public.ugc_pipeline_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ugc_runs: owner select"
  ON public.ugc_pipeline_runs FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "ugc_runs: owner insert"
  ON public.ugc_pipeline_runs FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "ugc_runs: owner update"
  ON public.ugc_pipeline_runs FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "ugc_runs: owner delete"
  ON public.ugc_pipeline_runs FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Auto-update trigger
CREATE TRIGGER ugc_runs_set_updated_at
  BEFORE UPDATE ON public.ugc_pipeline_runs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.ugc_pipeline_runs;


-- ===========================================================================
-- ALTER TABLE: days — add source, ugc_run_id, product_url
-- Existing rows get source='studio' via default. Zero-risk additive change.
-- ===========================================================================
ALTER TABLE public.days
  ADD COLUMN IF NOT EXISTS source      TEXT NOT NULL DEFAULT 'studio'
    CHECK (source IN ('studio', 'ugc')),
  ADD COLUMN IF NOT EXISTS ugc_run_id  UUID,
  ADD COLUMN IF NOT EXISTS product_url TEXT;

CREATE INDEX IF NOT EXISTS days_source_idx ON public.days (source);
CREATE INDEX IF NOT EXISTS days_ugc_run_id_idx ON public.days (ugc_run_id)
  WHERE ugc_run_id IS NOT NULL;
