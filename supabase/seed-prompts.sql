-- =============================================================================
-- Seed Default Prompt Templates
-- Run with service role key or as superuser.
-- Uses a placeholder user_id that must be replaced at runtime.
-- =============================================================================

-- Helper: insert prompt with ON CONFLICT to make re-running safe
-- Usage: call with the authenticated user's ID

CREATE OR REPLACE FUNCTION public.seed_prompts_for_user(p_user_id UUID)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN

-- =========================================================================
-- SHARED PROMPTS
-- =========================================================================

INSERT INTO public.prompts (user_id, slug, label, category, model, template, default_template, variables, description)
VALUES (
  p_user_id,
  'shared_character_lock',
  'Character Lock Template',
  'shared',
  'sonnet',
  'Photorealistic {{persona.identity.nationality}} {{persona.identity.gender}}, {{persona.identity.age}} years old, {{persona.appearance.hair}}, {{persona.appearance.eyes}}, {{persona.appearance.bodyType}} build, {{persona.appearance.faceShape}} face, {{persona.appearance.distinctFeatures}}, {{persona.fashionStyle.aesthetic}} style, UGC content creator aesthetic, iPhone 14 Pro quality realism, high resolution, authentic lifestyle photography',
  'Photorealistic {{persona.identity.nationality}} {{persona.identity.gender}}, {{persona.identity.age}} years old, {{persona.appearance.hair}}, {{persona.appearance.eyes}}, {{persona.appearance.bodyType}} build, {{persona.appearance.faceShape}} face, {{persona.appearance.distinctFeatures}}, {{persona.fashionStyle.aesthetic}} style, UGC content creator aesthetic, iPhone 14 Pro quality realism, high resolution, authentic lifestyle photography',
  '["persona.identity.nationality", "persona.identity.gender", "persona.identity.age", "persona.appearance.hair", "persona.appearance.eyes", "persona.appearance.bodyType", "persona.appearance.faceShape", "persona.appearance.distinctFeatures", "persona.fashionStyle.aesthetic"]'::jsonb,
  'Base character description prompt built from persona appearance fields. Injected into every visual generation for consistency.'
) ON CONFLICT (user_id, slug) DO NOTHING;

INSERT INTO public.prompts (user_id, slug, label, category, model, template, default_template, variables, description)
VALUES (
  p_user_id,
  'shared_persona_voice',
  'Persona Voice Profile',
  'shared',
  'haiku',
  'Voice profile for {{persona.identity.fullName}}:
- Core traits: {{persona.psychographic.coreTraits}}
- Communication style: {{persona.fashionStyle.aesthetic}} aesthetic
- Mission: {{persona.psychographic.mission}}
- Interests: {{persona.psychographic.interests}}

Write in this persona''s authentic voice. Match their tone, vocabulary level, and energy. If they are playful, be playful. If they are authoritative, be authoritative.',
  'Voice profile for {{persona.identity.fullName}}:
- Core traits: {{persona.psychographic.coreTraits}}
- Communication style: {{persona.fashionStyle.aesthetic}} aesthetic
- Mission: {{persona.psychographic.mission}}
- Interests: {{persona.psychographic.interests}}

Write in this persona''s authentic voice. Match their tone, vocabulary level, and energy. If they are playful, be playful. If they are authoritative, be authoritative.',
  '["persona.identity.fullName", "persona.psychographic.coreTraits", "persona.fashionStyle.aesthetic", "persona.psychographic.mission", "persona.psychographic.interests"]'::jsonb,
  'Defines the persona''s writing voice for caption and script generation.'
) ON CONFLICT (user_id, slug) DO NOTHING;

-- =========================================================================
-- STUDIO PROMPTS
-- =========================================================================

