# Building the UGC System in Claude — Implementation Guide
## MCP + Skills Approach

---

## 🎯 DECISION: Build in Claude vs Build a Product

### Option A: Claude-Native (Recommended to Start)

**What you get:**
- Working system in 1-2 weeks
- Test all logic before committing to product build
- Iterate on prompts and strategies fast
- Manual but functional

**What you build:**
1. **3-5 MCP servers** for external data (product scraping, TikTok trends)
2. **5-7 core skills** for content generation logic
3. **Master prompt template** users fill in

**Workflow:**
```
User: "Generate video for [Amazon URL]"
  ↓
Claude uses MCP to scrape product data
  ↓
Claude uses skills to generate strategy + script + visuals
  ↓
Claude outputs complete package
  ↓
User copies to Freepik, ElevenLabs, TikTok (manual)
```

**Time investment:** 2 weeks to working prototype  
**Cost:** MCP server hosting (~$20/month)

---

### Option B: Standalone Product

**What you get:**
- Fully automated URL → video
- Batch processing
- Client dashboard
- Analytics

**What you build:**
- Full backend (FastAPI, LangGraph)
- Database (PostgreSQL)
- Job queue (Redis)
- Frontend dashboard
- API integrations (Freepik, ElevenLabs, FFmpeg)

**Workflow:**
```
User pastes URL in dashboard
  ↓
System auto-generates video
  ↓
User downloads MP4 + metadata
```

**Time investment:** 8-12 weeks to MVP  
**Cost:** Infrastructure + API costs ($500-1000/month at scale)

---

## 🚀 RECOMMENDED PATH: Build in Claude First

**Why:**
1. Validate the logic works before building infrastructure
2. Iterate on prompts 10x faster
3. Test with real products and measure results
4. Prove ROI before committing dev time

**Timeline:**
- Week 1-2: Build MCP servers + core skills
- Week 3-4: Test with 50-100 videos, measure performance
- Week 5: Decide if results justify building standalone product

---

## 🛠️ PHASE 1: MCP SERVERS TO BUILD

### MCP Server #1: DM_ProductIntel_MCP
**Purpose:** Scrape product data from URLs  
**Endpoints:**
- `scrape_product(url)` → product data
- `analyze_reviews(product_url)` → review insights
- `find_competitors(product_name)` → similar products

**Tools Exposed to Claude:**
```json
{
  "tools": [
    {
      "name": "scrape_amazon_product",
      "description": "Extract product details from Amazon URL",
      "input_schema": {
        "type": "object",
        "properties": {
          "url": {"type": "string", "description": "Amazon product URL"}
        }
      }
    },
    {
      "name": "scrape_tiktok_shop_product",
      "description": "Extract product details from TikTok Shop URL",
      "input_schema": {
        "type": "object",
        "properties": {
          "url": {"type": "string", "description": "TikTok Shop product URL"}
        }
      }
    },
    {
      "name": "analyze_product_reviews",
      "description": "Analyze customer reviews for insights",
      "input_schema": {
        "type": "object",
        "properties": {
          "product_url": {"type": "string"},
          "review_count": {"type": "integer", "default": 50}
        }
      }
    }
  ]
}
```

**Implementation:**
```python
# mcp_product_intel/server.py
from mcp.server import Server
import httpx
from bs4 import BeautifulSoup

server = Server("dm-product-intel")

@server.tool()
async def scrape_amazon_product(url: str) -> dict:
    """Scrape Amazon product page"""
    async with httpx.AsyncClient() as client:
        response = await client.get(url)
        soup = BeautifulSoup(response.text, 'html.parser')
        
        # Extract product data
        title = soup.select_one('#productTitle').text.strip()
        price = soup.select_one('.a-price-whole').text.strip()
        features = [li.text.strip() for li in soup.select('#feature-bullets li')]
        
        return {
            "product_name": title,
            "price": float(price.replace('$', '').replace(',', '')),
            "features": features,
            "url": url
        }

@server.tool()
async def analyze_product_reviews(product_url: str, review_count: int = 50) -> dict:
    """Analyze customer reviews using AI"""
    # Scrape reviews
    reviews = scrape_reviews(product_url, review_count)
    
    # Use Claude API to analyze
    import anthropic
    client = anthropic.Anthropic()
    
    prompt = f"""Analyze these product reviews and extract:
1. Most mentioned benefits (top 3)
2. Most mentioned complaints (top 3)
3. Overall sentiment (positive/negative/mixed)
4. Purchase motivations (why people bought)

Reviews:
{reviews}

Return as JSON."""
    
    response = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=1000,
        messages=[{"role": "user", "content": prompt}]
    )
    
    return json.loads(response.content[0].text)
```

