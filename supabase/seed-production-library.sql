-- =============================================================================
-- Seed Production Library — Content Knowledge Engine
-- =============================================================================

CREATE OR REPLACE FUNCTION public.seed_production_library(p_user_id UUID)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN

-- =========================================================================
-- VIRAL HOOKS (8 formats)
-- =========================================================================

INSERT INTO public.production_library (user_id, item_type, slug, label, platform, performance_score, sort_order, data)
VALUES
(p_user_id, 'viral_hook', 'hook_price_reveal', 'Price Reveal', 'both', 92, 1, '{
  "structure": "I spent $[X] on this [product] and [unexpected outcome]",
  "bestFor": ["Mid-range products ($15-60)", "Fashion", "Beauty"],
  "examples": [
    "I spent $23 on this serum and threw out my $80 one",
    "I spent $15 on this foundation and I''m never going back",
    "Under twenty dollars fixed my bikini line nightmare"
  ],
  "triggerCondition": "price < $60 AND reviews > 50",
  "psychology": "Price anchor creates impulse trigger. Under-$20 is strongest.",
  "tips": "Always spell out the price in words for voiceover. Use exact cents for text overlay."
}'::jsonb),

(p_user_id, 'viral_hook', 'hook_pov', 'POV', 'tiktok', 88, 2, '{
  "structure": "POV: You finally found [specific problem solution]",
  "bestFor": ["Problem-solving products", "Relatable struggles", "Fashion fit issues"],
  "examples": [
    "POV: You found jeans that fit your waist AND hips",
    "POV: Your bikini line bumps vanish in one week",
    "POV: You finally found a mascara that doesn''t flake by noon"
  ],
  "triggerCondition": "product solves a clear pain point",
  "psychology": "POV format is native to TikTok. Creates immediate identification.",
  "tips": "Keep the POV specific, not generic. The more niche the problem, the better it resonates."
}'::jsonb),

(p_user_id, 'viral_hook', 'hook_twist', 'Twist', 'both', 85, 3, '{
  "structure": "Everyone told me [not to/to] [action]. They were [wrong/right].",
  "bestFor": ["Contrarian takes", "Underdog products", "Budget alternatives"],
  "examples": [
    "Everyone said skip the $15 moisturizer. Big mistake.",
    "My dermatologist told me to stop using expensive serums. She was right.",
    "Everyone told me drugstore foundation can''t compete. Watch this."
  ],
  "triggerCondition": "product challenges conventional wisdom",
  "psychology": "Curiosity gap + contrarian energy. People click to see who was wrong.",
  "tips": "The twist must be genuine — fake contrarian takes get called out."
}'::jsonb),

(p_user_id, 'viral_hook', 'hook_social_proof', 'Social Proof', 'both', 86, 4, '{
  "structure": "I''ve seen [X people/places] using this. Here''s why.",
  "bestFor": ["Trending products", "Location-based content", "Viral items"],
  "examples": [
    "3 influencers I follow use this. Here''s the real tea.",
    "This product sold out 4 times. I finally got one.",
    "TikTok made me buy this. Was it worth the hype?"
  ],
  "triggerCondition": "product is trending OR has social buzz",
  "psychology": "Bandwagon effect + FOMO. If others have it, I need it too.",
  "tips": "Reference specific people or numbers for credibility."
}'::jsonb),

(p_user_id, 'viral_hook', 'hook_opinion', 'Opinion', 'both', 80, 5, '{
  "structure": "Hot take: [bold statement about category] — except this one",
  "bestFor": ["Crowded markets", "Differentiation plays", "Premium products"],
  "examples": [
    "Most $30 dresses are trash. This one isn''t.",
    "Hot take: 90% of vitamin C serums are useless. Here''s the exception.",
    "I hate subscription boxes. But this one actually delivers."
  ],
  "triggerCondition": "competitive market with 5+ similar products",
  "psychology": "Bold opinions stop the scroll. The exception creates curiosity.",
  "tips": "Be genuinely opinionated. Lukewarm takes don''t scroll-stop."
}'::jsonb),

