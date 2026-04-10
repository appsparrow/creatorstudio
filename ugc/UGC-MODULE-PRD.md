# UGC Video Factory — Module PRD
## Creator Studio Extension

---

## 1. Overview

**What:** A UGC (User-Generated Content) video generation module that takes product info (pasted from Kalodata, Amazon, or manual input) and generates a complete TikTok/Instagram video package — hooks, scripts, image prompts, audio direction, and metadata.

**Where it lives:** Accessible via the Product Switcher (logo click → slide panel) from anywhere in Creator Studio. When UGC mode is active, the sidebar shows UGC posts and the Library panel icon appears below the persona rail.

**Why here:** Creator Studio already has the persona system, product management, content calendar, and publishing pipeline. The UGC module adds an automated product-to-video workflow that feeds into the existing content system.

**Target platforms:** TikTok and Instagram only. YouTube and Amazon may come later.

**Philosophy:** Keep it simple. No complex web scraping. The user provides product data (paste from Kalodata, copy from Amazon, or type manually). The AI generates the creative package from that input. The value is in the content generation pipeline, not the research.

**As-built status (April 10, 2026):** Core pipeline is shipped to staging. Production Library seeded and wired to pipeline. P0 fixes in progress.

---

## 2. How It Fits Into Creator Studio

### Shared Components (reuse, don't rebuild)
- **Persona** — Character profile drives image prompts (appearance, style, traits). Persona pinning (new) sorts priority personas to top of rail.
- **Product** — Product catalog stores scraped product intel for reuse
- **ContentDay / `days` table** — Final video package becomes a `days` row with `source='ugc'`
- **TargetAudience** — Audience segments inform strategy selection
- **Publishing** — Meta Graph API, Blotato, Google Drive sync all work as-is
- **AppShell** — Same layout, dark theme, sidebar
- **Status workflow** — Studio's `draft → completed → published` arc extended with `generating` state for UGC

### New Components (built)
- **Product Switcher** — Logo click → slide panel → Studio / UGC mode selection
- **UGC Pipeline view** — URL input + pipeline runner embedded in workspace
- **UGCPostCard** — Tabbed post detail: Product Intel / Strategy / Script / Visuals / Audio / Metadata
- **Production Library** — Sidebar panel with viral hooks, content formats, decision rules, location settings
- **PromptsManager** — Settings tab for editing all 12 AI prompt templates
- **Pipeline Progress** — 6-step progress indicator with per-step status and timing

---

## 3. User Flow

### 3.1 Auto Mode (fully automated)

```
User pastes product URL → clicks "Generate"
  ↓
Pipeline runs all 6 steps automatically (Steps 4/5/6 parallel)
  ↓
Complete package appears for review in UGCPostCard
  ↓
User toggles "Good to Post" → checklist modal → published
```

### 3.2 Human-in-the-Loop Mode (review at each step)

```
User pastes product URL → clicks "Generate"
  ↓
Step 1: Product Intel → PAUSE → User reviews/edits → "Continue"
  ↓
Step 2: Strategy → PAUSE → User reviews Decision Log → "Continue"
  ↓
Step 3: Script → PAUSE → User reviews/selects hook → "Continue"
  ↓
Step 4: Visual Prompts → PAUSE → User reviews storyboard → "Continue"
  ↓
Step 5: Audio → PAUSE → User reviews voice settings → "Continue"
  ↓
Step 6: Metadata → PAUSE → User reviews captions/hashtags → "Continue"
  ↓
Complete package → Good to Post checklist modal → published
```

### 3.3 Review Gates (logical pause points)

| Gate | After Step | Why |
|------|-----------|-----|
| **Strategy Gate** | Step 2 | Hook format choice drives everything downstream. Decision Log shows why each choice was made. |
| **Script Gate** | Step 3 | Script quality is the #1 factor in video performance. HookSelector lets user override the top-scored variant. |
| **Final Review** | Step 6 | Before publishing, the Good to Post checklist enforces a 16-item pre-flight check. |

