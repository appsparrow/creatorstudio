# UGC Module — API Contracts

All endpoints prefixed with `/api/ugc/`.

---

## Pipeline Run CRUD

### POST `/api/ugc/runs`
Create a new pipeline run.

**Request:**
```json
{
  "personaId": "persona_abc123",
  "productUrl": "https://amazon.com/dp/B0GG7H8Y52",
  "productText": "BBL Serum – 3-in-1 Bikini Line Care. $19.99. Salicylic Acid, Niacinamide, Kojic Acid. Fragrance-free. Clears ingrowns, fades dark spots, calms irritation. Reviews say clears ingrowns in a week, takes 2-3 weeks for dark spots. Competitors: European Wax Center ($29), Fur ($32).",
  "mode": "hitl"
}
```

**Note:** Two input modes:
- **Auto scrape:** Provide `productUrl`, leave `productText` empty. System fetches and extracts.
- **Paste data:** Provide `productText` (from Kalodata, Amazon, manual). `productUrl` optional for reference.
- Both can be provided — text takes priority, URL stored for reference.

**Response:**
```json
```

**Response:**
```json
{
  "id": "run_20260409_001",
  "personaId": "persona_abc123",
  "productUrl": "https://amazon.com/dp/B0GG7H8Y52",
  "mode": "hitl",
  "status": "running",
  "startedAt": "2026-04-09T18:30:00Z",
  "steps": [
    { "name": "product_intel", "status": "running" },
    { "name": "strategy", "status": "pending" },
    { "name": "script", "status": "pending" },
    { "name": "visuals", "status": "pending" },
    { "name": "audio", "status": "pending" },
    { "name": "metadata", "status": "pending" }
  ]
}
```

### GET `/api/ugc/runs?personaId=xxx`
List all runs for a persona.

**Response:**
```json
{
  "runs": [
    {
      "id": "run_20260409_001",
      "productName": "BBL Serum – 3-in-1 Bikini Line Care",
      "status": "complete",
      "mode": "hitl",
      "hookFormat": "price_reveal",
      "selectedHook": "Under twenty dollars fixed my bikini line nightmare",
      "startedAt": "2026-04-09T18:30:00Z",
      "completedAt": "2026-04-09T18:31:02Z",
      "stepsComplete": 6,
      "stepsTotal": 6,
      "contentDayId": null
    }
  ]
}
```

### GET `/api/ugc/runs/:runId`
Full run detail with all step outputs.

**Response:** Full `UGCPipelineRun` object (see types in PRD).

### DELETE `/api/ugc/runs/:runId`
Delete a run and its data.

---

## Pipeline Step Execution

### POST `/api/ugc/runs/:runId/step/:stepName`
Trigger a specific step. In auto mode, steps auto-chain. In HITL mode, each step requires explicit trigger.

**stepName values:** `product_intel`, `strategy`, `script`, `visuals`, `audio`, `metadata`

**Request (step depends on which):**

#### Step 1: product_intel
```json
{
  "productUrl": "https://amazon.com/dp/B0GG7H8Y52",
  "productText": "Paste from Kalodata or Amazon or manual input. AI will structure this into clean data."
}
```

**Response:**
```json
{
  "step": "product_intel",
  "status": "complete",
  "durationMs": 2100,
  "output": {
    "productName": "BBL Serum – 3-in-1 Bikini Line Care",
    "brand": "The Bikini Line Co.",
    "category": "beauty_body",
    "subcategory": "intimate_skincare",
    "price": 19.99,
    "currency": "USD",
    "size": "1.7 fl oz",
    "keyFeatures": ["Salicylic Acid", "Niacinamide", "Kojic Acid", "Fragrance-free", "Sensitive skin safe"],
    "primaryBenefit": "Reduces ingrown bumps, fades dark spots, calms irritation after shaving/waxing",
    "painPointsSolved": ["ingrown hairs", "bikini line darkening", "razor bumps", "post-wax irritation"],
    "reviewSentiment": {
      "positive": ["clears ingrowns within a week", "lightens dark spots", "huge reduction in irritation", "lightweight"],
      "negative": ["takes 14-21 days for full results", "small bottle for the price"]
    },
    "competitorProducts": [
      { "name": "European Wax Center Ingrown Hair Serum", "price": 29.00 },
      { "name": "Fur Ingrown Concentrate", "price": 32.00 },
      { "name": "Tend Skin Solution", "price": 16.00 }
    ],
    "targetAudience": "Women 18-35 who shave/wax bikini area",
    "trendingStatus": true,
    "sourceUrl": "https://amazon.com/dp/B0GG7H8Y52"
  }
}
```

#### Step 2: strategy
```json
{}
```
(Uses product_intel output from previous step + persona data)

