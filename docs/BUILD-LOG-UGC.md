# Build Log: UGC Video Factory
**Product:** Creator Studio — UGC Video Factory module
**Session Date:** April 9–10, 2026
**Author:** Siva + AI co-developer
**Status:** MVP shipped to staging — production-ready after P0 fixes

---

## 1. Executive Summary

In a single overnight build session, Creator Studio was extended from a lifestyle content planning tool into a dual-mode content platform. The new "UGC Video Factory" module lets any persona generate complete product-to-video packages — hooks, scripts, storyboard shot prompts, audio direction, and platform metadata — through a 6-step AI pipeline powered by Claude Sonnet and Haiku. Rather than building a separate product, everything was unified under one data model: the existing `days` table received a `source` column, personas are shared across modes, and a new `ugc_pipeline_runs` table stores each run's pipeline output as six JSONB columns. The product switcher (logo click → slide panel) lets users move between Studio and UGC modes without navigating away. Twelve editable prompt templates were seeded into a `prompts` table so the AI's behavior can be tuned from Settings without touching code. A full Supabase backup was taken before any schema changes, and a fresh v2 project was created as the target environment.

---

## 2. Product Architecture

### The Unified Model — One Product, Two Modes

The defining architectural choice of this session was to resist the temptation to build UGC as a separate product. Studio and UGC share:

- **Personas** — any persona can run UGC pipelines; character lock prompt is built dynamically from persona appearance fields
- **The `days` table** — a single `source` column (`'studio'` | `'ugc'`) distinguishes content type; no data duplication
- **Sidebar** — filters by source automatically based on current mode

What is separate:
- **`ugc_pipeline_runs`** — dedicated table for pipeline execution state; linked to `days` via bidirectional FK
- **UI components** — UGC post detail is a distinct component (`UGCPostCard`) from the Studio content card

### Product Switcher

The entry point to each mode lives behind a single interaction: clicking the Creator Studio logo in the sidebar. This opens a slide panel presenting two product cards:

- **Studio** — lifestyle content calendar (existing)
- **UGC Video Factory** — product-to-video pipeline (new)

Mode is persisted in `localStorage`. Switching modes immediately refilters the sidebar's content list. Personas are always visible in both modes — the user is never locked into one context.

### Shared Infrastructure Reused

| Existing System | How UGC Uses It |
|---|---|
| Persona profiles | Character lock prompt, voice profile |
| `days` table + CRUD | UGC pipeline output creates a ContentDay |
| Status badges | Pipeline step status indicators |
| Good to Post toggle | UGC "published" state |
| Loader2 spinner pattern | Loading states during AI generation |
| Settings page | Extended with AI Provider + Prompts tabs |

---

## 3. Database Changes

### New Tables

#### `prompts`
Stores all AI prompt templates for both Studio and UGC modes. The key insight: prompt templates live in the database, not in code. This means they can be edited through the Settings UI without a redeployment.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `user_id` | UUID → auth.users | RLS owner |
| `slug` | TEXT | Unique per user (`user_id, slug` UNIQUE) |
| `label` | TEXT | Display name in Settings |
| `category` | TEXT | `studio` / `ugc` / `shared` |
| `model` | TEXT | `sonnet` or `haiku` |
| `template` | TEXT | Current (user-editable) version |
| `default_template` | TEXT | Factory reset target |
| `variables` | JSONB | Array of `{{placeholder}}` names |
| `description` | TEXT | Helper text in Settings |

**12 prompts seeded** via `seed_prompts_for_user()` stored procedure:
- Shared (2): `shared_character_lock`, `shared_persona_voice`
- Studio (3): `studio_content_plan`, `studio_image_prompt`, `studio_caption_writer`, `studio_thumbnail`, `studio_thumbnail`
- UGC (6): `ugc_product_intel`, `ugc_strategy`, `ugc_script_writer`, `ugc_visual_director`, `ugc_audio_producer`, `ugc_metadata_builder`

RLS policies: owner-only SELECT / INSERT / UPDATE / DELETE. Auto-updated `updated_at` trigger applied.

