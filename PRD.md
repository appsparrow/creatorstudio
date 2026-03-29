# Creator Studio - Product Requirements Document (PRD)

**Version:** 1.0
**Date:** March 28, 2026
**Status:** Living Document

---

## 1. Product Overview

### 1.1 What is Creator Studio?

Creator Studio is an AI-powered content creation and publishing platform designed for social media creators and brands. It enables users to create detailed virtual personas, plan content calendars, generate AI images and videos, and publish directly to social media platforms -- all from a single desktop application.

The product streamlines the end-to-end content workflow: **Persona Creation -> Content Planning -> Asset Generation -> Review -> Publishing**.

### 1.2 Problem Statement

Social media content creation involves fragmented tools and manual processes:
- Creators juggle multiple apps for planning, image creation, video editing, and scheduling
- Maintaining visual consistency across posts (same character, style, brand) is extremely difficult with AI tools
- Content calendars live in spreadsheets disconnected from the assets they describe
- Publishing requires manually downloading, uploading, and captioning across platforms

Creator Studio solves this by unifying persona management, AI-driven content generation, and social publishing into one coherent workflow.

### 1.3 Target Users

| User Type | Description |
|-----------|-------------|
| **Solo Creators** | Influencers and content creators who need consistent AI-generated visual content |
| **Brand Managers** | Marketing professionals managing persona-driven content campaigns |
| **Agencies** | Teams managing multiple personas/brands across social platforms |
| **AI Content Experimenters** | Creators exploring AI-generated characters for Instagram, TikTok, YouTube |

### 1.4 Key Value Propositions

1. **Persona-First Workflow** -- Define a character once; every generated image and video stays consistent
2. **End-to-End Pipeline** -- From content idea to published post without leaving the app
3. **Multi-Model AI** -- Choose between Gemini, NanoBanana, and Kling for different generation needs
4. **Calendar-Driven Planning** -- Visual content calendar with drag-and-drop scheduling
5. **One-Click Publishing** -- Direct posting to Instagram via Blotato integration

---

## 2. Technology Stack

### 2.1 Frontend

| Technology | Version | Purpose |
|------------|---------|---------|
| **React** | 19.0.0 | UI framework |
| **TypeScript** | 5.8.2 | Type-safe development |
| **Vite** | 6.2.0 | Build tool with HMR |
| **Tailwind CSS** | 4.1.14 | Utility-first styling |
| **Motion** | 12.38.0 | UI animations |
| **Lucide React** | 0.546.0 | Icon library |

### 2.2 Backend

| Technology | Version | Purpose |
|------------|---------|---------|
| **Express.js** | 4.21.2 | API server |
| **Node.js + tsx** | -- | TypeScript execution |
| **better-sqlite3** | 12.8.0 | Local SQLite database |
| **CORS** | 2.8.6 | Cross-origin support |
| **dotenv** | 17.2.3 | Environment configuration |

### 2.3 AI & External Services

| Service | Purpose | Integration Type |
|---------|---------|-----------------|
| **Google Gemini API** | Text generation (content planning) + Image generation | REST API via `@google/genai` SDK |
| **NanoBanana API** | Alternative image generation (Standard, v2, Ultra/Flash sub-models) | Proxied REST API with polling |
| **Kling AI** | Image-to-video generation (5-second videos, multiple camera angles) | REST API with JWT auth + webhook callbacks |
| **Blotato API** | Social media publishing to Instagram (photos + reels) | REST API |
| **Google Sheets** | Content calendar import | Public sheet fetch |
| **Google Drive** | Media asset selection/override | URL-based integration |

### 2.4 Database

| Technology | Type | Storage |
|------------|------|---------|
| **SQLite3** | Local file-based | `database.db` with 3 tables: `personas`, `days`, `video_tasks` |

### 2.5 Infrastructure

| Component | Technology |
|-----------|-----------|
| Dev Server (Frontend) | Vite on port 3000 |
| API Server (Backend) | Express on port 3001 |
| Proxy | Vite proxies `/api` and `/uploads` to backend |
| Webhook Tunnel | ngrok for Kling video callbacks |
| Asset Storage | Local filesystem at `/public/uploads/{personaId}/` |

---

## 3. Database Schema

### 3.1 Tables

```
personas
  - id: TEXT (PK)           -- UUID
  - data: TEXT              -- JSON-serialized Persona object

days
  - id: TEXT (PK)           -- UUID
  - personaId: TEXT         -- FK -> personas.id
  - data: TEXT              -- JSON-serialized ContentDay object

video_tasks
  - taskId: TEXT (PK)       -- Kling task ID
  - dayId: TEXT             -- FK -> days.id
  - createdAt: INTEGER      -- Unix timestamp
```