---

## 4. Pipeline Steps (6 Agents)

### Step 1: Product Intel (Two Input Modes)
- **Mode A — Auto Scrape:** User pastes a product URL (Amazon, TikTok Shop). System fetches the page and extracts product data automatically.
- **Mode B — Paste Data:** User pastes product details from Kalodata, Amazon, or types manually. AI structures the text into clean data.
- **UI:** Toggle or tabs: `[Auto Scrape URL]` | `[Paste Product Info]`
- **Process:** Either way, AI classifies category, extracts features, identifies pain points
- **Output:** `ProductIntel` object (name, price, features, category, reviews, competitors)
- **Affiliate URL:** Editable input in Product Intel tab — persisted in `day.cta`, auto-injected into Metadata captions with disclosure language
- **Model:** Claude Haiku (structured extraction)

### Step 2: Strategy Selection
- **Input:** ProductIntel + Persona + TargetAudience + Production Library (decision rules + hooks)
- **Process:** Apply hook format decision tree from Library, select content format, setting, posting time
- **Output:** `ContentStrategy` object (hook_format, content_format, video_length, setting, hashtags) + **Decision Log** (why each choice was made, alternatives rejected, confidence scores)
- **Library query:** Step 2 reads `production_library` items of type `decision_rule` and `viral_hook` to ground its selections in the seeded knowledge base
- **Review gate:** User can override hook format before script generation. Decision Log shows the reasoning.
- **Model:** Claude Sonnet (strategy reasoning)

### Step 3: Script Writing
- **Input:** ProductIntel + ContentStrategy + Persona voice profile + Library hook examples
- **Process:** Generate 10 hooks, score them across 4 criteria, write full 20s timed script. Hook examples from Library used as stylistic anchors.
- **Output:** `VideoScript` object (hooks[], selected_hook, full_script with timing/overlays/voiceover)
- **Review gate:** HookSelector shows all 10 scored variants; user can pick a different hook or edit script sections
- **Model:** Claude Sonnet (creative writing)

### Step 4: Visual Direction
- **Input:** Persona appearance + ProductIntel + VideoScript + ContentStrategy.setting + Library location settings
- **Process:** Generate shot prompts with character locking. Shot 0 = thumbnail shot. Shots 1–N = video shots.
- **Output:** `VisualPackage` object (thumbnail shot + video shot prompts, consistency checklist, image settings)
- **Storyboard UI:** Horizontal 9:16 shot cards. Shot 0 labeled as Thumbnail. Click any card to expand Image/Video/Audio prompts.
- **Integration:** Copy buttons on all prompts. "Generate" button per shot → NanoBanana API (future).
- **Model:** Claude Sonnet (visual direction)

### Step 5: Audio Production
- **Input:** VideoScript + Persona voice profile
- **Process:** Format ElevenLabs payload, recommend trending sounds, mixing instructions
- **Output:** `AudioPackage` object (ElevenLabs payload, sound recommendations, mixing specs)
- **Model:** Claude Haiku (structured formatting)

### Step 6: Metadata
- **Input:** ProductIntel + VideoScript + ContentStrategy + Affiliate URL (from `day.cta`)
- **Process:** Generate TikTok/Instagram titles, captions, hashtags, posting schedule. Affiliate URL auto-injected with disclosure.
- **Output:** `MetadataPackage` object (TikTok metadata, Instagram metadata, engagement strategy)
- **Integration:** Maps directly to ContentDay fields (caption, hook, hashtags, cta, platforms)
- **Model:** Claude Haiku (structured generation)

---

## 5. Execution Modes

### Auto Mode
- All 6 steps run sequentially (Steps 4+5+6 parallel after Step 3)
- Pipeline progress shown in real-time via `PipelineProgress.tsx`
- Final package presented for review
- User activates "Good to Post" toggle → checklist modal → published

