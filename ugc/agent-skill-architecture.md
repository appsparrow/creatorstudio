# UGC Content Factory — Agent & Skill Architecture
## Digital Marketing Agency System Design

---

## 🎯 SYSTEM OVERVIEW

**Vision:** End-to-end UGC content generation from product URL → published TikTok/Instagram video

**Input:** Product link (Amazon/TikTok/AliExpress) OR product text dump
**Output:** Complete video package (images, script, audio, metadata)

**Execution Options:**
1. **Claude-native:** Use MCP servers + skills within claude.ai
2. **Standalone product:** API-based service with agent orchestration

---

## 🤖 AGENT ARCHITECTURE

### Agent Naming Convention: `DM_[Function]_Agent`
### Skill Naming Convention: `DM_[Capability]_Skill`

---

## 📋 CORE AGENTS (6 Total)

### 1. DM_ProductIntel_Agent
**Role:** Product research and intelligence gathering  
**責任:** Extract product details, pricing, reviews, competitor analysis

**Skills Used:**
- `DM_ProductScraper_Skill` — Extract from Amazon/TikTok/Shopify URLs
- `DM_ReviewAnalyzer_Skill` — Analyze customer reviews for pain points
- `DM_CompetitorMapper_Skill` — Find similar products and pricing
- `DM_ProductCategorizer_Skill` — Auto-classify product type (beauty/fashion/home)

**Input:**
```json
{
  "product_url": "https://amazon.com/dp/B08XYZ",
  "OR": "product_text_dump": "Revlon ColorStay Foundation..."
}
```

**Output:**
```json
{
  "product_name": "Revlon ColorStay Makeup Foundation",
  "category": "beauty_face_makeup",
  "subcategory": "foundation",
  "price": 14.99,
  "currency": "USD",
  "key_features": ["24hr wear", "SPF 15", "doesn't oxidize"],
  "available_shades": ["Ivory", "Buff", "Medium Beige", "..."],
  "primary_benefit": "Long-lasting coverage without oxidation",
  "pain_points_solved": ["makeup fading", "color changing", "oily skin"],
  "review_sentiment": {
    "positive": ["lasts all day", "doesn't oxidize", "affordable"],
    "negative": ["pump dispenser stiff", "limited shade range"]
  },
  "competitor_products": [
    {"name": "Maybelline Fit Me", "price": 8.99},
    {"name": "L'Oreal Infallible", "price": 12.99}
  ],
  "target_audience": "budget-conscious makeup buyers, oily/combo skin",
  "occasion_tags": ["everyday wear", "work makeup", "long shifts"]
}
```

---

### 2. DM_StrategySelector_Agent
**Role:** Content strategy and format selection  
**責任:** Choose viral hook, content format, posting strategy based on product intel

**Skills Used:**
- `DM_HookMatcher_Skill` — Match product to optimal viral hook format
- `DM_FormatSelector_Skill` — Select content format (demo/try-on/comparison)
- `DM_TrendAnalyzer_Skill` — Check current TikTok trends for product category
- `DM_AudienceMapper_Skill` — Map product → target audience intent

**Input:**
```json
{
  "product_intel": { /* from DM_ProductIntel_Agent */ },
  "character_profile": {
    "name": "Sofia Laurent",
    "niche": ["fashion", "beauty"],
    "tone": "warm, knowledgeable, approachable"
  },
  "constraints": {
    "video_length": "15-20s",
    "posting_frequency": "3/day"
  }
}
```

**Output:**
```json
{
  "hook_format": "price_reveal",
  "hook_rationale": "Product is $14.99 (under $20), creates impulse trigger",
  "content_format": "product_demo",
  "content_rationale": "Makeup = needs visual proof, demo shows application",
  "video_length": "20s",
  "setting": "bathroom_vanity",
  "character_outfit": "bathrobe or casual home wear",
  "optimal_posting_time": "7:00 AM EST",
  "posting_rationale": "Beauty content performs best during morning routine hours",
  "trending_sounds": [
    {"name": "Aesthetic Vibes", "url": "tiktok.com/@aestheticsounds/123", "usage_count": 125000}
  ],
  "hashtag_strategy": {
    "primary": "#makeup",
    "conversion": "#tiktokmademebuyit",
    "product": "#foundation",
    "brand": "#sofialaurent",
    "modifier": "#drugstorebeauty"
  }
}
```

---

### 3. DM_ScriptWriter_Agent
**Role:** Video script and voiceover generation  
**責任:** Write hooks, voiceover scripts, timing breakdowns