INSERT INTO public.prompts (user_id, slug, label, category, model, template, default_template, variables, description)
VALUES (
  p_user_id,
  'studio_content_plan',
  'Content Plan Generator',
  'studio',
  'sonnet',
  'You are a social media content strategist for {{persona.identity.fullName}}, a {{persona.identity.profession}}.

Create a content plan for the following prompt:
{{userPrompt}}

Target audience: {{targetAudience}}
Content themes: {{contentFocus}}
Platforms: {{platforms}}

For each post, provide:
- theme: a short title for the content
- sceneDescription: detailed visual description of the scene
- onScreenText: text overlay for the image/video
- caption: engaging social media caption
- hook: scroll-stopping first line
- hashtags: relevant hashtags (5-8)
- cta: call to action
- location: where the content is set
- musicSuggestion: background music mood
- contentType: Photo, Carousel, or Video
- storyArc: Beautiful Day, Real Moment, Achievement, Lesson, or Invitation
- captionTone: Aspirational, Relatable, Educational, Vulnerable, or Playful

Generate content that feels authentic to the persona''s voice and aesthetic.',
  'You are a social media content strategist for {{persona.identity.fullName}}, a {{persona.identity.profession}}.

Create a content plan for the following prompt:
{{userPrompt}}

Target audience: {{targetAudience}}
Content themes: {{contentFocus}}
Platforms: {{platforms}}

For each post, provide:
- theme: a short title for the content
- sceneDescription: detailed visual description of the scene
- onScreenText: text overlay for the image/video
- caption: engaging social media caption
- hook: scroll-stopping first line
- hashtags: relevant hashtags (5-8)
- cta: call to action
- location: where the content is set
- musicSuggestion: background music mood
- contentType: Photo, Carousel, or Video
- storyArc: Beautiful Day, Real Moment, Achievement, Lesson, or Invitation
- captionTone: Aspirational, Relatable, Educational, Vulnerable, or Playful

Generate content that feels authentic to the persona''s voice and aesthetic.',
  '["persona.identity.fullName", "persona.identity.profession", "userPrompt", "targetAudience", "contentFocus", "platforms"]'::jsonb,
  'Generates content calendar posts from a user prompt. Used by the New Post flow.'
) ON CONFLICT (user_id, slug) DO NOTHING;

INSERT INTO public.prompts (user_id, slug, label, category, model, template, default_template, variables, description)
VALUES (
  p_user_id,
  'studio_image_prompt',
  'Image Prompt Builder',
  'studio',
  'sonnet',
  '{{characterPrompt}}

Scene: {{sceneDescription}}
Setting: {{location}}
Outfit/style: {{styleOption}}
Hairstyle: {{hairstyle}}

{{onScreenText}}

Composition: vertical 9:16 portrait, shallow depth of field, natural lighting, social media content creator aesthetic. Leave space for text overlay at the {{textPosition}} of the frame.',
  '{{characterPrompt}}

Scene: {{sceneDescription}}
Setting: {{location}}
Outfit/style: {{styleOption}}
Hairstyle: {{hairstyle}}

{{onScreenText}}

Composition: vertical 9:16 portrait, shallow depth of field, natural lighting, social media content creator aesthetic. Leave space for text overlay at the {{textPosition}} of the frame.',
  '["characterPrompt", "sceneDescription", "location", "styleOption", "hairstyle", "onScreenText", "textPosition"]'::jsonb,
  'Builds the image generation prompt from post fields + character lock.'
) ON CONFLICT (user_id, slug) DO NOTHING;

INSERT INTO public.prompts (user_id, slug, label, category, model, template, default_template, variables, description)
VALUES (
  p_user_id,
  'studio_caption_writer',
  'Caption Writer',
  'studio',
  'haiku',
  'Write a social media caption for {{persona.identity.fullName}}.

Post theme: {{theme}}
Story arc: {{storyArc}}
Caption tone: {{captionTone}}
Platform: {{platform}}
Hook: {{hook}}

{{personaVoice}}

Keep it authentic and engaging. Max 2 emojis. Include a clear CTA.',
  'Write a social media caption for {{persona.identity.fullName}}.

Post theme: {{theme}}
Story arc: {{storyArc}}
Caption tone: {{captionTone}}
Platform: {{platform}}
Hook: {{hook}}

{{personaVoice}}

Keep it authentic and engaging. Max 2 emojis. Include a clear CTA.',
  '["persona.identity.fullName", "theme", "storyArc", "captionTone", "platform", "hook", "personaVoice"]'::jsonb,
  'Generates captions for Studio posts.'
) ON CONFLICT (user_id, slug) DO NOTHING;