---

### MCP Server #2: DM_TikTokTrends_MCP
**Purpose:** Pull trending TikTok data  
**Endpoints:**
- `get_trending_sounds(category)` → trending sounds
- `get_trending_hashtags(category)` → trending hashtags
- `get_viral_hooks(niche)` → current viral hooks

**Tools Exposed to Claude:**
```json
{
  "tools": [
    {
      "name": "get_trending_sounds",
      "description": "Get trending TikTok sounds for a category",
      "input_schema": {
        "type": "object",
        "properties": {
          "category": {
            "type": "string",
            "enum": ["beauty", "fashion", "lifestyle", "home"]
          },
          "timeframe": {
            "type": "string",
            "enum": ["7d", "30d"],
            "default": "7d"
          }
        }
      }
    }
  ]
}
```

**Implementation:**
```python
# mcp_tiktok_trends/server.py
from mcp.server import Server

server = Server("dm-tiktok-trends")

@server.tool()
async def get_trending_sounds(category: str, timeframe: str = "7d") -> list:
    """Get trending TikTok sounds"""
    # Option 1: Use TikTok Creative Center API (if available)
    # Option 2: Scrape TikTok Creative Center web page
    # Option 3: Use third-party API (e.g., Apify)
    
    sounds = await fetch_trending_sounds(category, timeframe)
    
    return [
        {
            "sound_name": sound.name,
            "sound_url": sound.url,
            "usage_count": sound.usage_count,
            "trend_status": "rising" if sound.growth > 0.2 else "stable",
            "category_fit": category
        }
        for sound in sounds
    ]

@server.tool()
async def get_trending_hashtags(category: str) -> list:
    """Get trending hashtags"""
    hashtags = await fetch_trending_hashtags(category)
    
    return [
        {
            "hashtag": tag.name,
            "views": tag.view_count,
            "competition": calculate_competition(tag),
            "growth_rate": tag.growth_percentage
        }
        for tag in hashtags
    ]
```

---

### MCP Server #3: DM_ImageGenerator_MCP
**Purpose:** Generate images via Freepik API  
**Endpoints:**
- `generate_image(prompt)` → image URL
- `batch_generate(prompts[])` → multiple images

**Tools Exposed to Claude:**
```json
{
  "tools": [
    {
      "name": "generate_freepik_image",
      "description": "Generate image using Freepik AI",
      "input_schema": {
        "type": "object",
        "properties": {
          "prompt": {"type": "string"},
          "aspect_ratio": {"type": "string", "default": "9:16"},
          "quality": {"type": "string", "default": "high"}
        }
      }
    }
  ]
}
```

**Implementation:**
```python
# mcp_image_generator/server.py
from mcp.server import Server
import httpx

server = Server("dm-image-generator")

@server.tool()
async def generate_freepik_image(prompt: str, aspect_ratio: str = "9:16") -> dict:
    """Generate image via Freepik API"""
    async with httpx.AsyncClient() as client:
        response = await client.post(
            "https://api.freepik.com/v1/ai/images",
            headers={"Authorization": f"Bearer {FREEPIK_API_KEY}"},
            json={
                "prompt": prompt,
                "aspect_ratio": aspect_ratio,
                "style": "photorealistic"
            }
        )
        
        result = response.json()
        
        return {
            "image_url": result["data"]["url"],
            "image_id": result["data"]["id"],
            "prompt_used": prompt
        }
```