**Skills Used:**
- `DM_HookGenerator_Skill` — Generate 10 hook variations per format
- `DM_ScriptStructurer_Skill` — Build 20s script with timing (hook/product/trust/CTA)
- `DM_VoiceDirector_Skill` — Add ElevenLabs expression tags for natural delivery
- `DM_CaptionOptimizer_Skill` — Create on-screen text overlays

**Input:**
```json
{
  "product_intel": { /* from DM_ProductIntel_Agent */ },
  "strategy": { /* from DM_StrategySelector_Agent */ },
  "character_voice_profile": {
    "tone": "calm, curious, playful",
    "pacing": "natural conversational",
    "emphasis_style": "subtle, not dramatic"
  }
}
```

**Output:**
```json
{
  "hook_variants": [
    "I spent $15 on this foundation and I'm never going back",
    "This $15 foundation is better than my $60 one",
    "I've been gatekeeping this $15 foundation for months"
  ],
  "selected_hook": "I spent $15 on this foundation and I'm never going back",
  "full_script": {
    "hook_section": {
      "timing": "0-2s",
      "text_overlay": "I spent $15 on this foundation and I'm never going back",
      "voiceover": "[curious] I spent fifteen dollars on this foundation and I'm never going back. [pause]",
      "visual_cue": "Sofia holding bottle, surprised expression"
    },
    "product_section": {
      "timing": "2-14s",
      "text_overlay": "Revlon ColorStay • $14.99",
      "voiceover": "[calm] This is the Revlon ColorStay in Medium Beige. It's got SPF fifteen, actually lasts all day, and here's the thing [continues after a beat] it doesn't oxidize. [pause] I'm wearing it right now. No touch-ups since seven a.m.",
      "visual_cue": "Applying to face, product close-up, showing result"
    },
    "trust_section": {
      "timing": "14-18s",
      "text_overlay": "only issue: pump is stiff",
      "voiceover": "[playfully] The only thing? [pause] The pump dispenser is a little stiff at first. [deadpan] But honestly, for fifteen bucks and this formula? I don't even care.",
      "visual_cue": "Touching face, genuine reaction"
    },
    "cta_section": {
      "timing": "18-20s",
      "text_overlay": "🔗 Tap product tag",
      "voiceover": "[calm] Link in bio or tap the product tag right here.",
      "visual_cue": "Holding bottle, pointing at camera"
    }
  },
  "word_count": 68,
  "estimated_duration": "20s",
  "elevenlabs_settings": {
    "voice_stability": 0.65,
    "voice_clarity": 0.75,
    "style": "conversational_ugc"
  }
}
```

---

### 4. DM_VisualDirector_Agent
**Role:** Image generation and visual consistency  
**責任:** Create Freepik prompts, maintain character consistency, shot composition

**Skills Used:**
- `DM_CharacterLocker_Skill` — Maintain consistent character across all images
- `DM_PromptBuilder_Skill` — Generate Freepik/Midjourney prompts
- `DM_SceneComposer_Skill` — Set up shots based on product type and setting
- `DM_ProductPlacer_Skill` — Determine product placement in each shot

**Input:**
```json
{
  "character_profile": {
    "base_prompt": "Photorealistic French woman, late 20s, warm olive skin...",
    "locked_features": {
      "hair": "shoulder-length dark chestnut brown, natural wave",
      "skin_tone": "warm olive",
      "age": "27-29",
      "style": "minimalist chic"
    }
  },
  "product_intel": { /* from DM_ProductIntel_Agent */ },
  "script": { /* from DM_ScriptWriter_Agent */ },
  "strategy": { /* from DM_StrategySelector_Agent */ }
}
```