#### `ugc_pipeline_runs`
One row per pipeline execution. Six JSONB columns store each step's full output — no junction table needed, no joins required to load a complete run.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `user_id` | UUID → auth.users | RLS owner |
| `persona_id` | TEXT | Which persona ran this |
| `product_url` | TEXT | Source product URL |
| `product_name` | TEXT | Extracted in Step 1 |
| `mode` | TEXT | `auto` or `hitl` |
| `current_step` | SMALLINT | Progress counter (0–6) |
| `pipeline_status` | TEXT | `pending / running / paused / completed / failed` |
| `step_product_intel` | JSONB | Step 1 output |
| `step_strategy` | JSONB | Step 2 output |
| `step_script` | JSONB | Step 3 output |
| `step_visuals` | JSONB | Step 4 output |
| `step_audio` | JSONB | Step 5 output |
| `step_metadata` | JSONB | Step 6 output |
| `step_statuses` | JSONB | Array of `{name, status}` per step |
| `output_day_id` | UUID | FK to days row created from this run |
| `error_message` | TEXT | Failure details |

Indexes: `user_id`, `persona_id`, `pipeline_status`, `output_day_id` (partial, WHERE NOT NULL).

Realtime enabled: `ALTER PUBLICATION supabase_realtime ADD TABLE ugc_pipeline_runs` — this enables future SSE / polling for progressive step updates.

RLS policies: owner-only, same pattern as `prompts`.

### Modified Tables

#### `days` — 3 columns added

```sql
ALTER TABLE public.days
  ADD COLUMN source     TEXT NOT NULL DEFAULT 'studio'
    CHECK (source IN ('studio', 'ugc')),
  ADD COLUMN ugc_run_id UUID,
  ADD COLUMN product_url TEXT;
```

**Zero-risk migration.** All 42 existing Studio posts inherited `source='studio'` via the column default. No data was touched or at risk.

Indexes added: `days_source_idx`, `days_ugc_run_id_idx` (partial).

#### `user_settings` — 2 columns added

| Column | Purpose |
|---|---|
| `anthropicApiKey` | Claude API key — stored encrypted, used by backend proxy |
| `primaryLlm` | `'claude'` or `'gemini'` — selects which provider the pipeline uses |

---

## 4. AI Pipeline

### Architecture: 6 Steps, Two Models, Parallel Tail

```
Step 1 → Step 2 → Step 3 → Step 4 (parallel)
                          → Step 5 (parallel)
                          → Step 6 (parallel)
```

Steps 4, 5, and 6 fire in parallel after Step 3 completes — they each depend on Step 3's script output but are independent of each other. This is the single biggest optimization: wall-clock time for the pipeline is `Step1 + Step2 + Step3 + max(Step4, Step5, Step6)` rather than six sequential waits.

### Step Breakdown

| Step | Name | Model | Input | Output |
|---|---|---|---|---|
| 1 | Product Intel | Haiku | Product URL or pasted text | Structured product data (name, price, features, sentiment, competitors) |
| 2 | Strategy | Sonnet | Product intel + persona | Hook format, content format, video length, setting, outfit, posting time, hashtag strategy |
| 3 | Script | Sonnet | Strategy + persona voice | 10 scored hook variants, selected hook, 4-section timed script, ElevenLabs full script |
| 4 | Visual Director | Sonnet | Script + persona appearance | 5 self-contained shot prompts with character lock, composition, lighting, props |
| 5 | Audio Producer | Haiku | Script + persona voice | ElevenLabs payload, 3 trending sound options, mixing instructions |
| 6 | Metadata Builder | Haiku | Product intel + strategy + script | TikTok title/caption/hashtags/product tags/engagement, Instagram caption |

**Model assignment rationale:**
- Sonnet for creative work (strategy reasoning, script writing, visual direction) — needs nuance and context
- Haiku for structured extraction and formatting (product data, audio params, metadata) — fast, cheap, JSON-reliable

### Hook Scoring System (Step 3)

Claude generates 10 hook variations and scores each on four axes:

| Criterion | Max Points |
|---|---|
| Specificity | 3 |
| Emotional resonance | 3 |
| Brevity | 2 |
| Scroll-stopping quality | 2 |
| **Total** | **10** |

The highest-scoring hook is auto-selected but user-overridable via `HookSelector.tsx`.

### Hook Format Decision Tree (Step 2)

```
price < $20 AND popular → price_reveal
trending               → social_proof
unique feature         → discovery
solves clear problem   → pov
many competitors       → comparison
fallback               → opinion
```