### Human-in-the-Loop Mode
- Each step pauses after completion
- User sees output in an editable card
- User can: Accept (continue), Edit (modify then continue), Regenerate (re-run step)
- Edited values propagate to downstream steps

### Mode Toggle
- Global default set in Settings
- Per-run override available on the UGC view
- Suggested default: **Human-in-the-Loop** until user has generated 10+ videos

---

## 6. Pipeline Progress Indicator

Agentic progress UI — always visible during generation:

```
┌──────────────────────────────────────────────────────┐
│  UGC Pipeline                          [Auto | HITL] │
├──────────────────────────────────────────────────────┤
│                                                      │
│  ✅ Product Intel ····· 2.1s    [View]               │
│  ✅ Strategy ·········· 3.4s    [View] [Edit]        │
│  ⏳ Script ············ generating...                │
│  ⬜ Visual Prompts                                   │
│  ⬜ Audio Direction                                  │
│  ⬜ Metadata                                         │
│                                                      │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━░░░░░░░░░  42%          │
│                                                      │
└──────────────────────────────────────────────────────┘
```

States per step:
- ⬜ Pending (gray)
- ⏳ Running (amber, animated pulse)
- ✅ Complete (green)
- ⏸️ Paused for review (violet, HITL mode)
- ❌ Error (red, with retry button)
- ✏️ Edited by user (blue checkmark)

---

## 7. Production Library

The Production Library is Creator Studio's knowledge engine for UGC content. It stores the battle-tested production knowledge from `ugc/files/` in the database and makes it visible in the product UI. The pipeline reads from it at Steps 2 and 3.

### Library Location

The Library lives in the sidebar, not Settings. A BookOpen icon appears below the persona rail in UGC mode. Clicking it swaps the sidebar from the post list to the Library browser. The main canvas remains untouched — you can reference the Library while reviewing a post.

### Database Table: `production_library`

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `type` | TEXT | `viral_hook` / `content_format` / `decision_rule` / `location_setting` |
| `name` | TEXT | Display name |
| `slug` | TEXT | Machine-readable key used by pipeline |
| `platform` | TEXT | `tiktok` / `instagram` / `both` |
| `content` | JSONB | Full structured data (scores, examples, timing, criteria) |
| `is_active` | BOOLEAN | Whether pipeline uses this item |
| `sort_order` | INTEGER | Display order |

**25 items seeded (April 10, 2026):**

| Type | Count | Items |
|------|-------|-------|
| `viral_hook` | 8 | Price Reveal, POV, Twist, Social Proof, Opinion, Discovery, Before/After, Comparison — each with structure template, best-for criteria, scored examples, psychology notes |
| `content_format` | 6 | Product Demo, Try-On Haul, Comparison, Styling List, Before/After, Transformation — each with timing breakdown, script structure, best-for category |
| `decision_rule` | 7 | Category-based rules driving hook format selection at Step 2 (e.g., price < $20 AND trending → price_reveal) |
| `location_setting` | 4 | Bathroom Vanity, Mirror/Closet, Kitchen Counter, Outdoor — each with visual setup guide and product category fit |

### Library UI

| View | Description |
|------|-------------|
| Sidebar panel | Sections list: Viral Hooks / Content Formats / Decision Rules / Location Guide |
| Canvas detail | Click a section → main canvas shows the full Library detail view for that item |
| Platform filter | All / TikTok / Instagram — filtered items go to 40% opacity rather than hiding |
| Hook cards | 2-column card grid with name, score, structure template, best-for pills, example expand |
| Hook table | Alternate compact view for scanning all 8 formats |

### Pipeline Integration

- **Step 2** queries `decision_rule` and `viral_hook` items to ground strategy selection in seeded knowledge
- **Step 3** pulls hook examples from `viral_hook` items as stylistic anchors for script writing
- **Step 4** uses `location_setting` items to enrich the setting guide in visual prompts
- **Strategy tab Decision Log** shows the decision path taken and links to the relevant Library item

---

## 8. Data Flow & Type Integration

### New Types (`src/types/ugc.ts`)