**Output:**
```json
{
  "base_character_prompt": "Photorealistic French woman with Mediterranean features, late twenties (27-29), warm olive skin tone, shoulder-length dark chestnut brown hair with natural wave, minimal makeup with defined brows, soft diffused natural window lighting, neutral clean background, looking directly at camera with warm confident expression, UGC content creator aesthetic, iPhone 14 Pro quality realism, high resolution, natural skin texture with subtle freckles, authentic lifestyle photography",
  
  "shot_prompts": [
    {
      "shot_id": "shot_1_hook",
      "timing": "0-2s",
      "purpose": "hook_frame",
      "full_prompt": "[BASE_PROMPT] + white marble bathroom countertop background, looking directly at camera with surprised knowing expression, holding Revlon ColorStay foundation bottle in right hand close to camera, product label clearly visible facing camera, shallow depth of field with product in sharp focus",
      "composition_notes": "Product takes 40% of frame, Sofia's face 60%, eye contact direct",
      "lighting": "soft natural window light from left",
      "props": ["Revlon ColorStay bottle", "marble countertop"]
    },
    {
      "shot_id": "shot_2_application",
      "timing": "2-8s",
      "purpose": "product_demo",
      "full_prompt": "[BASE_PROMPT] + bathroom mirror in background, mid-shot framing showing face and shoulders, applying foundation to cheek with finger, Revlon ColorStay bottle visible on marble counter, natural hand placement, makeup application in progress showing before/during state, authentic bathroom setting with soft towels visible",
      "composition_notes": "Face centered, application visible, product in background context",
      "lighting": "soft natural window light",
      "props": ["Revlon ColorStay bottle", "bathroom mirror", "towels"]
    },
    {
      "shot_id": "shot_3_product_closeup",
      "timing": "8-10s",
      "purpose": "product_detail",
      "full_prompt": "Close-up shot of Revlon ColorStay foundation bottle on white marble bathroom counter, product label 'Medium Beige' readable, SPF 15 marking visible, woman's hand with natural manicure holding pump dispenser, soft natural window light creating slight reflection on glass bottle, shallow depth of field, lifestyle product photography",
      "composition_notes": "Product hero shot, 70% of frame, hand adds human element",
      "lighting": "soft natural with slight reflection",
      "props": ["Revlon ColorStay bottle"]
    },
    {
      "shot_id": "shot_4_result",
      "timing": "10-16s",
      "purpose": "reaction_proof",
      "full_prompt": "[BASE_PROMPT] + fresh foundation makeup applied evenly, bathroom mirror visible in background, looking at camera with genuine pleased expression, touching own cheek with fingertips to show skin texture, Revlon ColorStay bottle still visible on counter, natural 'checking my makeup' pose, authentic bathroom setting",
      "composition_notes": "Face 70%, showing foundation result, product contextual",
      "lighting": "soft natural window light",
      "props": ["Revlon ColorStay bottle", "mirror"]
    },
    {
      "shot_id": "shot_5_cta",
      "timing": "16-20s",
      "purpose": "call_to_action",
      "full_prompt": "[BASE_PROMPT] + fresh foundation makeup applied, neutral bathroom background, looking directly at camera with warm inviting smile, holding Revlon ColorStay bottle at mid-chest height showing label, friendly gesture with other hand pointing toward camera, 'tap to shop' energy, engaging direct eye contact",
      "composition_notes": "Direct eye contact, product visible, inviting gesture",
      "lighting": "soft natural window light",
      "props": ["Revlon ColorStay bottle"]
    }
  ],
  
  "consistency_checklist": [
    "Same face structure across all 5 shots",
    "Identical hair color, length, style",
    "Consistent skin tone and lighting warmth",
    "Same bathroom setting elements",
    "Natural progression (no makeup → applying → finished)"
  ],
  
  "image_generation_settings": {
    "platform": "freepik",
    "resolution": "1080x1920",
    "aspect_ratio": "9:16",
    "quality": "high",
    "style": "photorealistic_ugc"
  }
}
```

---

### 5. DM_AudioProducer_Agent
**Role:** Audio generation and optimization  
**責任:** Generate voiceover, select trending sounds, audio mixing direction

**Skills Used:**
- `DM_VoiceCloner_Skill` — Clone/select character voice in ElevenLabs
- `DM_AudioMixer_Skill` — Layer voiceover + trending sound
- `DM_SoundLibrary_Skill` — Pull trending TikTok sounds for product category
- `DM_PacingOptimizer_Skill` — Adjust delivery speed for 20s target

**Input:**
```json
{
  "script": { /* from DM_ScriptWriter_Agent */ },
  "character_voice_id": "sofia_laurent_v1",
  "product_category": "beauty_face_makeup",
  "video_length": "20s"
}
```

