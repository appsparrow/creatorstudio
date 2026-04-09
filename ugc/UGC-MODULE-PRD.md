# UGC Video Factory — Module PRD
## Creator Studio Extension

---

## 1. Overview

**What:** A UGC (User-Generated Content) video generation module that takes product info (pasted from Kalodata, Amazon, or manual input) and generates a complete TikTok/Instagram video package — hooks, scripts, image prompts, audio direction, and metadata.

**Where it lives:** New tab inside PersonaPage at `/persona/:personaId/ugc`, alongside existing tabs (Profile, Calendar, Audience, Products, Storyline).

**Why here:** Creator Studio already has the persona system, product management, content calendar, and publishing pipeline. The UGC module adds an automated product-to-video workflow that feeds into the existing content system.

**Target platforms:** TikTok and Instagram only. YouTube and Amazon may come later.

**Philosophy:** Keep it simple. No complex web scraping. The user provides product data (paste from Kalodata, copy from Amazon, or type manually). The AI generates the creative package from that input. The value is in the content generation pipeline, not the research.

---

## 2. How It Fits Into Creator Studio

### Shared Components (reuse, don't rebuild)
- **Persona** — Character profile drives image prompts (appearance, style, traits)
- **Product** — Product catalog stores scraped product intel for reuse
- **ContentDay** — Final video package becomes a ContentDay entry in the calendar
- **TargetAudience** — Audience segments inform strategy selection
- **Publishing** — Meta Graph API, Blotato, Google Drive sync all work as-is
- **AppShell** — Same layout, dark theme, sidebar

### New Components (build these)
- **UGC Pipeline page** — URL input + pipeline runner
- **Pipeline Step cards** — Show each agent's output with review/edit capability
- **Mode toggle** — Auto mode vs Human-in-the-Loop mode
- **Pipeline status indicator** — Agentic progress tracker

---

## 3. User Flow

### 3.1 Auto Mode (fully automated)

```
User pastes product URL → clicks "Generate"
  ↓
Pipeline runs all 6 steps automatically
  ↓
Complete package appears for review
  ↓
User clicks "Create Post" → ContentDay created in calendar
```

### 3.2 Human-in-the-Loop Mode (review at each step)

```
User pastes product URL → clicks "Generate"
  ↓
Step 1: Product Intel → PAUSE → User reviews/edits → "Continue"
  ↓
Step 2: Strategy → PAUSE → User reviews/edits hook format → "Continue"
  ↓
Step 3: Script → PAUSE → User reviews/edits hooks and script → "Continue"
  ↓
Step 4: Visual Prompts → PAUSE → User reviews/edits prompts → "Continue"
  ↓
Step 5: Audio → PAUSE → User reviews/edits voice settings → "Continue"
  ↓
Step 6: Metadata → PAUSE → User reviews/edits captions/hashtags → "Continue"
  ↓
Complete package → "Create Post"
```

### 3.3 Review Gates (logical pause points)

Even in auto mode, the pipeline should have **soft review gates** where the user CAN intervene if they're watching:

| Gate | After Step | Why |
|------|-----------|-----|
| **Strategy Gate** | Step 2 | Hook format choice drives everything downstream. Wrong format = wasted generation. |
| **Script Gate** | Step 3 | Script quality is the #1 factor in video performance. Worth a human eye. |
| **Final Review** | Step 6 | Before creating the ContentDay, review the complete package. |

---

## 4. Pipeline Steps (6 Agents)

### Step 1: Product Intel (Two Input Modes)
- **Mode A — Auto Scrape:** User pastes a product URL (Amazon, TikTok Shop). System fetches the page and extracts product data automatically.
- **Mode B — Paste Data:** User pastes product details from Kalodata, Amazon, or types manually. AI structures the text into clean data.
- **UI:** Toggle or tabs: `[Auto Scrape URL]` | `[Paste Product Info]`
- **Process:** Either way, AI classifies category, extracts features, identifies pain points
- **Output:** `ProductIntel` object (name, price, features, category, reviews, competitors)
- **Reuse:** Saves to Creator Studio's existing `Product` type in the Products tab

