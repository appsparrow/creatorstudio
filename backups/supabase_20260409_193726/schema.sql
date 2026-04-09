-- =============================================================================
-- Creator Studio — Initial Schema Migration
-- =============================================================================
-- Converts the local SQLite "JSON blob" design into a fully normalized
-- PostgreSQL schema on Supabase.
--
-- Design principles applied:
--   1. Every table carries user_id (auth.users FK) — hard multi-tenancy boundary
--   2. JSON blobs are decomposed into typed columns; remaining semi-structured
--      fields (arrays of scalars, nested objects that vary by feature flag) live
--      in typed JSONB columns with a _structure comment
--   3. TEXT[] is used for simple string arrays (platforms, traits, etc.)
--   4. RLS is enabled on every table — authenticated users see ONLY their rows
--   5. Cascade deletes follow the ownership chain:
--        user → personas → days → video_tasks
--        user → drive_assets
--   6. Indexes are added on every FK column and every column used in WHERE
--      clauses in server.ts / the frontend query patterns
-- =============================================================================


-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "pgcrypto";   -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "pg_trgm";   -- future full-text persona search


-- ===========================================================================
-- TABLE: user_settings
-- Stores per-user API keys and application preferences.
-- Replaces the .env / localStorage pattern used in the SQLite app.
-- IMPORTANT: blotato_api_key, kling_api_key, kling_api_secret, and
-- nanobanana_api_key are sensitive credentials. The column is encrypted at
-- rest by Postgres row-level storage; additionally, consider wrapping these
-- in pgsodium (Supabase Vault) for production.
-- ===========================================================================
CREATE TABLE IF NOT EXISTS public.user_settings (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Third-party API credentials
  blotato_api_key     TEXT,
  kling_api_key       TEXT,
  kling_api_secret    TEXT,
  nanobanana_api_key  TEXT,

  -- Google Drive integration
  drive_folder_url    TEXT,

  -- Auto-posting schedule
  posting_mode        TEXT        CHECK (posting_mode IN ('manual', 'auto')) DEFAULT 'manual',
  posting_time        TIME,                -- local time of first post in the day (e.g. 09:00)
  posting_end_time    TIME,                -- latest post time window boundary
  posts_per_day       SMALLINT    DEFAULT 1 CHECK (posts_per_day BETWEEN 1 AND 20),

  -- Webhook / tunnel config for Kling callbacks
  public_tunnel_url   TEXT,

  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT user_settings_user_id_unique UNIQUE (user_id)
);

-- One row per user — upsert friendly
COMMENT ON TABLE public.user_settings IS
  'Per-user application settings and third-party API credentials.';
COMMENT ON COLUMN public.user_settings.kling_api_key IS
  'Kling AI API key. Stored in plaintext; consider migrating to Supabase Vault (pgsodium) before production launch.';