INSERT INTO public.prompts (user_id, slug, label, category, model, template, default_template, variables, description)
VALUES (
  p_user_id,
  'studio_thumbnail',
  'Thumbnail Concept',
  'studio',
  'haiku',
  'Create a thumbnail concept for a {{contentType}} about "{{theme}}".

Character: {{characterPrompt}}
Style references: {{thumbnailReferences}}

The thumbnail should be eye-catching, clearly communicate the topic, and match the persona''s visual brand.',
  'Create a thumbnail concept for a {{contentType}} about "{{theme}}".

Character: {{characterPrompt}}
Style references: {{thumbnailReferences}}

The thumbnail should be eye-catching, clearly communicate the topic, and match the persona''s visual brand.',
  '["contentType", "theme", "characterPrompt", "thumbnailReferences"]'::jsonb,
  'Generates thumbnail concepts for video content.'
) ON CONFLICT (user_id, slug) DO NOTHING;

-- =========================================================================
-- UGC PROMPTS
-- =========================================================================

INSERT INTO public.prompts (user_id, slug, label, category, model, template, default_template, variables, description)
VALUES (
  p_user_id,
  'ugc_product_intel',
  '1. Product Intel Extractor',
  'ugc',
  'haiku',
  'You are a product research analyst. Extract structured product intelligence from the following input.

Product URL: {{productUrl}}
Product text/description:
{{productText}}

Extract and return a JSON object with:
- productName: full product name
- brand: brand name
- category: one of (beauty_face_makeup, beauty_eye_makeup, beauty_lip, beauty_skincare, beauty_body, fashion_clothing, fashion_accessories, fashion_shoes, home_kitchen, home_decor, lifestyle_wellness, lifestyle_tech)
- subcategory: specific sub-category
- price: number (USD)
- currency: "USD"
- size: product size if applicable
- keyFeatures: array of key features/ingredients
- primaryBenefit: one sentence main benefit
- painPointsSolved: array of problems this solves
- reviewSentiment: { positive: [top 3-4], negative: [top 2-3] }
- competitorProducts: [{ name, price }] (2-4 competitors)
- targetAudience: one sentence describing ideal buyer
- trendingStatus: boolean
- sourceUrl: the product URL

Be precise. Use actual data from the input, don''t fabricate reviews or competitors unless you can infer them from context.',
  'You are a product research analyst. Extract structured product intelligence from the following input.

Product URL: {{productUrl}}
Product text/description:
{{productText}}

Extract and return a JSON object with:
- productName: full product name
- brand: brand name
- category: one of (beauty_face_makeup, beauty_eye_makeup, beauty_lip, beauty_skincare, beauty_body, fashion_clothing, fashion_accessories, fashion_shoes, home_kitchen, home_decor, lifestyle_wellness, lifestyle_tech)
- subcategory: specific sub-category
- price: number (USD)
- currency: "USD"
- size: product size if applicable
- keyFeatures: array of key features/ingredients
- primaryBenefit: one sentence main benefit
- painPointsSolved: array of problems this solves
- reviewSentiment: { positive: [top 3-4], negative: [top 2-3] }
- competitorProducts: [{ name, price }] (2-4 competitors)
- targetAudience: one sentence describing ideal buyer
- trendingStatus: boolean
- sourceUrl: the product URL

Be precise. Use actual data from the input, don''t fabricate reviews or competitors unless you can infer them from context.',
  '["productUrl", "productText"]'::jsonb,
  'Extracts structured product data from URL or pasted text. First step of UGC pipeline.'
) ON CONFLICT (user_id, slug) DO NOTHING;