(p_user_id, 'viral_hook', 'hook_discovery', 'Discovery', 'both', 91, 6, '{
  "structure": "Wait, why is no one talking about [product feature]?",
  "bestFor": ["Underrated products", "Hidden features", "New launches"],
  "examples": [
    "Why is no one talking about this built-in SPF?",
    "Wait — this $12 concealer has niacinamide?",
    "Nobody talks about why your bikini line darkens"
  ],
  "triggerCondition": "product has a unique or underrated feature",
  "psychology": "Creates information gap. Viewer feels they''re missing out on knowledge.",
  "tips": "The discovery must be genuinely surprising. Manufacture urgency around the feature."
}'::jsonb),

(p_user_id, 'viral_hook', 'hook_before_after', 'Before/After', 'both', 87, 7, '{
  "structure": "I tried this for [X days/weeks]. Here''s what changed.",
  "bestFor": ["Skincare", "Supplements", "Habit-forming products", "Body care"],
  "examples": [
    "I used this for 2 weeks. My skin is obsessed.",
    "7 days with this serum. The difference is unreal.",
    "I fake tanned with this $12 mousse. Day 3 results."
  ],
  "triggerCondition": "product shows visible results over time",
  "psychology": "Specific timeframe creates believability. Results-driven viewers click.",
  "tips": "Always include a specific timeframe. ''Some time'' is weak, ''2 weeks'' is strong."
}'::jsonb),

(p_user_id, 'viral_hook', 'hook_comparison', 'Comparison', 'both', 84, 8, '{
  "structure": "[Expensive brand] vs [affordable brand]. Let me explain.",
  "bestFor": ["Dupes", "Budget alternatives", "Premium vs drugstore"],
  "examples": [
    "Drunk Elephant vs CeraVe. The difference is wild.",
    "This $15 foundation vs my $60 one. Same formula?",
    "European Wax Center vs this $20 serum. Let me explain."
  ],
  "triggerCondition": "product has a clear competitor at a different price point",
  "psychology": "Viewers love a dupe. Price comparison creates immediate value perception.",
  "tips": "Always put the expensive brand first — it anchors the comparison."
}'::jsonb)

ON CONFLICT (user_id, slug) DO UPDATE SET
  data = EXCLUDED.data,
  performance_score = EXCLUDED.performance_score,
  updated_at = now();

-- =========================================================================
-- CONTENT FORMATS (6 types)
-- =========================================================================

INSERT INTO public.production_library (user_id, item_type, slug, label, platform, performance_score, sort_order, data)
VALUES
(p_user_id, 'content_format', 'format_product_demo', 'Product Demo', 'both', 90, 1, '{
  "duration": "15-20s",
  "timing": {
    "hook": "0-2s: Hook + product reveal",
    "demo": "2-12s: Hands-on demonstration, key features",
    "trust": "12-18s: Honest reaction/caveat",
    "cta": "18-20s: CTA"
  },
  "bestFor": ["Makeup", "Skincare", "Tools", "Gadgets"],
  "wordCount": "55-70 words",
  "tips": "Show the product being USED, not just held. Texture shots convert."
}'::jsonb),

(p_user_id, 'content_format', 'format_try_on', 'Try-On / Unboxing', 'both', 85, 2, '{
  "duration": "20-30s",
  "timing": {
    "hook": "0-2s: Hook while opening/holding product",
    "demo": "2-15s: Trying on/testing product",
    "reaction": "15-25s: Fit/result commentary",
    "cta": "25-30s: CTA"
  },
  "bestFor": ["Fashion", "Accessories", "Shoes"],
  "wordCount": "70-100 words",
  "tips": "Film the reveal moment. First reaction must be genuine."
}'::jsonb),

(p_user_id, 'content_format', 'format_comparison', 'Comparison Shot', 'both', 88, 3, '{
  "duration": "15-20s",
  "timing": {
    "hook": "0-2s: This vs That hook",
    "compare": "2-10s: Side-by-side visual comparison",
    "explain": "10-18s: Key difference explained",
    "cta": "18-20s: CTA"
  },
  "bestFor": ["Dupes", "Before/After", "Alternatives"],
  "wordCount": "55-70 words",
  "tips": "Split screen or cut between products. Always test both on camera."
}'::jsonb),

