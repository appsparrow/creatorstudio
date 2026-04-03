# Creator Studio — Meta API Integration Plan

**Goal:** Replace Blotato with direct Meta Graph API posting from Creator Studio to Instagram (and eventually Facebook)

---

## Architecture Overview

```
InfluencerLabs (Meta Business Manager)
  │
  ├── Facebook Page: "Sofia Laurant"
  │     └── Instagram Professional Account: @sofia.laurant
  │
  ├── Facebook Page: "Luna"
  │     └── Instagram Professional Account: @luna.stories
  │
  ├── Facebook Page: "Marcus"
  │     └── Instagram Professional Account: @marcus.growth
  │
  └── Facebook Page: "Zara"
        └── Instagram Professional Account: @zara.lifestyle

Creator Studio App
  │
  ├── System User Token (never expires, Business Manager level)
  │     └── Permissions: pages_manage_posts, instagram_basic,
  │         instagram_content_publish, pages_read_engagement
  │
  └── Each Persona in Creator Studio maps to an Instagram Account ID
```

---

## Step 1: Meta Business Manager Setup

### What You Need

| Component | What It Is | How to Get It |
|---|---|---|
| **Meta Business Manager** | The parent account that owns everything | business.facebook.com → Create Account as "InfluencerLabs" |
| **Facebook Page** (per persona) | Required — every Instagram Professional Account must be linked to a Facebook Page | Business Manager → Pages → Create Page |
| **Instagram Professional Account** (per persona) | The actual IG account that posts go to | Instagram app → Switch to Professional → Connect to Facebook Page |
| **Meta App** | Your developer app that gets API access | developers.facebook.com → Create App → Business type |
| **System User** | A non-human user that holds the API token | Business Manager → System Users → Create |
| **System User Token** | The long-lived token your API uses | Generate from System User with required permissions |

### Setup Order

```
1. Create Meta Business Manager (business.facebook.com)
     └── Business name: "InfluencerLabs" or "Creator Studio"

2. Create a Meta App (developers.facebook.com)
     └── App type: "Business"
     └── Add products: "Instagram Graph API", "Pages API"

3. For EACH persona:
     a. Create a Facebook Page (e.g., "Sofia Laurant - Lifestyle")
     b. Create an Instagram account (e.g., @sofia.laurant)
     c. Switch Instagram to Professional/Creator account
     d. Connect Instagram to the Facebook Page (Instagram Settings → Linked Accounts)
     e. Add the Facebook Page to your Business Manager

4. Create a System User in Business Manager
     └── Role: Admin
     └── Assign ALL pages to this system user
     └── Generate token with permissions:
         - pages_manage_posts
         - pages_read_engagement
         - instagram_basic
         - instagram_content_publish
         - instagram_manage_comments (optional)
         - business_management

5. Store the System User Token in Creator Studio
     └── This is the ONE token that can post to ALL personas' Instagram accounts
```

---

## Step 2: How the API Works

### Publishing a Photo Post

```
Step 1: Create a media container
POST https://graph.facebook.com/v19.0/{instagram-account-id}/media
  ?image_url={public-image-url}        ← must be publicly accessible (R2 URL works)
  &caption={caption-with-hashtags}
  &access_token={system-user-token}

Response: { "id": "container-id-123" }

Step 2: Publish the container
POST https://graph.facebook.com/v19.0/{instagram-account-id}/media_publish
  ?creation_id={container-id-123}
  &access_token={system-user-token}

Response: { "id": "published-post-id-456" }
```

### Publishing a Carousel

```
Step 1: Create containers for EACH slide (up to 10)
POST /v19.0/{ig-account-id}/media
  ?image_url={slide-1-url}
  &is_carousel_item=true
  &access_token={token}
→ Returns container_id_1

POST /v19.0/{ig-account-id}/media
  ?image_url={slide-2-url}
  &is_carousel_item=true
  &access_token={token}
→ Returns container_id_2

(repeat for slides 3, 4)

Step 2: Create the carousel container
POST /v19.0/{ig-account-id}/media
  ?media_type=CAROUSEL
  &children={container_id_1},{container_id_2},{container_id_3},{container_id_4}
  &caption={caption}
  &access_token={token}
→ Returns carousel_container_id

Step 3: Publish
POST /v19.0/{ig-account-id}/media_publish
  ?creation_id={carousel_container_id}
  &access_token={token}
```