```typescript
// --- UGC Pipeline Types ---

export type UGCPipelineMode = 'auto' | 'hitl';
export type UGCStepStatus = 'pending' | 'running' | 'complete' | 'paused' | 'error' | 'edited';

export interface UGCPipelineRun {
  id: string;
  personaId: string;
  productUrl: string;
  mode: UGCPipelineMode;
  status: 'running' | 'complete' | 'error';
  startedAt: string;
  completedAt?: string;
  steps: UGCPipelineStep[];
  // Final outputs
  productIntel?: ProductIntel;
  strategy?: ContentStrategy;
  script?: VideoScript;
  visuals?: VisualPackage;
  audio?: AudioPackage;
  metadata?: MetadataPackage;
  // Created content
  contentDayId?: string;
}

export interface UGCPipelineStep {
  name: string;
  status: UGCStepStatus;
  startedAt?: string;
  completedAt?: string;
  durationMs?: number;
  output?: any;
  userEdits?: any;
  error?: string;
}

export interface ProductIntel {
  productName: string;
  brand: string;
  category: string;
  subcategory: string;
  price: number;
  currency: string;
  size?: string;
  keyFeatures: string[];
  primaryBenefit: string;
  painPointsSolved: string[];
  reviewSentiment: {
    positive: string[];
    negative: string[];
  };
  competitorProducts: { name: string; price: number }[];
  targetAudience: string;
  trendingStatus: boolean;
  sourceUrl: string;
  affiliateUrl?: string;  // Editable in Product Intel tab, persisted in day.cta
}

export interface ContentStrategy {
  hookFormat: 'price_reveal' | 'pov' | 'discovery' | 'social_proof' | 'comparison' | 'opinion' | 'twist' | 'before_after';
  hookRationale: string;
  contentFormat: string;
  contentRationale: string;
  videoLength: string;
  setting: string;
  characterOutfit: string;
  optimalPostingTime: string;
  postingRationale: string;
  hashtagStrategy: {
    primary: string;
    conversion: string;
    product: string;
    brand: string;
    modifier: string;
  };
  decisionLog?: {              // Pipeline transparency — shown in Strategy tab
    hookChosen: string;
    hookConfidence: number;
    hookRejected: { format: string; score: number; reason: string }[];
    decisionPath: string;
    libraryItemRefs: string[]; // IDs into production_library
  };
}

export interface HookVariation {
  hook: string;
  score: number;
  rationale: string;
}

export interface ScriptSection {
  timing: string;
  wordCount: number;
  textOverlay: string;
  voiceover: string;
  visualCue: string;
}

export interface VideoScript {
  hookVariants: HookVariation[];
  selectedHook: string;
  fullScript: {
    hookSection: ScriptSection;
    productSection: ScriptSection;
    trustSection: ScriptSection;
    ctaSection: ScriptSection;
  };
  totalWordCount: number;
  estimatedDuration: string;
  elevenlabsFullScript: string;
  elevenlabsSettings: {
    voiceStability: number;
    voiceClarity: number;
    style: string;
  };
}

export interface ShotPrompt {
  shotId: string;            // Shot 0 = Thumbnail
  isThumbnail?: boolean;     // true for Shot 0
  timing: string;
  purpose: string;
  fullPrompt: string;
  compositionNotes: string;
  lighting: string;
  props: string[];
  generatedImageUrl?: string;
}

export interface VisualPackage {
  baseCharacterPrompt: string;
  shotPrompts: ShotPrompt[];  // shotPrompts[0] is always the thumbnail shot
  consistencyChecklist: string[];
  imageGenerationSettings: {
    platform: string;
    resolution: string;
    aspectRatio: string;       // '9:16' for TikTok/IG vertical
    quality: string;
    style: string;
  };
}

export interface AudioPackage {
  elevenlabsPayload: {
    voiceId: string;
    text: string;
    voiceSettings: {
      stability: number;
      similarityBoost: number;
      style: number;
      useSpeakerBoost: boolean;
    };
    outputFormat: string;
  };
  trendingSoundOptions: {
    soundName: string;
    categoryFit: string;
    recommended: boolean;
    notes: string;
  }[];
  audioMixingInstructions: {
    voiceoverVolume: string;
    backgroundSoundVolume: string;
    fadeInDuration: string;
    fadeOutDuration: string;
    voiceoverPriority: boolean;
  };
}

export interface MetadataPackage {
  tiktok: {
    title: string;
    titleCharCount: number;
    caption: string;           // Includes affiliate URL + disclosure if set
    hashtags: { tag: string; type: string; rationale: string }[];
    productTags: { productName: string; variant: string; price: string; tagPlacement: string; tagTiming: string }[];
    postingSchedule: { optimalTime: string; dayOfWeek: string; rationale: string; backupTimes: string[] };
    engagementStrategy: {
      pinComment: string;
      autoReplyTriggers: { keyword: string; response: string }[];
    };
  };
  instagram: {
    caption: string;           // Includes affiliate URL + disclosure if set
    hashtagsCount: number;
    brandMentions: string[];
  };
}
```

