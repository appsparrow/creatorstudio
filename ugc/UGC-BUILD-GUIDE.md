# UGC Video Factory — Build Guide
## For Creator Studio Development

---

## Quick Context

The UGC Video Factory is a new module inside Creator Studio that generates product-to-video content packages. It adds a "UGC" tab to PersonaPage and reuses existing persona, product, calendar, and publishing infrastructure.

**Key principle: KEEP IT SIMPLE.**
- Two input modes: Auto Scrape (paste URL, system fetches) OR Paste Data (copy from Kalodata/Amazon/manual). User chooses.
- Auto scrape is best-effort — if it fails, gracefully fall back to paste mode.
- Target platforms: TikTok and Instagram only.
- The AI organizes user input and generates creative assets (hooks, scripts, image prompts, metadata).
- Don't modify existing Creator Studio files unless absolutely necessary. UGC is additive.

**Reference docs in this folder:**
- `UGC-MODULE-PRD.md` — Full PRD with UI wireframes, data flow, build phases
- `UGC-API-CONTRACTS.md` — All API endpoint schemas with request/response examples
- `UGC-AGENT-DEFINITIONS.md` — 6 agent definitions with prompt context and parallel execution map
- `sample-data/bbl-serum-package.json` — Complete pipeline output for BBL Serum (real data)

**IMPORTANT: Safety rules for the build:**
- Do NOT refactor existing Creator Studio components
- Do NOT change existing types, routes, or API endpoints
- ADD new files only. Import from existing code where needed.
- Test UGC module in isolation before integrating with PersonaPage tabs
- Start with mock data from sample-data/ to build the UI, then wire AI later

---

## Tech Stack (matches Creator Studio)

- React 19 + TypeScript + Vite 6
- Tailwind 4 (dark theme: gray-900/950, violet-500 accents)
- React Router 7 (add `/persona/:id/ugc` routes)
- Express.js dev server (add `/api/ugc/*` endpoints to server.ts)
- Cloudflare Workers prod (add to worker/src/index.ts)
- SQLite dev / Supabase prod (add `ugc_runs` table)
- Gemini AI (existing) for pipeline agents
- NanoBanana (existing) for image generation from prompts

---

## What to Build

### New Files to Create

```
src/
  pages/
    UGCPipelinePage.tsx          — UGC tab: list of runs + "New Video Package"
    UGCPipelineRunPage.tsx       — Individual run: URL input + pipeline steps
  components/
    ugc/
      PipelineProgress.tsx       — Agentic progress indicator (6 steps)
      PipelineStepCard.tsx       — Expandable step output card (view/edit)
      ProductIntelCard.tsx       — Step 1 output display
      StrategyCard.tsx           — Step 2 output with override controls
      ScriptCard.tsx             — Step 3 with hook selector + script editor
      VisualPromptsCard.tsx      — Step 4 with 5 shot prompts + generate buttons
      AudioCard.tsx              — Step 5 with ElevenLabs payload + sound picks
      MetadataCard.tsx           — Step 6 with TikTok/IG metadata preview
      ModeToggle.tsx             — Auto / Human-in-the-Loop toggle
      HookSelector.tsx           — Radio list of scored hooks
  services/
    ugc.ts                       — UGC API client (CRUD runs, trigger steps)
  types/
    ugc.ts                       — UGC-specific TypeScript types
```

### Files to Modify

```
src/types.ts                     — Add UGC types (or import from types/ugc.ts)
src/pages/PersonaPage.tsx        — Add "UGC" tab to NavLink tabs
src/Workspace.tsx                — Add UGC routes
server.ts                        — Add /api/ugc/* endpoints
worker/src/index.ts              — Add /api/ugc/* endpoints (prod)
```

---

## Shared Components to Reuse

| Existing Component/Pattern | Reuse In UGC Module |
|---|---|
| PersonaPage tab layout (NavLink tabs) | Add "UGC" tab alongside Profile/Calendar/etc |
| ContentDayPage field layout | Similar card-based sections for step outputs |
| Status badges (gray/amber/blue/green) | Pipeline step status indicators |
| Loader2 spinner pattern | Loading states during generation |
| Product type & CRUD | Save scraped products to existing Products tab |
| ContentDay type & CRUD | "Create Post" maps UGC output → ContentDay |
| NanoBanana service | "Generate Image" buttons on visual prompts |
| Kling service pattern | Model for future ElevenLabs polling integration |
| Motion/AnimatePresence | Step card expand/collapse animations |