### Publishing a Reel (Video)

```
Step 1: Create video container
POST /v19.0/{ig-account-id}/media
  ?media_type=REELS
  &video_url={public-video-url}         ← must be publicly accessible
  &caption={caption}
  &share_to_feed=true
  &access_token={token}
→ Returns container_id

Step 2: Check upload status (video processing takes time)
GET /v19.0/{container_id}
  ?fields=status_code
  &access_token={token}
→ status_code: "IN_PROGRESS" or "FINISHED" or "ERROR"

Step 3: Publish when FINISHED
POST /v19.0/{ig-account-id}/media_publish
  ?creation_id={container_id}
  &access_token={token}
```

---

## Step 3: Data Model Changes in Creator Studio

### Per-Persona: Instagram Account Mapping

Add to the Persona type:
```typescript
interface Persona {
  // ... existing fields ...

  // Meta API integration
  instagramAccountId?: string;    // The IG account ID (numeric, from API)
  facebookPageId?: string;        // The linked FB page ID
}
```

### Global Settings: Meta API Token

Add to UserSettings:
```typescript
interface UserSettings {
  // ... existing fields ...

  metaAccessToken?: string;       // System User token (long-lived)
  metaAppId?: string;             // Meta App ID (for reference)
}
```

### Post-Level: Published Post Tracking

Already exists: `status: 'published'`. Add:
```typescript
interface ContentDay {
  // ... existing fields ...

  publishedPostId?: string;       // Meta post ID after publishing
  publishedAt?: string;           // Timestamp
  publishedPlatform?: string;     // 'instagram' | 'facebook' | 'both'
}
```

---

## Step 4: Worker API Changes

### Replace Blotato Route with Meta API Route

Replace `POST /api/blotato/publish` with `POST /api/meta/publish`:

```typescript
app.post('/api/meta/publish', async (c) => {
  const { imageUrl, videoUrl, caption, contentType, slides, personaId } = await c.req.json();

  // Get persona's Instagram Account ID
  const persona = await getPersona(personaId);
  const igAccountId = persona.instagramAccountId;

  // Get Meta token from user settings
  const settings = await getUserSettings(userId);
  const token = settings.metaAccessToken;

  if (contentType === 'Photo') {
    // Single photo publish
    const container = await createMediaContainer(igAccountId, imageUrl, caption, token);
    const post = await publishMedia(igAccountId, container.id, token);
    return { postId: post.id };
  }

  if (contentType === 'Carousel') {
    // Create slide containers
    const slideIds = [];
    for (const slide of slides) {
      const container = await createCarouselItem(igAccountId, slide.imageUrl, token);
      slideIds.push(container.id);
    }
    // Create and publish carousel
    const carousel = await createCarousel(igAccountId, slideIds, caption, token);
    const post = await publishMedia(igAccountId, carousel.id, token);
    return { postId: post.id };
  }

  if (contentType === 'Video') {
    // Create reel container
    const container = await createReelContainer(igAccountId, videoUrl, caption, token);
    // Poll until processed
    await waitForProcessing(container.id, token);
    const post = await publishMedia(igAccountId, container.id, token);
    return { postId: post.id };
  }
});
```

---

## Step 5: Persona Settings UI

In the Persona Editor → Settings tab, add:

```
Meta / Instagram Connection
┌──────────────────────────────────────────┐
│ Instagram Account ID: [input field]       │
│ Facebook Page ID: [input field]           │
│                                           │
│ Status: ● Connected                       │
│ Last posted: 2 hours ago                  │
│                                           │
│ [Test Connection]                         │
└──────────────────────────────────────────┘
```