### Mapping UGC Output → Existing ContentDay

When user clicks "Create Post" or the pipeline completes and creates a `days` row:

```typescript
const contentDay: Partial<ContentDay> = {
  source: 'ugc',                           // New column — distinguishes from Studio posts
  ugcRunId: pipelineRun.id,                // New column — bidirectional FK
  productUrl: productIntel.sourceUrl,      // New column
  theme: productIntel.productName,
  hook: script.selectedHook,
  caption: metadata.tiktok.caption,
  hashtags: metadata.tiktok.hashtags.map(h => h.tag).join(' '),
  cta: productIntel.affiliateUrl || script.fullScript.ctaSection.voiceover,
  sceneDescription: visuals.shotPrompts.map(s => s.fullPrompt).join('\n\n'),
  onScreenText: Object.values(script.fullScript).map(s => s.textOverlay).join(' | '),
  musicSuggestion: audio.trendingSoundOptions.find(s => s.recommended)?.soundName || '',
  contentType: 'Video' as ContentType,
  platforms: ['TikTok', 'Instagram'] as Platform[],
  status: 'draft' as ContentStatus,
  location: strategy.setting,
  notes: `UGC Pipeline: ${strategy.hookFormat} hook, ${strategy.contentFormat} format`,
};
```

---

## 9. Routing

### Current: Workspace pattern (no React Router)

The UGC module lives inside `Workspace.tsx` as a view state, consistent with the existing single-page architecture. Mode is set via localStorage. A React Router version (`App.new.tsx`) was built and preserved for future migration.

```
Logo click → slide panel → select UGC → workspace switches mode
Post click → UGCPostCard renders in main canvas
```

### Future: React Router

```
/persona/:personaId/ugc              → UGCPipelinePage (main UGC tab)
/persona/:personaId/ugc/:runId       → UGCPipelineRunPage (specific run detail)
```

Pages built: `src/pages/UGCPipelinePage.tsx` and `src/pages/UGCPipelineRunPage.tsx` — preserved for future router migration.

---

## 10. UI Layout

### UGC Mode — Sidebar

```
[Creator Studio logo]  ← click to switch mode
─────────────────────
[Persona 1]  ● pinned
[Persona 2]  ● pinned
[Persona 3]
─────────────────────
[Post list — source='ugc' only]
  BBL Serum ✅ Complete
  Foundation ⏳ Running
─────────────────────
[BookOpen icon]  ← Library panel toggle
```

### UGCPostCard — Tabbed Detail View