---

### MCP Server #4: DM_VoiceGenerator_MCP (Optional)
**Purpose:** Generate voiceover via ElevenLabs  
**Endpoints:**
- `generate_voice(text, voice_id)` → audio URL

---

### MCP Server #5: DM_ViralHookLibrary_MCP
**Purpose:** Store and retrieve viral hook templates  
**Endpoints:**
- `get_hooks_by_format(format)` → hook templates
- `get_top_performing_hooks(niche)` → ranked hooks

**Implementation:**
```python
# mcp_viral_hooks/server.py
from mcp.server import Server

server = Server("dm-viral-hooks")

# In-memory hook database (or use PostgreSQL)
HOOK_LIBRARY = {
    "price_reveal": [
        {
            "template": "I spent $[PRICE] on this [PRODUCT] and [OUTCOME]",
            "examples": [
                "I spent $15 on this foundation and I'm never going back",
                "I spent $23 on this serum and threw out my $80 one"
            ],
            "avg_performance": 8.2,
            "best_for": ["under_$20", "value_products"]
        }
    ],
    "pov": [
        {
            "template": "POV: You finally found [SOLUTION]",
            "examples": [
                "POV: You found jeans that fit your waist AND hips",
                "POV: You found a mascara that doesn't flake"
            ],
            "avg_performance": 7.8,
            "best_for": ["problem_solution", "relatable_struggles"]
        }
    ]
    # ... more formats
}

@server.tool()
async def get_hooks_by_format(format: str) -> list:
    """Get hook templates for a specific format"""
    return HOOK_LIBRARY.get(format, [])

@server.tool()
async def match_product_to_hook(product_data: dict) -> dict:
    """Match product characteristics to best hook format"""
    # Logic to select best hook
    if product_data["price"] < 20:
        return HOOK_LIBRARY["price_reveal"][0]
    elif product_data.get("unique_feature"):
        return HOOK_LIBRARY["discovery"][0]
    # ... more logic
```

---

## 📚 PHASE 2: CORE SKILLS TO BUILD

### Skill #1: DM_ViralHookBuilder_Skill
**Purpose:** Generate complete video hooks based on product + format

**File:** `/mnt/skills/user/dm_viral_hook_builder/SKILL.md`

```markdown
# DM_ViralHookBuilder_Skill

Use this skill to generate viral TikTok/Instagram hooks for products.

## When to Use
- User provides product data and wants hook variations
- Need to select optimal hook format for a product
- Generating multiple videos and need diverse hooks

## Inputs Required
1. Product data (name, price, category, features)
2. Target audience
3. Character personality (optional)

## Process
1. Classify product type (beauty/fashion/home/lifestyle)
2. Determine optimal hook format using decision tree:
   - Price < $20 + popular → "price_reveal"
   - Trending → "social_proof"
   - Unique feature → "discovery"
   - Problem solver → "pov"
   - Competitive market → "comparison"
3. Use MCP server `dm-viral-hooks` to get templates
4. Generate 10 variations using product specifics
5. Rank by predicted performance

## Output Format
Return JSON:
```json
{
  "recommended_format": "price_reveal",
  "rationale": "Product is $14.99 (under $20), creates impulse trigger",
  "top_hooks": [
    {
      "hook": "I spent $15 on this foundation and I'm never going back",
      "score": 9.2,
      "reasoning": "Strong commitment phrase, clear price anchor"
    },
    // ... 9 more
  ]
}
```

## Example Usage
Input:
```
Product: Revlon ColorStay Foundation
Price: $14.99
Category: Beauty - Face Makeup
Features: 24hr wear, SPF 15, doesn't oxidize
```

Output:
```
Format: price_reveal
Top hook: "I spent $15 on this foundation and I'm never going back"
```
```

---

### Skill #2: DM_ImagePromptGenerator_Skill
**Purpose:** Generate consistent Freepik prompts for character

**File:** `/mnt/skills/user/dm_image_prompt_generator/SKILL.md`

