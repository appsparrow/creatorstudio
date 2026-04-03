# Creator Studio - Product Requirements Document (PRD)

**Version:** 2.0
**Date:** March 30, 2026
**Status:** Living Document

---

## 1. Product Overview

### 1.1 What is Creator Studio?

Creator Studio is an AI-powered content creation and publishing platform for social media creators, brands, and agencies. It enables users to create detailed virtual influencer personas, define target audiences, plan content calendars, generate AI images and videos, and publish directly to social media platforms -- all from a single canvas-style workspace.

**Core workflow:** Persona Creation → Audience Definition → Content Planning → Asset Generation → Review → Publishing

### 1.2 Problem Statement

Social media content creation involves fragmented tools and manual processes:
- Creators juggle multiple apps for planning, image creation, video editing, and scheduling
- Maintaining visual consistency across posts (same character, style, brand) is extremely difficult with AI tools
- Content calendars live in spreadsheets disconnected from the assets they describe
- Publishing requires manually downloading, uploading, and captioning across platforms
- No tool connects persona identity → target audience → content strategy → generation → publishing in one flow

### 1.3 Target Users

| User Type | Description |
|-----------|-------------|
| **Solo Creators** | Influencers and content creators who need consistent AI-generated visual content |
| **Brand Managers** | Marketing professionals managing persona-driven content campaigns |
| **Agencies** | Teams managing multiple personas/brands across social platforms |
| **AI Content Experimenters** | Creators exploring AI-generated characters for Instagram, TikTok, YouTube |

### 1.4 Key Value Propositions

1. **Persona-First Workflow** -- Define a character once; every generated image and video stays consistent
2. **Audience-Aware Content** -- Content is generated with target audience pain points and aspirations baked in
3. **AI-First Creation** -- Describe what you want; AI fills in all the details
4. **End-to-End Pipeline** -- From content idea to published post without leaving the app
5. **Canvas Workspace** -- Everything visible in one view, minimal navigation
6. **Multi-Model AI** -- NanoBanana, Gemini, and Kling for different generation needs

---

## 2. Technology Stack

### 2.1 Frontend

| Technology | Purpose |
|------------|---------|
| **React 19** + **TypeScript** | UI framework with type safety |
| **Vite 6** | Build tool with HMR |
| **Tailwind CSS 4** | Utility-first styling |
| **Motion (Framer Motion)** | Animations and transitions |
| **Lucide React** | Icon library |
| **React Router DOM** | Deep-linking support (optional) |

### 2.2 Backend (Production)

| Technology | Purpose |
|------------|---------|
| **Cloudflare Workers** + **Hono** | API server (edge-deployed) |
| **Supabase PostgreSQL** | Database with RLS |
| **Supabase Auth** | Authentication (email/password) |
| **Supabase Storage** | Image/video file storage |

### 2.3 Backend (Local Dev)

| Technology | Purpose |
|------------|---------|
| **Express.js** | Local API server |
| **better-sqlite3** | Local SQLite database |
| **Vite Proxy** | Routes /api to Express |

### 2.4 AI & External Services

| Service | Purpose |
|---------|---------|
| **Google Gemini API** | Text generation (content planning, persona generation) + Image generation |
| **NanoBanana API** | Primary image generation (Standard, v2, Ultra/Flash) |
| **Kling AI** | Image-to-video generation (v1, v1-Pro, v1.5, v3) |
| **Blotato API** | Social media publishing to Instagram |

---

## 3. Architecture

### 3.1 Workspace Layout (Canvas-Style)

```
┌──────┬───────────────┬─────────────────────────────────────────────┐
│ Rail │   Sidebar     │           Main Canvas                       │
│ 72px │   280px       │           flex-1                            │
│      │               │                                             │
│ Logo │ Persona Info  │  Post Editor / Calendar / Persona Editor    │
│ +New │ + New Post    │  Settings (slide-over panels)               │
│      │ AI Prompt     │                                             │
│ ○ P1 │ Import        │  ┌─Left Column──┬─Right Column─┐           │
│ ○ P2 │ List/Calendar │  │ Content      │ Image        │           │
│ ○ P3 │               │  │ sections     │ preview      │           │
│      │ Day 1  [img]  │  │ (click to    │ + generate   │           │
│      │ Day 2  [img]  │  │  edit)       │ + publish    │           │
│      │ Day 3  [img]  │  │              │ + status     │           │
│      │ ...           │  └──────────────┴──────────────┘           │
│ ⚙    │               │                                             │
└──────┴───────────────┴─────────────────────────────────────────────┘
```