(p_user_id, 'content_format', 'format_storytime', 'Storytime UGC', 'tiktok', 82, 4, '{
  "duration": "20-30s",
  "timing": {
    "hook": "0-3s: Hook setting up story",
    "story": "3-20s: Short narrative arc with product",
    "payoff": "20-28s: Payoff/conclusion",
    "cta": "28-30s: CTA"
  },
  "bestFor": ["Problem-solution products", "Transformations"],
  "wordCount": "80-110 words",
  "tips": "The story must be personal. Third-person stories don''t convert on TikTok."
}'::jsonb),

(p_user_id, 'content_format', 'format_list', 'List Format', 'both', 83, 5, '{
  "duration": "20-30s",
  "timing": {
    "hook": "0-2s: Hook announcing list",
    "points": "2-25s: 3-5 rapid points with product visible",
    "cta": "25-30s: CTA"
  },
  "bestFor": ["Multi-benefit products", "Versatile items"],
  "wordCount": "70-100 words",
  "tips": "Number each point with text overlay. Keep each point to one sentence."
}'::jsonb),

(p_user_id, 'content_format', 'format_transformation', 'Transformation', 'both', 89, 6, '{
  "duration": "20-30s",
  "timing": {
    "hook": "0-2s: Before state shown",
    "process": "2-15s: Application/transformation process",
    "reveal": "15-25s: Dramatic reveal of after state",
    "cta": "25-30s: CTA"
  },
  "bestFor": ["Skincare results", "Hair products", "Home organization", "Cleaning products"],
  "wordCount": "60-80 words",
  "tips": "The before state must be relatable and real. Exaggerated befores lose trust."
}'::jsonb)

ON CONFLICT (user_id, slug) DO UPDATE SET
  data = EXCLUDED.data,
  performance_score = EXCLUDED.performance_score,
  updated_at = now();

-- =========================================================================
-- LOCATION/SETTING GUIDE (4 primary settings)
-- =========================================================================

INSERT INTO public.production_library (user_id, item_type, slug, label, platform, sort_order, data)
VALUES
(p_user_id, 'location_setting', 'setting_bathroom', 'Bathroom / Vanity', 'both', 1, '{
  "forCategories": ["Beauty face", "Beauty body", "Skincare", "Hair care"],
  "visual": "Soft natural window light, marble/white countertop, minimal background",
  "outfit": "Bathrobe, towel wrap, or casual home wear (tank top)",
  "props": ["Skincare bottles", "Mirror", "Soft towels", "Small plant"],
  "lighting": "Soft diffused natural window light from camera-left, warm ~5500K",
  "mood": "Spa-day self-care, intimate, authentic"
}'::jsonb),

(p_user_id, 'location_setting', 'setting_bedroom', 'Bedroom / Closet', 'both', 2, '{
  "forCategories": ["Fashion clothing", "Fashion shoes", "Loungewear"],
  "visual": "Natural bedroom lighting, neutral bed/closet background",
  "outfit": "Trying on the product OR outfit that complements",
  "props": ["Shopping bag", "Hanger", "Full-length mirror", "Neutral bedding"],
  "lighting": "Natural daylight from window, warm overhead as fill",
  "mood": "Getting ready, excited, personal style moment"
}'::jsonb),

(p_user_id, 'location_setting', 'setting_living_room', 'Living Room / Kitchen', 'both', 3, '{
  "forCategories": ["Lifestyle wellness", "Home kitchen", "Home decor", "Supplements"],
  "visual": "Cozy home environment, warm lighting, lived-in feel",
  "outfit": "Comfortable casual wear, sweater or loungewear",
  "props": ["Coffee cup", "Couch/blanket", "Plants", "Kitchen counter items"],
  "lighting": "Warm ambient lighting, natural daylight preferred",
  "mood": "Cozy, relatable, everyday life"
}'::jsonb),

(p_user_id, 'location_setting', 'setting_outdoor', 'Outdoor / Coffee Shop', 'both', 4, '{
  "forCategories": ["Fashion accessories", "Jewelry", "Sunglasses", "Bags"],
  "visual": "Natural daylight, blurred outdoor/cafe background",
  "outfit": "Styled outfit featuring the accessory as hero piece",
  "props": ["Coffee cup", "Bag on table", "Natural greenery"],
  "lighting": "Natural daylight, golden hour preferred for warm glow",
  "mood": "Aspirational, lifestyle, on-the-go"
}'::jsonb)