```markdown
# DM_ImagePromptGenerator_Skill

Generate consistent image prompts for UGC content while maintaining character identity.

## When to Use
- Creating video shots for a product
- Need 5 shots: hook, demo, close-up, reaction, CTA
- Character visual consistency is critical

## Locked Character Profile
ALWAYS use this exact base prompt for Sofia Laurent:
```
Photorealistic French woman with Mediterranean features, late twenties (27-29), warm olive skin tone, shoulder-length dark chestnut brown hair with natural wave, minimal makeup with defined brows, soft diffused natural window lighting, neutral clean background, looking directly at camera with warm confident expression, UGC content creator aesthetic, iPhone 14 Pro quality realism, high resolution, natural skin texture with subtle freckles, authentic lifestyle photography
```

## Shot Types Required
1. **Hook frame** (0-2s) — Character holding product, surprised/curious expression
2. **Demo/application** (2-8s) — Character using/wearing product
3. **Product close-up** (8-10s) — Product detail shot
4. **Reaction/result** (10-16s) — Character showing result or reaction
5. **CTA frame** (16-20s) — Character with product, inviting gesture

## Setting Selection
Based on product category:
- Beauty face/makeup → bathroom/vanity
- Beauty body/skincare → bathroom
- Fashion clothing → bedroom/mirror
- Fashion accessories → outdoor/coffee shop
- Home/kitchen → kitchen counter
- Lifestyle → living room

## Output Format
5 complete Freepik prompts, each with:
- Shot ID
- Timing
- Full prompt (base + scene-specific additions)
- Composition notes
- Props list

## Critical Rules
- NEVER change: face, hair color, hair length, skin tone, age
- CAN change: outfit (appropriate to setting), expression, background details
- Product must be visible and identifiable in relevant shots
```

---

### Skill #3: DM_ScriptStructurer_Skill
**Purpose:** Build timed 20-second script with all sections

**File:** `/mnt/skills/user/dm_script_structurer/SKILL.md`

```markdown
# DM_ScriptStructurer_Skill

Build production-ready video scripts with precise timing and structure.

## Script Formula
20-second video = 4 sections:
1. **Hook** (0-2s) — 8-10 words, pattern interrupt
2. **Product** (2-14s) — 25-35 words, specific details
3. **Trust** (14-18s) — 15-20 words, authentic reaction
4. **CTA** (18-20s) — 8-10 words, clear action

Total: 55-70 words = 20 seconds at natural UGC pace

## Required Elements
Hook: Text overlay + voiceover match exactly
Product: Price mention, 2-3 specific features, proof of use
Trust: One caveat or surprise (builds authenticity)
CTA: "Link in bio" OR "Tap product tag"

## Voice Direction
Add ElevenLabs expression tags:
- [curious] — for hooks
- [calm] — for product details
- [playfully] or [deadpan] — for trust moment
- [pause] — before key moments
- [continues after a beat] — for emphasis

## Output Format
JSON with:
- Full script by section (timing, text overlay, voiceover, visual cue)
- Word count per section
- Total duration estimate
- ElevenLabs settings

## Example
See: sofia-revlon-example-complete.md for full worked example
```

---

### Skill #4: DM_MetadataOptimizer_Skill
**Purpose:** Generate TikTok/Instagram metadata

**File:** `/mnt/skills/user/dm_metadata_optimizer/SKILL.md`

```markdown
# DM_MetadataOptimizer_Skill

Create optimized titles, captions, hashtags for TikTok and Instagram.

## TikTok Metadata Rules
Title: Max 150 chars, include hook + product + 1-2 hashtags
Caption: 3-4 lines, line breaks for readability, emojis minimal (1-2 max)
Hashtags: 3-5 ONLY (5 = primary + conversion + product + brand + modifier)
CTA: "Shop below 👇" or "Link in bio 🔗"

## Hashtag Strategy
1. Primary niche (e.g., #makeup, #fashion) — broad reach
2. Conversion hashtag (ALWAYS #tiktokmademebuyit) — intent signal
3. Product specific (e.g., #foundation, #jeans) — category
4. Brand tag (e.g., #sofialaurent) — searchability
5. Modifier (e.g., #drugstorebeauty, #budgetfashion) — audience filter

## Posting Time Recommendations
Beauty: 7am, 12pm, 7pm
Fashion: 11am, 3pm, 8pm
Lifestyle: 9am, 2pm, 9pm

## Output Format
JSON with:
- TikTok title (with char count)
- Caption (with line breaks)
- Hashtags (5 with rationale for each)
- Optimal posting time (with reasoning)
- Product tag placement instructions
```

