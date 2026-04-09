# UGC Module — Agent Definitions
## Adapted for Creator Studio Context

Each agent receives the Persona object from Creator Studio's existing data model. Character locking is built from `persona.appearance` and `persona.fashionStyle` fields — no hardcoded character profiles.

---

## Agent 1: ProductIntel (Two Input Modes)

**Trigger:** User provides product info via URL or pasted text.

**Input modes:**
- **Auto Scrape:** User pastes a URL (Amazon, TikTok Shop). System fetches the page and extracts data.
- **Paste Data:** User pastes text from Kalodata, Amazon listing, or types manually. AI structures it.

**System prompt context:**
- Product URL and/or pasted text
- Persona's content niches (from `persona.psychographic.interests`)
- Existing products in persona's catalog (to avoid duplicates)

**Process:**
1. If URL provided and auto-scrape selected → fetch page, extract product data
2. If text provided → parse the pasted text into structured fields
3. Either way, extract: name, brand, price, features, size, variants
4. Classify into category taxonomy:
   - `beauty_face_makeup`, `beauty_eye_makeup`, `beauty_lip`, `beauty_skincare`, `beauty_body`
   - `fashion_clothing`, `fashion_accessories`, `fashion_shoes`
   - `home_kitchen`, `home_decor`
   - `lifestyle_wellness`, `lifestyle_tech`
5. Extract review sentiment if available (top 3 positive, top 3 negative)
6. Structure competitor data if available
7. Determine trending status

**Output:** `ProductIntel` object

**Note:** Auto-scrape is best-effort — some sites block scraping. If it fails, the UI should gracefully fall back to "paste data" mode with a message like "Couldn't fetch that URL. Paste the product details below instead."

**Creator Studio integration:** Auto-saves to persona's Products tab (`Product` type) for reuse.

---

## Agent 2: StrategySelector

**Trigger:** ProductIntel complete.

**System prompt context:**
- ProductIntel output
- Persona profile (tone, aesthetic, niches)
- TargetAudience segments (pain points, content resonance)
- Previous UGC runs for this persona (to vary hook formats)

**Decision tree:**
```
IF price < $20 AND reviews > 100 → price_reveal
ELIF trending → social_proof
ELIF has_unique_feature → discovery
ELIF problem_solver → pov
ELIF competitor_count > 5 → comparison
ELSE → opinion
```

**Output:** `ContentStrategy` object

**HITL gate:** User can override hook format, setting, outfit, posting time.

---

## Agent 3: ScriptWriter

**Trigger:** Strategy complete (or user approves strategy in HITL).

**System prompt context:**
- ProductIntel
- ContentStrategy (hook format, content format, video length)
- Persona voice profile:
  - Tone from `persona.psychographic.coreTraits`
  - Style from `persona.fashionStyle.aesthetic`
  - Mission from `persona.psychographic.mission`

**Process:**
1. Generate 10 hook variations for selected format
2. Score each (specificity 3pts, emotion 3pts, brevity 2pts, scroll-stop 2pts)
3. Select top hook
4. Write 4-section script (hook/product/trust/CTA)
5. Add ElevenLabs expression tags
6. Verify word count 55-70

**Output:** `VideoScript` object

**HITL gate:** User can pick different hook, edit any script section, adjust word count.

---

## Agent 4: VisualDirector

**Trigger:** Script complete. Can run in PARALLEL with Agent 5 (Audio).

**System prompt context:**
- Persona appearance (builds character locking prompt dynamically):
  ```
  From persona.appearance:
  - height, bodyType, faceShape, eyes, hair, distinctFeatures
  From persona.fashionStyle:
  - aesthetic, signatureItems
  From persona.referenceImageUrls:
  - Style reference for consistency
  ```
- ProductIntel (product name, what it looks like)
- VideoScript (what happens in each section)
- ContentStrategy (setting, outfit)