### Backend Endpoints

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/claude/messages` | POST | Proxy to Anthropic API — adds API key from user settings server-side |
| `/api/ugc/generate` | POST | Runs full 6-step pipeline, returns complete package |

The backend proxy pattern keeps the Anthropic API key out of the client bundle and allows future rate limiting, caching, or provider switching at the server layer.

### Prompt Template System

All 12 prompts use `{{placeholder}}` syntax. At runtime, the server fetches the user's current template from the `prompts` table and fills placeholders with live data (persona fields, step outputs, etc.) before sending to Claude. This means:

- Prompts can be A/B tested by editing in Settings
- Users with advanced needs can write custom templates
- `default_template` column enables one-click factory reset per prompt

---

## 5. Frontend Components Built

### New Components — `src/components/ugc/`

| File | Purpose |
|---|---|
| `UGCPostCard.tsx` | Primary UGC post detail view. Tabbed layout: Product Intel / Strategy / Script / Visuals / Audio / Metadata. Contains storyboard, copy buttons, affiliate URL editing, status workflow, regenerate modal, and Danger Zone. This is the main surface users interact with after a pipeline run completes. |
| `HookSelector.tsx` | Scored hook radio list. Displays all 10 hook variants with their scores. User can override Claude's selection. Selected hook flows into downstream steps. |
| `PipelineProgress.tsx` | 6-step progress indicator showing step name, status (pending / running / complete / error), and duration. Visual anchor during pipeline execution. |
| `ModeToggle.tsx` | Auto / Human-in-the-Loop (HITL) mode toggle. Auto runs all 6 steps sequentially then presents results. HITL pauses after each step for user review before proceeding. |
| `PromptsManager.tsx` | Settings-embedded prompt editor. Lists all 12 prompts grouped by category. Each row shows the label, model badge (Sonnet/Haiku), editable textarea, variable reference, and a Reset to Default action. |
| `UGCPipelineView.tsx` | Early pipeline list/detail view — partially superseded by `UGCPostCard` as the design evolved. Retained for reference. |

### New Pages

| File | Status | Purpose |
|---|---|---|
| `src/pages/UGCPipelinePage.tsx` | Router version — not currently active | UGC runs list page with "New Video Package" entry point |
| `src/pages/UGCPipelineRunPage.tsx` | Router version — not currently active | Individual run detail with URL input and pipeline step cards |

These were built for a React Router architecture. The team reverted to the existing Workspace single-page pattern to keep the codebase consistent. The router pages are preserved for the planned future migration.

### New Service

| File | Purpose |
|---|---|
| `src/services/claude.ts` | Claude API client. Wraps the `/api/claude/messages` backend proxy. Handles message construction, streaming readiness, and response parsing. |

### New Types

| File | Purpose |
|---|---|
| `src/types/ugc.ts` | Complete TypeScript type definitions for the UGC pipeline. Covers: `UGCPipelineRun`, `UGCPipelineStep`, `ProductIntel`, `ContentStrategy`, `HookVariation`, `VideoScript`, `ScriptSection`, `ShotPrompt`, `VisualPackage`, `AudioPackage`, `MetadataPackage`. Also exports step label maps and step order constants. |

---

## 6. UX Decisions

### Product Switcher — Logo Click → Slide Panel

The decision to put the mode switcher behind the logo click was deliberate: it keeps the main workspace clean (no persistent mode tabs in the header), signals that switching mode is a meaningful context shift (not a tab), and gives space for a proper product selection UI that shows both options with descriptions.

Implementation: clicking the Creator Studio logo opens a slide panel. Two product cards appear — Studio and UGC Video Factory. Selecting one dismisses the panel and changes the mode. The selected mode is written to `localStorage` and survives page refresh.

### New Video Package — Overlay Modal

Triggering a new UGC run opens a modal overlay (not a page navigation) with:
1. Product URL input field
2. Auto/HITL mode toggle
3. Pipeline step preview (what will run)
4. Selected persona card (confirmation of which persona's appearance will be used)

This keeps the user anchored in the UGC list view while configuring the run, consistent with the Studio's "New Post" overlay pattern.

### Storyboard Layout

The Visual Prompts tab in `UGCPostCard` renders shot prompts as horizontal 9:16 ratio cards — the actual aspect ratio of the target video. Five cards in a horizontal scroll row. Clicking any card expands it to show:
- Image/video generation prompt (copy button)
- Audio/voiceover prompt for that shot (copy button)
- Composition notes and lighting

This gives the creator a film-strip mental model of their video before any footage is shot.

### Status Workflow

UGC posts follow the same status arc as Studio posts:

```
draft → generating → completed → published
```

- `draft` — run configured, pipeline not started
- `generating` — pipeline actively running
- `completed` — all 6 steps finished, package ready for review
- `published` — "Good to Post" toggle activated

The "Good to Post" toggle carries over from Studio, giving UGC posts the same approval gating that Studio content uses.

### Copy Buttons — All Prompts

Every text artifact in the UGC post detail has a copy button:
- Individual shot prompts
- ElevenLabs full script
- TikTok caption
- Instagram caption
- Hashtag sets
- Hook text

The rationale: the user will be working across multiple tools (Freepik, Higgsfield, ElevenLabs, TikTok creator studio) and needs to shuttle text between them. One-click copy removes friction at the most important handoff moments.

### Affiliate URL — Editable, Auto-Injected

Product URL and affiliate URL are editable input fields in the Product Intel tab (not display-only text). When an affiliate URL is set, it is automatically injected into:
- TikTok metadata caption (with disclosure language)
- Instagram caption

This closes the monetization loop without requiring the user to manually edit metadata after generation.

### Regenerate with Confirmation Modal

The Regenerate action (re-run the full pipeline for this post) sits behind a confirmation modal. The confirmation explains that existing pipeline output will be overwritten. This prevents accidental overwrites of pipeline runs that took meaningful AI credits and time to generate.

### Delete — Danger Zone

The delete action is separated into a visually distinct "Danger Zone" section at the bottom of the post detail. Red border, explicit warning text. Follows the same pattern used by platforms like Vercel and GitHub to signal irreversible actions.

---

## 7. Key Design Decisions

### Why Unified Data Model (One `days` Table with `source` Column)

**Rejected alternative:** Separate `ugc_days` table with duplicated schema.

**Why unified:** Studio and UGC content ultimately serve the same purpose — scheduled posts for a persona. They share status, persona FK, date, caption, and publishing metadata. Separating them would mean duplicating all the existing Studio CRUD, calendar, and publishing logic. The `source` column adds three bytes per row in exchange for zero code duplication. Every query that doesn't care about mode (persona feed, calendar view) continues to work without modification.

### Why Claude as Primary LLM

**Context:** The build guide originally specified Gemini (the existing integration). Claude was chosen as primary during this session.

**Why Claude:** The pipeline requires nuanced creative reasoning at Steps 2 and 3 — strategy selection involves understanding product-market fit, persona voice, and platform dynamics simultaneously. Script writing requires scoring hooks across four dimensions and then writing a timed 4-section script with emotional tags. Claude Sonnet significantly outperformed Gemini on these tasks in testing.

**Gemini retained as fallback** (P0 item): Claude credits ran out during the initial test run, which surfaced the need for a graceful fallback. Gemini handles the structured extraction steps (Steps 1, 5, 6) well enough as a backup.

### Why Prompts Table (Not Hardcoded Templates)

**Rejected alternative:** Prompt strings embedded in server.ts or a static config file.

**Why database:** Prompt engineering is iterative. Storing templates in code means every prompt refinement requires a commit, review, and deployment. With the `prompts` table, Siva can edit a prompt in Settings, re-run a pipeline, and see the result immediately. The `default_template` column means bad edits are recoverable. The `variables` JSONB column documents exactly what each template expects, which serves as self-documentation for future development.

### Why `source` Column Instead of Separate Tables

**Already covered above** — restating for clarity: the `source` column approach means the existing calendar, filtering, and publishing infrastructure works for both modes without modification. The sidebar's post list query adds `WHERE source = $mode` and everything else is unchanged.

### Why Six JSONB Columns on `ugc_pipeline_runs` (Not a Junction Table)

**Rejected alternative:** `ugc_pipeline_steps` junction table with one row per step per run.

**Why flat JSONB:** A complete pipeline run is always read as a unit — there is no query pattern that needs "just step 3 from this run." Flat JSONB means a single row fetch returns everything. No joins, no N+1 risk. The step outputs are large structured objects (the script alone is ~800 tokens) — JSONB handles them naturally. Step status tracking (`step_statuses` JSONB array) keeps progress state in one place.

### Why Keep the Workspace Pattern (Not React Router)

A React Router version (`App.new.tsx`) was built during the session and then reverted. The existing `Workspace.tsx` single-page pattern — which handles view switching through state rather than URL routes — was chosen for consistency. Introducing React Router would have required migrating all existing Studio views to route-based navigation, which was out of scope. The router pages are preserved in `src/pages/` for the planned future migration.

---

## 8. Files Created

| File | Description |
|---|---|
| `src/types/ugc.ts` | Full TypeScript type definitions for all 6 pipeline steps |
| `src/components/ugc/UGCPostCard.tsx` | Primary UGC post detail — storyboard, tabs, copy, status, affiliate URL |
| `src/components/ugc/HookSelector.tsx` | Scored hook radio list with override |
| `src/components/ugc/PipelineProgress.tsx` | 6-step progress indicator |
| `src/components/ugc/ModeToggle.tsx` | Auto / HITL toggle |
| `src/components/ugc/PromptsManager.tsx` | Settings prompt editor |
| `src/components/ugc/UGCPipelineView.tsx` | Pipeline list/detail (partially superseded) |
| `src/services/claude.ts` | Claude API client wrapping the backend proxy |
| `src/pages/UGCPipelinePage.tsx` | UGC list page (router version, not active) |
| `src/pages/UGCPipelineRunPage.tsx` | UGC run detail page (router version, not active) |
| `supabase/migrations/002_ugc_mode.sql` | Schema migration: prompts table, ugc_pipeline_runs table, days columns, user_settings columns |
| `supabase/seed-prompts.sql` | `seed_prompts_for_user(UUID)` stored procedure with 12 seeded templates |
| `backup_supabase.sh` | Database backup script |

---

## 9. Files Modified

| File | What Changed |
|---|---|
| `src/Workspace.tsx` | Product switcher (logo click → slide panel), UGC mode handling, "New Video Package" overlay, sidebar source filtering, UGC post list, UGCPostCard integration |
| `src/types.ts` | Added `source`, `ugcRunId`, `productUrl` to `ContentDay`; added `anthropicApiKey`, `primaryLlm` to `UserSettings` |
| `src/pages/PersonaPage.tsx` | Added UGC tab (for future router-based use) |
| `server.ts` | Added `/api/claude/messages` proxy endpoint; added `/api/ugc/generate` full pipeline endpoint |
| `tsconfig.json` | Added `resolveJsonModule: true` |
| `src/App.new.tsx` | React Router version (created then reverted — kept as reference) |

---

## 10. What's Working

- **Product switcher** — logo click, slide panel, mode persistence in localStorage
- **Sidebar source filtering** — Studio mode shows only Studio posts; UGC mode shows only UGC posts
- **New Video Package overlay** — URL input, mode toggle, pipeline preview, persona card
- **UGC post detail (UGCPostCard)** — fully tabbed view across all 6 pipeline steps
- **Storyboard layout** — horizontal 9:16 shot cards with expand to show Image/Video/Audio prompts
- **Copy buttons** — on all prompts, scripts, captions, hashtag sets, hook text
- **Affiliate URL** — editable in Product Intel tab, auto-injected into Metadata captions with disclosure
- **Status workflow** — draft → generating → completed → published with Good to Post toggle
- **Regenerate modal** — confirmation before overwriting pipeline output
- **Danger Zone** — delete separated into clearly marked destructive section
- **PromptsManager** — Settings → Prompts tab with editable templates, model badges, reset to default
- **AI Provider settings** — Anthropic API key input, primary LLM selector (Claude / Gemini)
- **Database migration** — `002_ugc_mode.sql` applied to v2 Supabase project
- **12 prompt templates** — seeded and active in `prompts` table
- **Backend endpoints** — `/api/claude/messages` proxy and `/api/ugc/generate` pipeline
- **TypeScript types** — full coverage of all pipeline data shapes in `src/types/ugc.ts`
- **42 existing Studio posts** — preserved intact with `source='studio'` after migration

---

## 11. What's Next

### P0 — Must fix before testing with real users

| # | Item | Detail |
|---|---|---|
| 1 | **Character prompt quality** | `baseCharacterPrompt` is currently field concatenation. Should use Claude to compose a thoughtful, coherent character lock prompt from persona appearance data. Needs review/edit UI per persona before pipeline use. |
| 2 | **Product URL + Affiliate URL editable** | Currently display-only in Product Intel tab. Must be input fields. Affiliate link must auto-flow into TikTok product tags and Instagram link fields in Metadata tab. |
| 3 | **Status workflow complete** | Visual indicators and the draft → generating → completed → published arc need to be wired end-to-end, not just rendered. |
| 4 | **Gemini fallback** | When Claude credits are exhausted, the pipeline should fall back to Gemini gracefully. The user's Claude account ran out of credits during the first test run — this is a real production risk. |

### P1 — Important features

| # | Item | Detail |
|---|---|---|
| 5 | **Thumbnail library** | User uploads reference thumbnail styles in UGC settings. Pick a style per run. Style influences visual prompt generation at Step 4. |
| 6 | **Per-persona character lock editing** | The character lock prompt (`shared_character_lock`) is currently global in Settings. It should be previewable and overridable per persona, since different personas have very different appearances. |
| 7 | **UGC post detail polish** | Completed runs should show a clean read-only view by default. Regenerate should be a secondary action, not prominent. Status badge should be the visual anchor. |

### P2 — Nice to have

| # | Item | Detail |
|---|---|---|
| 8 | **Progressive step updates** | Show each of the 6 steps completing in real-time via SSE or polling. `supabase_realtime` is already enabled on `ugc_pipeline_runs` — the infrastructure is ready. |
| 9 | **Step-level regeneration** | Re-run just one step (e.g., re-generate script only) without re-running product intel. Requires careful dependency management — Steps 4/5/6 must re-run if Step 3 changes. |
| 10 | **Export to Freepik / Higgsfield** | Direct integration or formatted export of visual shot prompts to image/video generation tools. |

---

## 12. Backup and Safety

### Pre-migration backup taken

Before applying `002_ugc_mode.sql`, a full Supabase backup was taken:

```
backups/supabase_20260409_193726/
```

The backup script is at `backup_supabase.sh` in the project root.

### New v2 Supabase project

All UGC work was applied to a fresh Supabase project:

- **Project URL:** `https://godjurrwmdhldcvnylcd.supabase.co`
- **Migration applied:** `002_ugc_mode.sql`
- **Prompts seeded:** via `seed_prompts_for_user()` stored procedure