```
┌──────────────────────────────────────────────────────────────────────┐
│  BBL Serum – 3-in-1 Bikini Line Care          [draft] [Good to Post] │
│  ─────────────────────────────────────────────────────────────────── │
│  [Product Intel] [Strategy] [Script] [Visuals] [Audio] [Metadata]    │
├──────────────────────────────────────────────────────────────────────┤
│  (tab content — each tab shows the relevant pipeline step output)    │
│                                                                      │
│  ▼ AI Production Choices (collapsible — Strategy tab only)           │
│    Hook: price_reveal (87% confidence)                               │
│    Rejected: pov (score: 6.2), discovery (score: 5.8)               │
│    Path: price $19.99 < $20 AND trending=true → price_reveal         │
│    [View in Library]  [Regenerate with different hook]               │
│                                                                      │
├──────────────────────────────────────────────────────────────────────┤
│  ▼ Danger Zone                                                       │
│    [Delete this post]  ← red, collapsible, destructive action        │
└──────────────────────────────────────────────────────────────────────┘
```

### Storyboard Layout (Visuals Tab)

```
┌──────────────────────────────────────────────────────────────────────┐
│  Shot 0 [THUMBNAIL]  Shot 1  Shot 2  Shot 3  Shot 4  Shot 5          │
│  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐        │
│  │ 9:16 │  │ 9:16 │  │ 9:16 │  │ 9:16 │  │ 9:16 │  │ 9:16 │        │
│  └──────┘  └──────┘  └──────┘  └──────┘  └──────┘  └──────┘        │
│                                                                      │
│  [Expanded card shows: Image Prompt | Video Prompt | Audio Prompt]   │
│  [Copy button on each]                                               │
└──────────────────────────────────────────────────────────────────────┘
```

### Library Panel — Sidebar Mode

```
← [Back to posts]
─────────────────
Library
  Viral Hooks (8)
  Content Formats (6)
  Decision Rules (7)
  Location Settings (4)

[All] [TikTok] [Instagram]
─────────────────
[Price Reveal card]
[POV card]
[Twist card]
...
```

---

## 11. API Endpoints

```
POST   /api/ugc/generate                — Run full 6-step pipeline, returns complete package
POST   /api/claude/messages             — Proxy to Anthropic API (adds API key server-side)

POST   /api/ugc/runs                    — Create new pipeline run
GET    /api/ugc/runs?personaId=xxx      — List runs for persona
GET    /api/ugc/runs/:runId             — Get run detail
PATCH  /api/ugc/runs/:runId             — Update run (user edits)
DELETE /api/ugc/runs/:runId             — Delete run

POST   /api/ugc/runs/:runId/step/:step  — Trigger specific step
PATCH  /api/ugc/runs/:runId/step/:step  — Edit step output (HITL)

POST   /api/ugc/runs/:runId/create-post — Convert to ContentDay
POST   /api/ugc/scrape                  — Scrape product URL

GET    /api/ugc/library                 — Fetch production_library items
```

---

## 12. AI Integration

### As Built: Claude as Primary LLM

Claude was chosen over the original Gemini plan after testing showed significantly better performance on Steps 2 and 3.

| Steps | Model | Rationale |
|-------|-------|-----------|
| Step 1 (Product Intel) | Claude Haiku | Structured extraction — fast, cheap, JSON-reliable |
| Step 2 (Strategy) | Claude Sonnet | Strategy reasoning requires product-market fit understanding, persona context, and platform dynamics simultaneously |
| Step 3 (Script) | Claude Sonnet | Hook scoring + creative script writing requires nuanced judgment |
| Step 4 (Visual Director) | Claude Sonnet | Character locking and shot composition require creative direction |
| Step 5 (Audio) | Claude Haiku | Structured payload formatting |
| Step 6 (Metadata) | Claude Haiku | Structured caption/hashtag generation |

### Prompt Templates

All 12 prompts use `{{placeholder}}` syntax, stored in the `prompts` table, editable via Settings → Prompts. The `default_template` column enables one-click factory reset per prompt.

**12 prompts seeded:**
- **Shared (2):** `shared_character_lock`, `shared_persona_voice`
- **Studio (4):** `studio_content_plan`, `studio_image_prompt`, `studio_caption_writer`, `studio_thumbnail`
- **UGC (6):** `ugc_product_intel`, `ugc_strategy`, `ugc_script_writer`, `ugc_visual_director`, `ugc_audio_producer`, `ugc_metadata_builder`