INSERT INTO public.prompts (user_id, slug, label, category, model, template, default_template, variables, description)
VALUES (
  p_user_id,
  'ugc_strategy',
  '2. Strategy Selector',
  'ugc',
  'sonnet',
  'You are a TikTok/Instagram content strategist. Select the optimal content strategy for this product.

PRODUCT:
{{productIntel}}

PERSONA:
Name: {{persona.identity.fullName}}
Aesthetic: {{persona.fashionStyle.aesthetic}}
Core traits: {{persona.psychographic.coreTraits}}

TARGET AUDIENCE:
{{targetAudience}}

HOOK FORMAT DECISION TREE:
- IF price < $20 AND popular → price_reveal
- ELIF trending → social_proof
- ELIF has unique feature → discovery
- ELIF solves clear problem → pov
- ELIF many competitors → comparison
- ELSE → opinion

Return a JSON object with:
- hookFormat: one of (price_reveal, pov, discovery, social_proof, comparison, opinion)
- hookRationale: why this format works for this product
- contentFormat: (product_demo, get_ready_with_me, storytime, tutorial, comparison, unboxing)
- contentRationale: why this format
- videoLength: "15s" or "20s" or "30s"
- setting: where to film (bathroom_vanity, kitchen_counter, bedroom, outdoor, etc.)
- characterOutfit: what the persona should wear
- optimalPostingTime: specific time and day with timezone
- postingRationale: why this time
- hashtagStrategy: { primary, conversion, product, brand, modifier } — one hashtag each',
  'You are a TikTok/Instagram content strategist. Select the optimal content strategy for this product.

PRODUCT:
{{productIntel}}

PERSONA:
Name: {{persona.identity.fullName}}
Aesthetic: {{persona.fashionStyle.aesthetic}}
Core traits: {{persona.psychographic.coreTraits}}

TARGET AUDIENCE:
{{targetAudience}}

HOOK FORMAT DECISION TREE:
- IF price < $20 AND popular → price_reveal
- ELIF trending → social_proof
- ELIF has unique feature → discovery
- ELIF solves clear problem → pov
- ELIF many competitors → comparison
- ELSE → opinion

Return a JSON object with:
- hookFormat: one of (price_reveal, pov, discovery, social_proof, comparison, opinion)
- hookRationale: why this format works for this product
- contentFormat: (product_demo, get_ready_with_me, storytime, tutorial, comparison, unboxing)
- contentRationale: why this format
- videoLength: "15s" or "20s" or "30s"
- setting: where to film (bathroom_vanity, kitchen_counter, bedroom, outdoor, etc.)
- characterOutfit: what the persona should wear
- optimalPostingTime: specific time and day with timezone
- postingRationale: why this time
- hashtagStrategy: { primary, conversion, product, brand, modifier } — one hashtag each',
  '["productIntel", "persona.identity.fullName", "persona.fashionStyle.aesthetic", "persona.psychographic.coreTraits", "targetAudience"]'::jsonb,
  'Selects hook format, content format, setting, and posting strategy.'
) ON CONFLICT (user_id, slug) DO NOTHING;