**Output:**
```json
{
  "elevenlabs_payload": {
    "voice_id": "sofia_laurent_v1",
    "text": "[curious] I spent fifteen dollars on this foundation and I'm never going back. [pause] [calm] This is the Revlon ColorStay in Medium Beige. It's got SPF fifteen, actually lasts all day, and here's the thing [continues after a beat] it doesn't oxidize. [pause] I'm wearing it right now. No touch-ups since seven a.m. [pause] [playfully] The only thing? [pause] The pump dispenser is a little stiff at first. [deadpan] But honestly, for fifteen bucks and this formula? I don't even care. [pause] [calm] Link in bio or tap the product tag right here.",
    "voice_settings": {
      "stability": 0.65,
      "similarity_boost": 0.75,
      "style": 0.5,
      "use_speaker_boost": true
    },
    "output_format": "mp3_44100_128"
  },
  
  "trending_sound_options": [
    {
      "sound_name": "Aesthetic Vibes - Chill",
      "tiktok_url": "tiktok.com/@aestheticsounds/sound/123",
      "duration": "30s",
      "usage_count": 125000,
      "trend_status": "rising",
      "category_fit": "beauty_lifestyle",
      "recommended": true
    },
    {
      "sound_name": "Morning Routine Beat",
      "tiktok_url": "tiktok.com/@morningvibes/sound/456",
      "duration": "20s",
      "usage_count": 89000,
      "trend_status": "stable",
      "category_fit": "beauty_morning"
    }
  ],
  
  "audio_mixing_instructions": {
    "voiceover_volume": "100%",
    "background_sound_volume": "30%",
    "fade_in_duration": "0.5s",
    "fade_out_duration": "0.5s",
    "voiceover_priority": true,
    "ducking_enabled": false
  },
  
  "final_audio_specs": {
    "total_duration": "20s",
    "format": "mp3",
    "sample_rate": "44100 Hz",
    "bitrate": "128 kbps",
    "channels": "stereo"
  }
}
```

---

### 6. DM_MetadataBuilder_Agent
**Role:** TikTok/Instagram metadata generation  
**責任:** Create titles, captions, hashtags, posting strategy

**Skills Used:**
- `DM_CaptionWriter_Skill` — Generate platform-optimized captions
- `DM_HashtagOptimizer_Skill` — Select high-performing hashtag mix
- `DM_PostScheduler_Skill` — Recommend optimal posting times
- `DM_AffiliateLinker_Skill` — Format affiliate links for TikTok Shop

**Input:**
```json
{
  "product_intel": { /* from DM_ProductIntel_Agent */ },
  "script": { /* from DM_ScriptWriter_Agent */ },
  "strategy": { /* from DM_StrategySelector_Agent */ },
  "platform": "tiktok"
}
```

**Output:**
```json
{
  "tiktok_metadata": {
    "title": "I spent $15 on this foundation and I'm never going back | Revlon ColorStay review #makeup #tiktokmademebuyit",
    "title_length": 112,
    
    "caption": "I spent $15 on this foundation and I'm never going back 🔗\n\nRevlon ColorStay • Medium Beige • $14.99\nDoesn't oxidize + SPF 15 + actually lasts\n\nShop below 👇\n\n#makeup #tiktokmademebuyit #foundation #sofialaurent #drugstorebeauty",
    "caption_length": 198,
    
    "hashtags": [
      {
        "tag": "#makeup",
        "type": "primary_niche",
        "views": "890M",
        "competition": "high",
        "rationale": "Broad beauty audience"
      },
      {
        "tag": "#tiktokmademebuyit",
        "type": "conversion",
        "views": "45B",
        "competition": "very_high",
        "rationale": "Shopping intent signal"
      },
      {
        "tag": "#foundation",
        "type": "product_specific",
        "views": "12.3B",
        "competition": "high",
        "rationale": "Direct product category"
      },
      {
        "tag": "#sofialaurent",
        "type": "brand",
        "views": "0",
        "competition": "none",
        "rationale": "Build searchable brand"
      },
      {
        "tag": "#drugstorebeauty",
        "type": "modifier",
        "views": "2.1B",
        "competition": "medium",
        "rationale": "Target budget-conscious audience"
      }
    ],
    
    "product_tags": [
      {
        "product_name": "Revlon ColorStay Makeup Foundation",
        "shade": "Medium Beige",
        "price": "$14.99",
        "shop_link": "tiktok.com/shop/product/123456",
        "tag_placement": "bottom_left",
        "tag_timing": "appears_at_8s"
      }
    ],
    
    "posting_schedule": {
      "optimal_time": "7:00 AM EST",
      "timezone": "America/New_York",
      "day_of_week": "Thursday",
      "rationale": "Beauty content peaks during morning routine hours (6-9am)",
      "backup_times": ["12:00 PM EST", "7:00 PM EST"]
    },
    
    "engagement_strategy": {
      "pin_comment": "What shade should I try next? 👀",
      "auto_reply_triggers": [
        {"keyword": "link", "response": "Link in bio! 🔗 Or tap the product tag on the video"},
        {"keyword": "shade", "response": "I'm wearing Medium Beige! Check the product tag for all shades 💕"}
      ],
      "first_hour_monitoring": true
    }
  },
  
  "instagram_metadata": {
    "caption": "I spent $15 on this foundation and I'm never going back ✨\n\n@revlon ColorStay in Medium Beige • $14.99\n• Doesn't oxidize\n• SPF 15\n• 24hr wear\n\nLink in bio to shop 🔗\n\n#makeup #makeuptutorial #foundation #affordablebeauty #beautyfinds #drugstoremakeup #revlon #sofialaurent",
    "hashtag_limit": "30_max",
    "hashtags_used": 8,
    "product_tags": ["@revlon"],
    "link_in_bio": "linktr.ee/sofialaurent"
  },
  
  "affiliate_tracking": {
    "tiktok_shop_link": "tiktok.com/shop/product/123456?affiliate=sofia_laurent",
    "amazon_affiliate": "amzn.to/revlon-colorstay",
    "linktree_backup": "linktr.ee/sofialaurent/revlon-foundation"
  }
}
```

