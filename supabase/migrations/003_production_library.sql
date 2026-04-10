-- =============================================================================
-- Creator Studio — Production Library Migration
-- =============================================================================
-- The knowledge engine that drives content decisions.
-- Stores viral hooks, content formats, location settings, and decision rules.
-- Editable by users to evolve their content strategy over time.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.production_library (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Item classification
  item_type       TEXT        NOT NULL CHECK (item_type IN (
    'viral_hook', 'content_format', 'location_setting', 'decision_rule', 'content_pillar', 'thumbnail_style'
  )),
  slug            TEXT        NOT NULL,
  label           TEXT        NOT NULL,

  -- Core data (flexible JSONB for different item types)
  data            JSONB       NOT NULL DEFAULT '{}',

  -- Metadata
  platform        TEXT        DEFAULT 'both' CHECK (platform IN ('tiktok', 'instagram', 'both')),
  performance_score SMALLINT  DEFAULT 0,
  usage_count     INTEGER     DEFAULT 0,
  is_active       BOOLEAN     DEFAULT TRUE,
  sort_order      SMALLINT    DEFAULT 0,

  -- Optional persona binding (null = global, set = per-persona)
  persona_id      TEXT,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT production_library_user_slug_unique UNIQUE (user_id, slug)
);

COMMENT ON TABLE public.production_library IS
  'Content production knowledge base — viral hooks, content formats, location guides, decision rules. The AI pipeline reads from this to make content decisions. Users can edit to evolve their strategy.';

-- Indexes
CREATE INDEX IF NOT EXISTS prod_lib_user_id_idx ON public.production_library (user_id);
CREATE INDEX IF NOT EXISTS prod_lib_type_idx ON public.production_library (item_type);
CREATE INDEX IF NOT EXISTS prod_lib_platform_idx ON public.production_library (platform);
CREATE INDEX IF NOT EXISTS prod_lib_persona_idx ON public.production_library (persona_id) WHERE persona_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS prod_lib_active_idx ON public.production_library (is_active) WHERE is_active = TRUE;

-- RLS
ALTER TABLE public.production_library ENABLE ROW LEVEL SECURITY;

CREATE POLICY "prod_lib: owner select"
  ON public.production_library FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "prod_lib: owner insert"
  ON public.production_library FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "prod_lib: owner update"
  ON public.production_library FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "prod_lib: owner delete"
  ON public.production_library FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Auto-update trigger
CREATE TRIGGER prod_lib_set_updated_at
  BEFORE UPDATE ON public.production_library
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