### 3.2 Persona Data Model (JSON in `personas.data`)

| Category | Fields |
|----------|--------|
| **Identity** | fullName, age, gender, nationality, birthplace, profession, locations[] |
| **Appearance** | height, bodyType, faceShape, eyes, hair, distinctFeatures[] |
| **Psychographic** | coreTraits[], interests[], values[], fears[], motivations[], mission |
| **Fashion** | aesthetic, signatureItems[], photographyStyle |
| **Lifestyle** | routine, diet, pet, socialMediaPresence |
| **References** | referenceImageUrl, referenceImageUrls[] |
| **AI Rules** | Custom JSON enforcement rules for generation consistency |

### 3.3 ContentDay Data Model (JSON in `days.data`)

| Category | Fields |
|----------|--------|
| **Scheduling** | dayNumber, date, platforms[] |
| **Content** | contentType (Photo/Carousel/Video), theme, sceneDescription |
| **Copy** | onScreenText, caption, hook, hashtags, CTA |
| **Metadata** | location, musicSuggestion, notes, hairstyle |
| **Media** | generatedImageUrl, generatedVideoUrl, carouselSlides[] |
| **Status** | status (draft/generating/completed/published), isGoodToPost, pendingVideoTaskId |

---

## 4. Features & Use Cases

### 4.1 Persona Management

#### UC-1: Create a New Persona
**Description:** User creates a detailed virtual persona that serves as the consistent character across all generated content.

**Flow:**
1. Click "+" in the persona rail
2. Persona editor modal opens with comprehensive fields
3. Fill in identity, appearance, psychographic, fashion, and lifestyle details
4. Upload reference images for AI consistency
5. System creates dedicated upload folder at `/uploads/{personaId}/`
6. Persona saved to SQLite database

**Persona Fields:**
- **Identity:** Full name, age, gender, nationality, birthplace, profession, current locations
- **Appearance:** Height, body type, face shape, eye details, hair details, distinct features
- **Psychographic:** Core personality traits, interests, values, fears, motivations, personal mission
- **Fashion & Style:** Aesthetic description, signature items, photography style preference
- **Lifestyle:** Daily routine, diet, pet, social media presence description
- **Reference Images:** Multiple reference image URLs for AI generation consistency
- **AI Rules:** Custom JSON rules injected into every generation prompt for strict consistency

**Default Persona:** Ships with "Sofia Laurant" (Italian lifestyle creator) to demonstrate the feature.

#### UC-2: Edit an Existing Persona
Modify persona details via the editor modal. Changes affect all future content generation.

#### UC-3: Delete a Persona
"Danger Zone" section in editor modal. Confirms deletion and removes persona + all associated days from database.

#### UC-4: Switch Between Personas
Persona rail displays avatars (20px thumbnails with tooltips). Clicking switches the active persona context -- sidebar and main area update to show that persona's content.

---

### 4.2 Content Planning

#### UC-5: Create a Content Day Manually
Click "New Day" to create a blank day with auto-incremented number and date. Fill in all fields:
- Platform(s): Instagram, TikTok, YouTube
- Content Type: Photo, Carousel, Video
- Theme, scene description, on-screen text
- Caption, hook, hashtags, CTA
- Location tag, music suggestion, notes

#### UC-6: AI-Generated Content Plan
Enter a natural language prompt (e.g., "Morning coffee at a Parisian cafe, cozy autumn vibes"). Gemini (`gemini-3-flash-preview`) returns structured JSON with all content day fields populated. User reviews, edits, and saves.

**AI generates:** theme, scene description, caption, hashtags, CTA, music suggestion, location, and carousel slide descriptions (4 slides per carousel).

#### UC-7: Import from Google Sheets
Import a pre-planned content calendar from Google Sheets. Maps columns: day number, platform, content type, theme, scene description, hook, on-screen text, caption, hashtags, CTA, location, music, notes. Configurable start date and posts-per-day with duplicate avoidance.

#### UC-8: Import via JSON
Paste or upload structured JSON containing persona and day data. System creates corresponding entries.

#### UC-9: Calendar View
Monthly calendar grid with posts grouped by date. Status indicators (New, Scheduled, Generating, Generated, Posted). Drag-and-drop to reschedule. Click to switch to detail view.

#### UC-10: List View with Sidebar
Sidebar navigation of all days for selected persona. Color-coded status badges and platform indicators. Click to load in main content area for editing.

---

### 4.3 Image Generation