---

## 🛠️ CORE SKILLS (15 Total)

### Product Intelligence Skills

#### DM_ProductScraper_Skill
**Function:** Extract product data from URLs  
**Supports:** Amazon, TikTok Shop, Shopify, AliExpress  
**Output:** Structured product JSON

**Implementation:**
```python
def scrape_product(url: str) -> dict:
    # Uses web scraping + AI to extract:
    # - Product name, price, images
    # - Features, specifications
    # - Reviews and ratings
    # - Available variants (colors/sizes)
    return product_data
```

#### DM_ReviewAnalyzer_Skill
**Function:** Analyze customer reviews for insights  
**Output:** Pain points, benefits, sentiment analysis

**Implementation:**
```python
def analyze_reviews(reviews: list) -> dict:
    # AI summarization of reviews:
    # - Most mentioned benefits
    # - Common complaints
    # - Emotional sentiment
    # - Purchase motivations
    return review_insights
```

#### DM_CompetitorMapper_Skill
**Function:** Find similar/competing products  
**Output:** Price comparison, feature matrix

#### DM_ProductCategorizer_Skill
**Function:** Auto-classify product into content categories  
**Output:** Category, subcategory, content recommendations

---

### Strategy Skills

#### DM_HookMatcher_Skill
**Function:** Match product to optimal viral hook format  
**Logic Decision Tree:**
```
IF product.price < 20 AND product.reviews > 100:
    → hook_format = "price_reveal"
ELIF product.trending = True:
    → hook_format = "social_proof"
ELIF product.has_unique_feature = True:
    → hook_format = "discovery"
ELIF product.competitor_count > 5:
    → hook_format = "comparison"
ELSE:
    → hook_format = "pov"
```

**Output:** Hook format + rationale

#### DM_FormatSelector_Skill
**Function:** Select content format based on product type  
**Mapping:**
```
beauty_face_makeup → product_demo (15-20s)
beauty_skincare → product_demo (15-20s) OR before_after (30s)
fashion_clothing → try_on (20-30s)
fashion_accessories → styling_list (20-30s)
home_organization → transformation (30s)
```

#### DM_TrendAnalyzer_Skill
**Function:** Check current TikTok trends  
**Data Sources:** TikTok Creative Center, trending sounds, hashtag volume  
**Output:** Trending sounds, hashtags, content styles

#### DM_AudienceMapper_Skill
**Function:** Map product to target audience intent  
**Output:** Audience profile, purchase intent level, content angle

---

### Content Creation Skills

#### DM_HookGenerator_Skill
**Function:** Generate 10 hook variations per format  
**Input:** Product data + hook format  
**Output:** 10 hooks ranked by predicted performance

**Example Output:**
```json
{
  "hook_format": "price_reveal",
  "variations": [
    {
      "hook": "I spent $15 on this foundation and I'm never going back",
      "score": 9.2,
      "rationale": "Strong commitment phrase, price anchor clear"
    },
    {
      "hook": "This $15 foundation is better than my $60 one",
      "score": 8.8,
      "rationale": "Direct comparison, implies value"
    }
    // ... 8 more
  ]
}
```

#### DM_ScriptStructurer_Skill
**Function:** Build timed script with all sections  
**Structure:** Hook (0-2s) → Product (2-12s) → Trust (12-18s) → CTA (18-20s)  
**Output:** Full script with timing, text overlays, visual cues

#### DM_VoiceDirector_Skill
**Function:** Add ElevenLabs expression tags  
**Tags:** [curious], [calm], [playfully], [deadpan], [pause], [continues after a beat]  
**Output:** Script with natural delivery markers

#### DM_CaptionOptimizer_Skill
**Function:** Create on-screen text overlays  
**Optimization:** Readability, timing, platform best practices

---

### Visual Skills