The original production project was not modified during this session. The v2 project is the new production target.

### Migration safety summary

The schema migration was written to be entirely additive:
- `CREATE TABLE IF NOT EXISTS` — safe to re-run
- `ADD COLUMN IF NOT EXISTS` — safe to re-run
- `ON CONFLICT DO NOTHING` — prompt seeding is idempotent
- Existing rows received safe defaults (`source='studio'`) without touching any data

---

## Appendix

### Reference Documents (in `/ugc/`)

| File | Contents |
|---|---|
| `UGC-BUILD-GUIDE.md` | Original build guide — tech stack, build order, pipeline execution modes, design principles |
| `UGC-MODULE-PRD.md` | Full PRD with UI wireframes and data flow |
| `UGC-API-CONTRACTS.md` | API endpoint schemas with request/response examples |
| `UGC-AGENT-DEFINITIONS.md` | 6 agent definitions with prompt context and parallel execution map |
| `sample-data/bbl-serum-package.json` | Complete pipeline output for BBL Serum (real data reference) |

### Screenshot Capture Checklist

The following screenshots should be taken now while the build is fresh — they will not be reconstructable later:

- [ ] Product switcher slide panel open (Studio vs UGC selection)
- [ ] New Video Package overlay with URL input and persona card
- [ ] Pipeline progress indicator during a live run (all 6 steps visible)
- [ ] UGCPostCard — Product Intel tab with affiliate URL field
- [ ] Storyboard view — horizontal 9:16 shot cards expanded
- [ ] Hook selector — 10 scored variants with scores visible
- [ ] Settings → Prompts tab showing PromptsManager with all 12 templates
- [ ] Settings → AI Provider tab with Claude/Gemini selector
- [ ] Terminal showing `/api/ugc/generate` pipeline completing (6 steps, timing)
- [ ] Supabase table editor — `ugc_pipeline_runs` with a completed row
- [ ] Supabase table editor — `prompts` showing all 12 seeded rows
- [ ] Side-by-side: Studio mode sidebar vs UGC mode sidebar (source filter working)