### Step 2: Strategy Selection
- **Input:** ProductIntel + Persona + TargetAudience
- **Process:** Apply hook format decision tree, select content format, setting, posting time
- **Output:** `ContentStrategy` object (hook_format, content_format, video_length, setting, hashtags)
- **Review gate:** User can override hook format before script generation

### Step 3: Script Writing
- **Input:** ProductIntel + ContentStrategy + Persona voice profile
- **Process:** Generate 10 hooks, score them, write full 20s timed script
- **Output:** `VideoScript` object (hooks[], selected_hook, full_script with timing/overlays/voiceover)
- **Review gate:** User can pick a different hook or edit script sections

### Step 4: Visual Direction
- **Input:** Persona appearance + ProductIntel + VideoScript + ContentStrategy.setting
- **Process:** Generate 5 shot prompts with character locking
- **Output:** `VisualPackage` object (5 shot prompts, consistency checklist, image settings)
- **Integration:** "Generate" button per shot → NanoBanana API (existing integration)

### Step 5: Audio Production
- **Input:** VideoScript + Persona voice profile
- **Process:** Format ElevenLabs payload, recommend trending sounds, mixing instructions
- **Output:** `AudioPackage` object (ElevenLabs payload, sound recommendations, mixing specs)
- **Future:** Direct ElevenLabs API integration (like existing Kling integration)

### Step 6: Metadata
- **Input:** ProductIntel + VideoScript + ContentStrategy
- **Process:** Generate TikTok/Instagram titles, captions, hashtags, posting schedule
- **Output:** `MetadataPackage` object (TikTok metadata, Instagram metadata, engagement strategy)
- **Integration:** Maps directly to ContentDay fields (caption, hook, hashtags, cta, platforms)

---

## 5. Execution Modes

### Auto Mode
- All 6 steps run sequentially (steps 3+4 parallel, steps 5+6 parallel)
- Pipeline progress shown in real-time
- Final package presented for review
- User clicks "Create Post" to push to calendar

### Human-in-the-Loop Mode
- Each step pauses after completion
- User sees output in an editable card
- User can: Accept (continue), Edit (modify then continue), Regenerate (re-run step)
- Edited values propagate to downstream steps

### Mode Toggle
- Global default set in Settings
- Per-run override available on the UGC page
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

## 7. Data Flow & Type Integration

### New Types (extend types.ts)

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
}