**Dynamic character prompt construction:**
```
"Photorealistic [persona.identity.nationality] [persona.identity.gender],
[persona.identity.age] years old,
[persona.appearance.hair], [persona.appearance.eyes],
[persona.appearance.bodyType] build, [persona.appearance.faceShape] face,
[persona.appearance.distinctFeatures.join(', ')],
[persona.fashionStyle.aesthetic] style,
UGC content creator aesthetic, iPhone 14 Pro quality realism,
high resolution, authentic lifestyle photography"
```

**Process:**
1. Build base character prompt from persona fields
2. Select setting based on product category
3. Generate 5 shot prompts (hook, demo, close-up, reaction, CTA)
4. Each prompt is self-contained with full character description

**Output:** `VisualPackage` object

**Integration:** Each shot prompt has a "Generate Image" button that calls NanoBanana API (existing).

---

## Agent 5: AudioProducer

**Trigger:** Script complete. Can run in PARALLEL with Agent 4 (Visuals).

**System prompt context:**
- VideoScript (full script with expression tags)
- Persona voice traits (from `persona.psychographic.coreTraits`)
- Product category (for sound selection)

**Process:**
1. Format ElevenLabs payload with expression tags
2. Set voice parameters (stability, similarity, style, speed)
3. Recommend 2-3 trending sounds for the product category
4. Provide audio mixing instructions

**Output:** `AudioPackage` object

**Future integration:** Direct ElevenLabs API call (like existing Kling integration pattern — POST + polling).

---

## Agent 6: MetadataBuilder

**Trigger:** Script + Strategy complete. Can run in PARALLEL with Agent 5 (Audio).

**System prompt context:**
- ProductIntel (name, price, features)
- VideoScript (hook, script sections)
- ContentStrategy (hashtag strategy, posting time)
- Persona social handles (from `persona.socialHandles`)

**Process:**
1. Generate TikTok title (max 150 chars)
2. Write TikTok caption (3-4 lines, max 2 emojis)
3. Select exactly 5 hashtags (primary, conversion, product, brand, modifier)
4. Set posting schedule with rationale
5. Create engagement strategy (pinned comment, auto-replies)
6. Generate Instagram caption (longer format, @ mentions)

**Output:** `MetadataPackage` object

**Integration:** Maps directly to ContentDay fields when "Create Post" is clicked.

---

## Parallel Execution Map

```
Step 1: ProductIntel ──────────────────→ (sequential, needs URL)
Step 2: StrategySelector ──────────────→ (sequential, needs ProductIntel)
                    ┌──────────────────→ Step 3: ScriptWriter
                    │                              ↓
                    │                    ┌─────────┴─────────┐
                    │                    ↓                   ↓
                    │            Step 4: Visuals    Step 5: Audio
                    │                    ↓                   ↓
                    │                    └─────────┬─────────┘
                    │                              ↓
                    └──────────────────→ Step 6: MetadataBuilder
```

**Actual dependency graph:**
- Step 1 → Step 2 → Step 3 (must be sequential)
- Step 4 needs Step 3 output (shot prompts reference script)
- Step 5 needs Step 3 output (voice script)
- Step 6 needs Step 3 output (hook, CTA for caption)
- Steps 4, 5, 6 can run in parallel after Step 3

---

## Prompt Template Storage

Store prompt templates server-side in `/api/ugc/prompts/`:

```
server-prompts/
  ugc-product-intel.txt
  ugc-strategy-selector.txt
  ugc-script-writer.txt
  ugc-visual-director.txt
  ugc-audio-producer.txt
  ugc-metadata-builder.txt
```

Each template has `{{placeholder}}` variables filled at runtime:
- `{{persona.appearance}}` — from Persona object
- `{{productIntel}}` — from Step 1 output
- `{{strategy}}` — from Step 2 output
- `{{script}}` — from Step 3 output

This keeps prompts editable without code changes and allows A/B testing different prompt versions.