---

### Skill #5: DM_ContentStrategySelector_Skill
**Purpose:** Choose format + hook based on product

**File:** `/mnt/skills/user/dm_content_strategy_selector/SKILL.md`

```markdown
# DM_ContentStrategySelector_Skill

Select optimal content strategy (hook format + content format + length) for a product.

## Decision Matrix

### By Product Category
Beauty Face → price_reveal + product_demo + 15-20s
Beauty Body → before_after + product_demo + 20-30s
Makeup → price_reveal OR pov + product_demo + 15-20s
Fashion Clothing → pov + try_on + 20-30s
Fashion Accessories → social_proof + styling_list + 20-30s
Home Organization → before_after + transformation + 30s

### By Price Point
< $20 → price_reveal (impulse trigger)
$20-$50 → pov OR discovery (justification needed)
> $50 → comparison (social proof needed)

### By Product Maturity
Trending/viral → social_proof (ride the wave)
Established → discovery (new angle)
New launch → before_after (need proof)

## Output Format
JSON with:
- hook_format (with rationale)
- content_format (with rationale)
- video_length (15s/20s/30s)
- setting (bathroom/bedroom/outdoor/etc)
- character_outfit (appropriate to scene)
- optimal_posting_time
```

---

## 🔗 PHASE 3: CONNECTING IT ALL

### Master Conversation Flow in Claude

**User input:**
```
Generate a TikTok video for this product:
https://amazon.com/dp/B08XYZ123

Character: Sofia Laurent
Platform: TikTok
```

**Claude's process:**

**Step 1: Use MCP to scrape product**
```
<use_mcp_tool>
  <server_name>dm-product-intel</server_name>
  <tool_name>scrape_amazon_product</tool_name>
  <arguments>
    <url>https://amazon.com/dp/B08XYZ123</url>
  </arguments>
</use_mcp_tool>

Result: Product data extracted
```

**Step 2: Use skill to select strategy**
```
<use_skill>
  <skill_name>dm_content_strategy_selector</skill_name>
  <inputs>
    <product_category>beauty_face_makeup</product_category>
    <price>14.99</price>
    <features>["24hr wear", "SPF 15", "doesn't oxidize"]</features>
  </inputs>
</use_skill>

Result: hook_format = "price_reveal", content_format = "product_demo"
```

**Step 3: Use skill to generate hooks**
```
<use_skill>
  <skill_name>dm_viral_hook_builder</skill_name>
  <inputs>
    <product_data>{...}</product_data>
    <hook_format>price_reveal</hook_format>
  </inputs>
</use_skill>

Result: 10 hook variations generated
```

**Step 4: Use skill to generate script**
```
<use_skill>
  <skill_name>dm_script_structurer</skill_name>
  <inputs>
    <selected_hook>"I spent $15 on this foundation and I'm never going back"</selected_hook>
    <product_data>{...}</product_data>
  </inputs>
</use_skill>

Result: Full 20s script with timing
```

**Step 5: Use skill to generate image prompts**
```
<use_skill>
  <skill_name>dm_image_prompt_generator</skill_name>
  <inputs>
    <character_profile>{sofia_laurent}</character_profile>
    <script>{...}</script>
    <setting>bathroom_vanity</setting>
  </inputs>
</use_skill>

Result: 5 Freepik prompts
```