#### DM_CharacterLocker_Skill
**Function:** Maintain character consistency  
**Locked Elements:** Face, hair, skin tone, age, style  
**Variable Elements:** Outfit, expression, setting  
**Output:** Base prompt + shot-specific variations

#### DM_PromptBuilder_Skill
**Function:** Generate image generation prompts  
**Platforms:** Freepik, Midjourney, DALL-E, Stable Diffusion  
**Output:** Platform-specific prompts with composition notes

#### DM_SceneComposer_Skill
**Function:** Set up shots based on product + setting  
**Shot Types:** Hook, demo, close-up, reaction, CTA  
**Output:** Shot list with composition, lighting, props

#### DM_ProductPlacer_Skill
**Function:** Determine product placement in each shot  
**Rules:** Product visible by 8s, hero shot at key moment, contextual placement

---

### Audio & Metadata Skills

#### DM_VoiceCloner_Skill
**Function:** Clone/select character voice  
**Platform:** ElevenLabs API  
**Output:** Voice ID, settings, test audio

#### DM_AudioMixer_Skill
**Function:** Layer voiceover + trending sound  
**Mixing Rules:** Voiceover 100%, background 30%, ducking optional

#### DM_SoundLibrary_Skill
**Function:** Pull trending TikTok sounds  
**Filters:** Category, usage count, trend status  
**Output:** Ranked sound options with metadata

#### DM_CaptionWriter_Skill
**Function:** Generate platform-optimized captions  
**Platforms:** TikTok, Instagram, YouTube Shorts  
**Output:** Caption with line breaks, emojis, CTA

#### DM_HashtagOptimizer_Skill
**Function:** Select high-performing hashtag mix  
**Strategy:** 1 primary + 1 conversion + 1 product + 1 brand + 1 modifier  
**Output:** 3-5 hashtags with rationale

#### DM_PostScheduler_Skill
**Function:** Recommend optimal posting times  
**Data:** Category performance, audience timezone, competition  
**Output:** Primary + backup posting times

---

## 🔄 AGENT ORCHESTRATION WORKFLOW

### Master Workflow: Product URL → Published Video

```
┌─────────────────────────────────────────────────────────────┐
│ INPUT: Product URL or Text Dump + Character Profile        │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ AGENT 1: DM_ProductIntel_Agent                             │
│ Skills: ProductScraper, ReviewAnalyzer, Categorizer        │
│ Output: Structured product data + competitive intel        │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ AGENT 2: DM_StrategySelector_Agent                         │
│ Skills: HookMatcher, FormatSelector, TrendAnalyzer         │
│ Output: Hook format + content format + posting strategy    │
└─────────────────────────────────────────────────────────────┘
                            ↓
                    ┌───────┴───────┐
                    ↓               ↓
┌──────────────────────────┐  ┌──────────────────────────┐
│ AGENT 3:                 │  │ AGENT 4:                 │
│ DM_ScriptWriter_Agent    │  │ DM_VisualDirector_Agent  │
│ Skills: HookGenerator,   │  │ Skills: CharacterLocker, │
│ ScriptStructurer,        │  │ PromptBuilder,           │
│ VoiceDirector            │  │ SceneComposer            │
│ Output: Full script +    │  │ Output: 5 image prompts  │
│ timing + audio tags      │  │ + consistency rules      │
└──────────────────────────┘  └──────────────────────────┘
                    ↓               ↓
                    └───────┬───────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ AGENT 5: DM_AudioProducer_Agent                            │
│ Skills: VoiceCloner, AudioMixer, SoundLibrary              │
│ Output: ElevenLabs payload + trending sound + mixing      │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ AGENT 6: DM_MetadataBuilder_Agent                          │
│ Skills: CaptionWriter, HashtagOptimizer, PostScheduler     │
│ Output: Title, caption, hashtags, posting time, links      │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ OUTPUT: Complete Video Package                             │
│ - 5 Freepik image prompts                                  │
│ - Full script with timing                                  │
│ - ElevenLabs audio direction                               │
│ - TikTok/Instagram metadata                                │
│ - Posting schedule                                         │
└─────────────────────────────────────────────────────────────┘
```

---

## 💾 DATA MODELS

### Character Profile Schema
```json
{
  "character_id": "sofia_laurent_v1",
  "name": "Sofia Laurent",
  "locked_visual_profile": {
    "base_prompt": "Photorealistic French woman...",
    "age_range": "27-29",
    "ethnicity": "French Mediterranean",
    "skin_tone": "warm olive",
    "hair": "shoulder-length dark chestnut brown, natural wave",
    "style_aesthetic": "minimalist chic, neutral earth tones"
  },
  "voice_profile": {
    "elevenlabs_voice_id": "sofia_v1_123abc",
    "tone": ["warm", "knowledgeable", "approachable"],
    "pacing": "natural conversational",
    "accent": "slight French influence"
  },
  "content_niches": ["fashion", "beauty"],
  "brand_personality": {
    "archetype": "the_informed_friend",
    "values": ["authenticity", "affordability", "quality"],
    "tone_guidelines": "warm but not overly friendly, knowledgeable but not preachy"
  }
}
```