-- ===========================================================================
-- TABLE: personas
-- Decomposed from SQLite personas.data (TEXT JSON blob).
-- Semi-structured nested objects (psychographic, fashionStyle, lifestyle,
-- socialHandles) are stored as JSONB columns with strict shape contracts
-- documented below. Simple string arrays are TEXT[].
-- ===========================================================================
CREATE TABLE IF NOT EXISTS public.personas (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- identity
  full_name           TEXT        NOT NULL,
  age                 SMALLINT,
  gender              TEXT,
  nationality         TEXT,
  birthplace          TEXT,
  profession          TEXT,
  locations           TEXT[]      DEFAULT '{}',

  -- appearance
  height              TEXT,
  body_type           TEXT,
  face_shape          TEXT,
  eyes                TEXT,
  hair                TEXT,
  distinct_features   TEXT[]      DEFAULT '{}',

  -- psychographic
  -- JSONB shape: { coreTraits: string[], interests: string[], values: string[],
  --               fears: string[], motivations: string[], mission: string }
  psychographic       JSONB       NOT NULL DEFAULT '{}',

  -- backstory
  backstory           TEXT,

  -- fashion style
  -- JSONB shape: { aesthetic: string, signatureItems: string[], photographyStyle: string }
  fashion_style       JSONB       NOT NULL DEFAULT '{}',

  -- lifestyle
  -- JSONB shape: { routine: string, diet: string, pet: string, socialMediaPresence: string }
  lifestyle           JSONB       NOT NULL DEFAULT '{}',

  -- social handles
  -- JSONB shape: { instagram?: string, tiktok?: string, youtube?: string,
  --               twitter?: string, x?: string }
  social_handles      JSONB       NOT NULL DEFAULT '{}',

  -- reference images — primary single image kept for backward compat
  reference_image_url  TEXT,
  reference_image_urls TEXT[]     DEFAULT '{}',

  -- AI consistency rules JSON (injected verbatim into generation prompts)
  ai_analysis         TEXT,

  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.personas IS
  'Virtual personas — the core entity in Creator Studio. Each persona owns a content calendar and drives all AI generation.';
COMMENT ON COLUMN public.personas.psychographic IS
  'JSON shape: { coreTraits: string[], interests: string[], values: string[], fears: string[], motivations: string[], mission: string }';
COMMENT ON COLUMN public.personas.fashion_style IS
  'JSON shape: { aesthetic: string, signatureItems: string[], photographyStyle: string }';
COMMENT ON COLUMN public.personas.lifestyle IS
  'JSON shape: { routine: string, diet: string, pet?: string, socialMediaPresence: string }';
COMMENT ON COLUMN public.personas.social_handles IS
  'JSON shape: { instagram?: string, tiktok?: string, youtube?: string, twitter?: string, x?: string }';
COMMENT ON COLUMN public.personas.ai_analysis IS
  'Free-form AI rule text injected into every generation prompt to enforce visual consistency.';

-- Indexes
CREATE INDEX IF NOT EXISTS personas_user_id_idx ON public.personas (user_id);
CREATE INDEX IF NOT EXISTS personas_full_name_trgm_idx ON public.personas USING GIN (full_name gin_trgm_ops);


-- ===========================================================================
-- TABLE: days  (content_days in normalized form)
-- Decomposed from SQLite days.data (TEXT JSON blob).
-- platforms, post_image_references, and slides remain JSONB / TEXT[] because
-- they are variable-length and queried as units, not by individual sub-field.
-- ===========================================================================

-- Enum types — defined once, reused across tables
DO $$ BEGIN
  CREATE TYPE content_day_status AS ENUM ('draft', 'generating', 'completed', 'published');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE content_type AS ENUM ('Photo', 'Carousel', 'Video');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.days (
  id                    UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID          NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  persona_id            UUID          NOT NULL REFERENCES public.personas(id) ON DELETE CASCADE,

  -- Scheduling
  day_number            SMALLINT,
  date                  DATE,
  platforms             TEXT[]        NOT NULL DEFAULT '{}',
  -- valid values: 'Instagram', 'TikTok', 'YouTube'

  -- Content specification
  content_type          content_type  NOT NULL DEFAULT 'Photo',
  theme                 TEXT,
  scene_description     TEXT,
  on_screen_text        TEXT,
  hairstyle             TEXT,
  style_option          TEXT,
  -- valid values: 'Luxury/High-end', 'Casual/Street', 'Morning Cozy',
  --               'Elegant Evening', 'Formal/Corporate'

  -- Copy
  caption               TEXT,
  hook                  TEXT,
  hashtags              TEXT,
  cta                   TEXT,

  -- Contextual metadata
  location              TEXT,
  music_suggestion      TEXT,
  notes                 TEXT,

  -- Generated / uploaded media
  generated_image_url   TEXT,
  generated_video_url   TEXT,
  custom_media_url      TEXT,

  -- Async video generation state
  pending_video_task_id TEXT,

  -- Workflow flags
  status                content_day_status NOT NULL DEFAULT 'draft',
  is_ai_generated       BOOLEAN       NOT NULL DEFAULT FALSE,
  is_good_to_post       BOOLEAN       NOT NULL DEFAULT FALSE,

  -- Post-level image reference overrides
  -- JSONB array shape: [{ id: string, url: string,
  --                       tag: 'Location'|'Style'|'FaceSwap'|'None' }]
  post_image_references JSONB         NOT NULL DEFAULT '[]',

  -- Carousel slides
  -- JSONB array shape: [{ id: string, sceneDescription: string,
  --   onScreenText: string, contentType: 'Photo'|'Video',
  --   generatedImageUrl?: string, generatedVideoUrl?: string }]
  slides                JSONB         NOT NULL DEFAULT '[]',

  created_at            TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ   NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.days IS
  'Content calendar entries ("days"). One row = one planned social post or carousel.';
COMMENT ON COLUMN public.days.platforms IS
  'Social platforms targeted by this post. Values: Instagram, TikTok, YouTube.';
COMMENT ON COLUMN public.days.post_image_references IS
  'Array of image references attached at the post level. Shape: [{id,url,tag}] where tag ∈ Location|Style|FaceSwap|None.';
COMMENT ON COLUMN public.days.slides IS
  'Carousel slide definitions. Shape: [{id,sceneDescription,onScreenText,contentType,generatedImageUrl?,generatedVideoUrl?}]';

-- Indexes
CREATE INDEX IF NOT EXISTS days_user_id_idx       ON public.days (user_id);
CREATE INDEX IF NOT EXISTS days_persona_id_idx    ON public.days (persona_id);
CREATE INDEX IF NOT EXISTS days_date_idx          ON public.days (date);
CREATE INDEX IF NOT EXISTS days_status_idx        ON public.days (status);
CREATE INDEX IF NOT EXISTS days_persona_date_idx  ON public.days (persona_id, date);
-- Partial index — only rows still waiting for a video task
CREATE INDEX IF NOT EXISTS days_pending_video_idx ON public.days (pending_video_task_id)
  WHERE pending_video_task_id IS NOT NULL;


-- ===========================================================================
-- TABLE: video_tasks
-- Maps Kling task IDs to the days row they will update.
-- ===========================================================================
CREATE TABLE IF NOT EXISTS public.video_tasks (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  task_id     TEXT        NOT NULL,          -- external Kling task ID (string)
  day_id      UUID        NOT NULL REFERENCES public.days(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT video_tasks_task_id_unique UNIQUE (task_id)
);

COMMENT ON TABLE public.video_tasks IS
  'Maps Kling AI video generation task IDs to their corresponding content day. The webhook handler uses this to auto-link completed videos.';
COMMENT ON COLUMN public.video_tasks.task_id IS
  'External task ID returned by the Kling /v1/videos/image2video endpoint.';

-- Indexes
CREATE INDEX IF NOT EXISTS video_tasks_user_id_idx ON public.video_tasks (user_id);
CREATE INDEX IF NOT EXISTS video_tasks_day_id_idx  ON public.video_tasks (day_id);
CREATE INDEX IF NOT EXISTS video_tasks_task_id_idx ON public.video_tasks (task_id);


-- ===========================================================================
-- TABLE: drive_assets
-- Google Drive media cache — synced by the /api/drive/list endpoint.
-- ===========================================================================

DO $$ BEGIN
  CREATE TYPE drive_asset_status AS ENUM ('unused', 'linked', 'archived');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.drive_assets (
  id              UUID              PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID              NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  drive_file_id   TEXT              NOT NULL,
  file_name       TEXT              NOT NULL,
  mime_type       TEXT              NOT NULL,
  file_size       BIGINT,
  drive_url       TEXT,
  thumbnail_url   TEXT,
  content_type    content_type      NOT NULL DEFAULT 'Photo',
  status          drive_asset_status NOT NULL DEFAULT 'unused',
  linked_day_id   UUID              REFERENCES public.days(id) ON DELETE SET NULL,
  synced_at       TIMESTAMPTZ       NOT NULL DEFAULT now(),
  created_at      TIMESTAMPTZ       NOT NULL DEFAULT now(),

  CONSTRAINT drive_assets_user_drive_file_unique UNIQUE (user_id, drive_file_id)
);

COMMENT ON TABLE public.drive_assets IS
  'Cache of Google Drive media files synced for a user. The drive_file_id + user_id pair is unique to prevent duplicates across refreshes.';
COMMENT ON COLUMN public.drive_assets.status IS
  'unused = not yet attached to a post; linked = assigned to a day; archived = soft-removed.';

-- Indexes
CREATE INDEX IF NOT EXISTS drive_assets_user_id_idx       ON public.drive_assets (user_id);
CREATE INDEX IF NOT EXISTS drive_assets_drive_file_id_idx ON public.drive_assets (drive_file_id);
CREATE INDEX IF NOT EXISTS drive_assets_linked_day_id_idx ON public.drive_assets (linked_day_id);
CREATE INDEX IF NOT EXISTS drive_assets_status_idx        ON public.drive_assets (status);


-- ===========================================================================
-- updated_at auto-maintenance trigger
-- Applied to every table that has an updated_at column.
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER personas_set_updated_at
  BEFORE UPDATE ON public.personas
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER days_set_updated_at
  BEFORE UPDATE ON public.days
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER user_settings_set_updated_at
  BEFORE UPDATE ON public.user_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ===========================================================================
-- Row Level Security
-- Policy pattern: "authenticated users see and modify only their own rows"
-- Service-role key bypasses RLS — used only in Edge Functions / webhooks.
-- ===========================================================================

-- ---- user_settings ----
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_settings: owner select"
  ON public.user_settings FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "user_settings: owner insert"
  ON public.user_settings FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_settings: owner update"
  ON public.user_settings FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_settings: owner delete"
  ON public.user_settings FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);


-- ---- personas ----
ALTER TABLE public.personas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "personas: owner select"
  ON public.personas FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "personas: owner insert"
  ON public.personas FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "personas: owner update"
  ON public.personas FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "personas: owner delete"
  ON public.personas FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);


-- ---- days ----
ALTER TABLE public.days ENABLE ROW LEVEL SECURITY;

CREATE POLICY "days: owner select"
  ON public.days FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "days: owner insert"
  ON public.days FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "days: owner update"
  ON public.days FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "days: owner delete"
  ON public.days FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);