export interface ContentStrategy {
  hookFormat: 'price_reveal' | 'pov' | 'discovery' | 'social_proof' | 'comparison' | 'opinion';
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
  shotId: string;
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
  shotPrompts: ShotPrompt[];
  consistencyChecklist: string[];
  imageGenerationSettings: {
    platform: string;
    resolution: string;
    aspectRatio: string;
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
    caption: string;
    hashtags: { tag: string; type: string; rationale: string }[];
    productTags: { productName: string; variant: string; price: string; tagPlacement: string; tagTiming: string }[];
    postingSchedule: { optimalTime: string; dayOfWeek: string; rationale: string; backupTimes: string[] };
    engagementStrategy: {
      pinComment: string;
      autoReplyTriggers: { keyword: string; response: string }[];
    };
  };
  instagram: {
    caption: string;
    hashtagsCount: number;
    brandMentions: string[];
  };
}
```

### Mapping UGC Output → Existing ContentDay

When user clicks "Create Post", map:

```typescript
// UGC Pipeline Output → ContentDay fields
const contentDay: Partial<ContentDay> = {
  theme: productIntel.productName,
  hook: script.selectedHook,
  caption: metadata.tiktok.caption,
  hashtags: metadata.tiktok.hashtags.map(h => h.tag).join(' '),
  cta: script.fullScript.ctaSection.voiceover,
  sceneDescription: visuals.shotPrompts.map(s => s.fullPrompt).join('\n\n'),
  onScreenText: Object.values(script.fullScript).map(s => s.textOverlay).join(' | '),
  musicSuggestion: audio.trendingSoundOptions.find(s => s.recommended)?.soundName || '',
  contentType: 'Video' as ContentType,
  platforms: ['TikTok', 'Instagram'] as Platform[],
  status: 'draft' as ContentStatus,
  location: strategy.setting,
  notes: `UGC Pipeline: ${strategy.hookFormat} hook, ${strategy.contentFormat} format`,
  featuredProducts: [{
    productId: savedProduct.id,
    placementType: 'hero',
    captionMention: 'direct',
    imagePromptInjection: visuals.baseCharacterPrompt
  }],
};
```

---

## 8. Routing

Add to existing PersonaPage tab routing:

```
/persona/:personaId/ugc              → UGCPipelinePage (main UGC tab)
/persona/:personaId/ugc/:runId       → UGCPipelineRunPage (specific run detail)
```

### Navigation
- New tab "UGC" in PersonaPage tab bar (after Products, before Storyline)
- Tab shows list of pipeline runs + "New Video Package" button
- Each run is expandable to show all 6 steps

---

## 9. UI Layout

### UGC Tab — List View

```
┌─────────────────────────────────────────────────────────────┐
│  UGC Video Factory                    [+ New Video Package] │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─ BBL Serum – 3-in-1 Bikini Line Care ──── ✅ Complete ─┐│
│  │  Apr 9 · price_reveal · 20s · 6/6 steps complete       ││
│  │  Hook: "Under twenty dollars fixed my bikini line..."   ││
│  │  [View Package]  [Create Post]  [Regenerate]            ││
│  └─────────────────────────────────────────────────────────┘│
│                                                             │
│  ┌─ Revlon ColorStay Foundation ────────── ⏳ Running ────┐│
│  │  Apr 9 · Step 3/6: Generating script...                 ││
│  │  ━━━━━━━━━━━━━━━━━━━━━░░░░░░░░░  50%                   ││
│  └─────────────────────────────────────────────────────────┘│
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### UGC Tab — Pipeline Run Detail

```
┌───────────────────────────────────────────────────────────────────────┐
│  ← Back to UGC                                       [Auto | ●HITL] │
├───────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  Product URL: [https://amazon.com/dp/B0GG7H8Y52________] [Generate] │
│                                                                       │
│  ── Pipeline Progress ──────────────────────────────────────────────  │
│  ✅ Product Intel (2.1s)  ✅ Strategy (3.4s)  ⏸ Script  ⬜ Visual   │
│  ⬜ Audio  ⬜ Metadata                                                │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━░░░░░░░░░  33%                    │
│                                                                       │
│  ┌─── Step 1: Product Intel ─────────────────── ✅ ──────────────┐  │
│  │  BBL Serum – 3-in-1 Bikini Line Care · $19.99 · beauty_body   │  │
│  │  Features: Salicylic Acid, Niacinamide, Kojic Acid            │  │
│  │  Reviews: ↑ clears ingrowns, lightens spots  ↓ small bottle   │  │
│  │  [Expand]                                                      │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                       │
│  ┌─── Step 2: Strategy ──────────────────────── ✅ ──────────────┐  │
│  │  Hook: price_reveal  Format: product_demo  Length: 20s         │  │
│  │  Setting: bathroom_vanity  Post: Tue 7:15 PM EST              │  │
│  │  [Expand]  [Edit]                                              │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                       │
│  ┌─── Step 3: Script ──────────────────────── ⏸ REVIEW ──────────┐  │
│  │  Selected Hook: "Under $20 fixed my bikini line nightmare"     │  │
│  │  ┌────────────────────────────────────────────────────────┐    │  │
│  │  │ Hook (0-2s):  [curious] Under twenty dollars...        │    │  │
│  │  │ Product (2-14s): [calm] This is the BBL Serum...       │    │  │
│  │  │ Trust (14-18s): [playfully] Full transparency...       │    │  │
│  │  │ CTA (18-20s): [calm] Link is right here...            │    │  │
│  │  └────────────────────────────────────────────────────────┘    │  │
│  │  Word count: 63/70  Duration: ~20s                             │  │
│  │                                                                │  │
│  │  Other hooks:  ○ "POV your bikini line bumps vanish..."  (9)   │  │
│  │                ○ "Nobody talks about why your bikini..."  (9)  │  │
│  │                                                                │  │
│  │  [Accept & Continue]  [Edit Script]  [Pick Different Hook]     │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                       │
│  ┌─── Step 4: Visual Prompts ────────────────── ⬜ Pending ──────┐  │
│  └────────────────────────────────────────────────────────────────┘  │
│  ┌─── Step 5: Audio Direction ───────────────── ⬜ Pending ──────┐  │
│  └────────────────────────────────────────────────────────────────┘  │
│  ┌─── Step 6: Metadata ─────────────────────── ⬜ Pending ──────┐  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                       │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │  [Create Post in Calendar]  [Export JSON]  [Share Link]        │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                       │
└───────────────────────────────────────────────────────────────────────┘
```