#### UC-11: Generate AI Image with Gemini
Primary image generation using `gemini-3.1-flash-image-preview`:
- Constructs prompt from persona appearance + scene description + style modifiers
- Sends reference images for consistency
- Enforces: "DO NOT ALTER THE FACE, HAIR, OR BASE FEATURES"
- Hairstyle randomly selected from 11 predefined styles
- Generates 9:16 aspect ratio (1K resolution)
- Saves to `/public/uploads/{personaId}/`

**Style Options:** Luxury/High-end, Casual/Street, Morning Cozy, Elegant Evening, Formal/Corporate

**Consistency Features:**
- Persona reference images sent with every request
- Post-level image references (Location, Style, FaceSwap tags)
- AI rules enforce character consistency
- Candid/unposed shot direction

#### UC-12: Generate AI Image with NanoBanana
Alternative generation via NanoBanana API (proxied through backend). Sub-models: Standard, v2, Ultra/Flash. Supports text-to-image and image-to-image. Polling: every 5 seconds, up to 2.5 min timeout.

#### UC-13: Generate Carousel Images
4-slide carousels with sequential generation. First slide uses full persona reference; subsequent slides use first slide as additional reference for consistency (clothing, hairstyle, accessories maintained across slides).

#### UC-14: Use Google Drive Media
Select pre-existing media from Google Drive dropdown. Formats URL for direct download.

#### UC-15: Manual Media URL Override
Enter any publicly accessible image/video URL to bypass AI generation.

---

### 4.4 Video Generation

#### UC-16: Generate Video from Image (Kling AI)
Convert a generated image into a 5-second video:

1. Select camera angle from 8 options: overhead, zoom, walking-in, low-angle, action close-up, dolly zoom, pan, tilt
2. System generates JWT token (HS256, 30-min expiry)
3. Sends image + prompt + camera to Kling API (with Singapore fallback)
4. Stores `taskId -> dayId` in `video_tasks` table
5. Kling processes asynchronously; webhook at `/api/videos/callback` receives result
6. Video auto-downloads to `/public/uploads/`; day updated with `generatedVideoUrl`

**Model Options:** v1, v1-Pro, v1.5, v3

---

### 4.5 Publishing & Posting

#### UC-17: Publish to Instagram (Manual)
1. Click "Publish" on a reviewed content day
2. System fetches connected Instagram account via Blotato API
3. Uploads media to Blotato servers
4. Applies text overlay on images (semi-transparent box, bottom-aligned, max 3 lines)
5. Publishes as Photo post or Reel (for videos)
6. Hashtags limited to 5 for Instagram
7. Returns `platformPostId`; status updates to "published"

#### UC-18: Auto-Schedule Publishing
1. Enable "Auto-schedule" in Settings with daily posting time
2. System polls every 30 seconds
3. Publishes posts matching: today's date + `isGoodToPost=true` + not yet published
4. Sequential queue with 2-minute gaps between posts
5. Status auto-updates to "published"

#### UC-19: Mark as "Good to Post"
Toggle `isGoodToPost` flag after reviewing content. Required for auto-scheduling eligibility.

---

### 4.6 Settings & Configuration

#### UC-20: Configure API Keys & Services
Settings panel with:
- **NanoBanana:** API key + sub-model selection (Standard, v2, Ultra/Flash)
- **Kling Video:** API key + secret + model selection (v1, v1-Pro, v1.5, v3)
- **Blotato:** API key for social publishing
- **Public Tunnel URL:** ngrok URL for webhook callbacks
- **Publishing Mode:** Manual or Auto-schedule with daily time picker

All settings persist in `localStorage`.

---

## 5. User Flows

### 5.1 End-to-End: Persona to Published Post

```
Create Persona --> Plan Content Calendar --> Generate Images --> Generate Videos (opt.)
      |                    |                      |                       |
 Define identity,   AI-generate plan,      Gemini / NanoBanana     Kling converts
 appearance, style  import Sheets/JSON,    with persona refs       image to 5s video
 + reference imgs   or create manually
      |                    |                      |                       |
      v                    v                      v                       v
                  Review & Approve  -------->  Publish to Instagram
                  (isGoodToPost)               Manual or Auto-scheduled
```

### 5.2 Persona Setup Flow

```
1. Click "+" in persona rail
2. Fill identity (name, age, profession, nationality)
3. Define appearance (face, eyes, hair, body, distinct features)
4. Set psychographic profile (traits, interests, values, motivations)
5. Describe fashion aesthetic and signature items
6. Upload reference images (critical for AI consistency)
7. Add custom AI rules (optional JSON enforcement)
8. Save -> folder created at /uploads/{personaId}/
```