**Step 6: Use skill to generate metadata**
```
<use_skill>
  <skill_name>dm_metadata_optimizer</skill_name>
  <inputs>
    <product_data>{...}</product_data>
    <script>{...}</script>
  </inputs>
</use_skill>

Result: Caption, hashtags, posting time
```

**Claude's output to user:**
```
✅ Video Package Ready for: Revlon ColorStay Foundation

📸 FREEPIK IMAGE PROMPTS (5 shots)
[Copy-paste ready prompts]

🎙️ ELEVENLABS AUDIO SCRIPT
[Copy-paste ready script with expression tags]

📝 TIKTOK METADATA
Title: I spent $15 on this foundation and I'm never going back | Revlon review
Caption: [full caption]
Hashtags: #makeup #tiktokmademebuyit #foundation #sofialaurent #drugstorebeauty
Post at: 7:00 AM EST Thursday

⏱️ ESTIMATED PRODUCTION TIME: 45 minutes

📊 PREDICTED PERFORMANCE
Views (24h): 3,000-8,000
Engagement: 6-9%
CTR: 2.5-4%

[Detailed breakdown available if you want it]
```

---

## 📦 INSTALLATION GUIDE

### 1. Set Up MCP Servers

**Install MCP SDK:**
```bash
pip install mcp
```

**Create server directory:**
```bash
mkdir ~/mcp-servers
cd ~/mcp-servers
```

**Build each MCP server:**
```bash
# Product Intel Server
mkdir dm-product-intel
cd dm-product-intel
# Copy implementation from above
# Install dependencies: pip install httpx beautifulsoup4 anthropic
```

**Add to Claude config:**
```json
// ~/Library/Application Support/Claude/claude_desktop_config.json
{
  "mcpServers": {
    "dm-product-intel": {
      "command": "python",
      "args": ["/path/to/dm-product-intel/server.py"]
    },
    "dm-tiktok-trends": {
      "command": "python",
      "args": ["/path/to/dm-tiktok-trends/server.py"]
    },
    "dm-viral-hooks": {
      "command": "python",
      "args": ["/path/to/dm-viral-hooks/server.py"]
    }
  }
}
```

---

### 2. Set Up Skills

**Create skill directory:**
```bash
mkdir ~/claude-skills/dm-ugc-factory
cd ~/claude-skills/dm-ugc-factory
```

**Create each skill:**
```bash
mkdir dm_viral_hook_builder
mkdir dm_image_prompt_generator
mkdir dm_script_structurer
mkdir dm_metadata_optimizer
mkdir dm_content_strategy_selector
```

**Write SKILL.md for each** (use templates above)

**Tell Claude where skills are:**
In Claude settings → Skills → Add folder: `~/claude-skills/dm-ugc-factory`

---

## 🎯 USAGE EXAMPLES

### Example 1: Simple Product URL
```
User: Generate video for https://amazon.com/dp/B08COLORSTAY

Claude:
[Uses MCP to scrape]
[Uses skills to generate all assets]
[Outputs complete package]
```

### Example 2: Batch Request
```
User: Generate 5 videos for these products:
1. [URL 1]
2. [URL 2]
3. [URL 3]
4. [URL 4]
5. [URL 5]

Character: Sofia Laurent
Mix of hook formats

Claude:
[Processes each product]
[Varies hook formats automatically]
[Outputs 5 complete packages]
```

### Example 3: Custom Parameters
```
User: Generate video for [URL]
Character: Sofia Laurent
Hook format: POV (force this one)
Video length: 15s (make it shorter)
Setting: Outdoor coffee shop

Claude:
[Respects user overrides]
[Generates accordingly]
```

---

## 📊 SUCCESS METRICS

Track these for each video generated:
- Time to generate (target: <5 minutes)
- User edits required (target: <10%)
- Final video performance (track after posting)
- Hook format success rate
- Character consistency score (manual review)

After 50-100 videos, you'll have data to:
- Optimize hook selection logic
- Improve prompt templates
- Identify winning patterns
- Justify building standalone product

---

*InfluencerLabs · Claude Implementation Guide*  
*Build the system in 2 weeks, validate before productizing*