### 3.2 Database Schema (Supabase)

**Tables:** personas, days, video_tasks, drive_assets, user_settings

All tables have `user_id` FK + Row Level Security. See `supabase/migrations/001_initial_schema.sql`.

---

## 4. Features (Built)

### 4.1 Authentication

- **Email/password sign-in and sign-up** via Supabase Auth
- Session persists across page reloads
- Auth token auto-injected into all API calls
- User profile displayed in settings with sign-out

### 4.2 Persona Management

#### Persona Card (Visual Editor)
- **Visual card layout** — not a form. 3-column grid showing identity, bio, traits as a persona infographic
- **Click-to-edit** on every field via InlineEdit component
- **AI Persona Generation** — type a description (e.g., "24yo Italian lifestyle influencer"), Gemini populates all fields
- AI prompt bar only shows for new/empty personas (hidden once populated)
- **Tabbed interface:** Profile | Friends | Target Audience

#### Persona Profile Tab
- **Identity**: Full name, age, gender, nationality, birthplace, profession, locations (tags)
- **Appearance**: Height, body type, face shape, eyes, hair, distinct features (tags)
- **Social Handles**: Instagram, TikTok, YouTube, Twitter/X
- **Psychographic**: Core traits, interests, values, motivations, fears (all as colored tags + bullet lists)
- **Backstory**: Click-to-edit text block
- **Mission**: Click-to-edit italic text
- **Fashion & Style**: Aesthetic, photography style, signature items (tags)
- **Lifestyle**: Routine, diet, pet, social media presence
- **Reference Images**: Upload multiple images, click to set primary, remove with confirmation
- **AI Analysis/Rules**: Collapsible JSON/text field for generation consistency enforcement
- **Danger Zone**: Delete persona with full warning about data loss (bottom of Profile tab only)

#### Friends Tab (Recurring Characters)
- Up to 6 friends/companions per persona
- Each friend: photo (upload), name, relationship, traits (tags), profession
- **Active/Inactive toggle** — deactivated friends dim and are excluded from content generation
- Friends appear as named supporting characters in generated images with diversity rules

#### Target Audience Tab
- Up to 6 audience segments per persona
- Each segment: name, age range, gender skew, locations (tags), core aspiration, pain points (tags), content resonance notes
- **Active/Inactive toggle** — inactive audiences hidden from post creation
- **"Generate with AI"** — Gemini analyzes persona and suggests 3 audience segments
- **Content Themes** — tag-based theme list (Fashion, Travel, Motivational, etc.)

### 4.3 Content Creation (Posts)