### Fallback: Gemini (P0)

When Claude credits are exhausted, the pipeline should fall back to Gemini gracefully. Steps 1, 5, and 6 (structured extraction/formatting) are the best candidates for Gemini fallback. This is a P0 item — Claude credits ran out during the first production test.

---

## 13. Database Schema

### New Tables

```sql
-- Editable AI prompt templates
CREATE TABLE public.prompts (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  slug              TEXT NOT NULL,
  label             TEXT NOT NULL,
  category          TEXT NOT NULL CHECK (category IN ('studio', 'ugc', 'shared')),
  model             TEXT NOT NULL CHECK (model IN ('sonnet', 'haiku')),
  template          TEXT NOT NULL,
  default_template  TEXT NOT NULL,
  variables         JSONB DEFAULT '[]',
  description       TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, slug)
);

-- Pipeline execution state — 6 JSONB columns, one per step
CREATE TABLE public.ugc_pipeline_runs (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  persona_id          TEXT NOT NULL,
  product_url         TEXT,
  product_name        TEXT,
  mode                TEXT DEFAULT 'hitl' CHECK (mode IN ('auto', 'hitl')),
  current_step        SMALLINT DEFAULT 0,
  pipeline_status     TEXT DEFAULT 'pending'
                        CHECK (pipeline_status IN ('pending','running','paused','completed','failed')),
  step_product_intel  JSONB,
  step_strategy       JSONB,
  step_script         JSONB,
  step_visuals        JSONB,
  step_audio          JSONB,
  step_metadata       JSONB,
  step_statuses       JSONB DEFAULT '[]',
  output_day_id       UUID REFERENCES public.days(id),
  error_message       TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- Production knowledge engine — viral hooks, content formats, decision rules, settings
CREATE TABLE public.production_library (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type         TEXT NOT NULL
                 CHECK (type IN ('viral_hook','content_format','decision_rule','location_setting')),
  name         TEXT NOT NULL,
  slug         TEXT NOT NULL UNIQUE,
  platform     TEXT DEFAULT 'both' CHECK (platform IN ('tiktok','instagram','both')),
  content      JSONB NOT NULL,     -- full structured data per type
  is_active    BOOLEAN DEFAULT TRUE,
  sort_order   INTEGER DEFAULT 0,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);
```

### Modified Tables

```sql
-- days: three new columns for UGC mode
ALTER TABLE public.days
  ADD COLUMN source      TEXT NOT NULL DEFAULT 'studio'
    CHECK (source IN ('studio', 'ugc')),
  ADD COLUMN ugc_run_id  UUID REFERENCES public.ugc_pipeline_runs(id),
  ADD COLUMN product_url TEXT;

-- user_settings: AI provider config
ALTER TABLE public.user_settings
  ADD COLUMN anthropic_api_key TEXT,   -- stored encrypted, used by backend proxy
  ADD COLUMN primary_llm       TEXT DEFAULT 'claude'
    CHECK (primary_llm IN ('claude', 'gemini'));
```

**Migration:** `supabase/migrations/002_ugc_mode.sql`
**Safe to re-run:** All `CREATE TABLE IF NOT EXISTS` and `ADD COLUMN IF NOT EXISTS` — idempotent.
**Zero-risk:** All 42 existing Studio posts inherited `source='studio'` via column default. No data modified.

---

## 14. Status Workflow & Good to Post Checklist

UGC posts follow a 4-state arc:

```
draft → generating → completed → published
```

| State | Meaning |
|-------|---------|
| `draft` | Run configured, pipeline not started |
| `generating` | Pipeline actively running (Steps 1–6) |
| `completed` | All 6 steps finished, package ready for review |
| `published` | "Good to Post" toggle activated, checklist confirmed |

### Good to Post Checklist Modal