---

## 10. API Endpoints (add to server.ts / worker)

```
POST   /api/ugc/runs                    — Create new pipeline run
GET    /api/ugc/runs?personaId=xxx      — List runs for persona
GET    /api/ugc/runs/:runId             — Get run detail
PATCH  /api/ugc/runs/:runId             — Update run (user edits)
DELETE /api/ugc/runs/:runId             — Delete run

POST   /api/ugc/runs/:runId/step/:step  — Trigger specific step
PATCH  /api/ugc/runs/:runId/step/:step  — Edit step output (HITL)

POST   /api/ugc/runs/:runId/create-post — Convert to ContentDay
POST   /api/ugc/scrape                  — Scrape product URL
```

---

## 11. AI Integration

### Current: Gemini (existing in Creator Studio)
- Use Gemini for Steps 1-2 and Step 6 (product intel, strategy, metadata)
- These are classification/generation tasks Gemini handles well

### Future: Claude API (upgrade path)
- Use Claude for Steps 3-5 (script, visuals, audio)
- These require nuanced creative judgment
- Can add as a setting: "AI Provider: Gemini / Claude"

### Prompt Templates
- Store as server-side templates (not client-side)
- Each agent's prompt references the Persona and ProductIntel dynamically
- Character locking prompt built from `persona.appearance` fields

---

## 12. Database Schema (add to SQLite / Supabase)

```sql
CREATE TABLE ugc_runs (
  id TEXT PRIMARY KEY,
  persona_id TEXT NOT NULL REFERENCES personas(id),
  product_url TEXT,
  mode TEXT DEFAULT 'hitl',       -- 'auto' | 'hitl'
  status TEXT DEFAULT 'running',  -- 'running' | 'complete' | 'error'
  data TEXT,                      -- JSON blob: full pipeline output
  content_day_id TEXT,            -- FK to created ContentDay
  created_at INTEGER DEFAULT (unixepoch()),
  completed_at INTEGER
);
```

---

## 13. Build Order

### Phase 1: Core Pipeline (Week 1)
1. Add UGC types to `types.ts`
2. Create `UGCPipelinePage` component (list + new run)
3. Create `UGCPipelineRunPage` component (step cards)
4. Add `/api/ugc/*` endpoints to server.ts
5. Implement Step 1 (Product Intel) with web scraping
6. Implement Step 2 (Strategy) with Gemini
7. Wire up pipeline progress indicator

### Phase 2: Content Generation (Week 2)
8. Implement Step 3 (Script Writer) with Gemini
9. Implement Step 4 (Visual Director) — prompt generation
10. Implement Step 5 (Audio) — ElevenLabs payload formatting
11. Implement Step 6 (Metadata) — caption/hashtag generation
12. Add HITL review gates with edit capability

### Phase 3: Integration (Week 3)
13. "Create Post" → ContentDay mapping
14. Image generation buttons → NanoBanana integration
15. Add UGC tab to PersonaPage routing
16. Pipeline run history and re-generation
17. Share/export functionality

---

## 14. Success Metrics

- Time from URL to complete package: < 60 seconds (auto mode)
- User edit rate per step: track which steps need most human intervention
- Pipeline completion rate: % of runs that reach "Create Post"
- Post performance: track views/engagement of UGC-generated posts vs manual posts

---

*Creator Studio · UGC Video Factory Module PRD*
*Designed to extend, not replace, the existing content creation workflow*