In Global Settings, add:
```
Meta API
┌──────────────────────────────────────────┐
│ System User Token: [password field]       │
│ App ID: [input field]                     │
│                                           │
│ Connected accounts: 4                     │
│ [Verify Token]                            │
└──────────────────────────────────────────┘
```

---

## Step 6: Image URL Requirement

**Critical:** Meta API requires **publicly accessible image URLs.**

Current setup: Images stored in Cloudflare R2, served via Worker at `/api/media/...`

This works because:
- The Worker serves R2 files without auth on the `/api/media/*` route
- The URL `https://creatorstudio-worker.domain-sparrow.workers.dev/api/media/{path}` is publicly accessible
- Meta's servers can fetch the image from this URL

**For video:** Same applies. Video URLs must be publicly accessible. R2 URLs via the Worker work.

---

## Step 7: Multi-Persona Posting Flow

```
Creator Studio Account (InfluencerLabs)
  │
  │ Global: Meta System User Token
  │
  ├── Persona: Sofia Laurant
  │     IG Account ID: 17841400000001
  │     Posts → instagram.com/sofia.laurant
  │
  ├── Persona: Luna
  │     IG Account ID: 17841400000002
  │     Posts → instagram.com/luna.stories
  │
  └── Persona: Zara
        IG Account ID: 17841400000003
        Posts → instagram.com/zara.lifestyle

One token → multiple accounts → each persona posts to its own IG
```

---

## Implementation Timeline

| Step | Task | Time |
|------|------|------|
| 1 | Create Meta Business Manager + App | 30 min |
| 2 | Create Facebook Pages + connect Instagram accounts | 1 hour (per persona) |
| 3 | Generate System User Token | 30 min |
| 4 | Add Meta token to Creator Studio global settings | 30 min |
| 5 | Add Instagram Account ID to persona settings | 30 min |
| 6 | Build `POST /api/meta/publish` Worker route | 2-3 hours |
| 7 | Update frontend publish button to use Meta API | 1 hour |
| 8 | Handle carousel + reel publishing | 2-3 hours |
| 9 | Add video processing polling | 1 hour |
| 10 | Test end-to-end with real posts | 1-2 hours |
| **Total** | | **~1 day** |

---

## Rate Limits & Gotchas

| Limit | Value | Notes |
|---|---|---|
| **Posts per day** | 25 per IG account | Enough for most use cases |
| **API calls/hour** | 200 per user token | Plenty for posting; be careful with polling |
| **Image size** | Max 8MB | R2-served images are fine |
| **Video length** | 3 sec - 15 min (Reels) | Kling generates 5-sec videos, within limits |
| **Carousel slides** | 2-10 items | We default to 4, well within |
| **Caption length** | 2,200 characters | Our captions are typically under 500 |
| **Hashtags** | Max 30 (we limit to 5) | Conservative, good for engagement |

### Gotchas

1. **Video processing is async** — after creating a reel container, you must poll `status_code` until `FINISHED` before publishing. Can take 30 sec to 5 min.
2. **Image must be JPEG or PNG** — our R2 images are already PNG/JPEG.
3. **System User tokens don't expire** — but can be revoked. Store securely.
4. **App Review required** — for `instagram_content_publish` permission, your Meta App needs to pass App Review. Submit with a screencast demo of Creator Studio.
5. **Two-step publishing** — always create container first, then publish. No single-call publish.

---

## Migration from Blotato

| Current (Blotato) | Future (Meta API Direct) |
|---|---|
| Upload media to Blotato servers | Images already on R2 (public URL) |
| Blotato handles IG auth | System User Token (we manage) |
| Single account posting | Multi-account via Business Manager |
| $0 (free tier) then paid | $0 (Meta API is free) |
| Rate limited by Blotato | Rate limited by Meta (generous) |
| Dependency on third party | Direct control |

**Keep Blotato as fallback** during transition. Add Meta API as primary, fall back to Blotato if Meta fails.

---

*Plan for Creator Studio Meta API integration — April 2026*