INSERT INTO public.prompts (user_id, slug, label, category, model, template, default_template, variables, description)
VALUES (
  p_user_id,
  'ugc_script_writer',
  '3. Script Writer',
  'ugc',
  'sonnet',
  'You are a UGC script writer for TikTok/Instagram. Write a {{strategy.videoLength}} video script.

PRODUCT: {{productIntel.productName}} — {{productIntel.primaryBenefit}}
PRICE: ${{productIntel.price}}
HOOK FORMAT: {{strategy.hookFormat}}
CONTENT FORMAT: {{strategy.contentFormat}}
SETTING: {{strategy.setting}}

PERSONA VOICE:
{{personaVoice}}

INSTRUCTIONS:
1. Generate 10 hook variations for the {{strategy.hookFormat}} format
2. Score each hook (specificity 3pts, emotion 3pts, brevity 2pts, scroll-stop 2pts, max 10)
3. Select the top-scoring hook
4. Write a 4-section timed script:
   - hookSection (0-2s): the hook line, 6-10 words
   - productSection (2-14s): demonstrate/explain, 25-35 words
   - trustSection (14-18s): honest take/social proof, 12-18 words
   - ctaSection (18-20s): call to action, 7-12 words

Each section needs: timing, wordCount, textOverlay, voiceover (with [emotion] tags), visualCue.

5. Combine all voiceover into elevenlabsFullScript with [curious], [calm], [playfully], [excited] emotion tags
6. Total word count must be 55-70 words

Return as JSON with: hookVariants[], selectedHook, fullScript{}, totalWordCount, estimatedDuration, elevenlabsFullScript, elevenlabsSettings.',
  'You are a UGC script writer for TikTok/Instagram. Write a {{strategy.videoLength}} video script.

PRODUCT: {{productIntel.productName}} — {{productIntel.primaryBenefit}}
PRICE: ${{productIntel.price}}
HOOK FORMAT: {{strategy.hookFormat}}
CONTENT FORMAT: {{strategy.contentFormat}}
SETTING: {{strategy.setting}}

PERSONA VOICE:
{{personaVoice}}

INSTRUCTIONS:
1. Generate 10 hook variations for the {{strategy.hookFormat}} format
2. Score each hook (specificity 3pts, emotion 3pts, brevity 2pts, scroll-stop 2pts, max 10)
3. Select the top-scoring hook
4. Write a 4-section timed script:
   - hookSection (0-2s): the hook line, 6-10 words
   - productSection (2-14s): demonstrate/explain, 25-35 words
   - trustSection (14-18s): honest take/social proof, 12-18 words
   - ctaSection (18-20s): call to action, 7-12 words

Each section needs: timing, wordCount, textOverlay, voiceover (with [emotion] tags), visualCue.

5. Combine all voiceover into elevenlabsFullScript with [curious], [calm], [playfully], [excited] emotion tags
6. Total word count must be 55-70 words

Return as JSON with: hookVariants[], selectedHook, fullScript{}, totalWordCount, estimatedDuration, elevenlabsFullScript, elevenlabsSettings.',
  '["strategy.videoLength", "productIntel.productName", "productIntel.primaryBenefit", "productIntel.price", "strategy.hookFormat", "strategy.contentFormat", "strategy.setting", "personaVoice"]'::jsonb,
  'Generates 10 scored hooks and a timed 4-section video script with ElevenLabs tags.'
) ON CONFLICT (user_id, slug) DO NOTHING;