---

## Pipeline Execution Modes

### Auto Mode
```
POST /api/ugc/runs { mode: "auto" }
→ Server runs all 6 steps sequentially
→ Steps 4+5+6 run in parallel after Step 3
→ Client polls GET /api/ugc/runs/:id for progress
→ Final package returned when all steps complete
```

### Human-in-the-Loop (HITL) Mode
```
POST /api/ugc/runs { mode: "hitl" }
→ Server runs Step 1 only
→ Client shows Step 1 output with [Accept] [Edit] [Regenerate]
→ User clicks Accept → Client calls POST /api/ugc/runs/:id/step/strategy
→ Server runs Step 2
→ Repeat until all 6 steps done
```

### Review Gates (even in auto mode)
After Step 2 (Strategy) and Step 3 (Script), the UI should highlight these steps with an "eye" icon indicating they're worth reviewing before the downstream steps use their output.

---

## Key Design Decisions

1. **Character prompt is DYNAMIC** — Built from `persona.appearance` fields, not hardcoded. Any persona can generate UGC, not just Sofia Laurent.

2. **Products are SAVED** — When Step 1 scrapes a product, it auto-saves to the persona's Products tab. Future runs for the same product skip Step 1.

3. **ContentDay is the output** — "Create Post" converts the pipeline output into a ContentDay that appears in the calendar, reusing all existing publishing infrastructure.

4. **Prompts are server-side** — Agent prompt templates stored on the server, not in client code. This allows iteration without redeployment.

5. **AI provider is swappable** — Start with Gemini (existing). Claude API can be added as an option via Settings. The pipeline structure is provider-agnostic.

---

## Database

### SQLite (dev) — add to server.ts init
```sql
CREATE TABLE IF NOT EXISTS ugc_runs (
  id TEXT PRIMARY KEY,
  personaId TEXT NOT NULL,
  productUrl TEXT,
  mode TEXT DEFAULT 'hitl',
  status TEXT DEFAULT 'running',
  data TEXT,
  contentDayId TEXT,
  createdAt INTEGER DEFAULT (unixepoch()),
  completedAt INTEGER
);
```

### Supabase (prod) — migration
```sql
CREATE TABLE ugc_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  persona_id UUID NOT NULL,
  product_url TEXT,
  mode TEXT DEFAULT 'hitl' CHECK (mode IN ('auto', 'hitl')),
  status TEXT DEFAULT 'running' CHECK (status IN ('running', 'complete', 'error')),
  data JSONB DEFAULT '{}'::jsonb,
  content_day_id UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);

ALTER TABLE ugc_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own UGC runs"
  ON ugc_runs FOR ALL
  USING (auth.uid() = user_id);
```

---

## Build Order

### Phase 1: Skeleton + Pipeline UI (start here)
1. Add UGC types to `types.ts`
2. Create `UGCPipelinePage` (list view with "New" button)
3. Create `UGCPipelineRunPage` (URL input + step cards)
4. Create `PipelineProgress` component
5. Create `PipelineStepCard` (expandable, editable)
6. Create `ModeToggle` (auto/hitl)
7. Add routing and tab to PersonaPage
8. Wire up with mock data from `sample-data/bbl-serum-package.json`

### Phase 2: Backend + AI Integration
9. Add `ugc_runs` table to SQLite
10. Add `/api/ugc/*` endpoints to server.ts
11. Implement Step 1 (product scraping with fetch + Gemini extraction)
12. Implement Step 2 (strategy selection with Gemini)
13. Implement Step 3 (script generation with Gemini)
14. Implement Steps 4-6 (visuals, audio, metadata with Gemini)

### Phase 3: Integration + Polish
15. HITL flow: edit step outputs, re-run downstream
16. "Create Post" → ContentDay mapping
17. "Generate Image" buttons → NanoBanana
18. Pipeline run history
19. Export/share functionality
20. Cloudflare Worker endpoints (prod)

---

*Start with Phase 1 — get the UI working with mock data first, then wire up the AI.*