### Video Package Schema
```json
{
  "package_id": "pkg_20260410_001",
  "character_id": "sofia_laurent_v1",
  "product_id": "revlon_colorstay_medium_beige",
  "creation_date": "2026-04-10",
  
  "product_intel": { /* from DM_ProductIntel_Agent */ },
  "strategy": { /* from DM_StrategySelector_Agent */ },
  "script": { /* from DM_ScriptWriter_Agent */ },
  "visuals": { /* from DM_VisualDirector_Agent */ },
  "audio": { /* from DM_AudioProducer_Agent */ },
  "metadata": { /* from DM_MetadataBuilder_Agent */ },
  
  "production_status": "ready_for_export",
  "estimated_production_time": "45 minutes",
  "platforms": ["tiktok", "instagram_reels"],
  
  "performance_predictions": {
    "expected_views_24h": "3000-8000",
    "expected_engagement_rate": "6-9%",
    "expected_ctr": "2.5-4%"
  }
}
```

---

## 🏗️ IMPLEMENTATION OPTIONS

### Option 1: Claude-Native (MCP Servers + Skills)

**Architecture:**
```
User Input → Claude Chat
    ↓
Claude uses MCP servers:
- web_search (for product scraping)
- Custom MCP: DM_TikTokTrends_Server
- Custom MCP: DM_ProductIntel_Server
    ↓
Claude uses Skills:
- DM_ViralHookBuilder_Skill
- DM_ImagePromptGenerator_Skill
- DM_MetadataOptimizer_Skill
    ↓
Output: Complete video package in chat
```

**Pros:**
- No product to build, works in Claude today
- Uses existing claude.ai infrastructure
- MCP servers for external data (trends, product scraping)
- Skills for content generation logic

**Cons:**
- Manual copy-paste of outputs to Freepik/ElevenLabs
- No automation of image generation
- User must assemble video manually

**Best For:**
- Testing the system
- Low-volume production (3-5 videos/day)
- Iterating on prompts and strategies

---

### Option 2: Standalone Product (API-Based)

**Architecture:**
```
User Input (API) → Agent Orchestrator
    ↓
Agents run in parallel:
- DM_ProductIntel_Agent (scraping)
- DM_StrategySelector_Agent (decision)
    ↓
Sequential agents:
- DM_ScriptWriter_Agent
- DM_VisualDirector_Agent
- DM_AudioProducer_Agent
- DM_MetadataBuilder_Agent
    ↓
External API Calls:
- Freepik API (image generation)
- ElevenLabs API (voice generation)
- Video assembly (FFmpeg)
    ↓
Output: Finished MP4 + metadata JSON
```

**Tech Stack:**
```
Backend: Python FastAPI
Orchestration: LangGraph / CrewAI / AutoGen
LLM: Claude API (Sonnet 4.5)
Image Gen: Freepik API
Voice: ElevenLabs API
Video: FFmpeg
Storage: S3 / Cloudflare R2
Database: PostgreSQL (character profiles, video packages)
Queue: Redis (job processing)
```

**Pros:**
- Fully automated (URL → finished video)
- Batch processing (50-100 videos/day)
- Quality control pipeline
- Analytics and optimization

**Cons:**
- Product development required
- API costs (Claude, Freepik, ElevenLabs)
- Infrastructure management

**Best For:**
- Agency service (client video production)
- High-volume content farms
- White-label UGC platform

---

## 🎯 SKILL DEVELOPMENT ROADMAP

### Phase 1: Core Content Generation (Week 1-2)
**Build these skills first:**
1. `DM_ProductCategorizer_Skill` — Auto-classify products
2. `DM_HookMatcher_Skill` — Match products to hooks
3. `DM_ScriptStructurer_Skill` — Build timed scripts
4. `DM_PromptBuilder_Skill` — Generate image prompts
5. `DM_CaptionWriter_Skill` — Create TikTok captions

**Result:** Manual workflow with AI-assisted generation

---

### Phase 2: Intelligence & Strategy (Week 3-4)
**Add these skills:**
6. `DM_ProductScraper_Skill` — Extract from URLs
7. `DM_ReviewAnalyzer_Skill` — Analyze customer reviews
8. `DM_TrendAnalyzer_Skill` — Pull TikTok trends
9. `DM_HashtagOptimizer_Skill` — Select hashtags