Triggered when the user activates the "Good to Post" toggle. All "Before" items must be checked to confirm. Three phases:

**Before Export (7 items)**
- Character consistency across all shots
- Product clearly visible in at least 3 shots
- Text overlays readable on mobile
- No competitor brand visible
- Audio cues match visual timing
- Hook text matches voiceover
- Export specs set (9:16, 1080×1920, 30fps)

**Before Posting (5 items)**
- Affiliate link added and tested
- Caption length within platform limits
- Hashtag count within limit (TikTok: 5–7, IG: 20–30)
- Trending sound confirmed available
- Post scheduled or ready

**After Posting (4 items)**
- Reply to first 10 comments within 1 hour
- Pin engagement comment
- Log performance notes at 24h
- Flag if going viral (>10k views/24h)

---

## 15. Persona Pinning

Pinned personas sort to the top of the persona rail with a violet dot indicator.

- Pin/unpin via pin icon in persona editor
- Pinned state persisted in `localStorage`
- Pinned personas displayed above non-pinned with a visual separator
- Designed for power users managing 5+ personas who always start with the same 1–2

---

## 16. Build Order — Completed vs Planned

### Phase 1: Core Pipeline (Completed — April 9, 2026)
- [x] UGC TypeScript types (`src/types/ugc.ts`)
- [x] Product Switcher (logo click → slide panel → mode)
- [x] New Video Package overlay (URL input, mode toggle, persona card)
- [x] UGCPostCard — tabbed post detail
- [x] PipelineProgress, HookSelector, ModeToggle components
- [x] `/api/ugc/generate` — full 6-step pipeline endpoint
- [x] `/api/claude/messages` — Anthropic proxy endpoint
- [x] `prompts` table + 12 seeded templates
- [x] `ugc_pipeline_runs` table
- [x] `days` table columns: `source`, `ugc_run_id`, `product_url`
- [x] `user_settings` columns: `anthropic_api_key`, `primary_llm`

### Phase 2: Library + UX Polish (Completed — April 10, 2026)
- [x] `production_library` table seeded with 25 items
- [x] Library sidebar panel (BookOpen icon, section list, canvas detail)
- [x] Platform filter (TikTok / Instagram) on Library
- [x] Pipeline reads from Library at Steps 2 and 3
- [x] Decision Log in Strategy output
- [x] Storyboard: Shot 0 = Thumbnail
- [x] Affiliate URL editable in Product Intel tab, auto-injected into Metadata
- [x] Good to Post checklist modal (16 items across 3 phases)
- [x] Persona pinning (localStorage, violet dot, sorted rail)
- [x] Copy buttons on all prompts, scripts, captions, hashtags
- [x] Regenerate with confirmation modal
- [x] Danger Zone (delete moved to collapsible bottom section)
- [x] PromptsManager in Settings

### Phase 3: Integration & Polish (Upcoming)
- [ ] Character lock prompt — Claude-composed from persona fields, reviewable per persona
- [ ] Gemini fallback when Claude credits exhausted
- [ ] "Create Post" → ContentDay full end-to-end mapping
- [ ] Progressive step updates (SSE / polling, infrastructure ready)
- [ ] Step-level regeneration (re-run one step without re-running pipeline)
- [ ] Per-persona UGC tab in persona editor (content pillars, thumbnail style, platform priority)
- [ ] NanoBanana integration per shot card
- [ ] Export to Freepik / Higgsfield

---

## 17. Success Metrics

- Time from URL to complete package: < 60 seconds (auto mode)
- User edit rate per step: track which steps need most human intervention
- Pipeline completion rate: % of runs that reach "Good to Post"
- Post performance: track views/engagement of UGC-generated posts vs manual posts
- Library utilization: % of strategy decisions that reference Library items (pipeline transparency)

---

*Creator Studio · UGC Video Factory Module PRD*
*Version 2.0 — Updated April 10, 2026 to reflect all work completed in the April 9–10 build session*
*Designed to extend, not replace, the existing content creation workflow*