#### AI-First Post Creation
1. Click **"+ New Post"** — prompt panel appears
2. Describe what the influencer does: *"Sofia is traveling to Atlanta, visiting City Market..."*
3. Select **target audience** (from persona's defined segments, shown as cards)
4. Select **content focus** tags (from persona's content themes)
5. Click **"Generate Post"** — Gemini generates ALL fields for all 3 content types (Photo, Carousel, Video) in one prompt
6. Post appears as visual card with click-to-edit

#### Post Card (Visual Editor)
- **Content type tabs**: Photo | Carousel | Video — switching shows type-specific fields
- **Two-column layout**: Left = content sections, Right = media preview + actions
- All text fields are **click-to-edit** (InlineEdit)
- Auto-save with 1-second debounce

#### Photo Post
- Scene description, on-screen text with **position selector** (Top/Middle/Bottom)
- Text position previewed live on the image
- Generate Image button, click image for full-screen lightbox

#### Carousel Post
- 4 numbered slide cards with per-slide scene description + overlay text
- Generate All Slides button
- Horizontal slide thumbnail selector
- "+ Add slide" for more than 4

#### Video/Reel Post
- **Hook section** (prominent, amber) — first 1-3 seconds hook text
- **Thumbnail concept** — description of click-worthy thumbnail
- **Camera angle selector** — pills: Overhead, Zoom, Walking-in, Low angle, Close-up, Dolly, Pan, Tilt
- **Audio/Music** suggestion
- Generate Image → Generate Video pipeline

#### Post Fields (All Types)
- Theme, scene description, caption, hook, CTA, hashtags
- Location, music suggestion, notes
- **Story Arc**: Beautiful Day, Real Moment, Achievement, Lesson, Invitation
- **Caption Tone**: Aspirational, Relatable, Educational, Vulnerable, Playful
- Platforms: Instagram, TikTok, YouTube (toggleable)
- Hairstyle, style option
- Good to Post toggle

### 4.4 Image Generation

- **NanoBanana API** (primary) — text-to-image and image-to-image with persona reference images
- **Gemini** (fallback) — generates images with inline reference data
- **Persona consistency** — reference images + AI analysis rules injected into every prompt
- **Diversity rules** — primary persona is always focal point; supporting characters are diverse races/ethnicities
- **Friends integration** — named friends included as supporting characters when applicable
- **Text overlay** — browser-side canvas compositing at top/middle/bottom position
- **Carousel generation** — sequential 4-slide generation with first slide as reference for consistency
- Saves to Supabase Storage (production) or local filesystem (dev)

### 4.5 Video Generation

- **Kling AI** (v1, v1-Pro, v1.5, v3) with camera angle selection
- Image-to-video: generates 5-second video from a still image
- **Polling mechanism**: checks status every 10 seconds, up to 16 minutes
- **Webhook support**: Kling callback auto-links completed videos
- Camera angles: overhead, zoom, walking-in, low-angle, action close-up, dolly zoom, pan, tilt
- Video saved to storage, day updated automatically

### 4.6 Publishing

- **Blotato API** integration for Instagram publishing
- Publishes photos as posts, videos as Reels
- Hashtags limited to 5 for Instagram
- **Auto-scheduling**: configure posting times in Settings, posts with "Good to Post" flag auto-publish
- **Distributed time slots**: evenly spaces posts between start and end time (displayed in Settings)
- Status updates to "published" after successful post

### 4.7 Content Calendar

- **Monthly grid view** with image thumbnails per day
- **Drag-and-drop** to reschedule posts (change date)
- **Published posts locked** — cannot drag, shown with lock badge
- **Duplicate button** on published posts — creates draft copy with "(Copy)" suffix and today's date
- Month navigation (prev/next)
- Click day cell to select post and switch to editor

### 4.8 Sidebar & Navigation

- **Persona rail**: Avatar circles, click to switch, selected ring highlight
- **Content sidebar**: Persona info, action buttons, scrollable day list
- Day list shows: date box, theme, status badge, platform letters, image thumbnail
- **Published posts** show lock icon + duplicate button on hover
- **View toggle**: List view / Calendar view

### 4.9 Settings

- **API Keys**: NanoBanana, Kling (key + secret), Blotato — password fields with show/hide
- **Google Drive**: Folder URL for media library
- **Posting Configuration**: Mode (manual/auto), posts per day, start time, end time
- **Distributed time slots** calculated and displayed
- **Network**: Public tunnel URL for webhooks
- **Save button** (explicit) + auto-save
- **Account section**: User email, sign-out

### 4.10 Google Sheets Import

- Import content calendar from public Google Sheet
- Configurable: Sheet ID, sheet name, start date, posts per day
- Avoid duplicates checkbox
- Maps columns to ContentDay fields

### 4.11 UX Features

- **Mobile responsive**: Collapsible sidebar, stacked layout, mobile top bar
- **Dark theme**: Black & white with rose/social accent colors
- **Custom logo**: CreatorStudio brand logo as favicon and sidebar icon
- **Confirmation modals**: Styled modal for all destructive actions (not browser confirm dialogs)
- **Lightbox**: Full-screen image preview on click
- **Blur effect**: Persona rail and sidebar blur when editor/settings panels are open
- **Published post locking**: View-only mode with duplicate option
- **Auto-save**: 1-second debounce on all edits

---

## 5. Data Models

### 5.1 Persona

```typescript
interface Persona {
  id: string;
  identity: { fullName, age, gender, nationality, birthplace, profession, locations[] };
  appearance: { height, bodyType, faceShape, eyes, hair, distinctFeatures[] };
  psychographic: { coreTraits[], interests[], values[], fears[], motivations[], mission };
  backstory: string;
  fashionStyle: { aesthetic, signatureItems[], photographyStyle };
  lifestyle: { routine, diet, pet?, socialMediaPresence };
  socialHandles?: { instagram?, tiktok?, youtube?, twitter?, x? };
  referenceImageUrl?: string;
  referenceImageUrls?: string[];
  aiAnalysis?: string;
  targetAudiences?: TargetAudience[];
  contentThemes?: string[];
  friends?: PersonaFriend[];
}
```

### 5.2 PersonaFriend

```typescript
interface PersonaFriend {
  id: string;
  name: string;
  imageUrl?: string;
  traits: string[];
  profession?: string;
  relationship?: string;
  active?: boolean;
}
```

### 5.3 TargetAudience

```typescript
interface TargetAudience {
  id: string;
  segmentName: string;
  ageRange: string;
  genderSkew: string;
  locations: string[];
  coreAspiration: string;
  painPoints: string[];
  contentResonanceNotes: string;
  active?: boolean;
}
```

### 5.4 ContentDay (Post)

```typescript
interface ContentDay {
  id: string;
  dayNumber: number;
  date: string;
  platforms: Platform[];
  theme, sceneDescription, onScreenText, caption, hook, hashtags, cta: string;
  location, musicSuggestion, notes: string;
  contentType: 'Photo' | 'Carousel' | 'Video';
  generatedImageUrl?, generatedVideoUrl?, customMediaUrl?: string;
  pendingVideoTaskId?: string;
  status: 'draft' | 'generating' | 'completed' | 'published';
  personaId: string;
  styleOption?, hairstyle?: string;
  isAIGenerated?, isGoodToPost?: boolean;
  textPosition?: 'top' | 'middle' | 'bottom';
  storyArc?: 'Beautiful Day' | 'Real Moment' | 'Achievement' | 'Lesson' | 'Invitation';
  captionTone?: 'Aspirational' | 'Relatable' | 'Educational' | 'Vulnerable' | 'Playful';
  targetAudienceSegment?: string;
  audienceMirrorHook?: string;
  featuredProducts?: FeaturedProduct[];
  postImageReferences?: { id, url, tag }[];
  slides?: CarouselSlide[];
}
```

### 5.5 UserSettings

```typescript
interface UserSettings {
  blotatoApiKey?, klingApiKey?, klingApiSecret?, nanobananaApiKey?: string;
  driveFolderUrl?, publicTunnelUrl?: string;
  postingMode?: 'manual' | 'auto';
  postingTime?, postingEndTime?: string;
  postsPerDay?: number;
}
```

---

## 6. API Reference

### Personas
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/personas` | List all personas (normalized columns → camelCase) |
| POST | `/api/personas` | Create or update persona (camelCase → snake_case) |
| DELETE | `/api/personas/:id` | Delete persona + cascade days |

### Content Days (Posts)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/days` | List all content days |
| POST | `/api/days` | Create or update content day |
| DELETE | `/api/days/:id` | Delete content day |

### Images
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/images/save` | Save base64 image to storage |
| POST | `/api/nanobanana/proxy` | Proxy image generation to NanoBanana |

### Videos
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/videos/generate` | Trigger Kling video generation |
| GET | `/api/videos/status/:taskId` | Check video generation status |
| POST | `/api/videos/save` | Download and save video to storage |
| POST | `/api/videos/callback` | Webhook for Kling async completion |

### Publishing
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/blotato/publish` | Publish content to Instagram via Blotato |

### Settings
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/settings` | Get user settings (snake_case → camelCase) |
| POST | `/api/settings` | Save user settings (camelCase → snake_case) |

### Google Drive
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/drive/list` | Sync files from Google Drive folder |
| GET | `/api/drive/assets` | Query drive assets with filters |
| PATCH | `/api/drive/assets/:id` | Update drive asset status |
| GET | `/api/drive/stats` | Aggregate drive asset counts |

---

## 7. Pending / Upcoming Features

| Feature | Description | Priority |
|---------|-------------|----------|
| **Cloudflare Deployment** | Deploy Worker + Pages to production | P0 |
| **Google Drive Image Selection** | Select images/videos from Drive per post, multi-select for carousels | P0 |
| **Products/Affiliates Catalog** | Per-persona product library with visual descriptions for AI prompt injection | P1 |
| **Product Picker per Post** | Attach products to posts, inject into image prompts and captions | P1 |
| **Facebook/Instagram Direct API** | Replace Blotato with direct Meta Graph API posting | P1 |
| **TikTok Publishing** | Direct TikTok API integration | P2 |
| **Storyline View** | Visual timeline showing narrative progression across posts | P2 |
| **Content Mix Dashboard** | % breakdown of story arcs + audience coverage analytics | P2 |
| **Light Mode Theme** | Alternate light theme option | P2 |
| **Supabase Realtime** | Replace video polling with realtime subscriptions | P3 |
| **Cloudflare Cron** | Move auto-scheduler from client to server-side cron | P3 |

---

## 8. Feature Inventory & Metrics

### 8.1 Feature Count by Category

| Category | Features | Complexity |
|----------|----------|------------|
| **Authentication & Account** | Email/password sign-in/sign-up, session persistence, auth token injection, user profile, sign-out | 5 features · Low |
| **Persona Management** | Visual card editor, AI persona generation from prompt, 4-tab editor (Profile/Friends/Audience/Settings), reference image upload with primary selection, thumbnail style references, social handles, AI analysis/consistency rules, inline click-to-edit, colored tag system, danger zone deletion | 10 features · High |
| **Friends & Companions** | Up to 6 friends per persona, photo upload, name/relationship/traits/profession, active/inactive toggle, friend image upload to R2, friends injected into AI generation prompts, diversity enforcement rules | 7 features · Medium |
| **Target Audience System** | Up to 6 segments per persona, AI-generated audience suggestions, pain points/aspirations/resonance notes, active/inactive toggle, content themes management, audience selection in post creation, audience-aware caption generation | 7 features · High |
| **Post Creation (AI-First)** | Prompt-driven creation, target audience selector (visual cards), content focus tag selector, AI generates ALL fields for ALL 3 content types in one prompt, story arc tagging (5 arcs), caption tone selection (5 tones), auto-save with debounce | 7 features · High |
| **Post Editor** | Visual post card (not form), content type tabs (Photo/Carousel/Video), two-column layout, inline click-to-edit, published post locking (view-only + duplicate), on-screen text position selector with live preview, date picker, status badges | 8 features · High |
| **Photo Posts** | Scene description, on-screen text overlay, text position (top/middle/bottom), position preview on image, generate/regenerate, Drive media selection, source badges (AI/Drive) | 7 features · Medium |
| **Carousel Posts** | 4+ numbered slide cards, per-slide scene + overlay text, generate all slides (sequential consistency), slide thumbnail selector, add slide, mix Drive + AI, multi-select from Drive | 7 features · High |
| **Video Posts** | Hook section, thumbnail concept, camera angle selector (8 angles), audio/music suggestion, thumbnail generation from style references, generate image → generate video pipeline, thumbnail preview | 7 features · High |
| **Image Generation** | NanoBanana API (primary), Gemini fallback, persona reference images for consistency, AI analysis rules enforcement, text overlay compositing (browser canvas), 3 position options, saves to Cloudflare R2, carousel consistency (first slide as reference), diversity rules for supporting characters, friends as named characters | 10 features · Very High |
| **Video Generation** | Kling AI (4 model variants), 8 camera angle presets, 10-second polling (16 min timeout), webhook callback support, video save to R2, task ID mapping | 6 features · High |
| **Thumbnail Generation** | Per-persona thumbnail style references, AI thumbnail generation, close-up/expressive composition prompting, separate thumbnail URL storage | 4 features · Medium |
| **Google Drive Integration** | Per-persona Drive folder, sync files with thumbnails, Drive picker modal (single/multi select), content type filtering, file size display, Drive URL → displayable thumbnail conversion, mix Drive + AI media, referrerPolicy handling | 8 features · High |
| **Content Calendar** | Monthly grid view, image thumbnails per day, drag-and-drop rescheduling, published post locking (lock badge), duplicate button on published posts (Copy suffix + today's date), month navigation, click to select | 7 features · Medium |
| **Sidebar Navigation** | Persona rail with avatar circles, content sidebar with post list, date boxes, status badges, content type icons (Photo/Video/Carousel), platform letters, drag-and-drop reorder (date swapping), hover drag affordance on date box, saving indicator | 9 features · Medium |
| **Publishing** | Blotato API → Instagram, photos as posts, videos as Reels, hashtag limiting (5 max), media upload to Blotato, account auto-detection | 6 features · Medium |
| **Scheduling** | Per-persona posting mode (manual/auto), posts per day, start/end time, distributed time slot calculator with display, good-to-post workflow flag | 5 features · Medium |
| **Settings** | Global API keys (NanoBanana, Kling key+secret, Blotato), network tunnel URL, per-persona Drive folder, per-persona posting schedule, explicit save button, user account section | 6 features · Low |
| **Import** | Google Sheets import, configurable Sheet ID + sheet name, start date, posts per day, duplicate avoidance, column mapping to ContentDay fields | 6 features · Medium |
| **Confirmation System** | Custom ConfirmModal component (not browser dialogs), danger variant (red) + default variant (white), animated entrance, used for all destructive actions (7 confirm points) | 2 features · Low |
| **UX & Polish** | Mobile responsive (collapsible sidebar, stacked layout, mobile top bar), dark theme (B&W + rose accents), custom logo/favicon, full-screen image lightbox, blur effect when panels open, auto-save (1-second debounce), InlineEdit component, TagList component, StatRow component | 9 features · Medium |
| **Infrastructure** | Cloudflare Workers (Hono), Cloudflare Pages, Cloudflare R2 (zero egress), Supabase PostgreSQL with RLS, Supabase Auth, camelCase↔snake_case conversion, 16 API endpoints, R2 media serving route | 8 features · High |

### 8.2 Summary

| Metric | Value |
|--------|-------|
| **Total Features** | **~152** |
| **Production Code** | **~6,650 lines** (TypeScript) |
| **API Endpoints** | **16** |
| **AI Service Integrations** | **5** (Gemini text, Gemini image, NanoBanana, Kling, Blotato) |
| **Data Models** | **7** (Persona, Friend, TargetAudience, ContentDay, CarouselSlide, FeaturedProduct, UserSettings) |
| **Database Tables** | **5** (personas, days, video_tasks, drive_assets, user_settings) |
| **External Integrations** | **7** (Supabase, Cloudflare Workers, Cloudflare R2, Google Drive API, NanoBanana, Kling AI, Blotato) |

---

## 9. Pending / Upcoming Features

| Feature | Description | Priority |
|---------|-------------|----------|
| **Products/Affiliates Catalog** | Per-persona product library with visual descriptions for AI prompt injection | P1 |
| **Product Picker per Post** | Attach products to posts, inject into image prompts and captions | P1 |
| **Facebook/Instagram Direct API** | Replace Blotato with direct Meta Graph API posting | P1 |
| **TikTok Publishing** | Direct TikTok API integration | P2 |
| **Storyline View** | Visual timeline showing narrative progression across posts | P2 |
| **Content Mix Dashboard** | % breakdown of story arcs + audience coverage analytics | P2 |
| **Light Mode Theme** | Alternate light theme option | P2 |
| **Supabase Realtime** | Replace video polling with realtime subscriptions | P3 |
| **Cloudflare Cron** | Move auto-scheduler from client to server-side cron | P3 |
| **Multi-user / Team** | Roles (creator/reviewer/publisher), approval workflows | P3 |

---

*This PRD reflects Creator Studio as of March 31, 2026 — Version 2.1 with 152+ features, deployed on Cloudflare (Pages + Workers + R2), Supabase PostgreSQL, and 5 AI service integrations.*

*For build cost analysis and team estimation, see [docs/build-cost-analysis.md](docs/build-cost-analysis.md).*
