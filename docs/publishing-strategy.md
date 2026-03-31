# Creator Studio — Publishing Strategy & Platform Integration Guide

**Last Updated:** March 29, 2026
**Purpose:** Document the complete publishing strategy, API integrations, and workflows so this can be replicated for other clients.

---

## Table of Contents

1. [Publishing Architecture Overview](#1-publishing-architecture-overview)
2. [Platform Behavior Matrix](#2-platform-behavior-matrix)
3. [Blotato API Integration](#3-blotato-api-integration)
4. [Instagram Graph API Direct Integration](#4-instagram-graph-api-direct-integration)
5. [TikTok Publishing](#5-tiktok-publishing)
6. [Google Drive Media Pipeline](#6-google-drive-media-pipeline)
7. [Media Size Limits & Workarounds](#7-media-size-limits--workarounds)
8. [Auto-Scheduling Logic](#8-auto-scheduling-logic)
9. [Text Overlay Strategy](#9-text-overlay-strategy)
10. [Setup Checklist for New Clients](#10-setup-checklist-for-new-clients)

---

## 1. Publishing Architecture Overview

```
Creator Studio App
      |
      ├── Photos ──────> Blotato API ──────> Instagram (published live with text overlay)
      |                       └──────────> TikTok (published live)
      |
      └── Videos ──────> Instagram Graph API ──> Unpublished Container
      |                  (user edits in app:       (add sound, text, cover)
      |                   adds sound, text)         then publishes manually)
      |
      └── Videos ──────> Blotato API ──────> TikTok (saved as draft)
                                              (user opens TikTok app to
                                               add sound and publish)
```

### Why Two APIs?

| API | Used For | Why |
|-----|----------|-----|
| **Blotato** | Photos (all platforms), TikTok videos | Simple API, handles media upload + publishing in one call. Supports `isDraft` for TikTok. |
| **Instagram Graph API** | Instagram videos/reels | Blotato doesn't support Instagram drafts. The Graph API's two-step process (create container → publish) lets us stop at step 1, leaving the reel as an unpublished container the user can edit in-app. |

---

## 2. Platform Behavior Matrix

### Default Publishing Behavior

| Content Type | Instagram | TikTok |
|-------------|-----------|--------|
| **Photo** | Published live with text overlay (hook text burned onto image) | Published live |
| **Carousel** | Published live (multiple images) | N/A |
| **Video/Reel** | Uploaded as unpublished container (user adds sound + text in app, then publishes) | Saved as draft (user opens TikTok to edit and publish) |

### Why Videos Are NOT Auto-Published

Videos/Reels need manual editing before going live because:
1. **Sound/Music** — Instagram's music library can only be added in-app, not via API
2. **Text overlays on video** — Animated text, captions, stickers are in-app features
3. **Cover image** — Must be selected/cropped in-app for the profile grid
4. **Trending audio** — Creator needs to pick audio manually for algorithm boost
5. **Quality control** — Videos need more review than photos before posting

### Key Limitation: Instagram Does NOT Support Drafts via API

- `isDraft` in Blotato = TikTok only
- Instagram Graph API has no "save as draft" endpoint
- **Workaround:** Create an unpublished media container (Step 1 of publish flow). The video is uploaded and processed by Instagram but NOT published. The creator then publishes it from the Instagram app.

---

## 3. Blotato API Integration

### Authentication
```
Authorization: Bearer {BLOTATO_API_KEY}
x-api-key: {BLOTATO_API_KEY}
```

### Connected Accounts
```
GET https://backend.blotato.com/v2/users/me/accounts
```
Returns all connected social accounts (Instagram, TikTok, etc.)

### Media Upload
```
POST https://backend.blotato.com/v2/media
Body: { "url": "data:image/jpeg;base64,..." }  // base64 for small files
Body: { "url": "https://drive.google.com/..." } // direct URL for large files
```
**Base64 limit: 20MB.** For larger files, pass the URL directly.

### Publishing a Post
```json
POST https://backend.blotato.com/v2/posts
{
  "post": {
    "accountId": "account-uuid",
    "content": {
      "text": "Caption text\n\n#hashtag1 #hashtag2",
      "mediaUrls": ["https://blotato-hosted-url.com/media.jpg"],
      "platform": "instagram"  // or "tiktok"
    },
    "target": {
      "targetType": "instagram",  // or "tiktok"
      "mediaType": "reel"         // for videos; omit for photos
    }
  },
  "isDraft": true,               // TikTok ONLY — saves as draft
  "scheduledTime": "2026-03-30T09:00:00Z"  // optional — schedule for later
}
```

### Blotato Limitations

| Feature | Instagram | TikTok |
|---------|-----------|--------|
| Publish photos | Yes | Yes |
| Publish reels | Yes | Yes |
| `isDraft` | **NO** | Yes |
| `scheduledTime` | Yes | Yes |
| Carousel | Yes (multiple mediaUrls) | No |
| Stories | No | No |
| Hashtag limit | 5 recommended | 5 recommended |

---

## 4. Instagram Graph API Direct Integration

### When To Use This Instead of Blotato

Use the Instagram Graph API directly when you need:
- Unpublished reel containers (pseudo-drafts)
- More control over the publishing flow
- Direct access to insights/analytics

### Prerequisites

| Requirement | Details |
|-------------|---------|
| **Facebook App** | Create at [developers.facebook.com](https://developers.facebook.com) → Business type |
| **Instagram Account Type** | Must be Creator or Business (not Personal) |
| **Facebook Page** | Each Instagram account must be connected to a Facebook Page |
| **Permissions** | `instagram_content_publish`, `instagram_basic`, `pages_show_list`, `pages_read_engagement` |

### Account Structure (Multi-Channel)

```
Your Facebook Account (admin/owner)
  └── Facebook Developer App (created once, shared across all channels)
        └── User Access Token (one token from your Facebook login)
              ├── Instagram Account A → ig_user_id: 17841400XXXXXX
              ├── Instagram Account B → ig_user_id: 17841400YYYYYY
              └── Instagram Account C → ig_user_id: 17841400ZZZZZZ
```

**Key insight:** You only need ONE Facebook App and ONE User Access Token to manage ALL Instagram accounts you own/admin. The token gives access to every connected Instagram account.

### Token Management

```bash
# 1. Get short-lived token (1 hour) from Graph API Explorer
#    https://developers.facebook.com/tools/explorer/
#    Select your app, add permissions, generate token

# 2. Exchange for long-lived token (60 days)
GET https://graph.facebook.com/v21.0/oauth/access_token
  ?grant_type=fb_exchange_token
  &client_id={APP_ID}
  &client_secret={APP_SECRET}
  &fb_exchange_token={SHORT_LIVED_TOKEN}

# 3. Get Instagram Account IDs
GET https://graph.facebook.com/v21.0/me/accounts?fields=id,name,instagram_business_account
# Response includes ig_user_id for each connected Instagram account
```

### Two-Step Reel Publishing (The "Draft" Workaround)

#### Step 1: Create Media Container (Upload Video)
```
POST https://graph.facebook.com/v21.0/{ig_user_id}/media
  ?media_type=REELS
  &video_url=https://drive.google.com/uc?export=download&id=FILE_ID
  &caption=Your caption here #hashtags
  &access_token={TOKEN}
```

Response:
```json
{ "id": "17889615691234567" }  // container_id
```

#### Step 1.5: Poll Container Status (Wait for Processing)
```
GET https://graph.facebook.com/v21.0/{container_id}
  ?fields=status_code
  &access_token={TOKEN}
```

Poll until `status_code` = `FINISHED`. Video processing can take 30s to several minutes.

Status codes:
- `IN_PROGRESS` — still processing
- `FINISHED` — ready to publish
- `EXPIRED` — took too long, retry
- `ERROR` — something went wrong

#### Step 2: Publish (SKIP THIS for "draft" behavior)
```
POST https://graph.facebook.com/v21.0/{ig_user_id}/media_publish
  ?creation_id={container_id}
  &access_token={TOKEN}
```

**By doing Step 1 only and skipping Step 2, the reel is uploaded and processed but NOT published.** The creator can then:
1. Open Instagram app
2. Find the reel in their content/pending
3. Add sound, text overlays, stickers, cover image
4. Publish manually when ready

### Rate Limits

| Limit | Value |
|-------|-------|
| API-published posts per 24 hours | 25 |
| Media containers created per hour | 50 |
| API calls per hour | 200 |

---

## 5. TikTok Publishing

### Via Blotato (Recommended)

TikTok publishing through Blotato is the simplest path:

```json
{
  "post": {
    "accountId": "tiktok-account-id",
    "content": {
      "text": "Caption #hashtag",
      "mediaUrls": ["https://hosted-video-url.mp4"],
      "platform": "tiktok"
    },
    "target": {
      "targetType": "tiktok",
      "privacyLevel": "PUBLIC_TO_EVERYONE",
      "isAiGenerated": true
    }
  },
  "isDraft": true  // This actually works for TikTok!
}
```

### TikTok Draft Workflow
1. Video uploaded via Blotato with `isDraft: true`
2. TikTok sends a push notification to the creator's phone
3. Creator opens TikTok → goes to notifications → finds the draft
4. Adds sound, effects, text
5. Posts from the app

---

## 6. Google Drive Media Pipeline

### Architecture

```
Google Drive Shared Folder
  └── Videos (MP4, MOV) + Images (JPG, PNG)
        |
        ├── [Sync] Server calls Drive API v3 → lists all files
        │          Stores metadata in drive_assets table
        │          Tracks: unused → queued → published
        |
        ├── [Select] User picks file from Drive picker in app
        │           Sets customMediaUrl or generatedVideoUrl on content day
        |
        └── [Publish] Google Drive URL passed directly to Blotato/Instagram
                      NO download + re-upload (avoids 20MB base64 limit)
```

### Google Drive URL Formats

```
# Shared folder URL (user pastes this in Settings)
https://drive.google.com/drive/folders/FOLDER_ID?usp=sharing

# Extract folder ID
FOLDER_ID = URL.match(/\/folders\/([-_a-zA-Z0-9]+)/)[1]

# Direct download URL (for API consumption)
https://drive.google.com/uc?export=download&id=FILE_ID

# File viewer URL (NOT for API — won't download)
https://drive.google.com/file/d/FILE_ID/view
```

### Drive API Key

The Drive API uses a Google Cloud API key (NOT OAuth) because the folder is shared publicly. The key only needs `drive.readonly` scope.

```
GET https://www.googleapis.com/drive/v3/files
  ?q='FOLDER_ID' in parents and trashed=false and (mimeType contains 'image/' or mimeType contains 'video/')
  &fields=files(id,name,mimeType,size,thumbnailLink,createdTime)
  &pageSize=100
  &key=API_KEY
```

---

## 7. Media Size Limits & Workarounds

| Constraint | Limit | Workaround |
|-----------|-------|------------|
| Blotato base64 upload | **20 MB** | Pass Google Drive URL directly instead of downloading + re-encoding |
| Instagram Reel via Graph API | **1 GB, 15 min** | Use `video_url` parameter — Instagram fetches from URL server-side |
| Instagram Photo via Graph API | **8 MB** | Compress with canvas before upload |
| TikTok via Blotato | **500 MB** | Pass URL directly |

### Media Processing Strategy

| Source | Type | Strategy |
|--------|------|----------|
| Google Drive URL | Video | Pass direct URL to API (no download) |
| Google Drive URL | Image | Pass direct URL to Blotato; download only if text overlay needed |
| Remote HTTP URL | Video | Pass URL directly (API fetches it) |
| Remote HTTP URL | Image | Download → burn text overlay → upload as base64 |
| Local file < 15MB | Any | Upload as base64 |
| Local file > 15MB | Any | Error — use Google Drive link instead |

---

## 8. Auto-Scheduling Logic

### Configuration (in Settings)

| Setting | Description | Default |
|---------|-------------|---------|
| Publishing Mode | `manual` or `auto` | manual |
| Posts Per Day | 1-10 | 1 |
| First Post Time | Start of posting window | 09:00 |
| Last Post Time | End of posting window | 21:00 |

### Slot Calculation

For `postsPerDay = 3`, window `09:00 - 21:00`:
```
Gap = (21:00 - 09:00) / (3 - 1) = 6 hours
Slots: 09:00, 15:00, 21:00
```

For `postsPerDay = 5`, window `09:00 - 21:00`:
```
Gap = (21:00 - 09:00) / (5 - 1) = 3 hours
Slots: 09:00, 12:00, 15:00, 18:00, 21:00
```

### Auto-Cron Behavior

- Polls every 30 seconds
- At each slot time, picks ONE unpublished post for today
- Post must have: `date = today`, `isGoodToPost = true`, `status != 'published'`
- Publishes one post per slot (not all at once)
- Resets triggered slots at midnight

### Instagram Best Practices

- 3-5 posts/day recommended for engagement
- 25 posts/day maximum (API limit)
- 2+ minute gaps between posts to avoid rate limiting
- Mix content types: photos, reels, carousels

---

## 9. Text Overlay Strategy

### When Text Is Applied

| Content | Platform | Text Overlay |
|---------|----------|-------------|
| Photo | Instagram | YES — hook text burned onto image before publishing |
| Photo | TikTok | YES — same treatment |
| Video | Any | NO — user adds text manually in-app |
| Carousel | Instagram | YES — on each slide |

### Text Overlay Rendering

The text overlay is rendered using HTML Canvas (browser-side) or node-canvas (server-side):

```
- Box width: 75% of image width
- Position: 12% from bottom edge
- Background: rgba(70, 60, 50, 0.85) with rounded corners
- Font: bold, 3.8% of image width, sans-serif
- Text: white, centered, max 3 lines with ellipsis
- Corner radius: min(24px, boxHeight/2)
- Export: JPEG at 95% quality
```

### Why Only Photos Get Text Overlay

- Photos are static — text overlay is the only way to add a "hook"
- Videos have native text/caption tools in Instagram and TikTok
- Video text should be animated/timed — can't do that with a static burn

---

## 10. Setup Checklist for New Clients

### Phase 1: Accounts & API Keys

- [ ] Client creates Instagram Creator or Business account(s)
- [ ] Client connects Instagram to a Facebook Page
- [ ] Create Facebook Developer App at [developers.facebook.com](https://developers.facebook.com)
- [ ] Add Instagram Graph API product to the app
- [ ] Generate User Access Token with permissions:
  - `instagram_content_publish`
  - `instagram_basic`
  - `pages_show_list`
  - `pages_read_engagement`
- [ ] Exchange for long-lived token (60 days)
- [ ] Client signs up for [Blotato](https://blotato.com) and gets API key
- [ ] Client connects Instagram + TikTok accounts in Blotato
- [ ] Client shares Google Drive folder with media assets
- [ ] Get Google Cloud API key with Drive API enabled

### Phase 2: Creator Studio Configuration

- [ ] Enter Blotato API key in Settings
- [ ] Enter Google Drive folder URL in Settings
- [ ] Sync Drive files
- [ ] Configure posting schedule (posts per day, time window)
- [ ] Set up personas (one per Instagram account/character)
- [ ] Set up Ngrok tunnel URL (if using local files)

### Phase 3: Content Pipeline

- [ ] Import content calendar (Google Sheets or manual)
- [ ] Assign Drive media to content days
- [ ] AI-generate captions, hashtags, hooks for each post
- [ ] Review and mark posts as "Good to Post"
- [ ] Test publish one photo (should go live with text overlay)
- [ ] Test publish one video (should create unpublished container / TikTok draft)

### Phase 4: Daily Operations

1. **Morning:** Review today's scheduled posts, approve with "Good to Post"
2. **Auto-cron fires:** Photos publish live, videos upload as drafts/containers
3. **Manual editing:** Open Instagram/TikTok apps, find drafted videos, add sound + text, publish
4. **Evening:** Check published posts, review analytics

### Environment Variables Needed

```bash
# Google
GEMINI_API_KEY=AIza...          # For AI content generation
DRIVE_API_KEY=AIza...           # For Drive file listing

# Supabase
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Blotato
BLOTATO_API_KEY=...             # Stored in user_settings table per user

# Instagram Graph API
INSTAGRAM_APP_ID=...
INSTAGRAM_APP_SECRET=...
INSTAGRAM_ACCESS_TOKEN=...      # Long-lived, 60-day expiry
```

---

## Appendix: API Reference Quick Links

- [Blotato API Docs](https://help.blotato.com/api/api-reference/publish-post)
- [Instagram Content Publishing API](https://developers.facebook.com/docs/instagram-platform/content-publishing/)
- [Instagram Graph API Explorer](https://developers.facebook.com/tools/explorer/)
- [Google Drive API v3](https://developers.google.com/drive/api/reference/rest/v3)
- [Kling AI API](https://docs.klingai.com/)
- [Google Gemini API](https://ai.google.dev/docs)

---

*This document captures the publishing strategy as of March 2026. Update as APIs change or new platforms are added.*