**Result:** Automated product research + strategy

---

### Phase 3: Consistency & Quality (Week 5-6)
**Add these skills:**
10. `DM_CharacterLocker_Skill` — Maintain visual consistency
11. `DM_VoiceDirector_Skill` — Add expression tags
12. `DM_AudioMixer_Skill` — Audio layering instructions
13. `DM_SceneComposer_Skill` — Shot composition

**Result:** Production-quality outputs

---

### Phase 4: Optimization & Scale (Week 7-8)
**Add these skills:**
14. `DM_CompetitorMapper_Skill` — Competitive intel
15. `DM_PostScheduler_Skill` — Timing optimization
16. `DM_AudienceMapper_Skill` — Audience targeting
17. `DM_SoundLibrary_Skill` — Trending sounds

**Result:** Full system operational

---

## 📊 SKILL PERFORMANCE METRICS

Each skill should track:
```json
{
  "skill_name": "DM_HookMatcher_Skill",
  "executions": 1247,
  "success_rate": 0.94,
  "avg_execution_time": "2.3s",
  "accuracy_metrics": {
    "correct_format_selection": 0.91,
    "user_override_rate": 0.09
  },
  "output_quality": {
    "avg_video_performance": "+23% vs baseline",
    "top_performing_hooks": ["price_reveal", "pov", "discovery"]
  }
}
```

---

## 🚀 QUICK START: Building First Skill

### Example: DM_HookMatcher_Skill

**File:** `skills/dm_hook_matcher/SKILL.md`

```markdown
# DM_HookMatcher_Skill

## Purpose
Match product characteristics to optimal viral hook format based on proven performance data.

## Trigger
Use this skill when you need to select the best hook format for a product.

## Input Schema
- Product category (beauty/fashion/home/lifestyle)
- Price point (under $20 / $20-50 / over $50)
- Unique features (boolean)
- Trending status (boolean)
- Competitor count (number)
- Review sentiment (positive/negative/mixed)

## Logic
1. IF price < $20 AND reviews > 100 → "price_reveal"
2. ELIF trending = true → "social_proof"
3. ELIF has_unique_feature = true → "discovery"
4. ELIF competitor_count > 5 → "comparison"
5. ELIF problem_solution = true → "pov"
6. ELSE → "opinion"

## Output
- hook_format: string
- rationale: string
- confidence_score: float (0-1)
- alternative_hooks: array[string]

## Examples
[Include 5-10 examples of input → output]

## Performance Data
- Price Reveal: 8.2/10 avg performance
- POV: 7.8/10 avg performance
- Discovery: 9.1/10 avg performance
[etc.]
```

---

## 🎬 END-TO-END EXAMPLE

### Input
```
Product URL: https://amazon.com/dp/B08XYZ123
Character: Sofia Laurent
Platform: TikTok
```

### Agent Execution Flow

**Step 1: DM_ProductIntel_Agent**
```json
{
  "product_name": "Revlon ColorStay Foundation",
  "price": 14.99,
  "category": "beauty_face_makeup",
  "key_features": ["24hr wear", "SPF 15", "doesn't oxidize"]
}
```

**Step 2: DM_StrategySelector_Agent**
```json
{
  "hook_format": "price_reveal",
  "content_format": "product_demo",
  "video_length": "20s"
}
```

**Step 3: DM_ScriptWriter_Agent**
```json
{
  "hook": "I spent $15 on this foundation and I'm never going back",
  "full_script": { /* 4-section script */ }
}
```

**Step 4: DM_VisualDirector_Agent**
```json
{
  "shot_prompts": [ /* 5 Freepik prompts */ ]
}
```

**Step 5: DM_AudioProducer_Agent**
```json
{
  "elevenlabs_payload": { /* voice settings + script */ },
  "trending_sound": "Aesthetic Vibes"
}
```

**Step 6: DM_MetadataBuilder_Agent**
```json
{
  "caption": "I spent $15 on this foundation...",
  "hashtags": ["#makeup", "#tiktokmademebuyit", ...],
  "posting_time": "7:00 AM EST"
}
```

### Final Output
```
✅ Video Package Ready

📸 Images: 5 prompts → Generate in Freepik
🎙️ Audio: ElevenLabs script ready
📝 Metadata: Caption + hashtags + posting time
⏱️ Estimated production: 45 minutes
```

---

*InfluencerLabs · Agent & Skill Architecture*  
*Digital Marketing Agency System Design · 2026*