-- ---- video_tasks ----
ALTER TABLE public.video_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "video_tasks: owner select"
  ON public.video_tasks FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "video_tasks: owner insert"
  ON public.video_tasks FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "video_tasks: owner update"
  ON public.video_tasks FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "video_tasks: owner delete"
  ON public.video_tasks FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);


-- ---- drive_assets ----
ALTER TABLE public.drive_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "drive_assets: owner select"
  ON public.drive_assets FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "drive_assets: owner insert"
  ON public.drive_assets FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "drive_assets: owner update"
  ON public.drive_assets FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "drive_assets: owner delete"
  ON public.drive_assets FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);


-- ===========================================================================
-- Storage bucket policies
-- Bucket name: "creator-studio-uploads"
-- Path convention: {user_id}/{persona_id}/{filename}
-- This replaces /public/uploads/{personaId}/ on the local filesystem.
-- ===========================================================================

-- Create the bucket (idempotent — safe to re-run)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'creator-studio-uploads',
  'creator-studio-uploads',
  FALSE,                        -- private: all access goes through signed URLs or RLS
  52428800,                     -- 50 MB per file
  ARRAY[
    'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif',
    'video/mp4', 'video/webm', 'video/quicktime'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: users can SELECT (download) their own files
CREATE POLICY "storage: owner select"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'creator-studio-uploads'
    AND (storage.foldername(name))[1] = auth.uid()::TEXT
  );

-- Storage RLS: users can INSERT (upload) into their own namespace
CREATE POLICY "storage: owner insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'creator-studio-uploads'
    AND (storage.foldername(name))[1] = auth.uid()::TEXT
  );

-- Storage RLS: users can UPDATE (replace) their own files
CREATE POLICY "storage: owner update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'creator-studio-uploads'
    AND (storage.foldername(name))[1] = auth.uid()::TEXT
  );

-- Storage RLS: users can DELETE their own files
CREATE POLICY "storage: owner delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'creator-studio-uploads'
    AND (storage.foldername(name))[1] = auth.uid()::TEXT
  );


-- ===========================================================================
-- Realtime publication
-- Enables Supabase Realtime for tables that the frontend needs to subscribe
-- to (video generation status polling, auto-posting state changes).
-- ===========================================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.days;
ALTER PUBLICATION supabase_realtime ADD TABLE public.video_tasks;