ON CONFLICT (user_id, slug) DO UPDATE SET
  data = EXCLUDED.data,
  updated_at = now();

-- =========================================================================
-- DECISION RULES (category → hook + format + setting mapping)
-- =========================================================================

INSERT INTO public.production_library (user_id, item_type, slug, label, platform, sort_order, data)
VALUES
(p_user_id, 'decision_rule', 'rule_beauty_face', 'Beauty — Face Makeup', 'both', 1, '{
  "category": "beauty_face_makeup",
  "recommendedHook": "hook_price_reveal",
  "alternateHook": "hook_comparison",
  "recommendedFormat": "format_product_demo",
  "recommendedSetting": "setting_bathroom",
  "videoLength": "15-20s",
  "reasoning": "Face makeup = universal need, price matters, shade match critical. Demo shows application proof."
}'::jsonb),

(p_user_id, 'decision_rule', 'rule_beauty_skincare', 'Beauty — Skincare', 'both', 2, '{
  "category": "beauty_skincare",
  "recommendedHook": "hook_discovery",
  "alternateHook": "hook_before_after",
  "recommendedFormat": "format_product_demo",
  "recommendedSetting": "setting_bathroom",
  "videoLength": "15-20s",
  "reasoning": "Skincare buyers want ingredients + proof of results. Discovery hooks highlight unique formulations."
}'::jsonb),

(p_user_id, 'decision_rule', 'rule_beauty_body', 'Beauty — Body Care', 'both', 3, '{
  "category": "beauty_body",
  "recommendedHook": "hook_before_after",
  "alternateHook": "hook_price_reveal",
  "recommendedFormat": "format_transformation",
  "recommendedSetting": "setting_bathroom",
  "videoLength": "20-30s",
  "reasoning": "Body products need visual proof of texture and results. Longer demo time needed."
}'::jsonb),

(p_user_id, 'decision_rule', 'rule_fashion_clothing', 'Fashion — Clothing', 'both', 4, '{
  "category": "fashion_clothing",
  "recommendedHook": "hook_pov",
  "alternateHook": "hook_price_reveal",
  "recommendedFormat": "format_try_on",
  "recommendedSetting": "setting_bedroom",
  "videoLength": "20-30s",
  "reasoning": "Fashion = fit is everything. Try-on format shows how it looks on a real body. POV hooks resonate with fit struggles."
}'::jsonb),

(p_user_id, 'decision_rule', 'rule_fashion_accessories', 'Fashion — Accessories', 'both', 5, '{
  "category": "fashion_accessories",
  "recommendedHook": "hook_social_proof",
  "alternateHook": "hook_opinion",
  "recommendedFormat": "format_list",
  "recommendedSetting": "setting_outdoor",
  "videoLength": "20-30s",
  "reasoning": "Accessories are aspirational. Social proof + outdoor setting = lifestyle aspiration."
}'::jsonb),

(p_user_id, 'decision_rule', 'rule_home_kitchen', 'Home — Kitchen / Decor', 'both', 6, '{
  "category": "home_kitchen",
  "recommendedHook": "hook_before_after",
  "alternateHook": "hook_discovery",
  "recommendedFormat": "format_transformation",
  "recommendedSetting": "setting_living_room",
  "videoLength": "20-30s",
  "reasoning": "Home products need before/after transformation to show value. Visual impact is everything."
}'::jsonb),

(p_user_id, 'decision_rule', 'rule_lifestyle_wellness', 'Lifestyle — Wellness / Tech', 'both', 7, '{
  "category": "lifestyle_wellness",
  "recommendedHook": "hook_discovery",
  "alternateHook": "hook_social_proof",
  "recommendedFormat": "format_storytime",
  "recommendedSetting": "setting_living_room",
  "videoLength": "20-30s",
  "reasoning": "Wellness products need a story — why you started using it, what changed. Story format builds trust."
}'::jsonb)

ON CONFLICT (user_id, slug) DO UPDATE SET
  data = EXCLUDED.data,
  updated_at = now();

END;
$$;