INSERT INTO public.prompts (user_id, slug, label, category, model, template, default_template, variables, description)
VALUES (
  p_user_id,
  'ugc_visual_director',
  '4. Visual Director',
  'ugc',
  'sonnet',
  'You are a visual director for UGC content. Create 5 shot prompts for image generation.

CHARACTER LOCK (use in EVERY shot):
{{characterPrompt}}

PRODUCT: {{productIntel.productName}}
SCRIPT:
- Hook ({{script.fullScript.hookSection.timing}}): {{script.fullScript.hookSection.voiceover}}
- Product ({{script.fullScript.productSection.timing}}): {{script.fullScript.productSection.voiceover}}
- Trust ({{script.fullScript.trustSection.timing}}): {{script.fullScript.trustSection.voiceover}}
- CTA ({{script.fullScript.ctaSection.timing}}): {{script.fullScript.ctaSection.voiceover}}

SETTING: {{strategy.setting}}
OUTFIT: {{strategy.characterOutfit}}

Generate 5 shot prompts:
1. hook_frame (0-2s) — scroll-stopping opening
2. product_demo (2-8s) — showing/using the product
3. product_detail (8-10s) — close-up of product
4. reaction_proof (10-16s) — genuine reaction/testimonial
5. call_to_action (16-20s) — CTA with product visible

EACH shot prompt must:
- Include the FULL character description (self-contained, copy-pasteable)
- Specify exact composition, lighting, camera angle
- Include props and their placement
- Be vertical 9:16 format
- Leave space for text overlays
- Feel like an authentic iPhone selfie, NOT a studio photo

Return JSON with: baseCharacterPrompt, shotPrompts[{shotId, timing, purpose, fullPrompt, compositionNotes, lighting, props[]}], consistencyChecklist[], imageGenerationSettings{}.',
  'You are a visual director for UGC content. Create 5 shot prompts for image generation.

CHARACTER LOCK (use in EVERY shot):
{{characterPrompt}}

PRODUCT: {{productIntel.productName}}
SCRIPT:
- Hook ({{script.fullScript.hookSection.timing}}): {{script.fullScript.hookSection.voiceover}}
- Product ({{script.fullScript.productSection.timing}}): {{script.fullScript.productSection.voiceover}}
- Trust ({{script.fullScript.trustSection.timing}}): {{script.fullScript.trustSection.voiceover}}
- CTA ({{script.fullScript.ctaSection.timing}}): {{script.fullScript.ctaSection.voiceover}}

SETTING: {{strategy.setting}}
OUTFIT: {{strategy.characterOutfit}}

Generate 5 shot prompts:
1. hook_frame (0-2s) — scroll-stopping opening
2. product_demo (2-8s) — showing/using the product
3. product_detail (8-10s) — close-up of product
4. reaction_proof (10-16s) — genuine reaction/testimonial
5. call_to_action (16-20s) — CTA with product visible

EACH shot prompt must:
- Include the FULL character description (self-contained, copy-pasteable)
- Specify exact composition, lighting, camera angle
- Include props and their placement
- Be vertical 9:16 format
- Leave space for text overlays
- Feel like an authentic iPhone selfie, NOT a studio photo

Return JSON with: baseCharacterPrompt, shotPrompts[{shotId, timing, purpose, fullPrompt, compositionNotes, lighting, props[]}], consistencyChecklist[], imageGenerationSettings{}.',
  '["characterPrompt", "productIntel.productName", "script.fullScript.hookSection", "script.fullScript.productSection", "script.fullScript.trustSection", "script.fullScript.ctaSection", "strategy.setting", "strategy.characterOutfit"]'::jsonb,
  'Generates 5 self-contained shot prompts with character locking for Freepik/Higgsfield/NanoBanana.'
) ON CONFLICT (user_id, slug) DO NOTHING;

INSERT INTO public.prompts (user_id, slug, label, category, model, template, default_template, variables, description)
VALUES (
  p_user_id,
  'ugc_audio_producer',
  '5. Audio Producer',
  'ugc',
  'haiku',
  'You are an audio producer for UGC TikTok/Instagram content.

SCRIPT:
{{script.elevenlabsFullScript}}

PERSONA VOICE TRAITS: {{persona.psychographic.coreTraits}}
PRODUCT CATEGORY: {{productIntel.category}}

Create an audio production package:

1. ElevenLabs payload:
   - Format the script with expression tags [curious], [calm], [playfully], [excited]
   - Set voice parameters: stability (0.3-0.5 for conversational), similarityBoost (0.7-0.85), style (0.3-0.4)
   - Recommend a stock voice that matches the persona
   - Output format: mp3_44100_192
   - Speed: 1.0-1.1x for natural UGC feel

2. Trending sound options (3 options):
   - One recommended background music
   - One alternative
   - One "no music / raw UGC" option
   Each with: soundName, categoryFit, recommended (boolean), notes

3. Audio mixing instructions:
   - voiceoverVolume, backgroundSoundVolume, fadeIn/Out durations
   - voiceoverPriority: true (voice always dominates)

Return as JSON.',
  'You are an audio producer for UGC TikTok/Instagram content.

SCRIPT:
{{script.elevenlabsFullScript}}

PERSONA VOICE TRAITS: {{persona.psychographic.coreTraits}}
PRODUCT CATEGORY: {{productIntel.category}}

Create an audio production package:

1. ElevenLabs payload:
   - Format the script with expression tags [curious], [calm], [playfully], [excited]
   - Set voice parameters: stability (0.3-0.5 for conversational), similarityBoost (0.7-0.85), style (0.3-0.4)
   - Recommend a stock voice that matches the persona
   - Output format: mp3_44100_192
   - Speed: 1.0-1.1x for natural UGC feel

2. Trending sound options (3 options):
   - One recommended background music
   - One alternative
   - One "no music / raw UGC" option
   Each with: soundName, categoryFit, recommended (boolean), notes

3. Audio mixing instructions:
   - voiceoverVolume, backgroundSoundVolume, fadeIn/Out durations
   - voiceoverPriority: true (voice always dominates)

Return as JSON.',
  '["script.elevenlabsFullScript", "persona.psychographic.coreTraits", "productIntel.category"]'::jsonb,
  'Creates ElevenLabs payload, recommends trending sounds, and provides mixing instructions.'
) ON CONFLICT (user_id, slug) DO NOTHING;

