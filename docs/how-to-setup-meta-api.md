# How To: Set Up Meta Graph API for Instagram Publishing

**Time needed:** ~15 minutes
**Prerequisites:** A Facebook account, an Instagram Professional/Creator account

---

## Common Mistakes (Read First)

| Mistake | What Happens | Fix |
|---|---|---|
| Using **App Token** (`123456\|AbCdEf...`) | "A user access token is required" error | Use Graph API Explorer to get a User Token (`EAA...`) |
| Using **Facebook Page ID** as Instagram Account ID | "Singular published story API deprecated" error | Use the Discover Accounts button to find the real IG Account ID |
| Instagram account is **Personal** (not Professional) | API calls fail silently or return errors | Switch to Professional/Creator account in Instagram app |
| Facebook Page **not linked** to Instagram | Discovery returns "no Instagram linked" | Link them in Instagram Settings → Linked Accounts |

---

## Step 1: Create a Meta App (one-time)

1. Go to **https://developers.facebook.com**
2. Click **"My Apps"** → **"Create App"**
3. Select app type: **"Business"**
4. Give it a name (e.g., "Creator Studio Publishing")
5. Note your **App ID** — you'll need it later

---

## Step 2: Set Up Your Instagram Account

Your Instagram account must be a **Professional** or **Creator** account (not Personal).

1. Open the **Instagram app** on your phone
2. Go to **Settings → Account → Switch to Professional Account**
3. Choose **Creator** or **Business**
4. Connect it to a **Facebook Page**:
   - Instagram Settings → **Linked Accounts** → Facebook
   - Select or create a Facebook Page for this persona

**Important:** Each AI persona needs its own Instagram account + Facebook Page pair.

---

## Step 3: Get a User Access Token

### Option A: Graph API Explorer (Quick — for testing)

This gives you a token that expires in ~1 hour. Good for testing.

1. Go to **https://developers.facebook.com/tools/explorer/**
2. Top-right dropdown: select **your app**
3. Click **"Generate Access Token"**
4. Log in and grant these permissions:
   - ✅ `pages_manage_posts`
   - ✅ `pages_read_engagement`
   - ✅ `instagram_basic`
   - ✅ `instagram_content_publish`
5. Click **"Generate Access Token"**
6. Copy the token — it starts with **`EAA...`**

**⚠️ This token expires in ~1 hour.** Fine for testing, not for production.

### Option B: System User Token (Production — never expires)

1. Go to **https://business.facebook.com** → Business Settings
2. Left sidebar → **Users → System Users**
3. Click **"Add"**
   - Name: "Creator Studio API"
   - Role: **Admin**
4. Click on the system user → **"Assign Assets"**
   - Add all your **Facebook Pages**
   - Add all your **Instagram Accounts**
   - Permission: **Full Control** for each
5. Click **"Generate New Token"**
   - Select your app
   - Check permissions:
     - ✅ `pages_manage_posts`
     - ✅ `pages_read_engagement`
     - ✅ `instagram_basic`
     - ✅ `instagram_content_publish`
     - ✅ `business_management`
   - Click **Generate Token**
6. **Copy the token immediately** — it's only shown once
7. Token starts with **`EAA...`** and **never expires**

---

## Step 4: Configure Creator Studio

### Global Settings (gear icon → Settings panel)

1. **Meta Access Token** — paste the `EAA...` token
2. **Meta App ID** — paste your App ID from Step 1
3. Click **Save**
4. Click **"Discover Instagram Accounts"**

### What Discover Shows You

```
┌─────────────────────────────────────────┐
│ Sofia Laurant Page                       │
│   IG: @sofia.laurant          connected  │
│   Account ID: 17841400987654321          │  ← Copy THIS
│   Page ID: 198765432100123               │  ← Copy this too
├─────────────────────────────────────────┤
│ Luna Stories Page                        │
│   IG: @luna.stories           connected  │
│   Account ID: 17841400111222333          │
│   Page ID: 334455667788990               │
└─────────────────────────────────────────┘
```

### Per-Persona Settings (edit persona → Settings tab)

1. **Instagram Account ID** — paste the `178...` number from Discover
2. **Facebook Page ID** — paste the Page ID from Discover
3. Click **"Test Connection"** — should show ✅ and the IG username
4. Save

---

## Step 5: Publish a Post

1. Select a post with a generated image
2. Mark it **"Good to Post"**
3. Click **"Publish to Instagram"**
4. The post goes directly to Instagram via Meta Graph API

---

## Token Types Explained

| Token Format | Type | Expires | Use For |
|---|---|---|---|
| `EAABwzLixnjYBO...` | User Access Token | ~1 hour | Testing in Graph API Explorer |
| `EAABwzLixnjYBO...` (from System User) | System User Token | **Never** | Production — use this |
| `879904791721300\|QsCHPG5J...` | App Token | Never | **DO NOT USE** — can't access user data |
| `dGhpcyBpcyBub3Q...` | Random string | N/A | Wrong — not a Meta token |

**Rule:** Your token must start with **`EAA`**. If it doesn't, it's the wrong token type.

---

## Troubleshooting

### "A user access token is required"
- **Cause:** You're using an App Token (format: `appId|secret`)
- **Fix:** Get a User Token from Graph API Explorer or System User

### "Singular published story API is deprecated"
- **Cause:** Wrong ID — you put a Facebook User ID or Page ID where the Instagram Account ID goes
- **Fix:** Use the Discover button to find the correct Instagram Account ID (starts with `178...`)

### "Invalid OAuth access token"
- **Cause:** Token expired (Graph API Explorer tokens last ~1 hour)
- **Fix:** Generate a new token, or switch to System User Token (never expires)

### "instagram_content_publish permission missing"
- **Cause:** Your app hasn't been approved for this permission
- **Fix:** For development/testing, the Graph API Explorer auto-grants it. For production, submit your app for App Review at developers.facebook.com

### "The user hasn't authorized the application"
- **Cause:** The System User doesn't have the Facebook Page/Instagram Account assigned
- **Fix:** Business Manager → System Users → Assign Assets → add the pages and IG accounts

### Test Connection shows error but Discover works
- **Cause:** The Test Connection button calls the Graph API directly from your browser. CORS might block it.
- **Fix:** Use the Discover button instead (it goes through the Worker which isn't blocked by CORS)

### Images don't appear after publishing
- **Cause:** The image URL isn't publicly accessible
- **Fix:** Images stored in Cloudflare R2 (via the Worker's `/api/media/` route) are public. Make sure the URL starts with `https://`

---

## Multiple Personas / Accounts

One Meta Access Token can publish to ALL your Instagram accounts:

```
Creator Studio Account
│
├── Settings: Meta Access Token (one token for everything)
│
├── Persona: Sofia → IG Account ID: 17841400111 → posts to @sofia.laurant
├── Persona: Luna  → IG Account ID: 17841400222 → posts to @luna.stories
└── Persona: Zara  → IG Account ID: 17841400333 → posts to @zara.lifestyle
```

Each persona has its own Instagram Account ID. The global token has access to all of them through Meta Business Manager.

---

## Rate Limits

| Limit | Value |
|---|---|
| Posts per IG account per day | 25 |
| API calls per hour | 200 |
| Max image size | 8 MB |
| Max video length (Reels) | 15 minutes |
| Min video length (Reels) | 3 seconds |
| Carousel slides | 2-10 |
| Caption length | 2,200 characters |
| Hashtags max | 30 (we use 5) |

---

*Last updated: April 2026*