**Response:**
```json
{
  "step": "strategy",
  "status": "complete",
  "durationMs": 3400,
  "output": {
    "hookFormat": "price_reveal",
    "hookRationale": "Product is $19.99 (under $20), creates impulse trigger",
    "contentFormat": "product_demo",
    "contentRationale": "Body care = needs visual proof of texture/application",
    "videoLength": "20s",
    "setting": "bathroom_vanity",
    "characterOutfit": "cream ribbed tank top, hair pulled back, spa-day aesthetic",
    "optimalPostingTime": "7:00 PM EST Tuesday",
    "postingRationale": "Beauty content peaks during evening self-care hours",
    "hashtagStrategy": {
      "primary": "#bikinilinecare",
      "conversion": "#tiktokmademebuyit",
      "product": "#bblserum",
      "brand": "#thebikinilineco",
      "modifier": "#darkspotremoval"
    }
  }
}
```

#### Step 3: script
```json
{}
```

**Response:**
```json
{
  "step": "script",
  "status": "complete",
  "durationMs": 4200,
  "output": {
    "hookVariants": [
      { "hook": "Under twenty dollars fixed my bikini line nightmare", "score": 9, "rationale": "Price anchor + emotional 'nightmare' word" },
      { "hook": "POV your bikini line bumps vanish in one week", "score": 9, "rationale": "Specific timeframe backed by reviews" }
    ],
    "selectedHook": "Under twenty dollars fixed my bikini line nightmare",
    "fullScript": {
      "hookSection": {
        "timing": "0-2s",
        "wordCount": 8,
        "textOverlay": "UNDER $20",
        "voiceover": "[curious] Under twenty dollars fixed my bikini line nightmare.",
        "visualCue": "Sofia holds up BBL Serum bottle, eyebrows raised"
      },
      "productSection": {
        "timing": "2-14s",
        "wordCount": 33,
        "textOverlay": "Salicylic Acid + Niacinamide + Kojic Acid | $19.99",
        "voiceover": "[calm] This is the BBL Serum — salicylic acid, niacinamide, and kojic acid in one fragrance-free bottle. It fades dark spots, kills ingrowns, and calms irritation after every single shave. Under twenty dollars on TikTok Shop.",
        "visualCue": "Application demo, product close-up"
      },
      "trustSection": {
        "timing": "14-18s",
        "wordCount": 16,
        "textOverlay": "~2 weeks for dark spots | ingrowns gone in DAYS",
        "voiceover": "[playfully] Full transparency — it took about two weeks for dark spots. But the ingrowns? Gone in days.",
        "visualCue": "Genuine reaction, casual shrug"
      },
      "ctaSection": {
        "timing": "18-20s",
        "wordCount": 9,
        "textOverlay": "LINK IN BIO / TAP BELOW",
        "voiceover": "[calm] Link is right here — grab it before summer.",
        "visualCue": "Holding product, pointing at camera"
      }
    },
    "totalWordCount": 63,
    "estimatedDuration": "20s",
    "elevenlabsFullScript": "[curious] Under twenty dollars fixed my bikini line nightmare. [calm] This is the BBL Serum — salicylic acid, niacinamide, and kojic acid in one fragrance-free bottle. It fades dark spots, kills ingrowns, and calms irritation after every single shave. Under twenty dollars on TikTok Shop. [playfully] Full transparency — it took about two weeks for dark spots. But the ingrowns? Gone in days. [calm] Link is right here — grab it before summer.",
    "elevenlabsSettings": {
      "voiceStability": 0.42,
      "voiceClarity": 0.78,
      "style": "conversational_ugc"
    }
  }
}
```

#### Step 4: visuals
**Response:** `VisualPackage` with 5 shot prompts (see sample data).

#### Step 5: audio
**Response:** `AudioPackage` with ElevenLabs payload + sound recommendations.

#### Step 6: metadata
**Response:** `MetadataPackage` with TikTok + Instagram metadata.

---

## HITL Edit Endpoint

### PATCH `/api/ugc/runs/:runId/step/:stepName`
Edit a step's output (human-in-the-loop).

**Request:**
```json
{
  "edits": {
    "hookFormat": "pov",
    "hookRationale": "User override: wants POV format for this product"
  }
}
```

**Response:**
```json
{
  "step": "strategy",
  "status": "edited",
  "output": { "...merged output with edits..." },
  "downstreamInvalidated": ["script", "visuals", "audio", "metadata"]
}
```

Note: Editing a step invalidates all downstream steps. They must be re-run.

---

## Create Post

### POST `/api/ugc/runs/:runId/create-post`
Convert a completed pipeline run into a ContentDay.

**Request:**
```json
{
  "date": "2026-04-15",
  "platforms": ["TikTok", "Instagram"]
}
```

**Response:**
```json
{
  "contentDayId": "day_abc123",
  "status": "draft",
  "message": "ContentDay created. View in calendar."
}
```

---

## Standalone Product Intel

### POST `/api/ugc/parse`
Parse product info outside of a pipeline run (for previewing before starting a run).

**Request:**
```json
{
  "url": "https://amazon.com/dp/B0GG7H8Y52",
  "text": "BBL Serum – 3-in-1 Bikini Line Care. $19.99. Salicylic Acid, Niacinamide...",
  "mode": "paste"
}
```

**mode:** `"scrape"` (fetch URL) or `"paste"` (parse text). If scrape fails, returns error with suggestion to paste instead.

**Response:** Same as Step 1 `product_intel` output.