INSERT INTO public.prompts (user_id, slug, label, category, model, template, default_template, variables, description)
VALUES (
  p_user_id,
  'ugc_metadata_builder',
  '6. Metadata Builder',
  'ugc',
  'haiku',
  'You are a social media metadata specialist for TikTok and Instagram.

PRODUCT: {{productIntel.productName}} (${{productIntel.price}})
HOOK: {{script.selectedHook}}
HASHTAG STRATEGY: {{strategy.hashtagStrategy}}
POSTING TIME: {{strategy.optimalPostingTime}}
PERSONA: {{persona.identity.fullName}} ({{persona.socialHandles.instagram}}, {{persona.socialHandles.tiktok}})

Generate metadata for BOTH platforms:

TIKTOK:
- title: max 150 chars, include product name and primary hashtag
- caption: 3-4 lines, max 2 emojis, conversational
- hashtags: exactly 5 [{tag, type (primary_niche/conversion/product_specific/brand_tag/modifier), rationale}]
- productTags: [{productName, variant, price, tagPlacement, tagTiming}]
- postingSchedule: {optimalTime, dayOfWeek, rationale, backupTimes[]}
- engagementStrategy: {pinComment (question that drives comments), autoReplyTriggers [{keyword, response}] (5 triggers)}

INSTAGRAM:
- caption: longer format (4-6 paragraphs), storytelling, end with hashtags
- hashtagsCount: 10
- brandMentions: [@handles]

Return as JSON with tiktok{} and instagram{} objects.',
  'You are a social media metadata specialist for TikTok and Instagram.

PRODUCT: {{productIntel.productName}} (${{productIntel.price}})
HOOK: {{script.selectedHook}}
HASHTAG STRATEGY: {{strategy.hashtagStrategy}}
POSTING TIME: {{strategy.optimalPostingTime}}
PERSONA: {{persona.identity.fullName}} ({{persona.socialHandles.instagram}}, {{persona.socialHandles.tiktok}})

Generate metadata for BOTH platforms:

TIKTOK:
- title: max 150 chars, include product name and primary hashtag
- caption: 3-4 lines, max 2 emojis, conversational
- hashtags: exactly 5 [{tag, type (primary_niche/conversion/product_specific/brand_tag/modifier), rationale}]
- productTags: [{productName, variant, price, tagPlacement, tagTiming}]
- postingSchedule: {optimalTime, dayOfWeek, rationale, backupTimes[]}
- engagementStrategy: {pinComment (question that drives comments), autoReplyTriggers [{keyword, response}] (5 triggers)}

INSTAGRAM:
- caption: longer format (4-6 paragraphs), storytelling, end with hashtags
- hashtagsCount: 10
- brandMentions: [@handles]

Return as JSON with tiktok{} and instagram{} objects.',
  '["productIntel.productName", "productIntel.price", "script.selectedHook", "strategy.hashtagStrategy", "strategy.optimalPostingTime", "persona.identity.fullName", "persona.socialHandles.instagram", "persona.socialHandles.tiktok"]'::jsonb,
  'Generates TikTok title/caption/hashtags/engagement and Instagram caption/mentions.'
) ON CONFLICT (user_id, slug) DO NOTHING;

END;
$$;