### 5.3 Content Day: Idea to Post

```
1. Select persona
2. Create day (manual or AI-assisted)
3. Fill: theme, scene description, caption, hashtags
4. Choose type (Photo / Carousel / Video)
5. Generate image (select style + model)
6. Review generated image
7. Generate video from image (optional)
8. Mark "Good to Post"
9. Publish (manual or auto-schedule)
10. Status -> "Published"
```

---

## 6. Architecture Diagram

```
+------------------+         +------------------+         +------------------+
|   React + Vite   |  proxy  |   Express API    |         |    SQLite DB     |
|   (Port 3000)    | ------> |   (Port 3001)    | ------> |  (database.db)   |
|   TypeScript     |         |   TypeScript     |         |  3 tables        |
|   Tailwind CSS   |         |   better-sqlite3 |         |                  |
+------------------+         +--------+---------+         +------------------+
                                      |
                     +----------------+----------------+
                     |                |                |
               +-----------+   +-----------+   +-----------+
               | Gemini    |   | NanoBanana|   | Kling AI  |
               | API       |   | API       |   | API       |
               | text +    |   | image gen |   | video gen |
               | image gen |   |           |   | + webhook |
               +-----------+   +-----------+   +-----------+
                     |                               |
               +-----------+                   +-----------+
               | Google    |                   | Blotato   |
               | Sheets +  |                   | API       |
               | Drive     |                   +-----------+
               +-----------+                         |
                                               +-----------+
                                               | Instagram |
                                               +-----------+
```

---

## 7. API Reference

### Personas
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/personas` | List all personas |
| POST | `/api/personas` | Create or update persona |
| DELETE | `/api/personas/:id` | Delete persona + associated content |

### Content Days
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/days` | List all content days |
| POST | `/api/days` | Create or update content day |
| DELETE | `/api/days/:id` | Delete content day |

### Images
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/images/save` | Save base64 image to local storage |
| POST | `/api/nanobanana/proxy` | Proxy image generation to NanoBanana |

### Videos
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/videos/generate` | Trigger Kling video generation |
| GET | `/api/videos/status/:taskId` | Check video generation status |
| POST | `/api/videos/save` | Download and save video locally |
| POST | `/api/videos/callback` | Webhook for Kling async completion |

### Publishing
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/blotato/publish` | Publish content to Instagram via Blotato |

---

## 8. Current Limitations

| Limitation | Detail |
|-----------|--------|
| **Local-Only** | No cloud deployment; runs on developer's machine |
| **Single-User** | No authentication or multi-user support |
| **Instagram-Only Publishing** | TikTok and YouTube publishing not yet implemented |
| **SQLite** | Not production-scale; adequate for local use |
| **ngrok Required** | Video callbacks need an active ngrok tunnel |
| **No Asset Versioning** | Regeneration overwrites previous images; no history |
| **Unencrypted Keys** | API keys stored in browser localStorage |
| **Google Drive Mock** | Drive file selection is partially mocked |

---

## 9. Future Roadmap Considerations

| Area | Ideas |
|------|-------|
| **Platforms** | TikTok publishing, YouTube Shorts, Twitter/X, LinkedIn |
| **Persona** | AI-assisted persona creation from reference photos, voice/tone training |
| **Analytics** | Post performance tracking, optimal posting times, hashtag insights |
| **Collaboration** | Multi-user with roles (creator/reviewer/publisher), approval workflows |
| **Infrastructure** | Cloud deployment (Supabase), encrypted credentials, CDN, job queues |
| **Content** | A/B testing for captions, trending audio suggestions, template library |

---

## 10. Glossary

| Term | Definition |
|------|-----------|
| **Persona** | A detailed virtual character profile for consistent AI content generation |
| **Content Day** | A single planned post with all metadata (caption, hashtags, media, etc.) |
| **Carousel** | A multi-slide Instagram post (4 slides in Creator Studio) |
| **Reel** | A short-form video post on Instagram |
| **Blotato** | Third-party API for publishing to social media platforms |
| **NanoBanana** | Third-party AI image generation service |
| **Kling AI** | Third-party AI video generation service (image-to-video) |
| **Reference Image** | Persona photo used to maintain visual consistency in AI generation |
| **isGoodToPost** | Flag indicating content is reviewed and approved for publishing |
| **Content Type** | Photo, Carousel, or Video |

---

*This PRD reflects the current state of Creator Studio as of March 2026. It is a living document for communicating the product's capabilities, architecture, and use cases to stakeholders and for planning future development.*
