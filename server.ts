import express from 'express';
import cors from 'cors';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createCanvas, loadImage } from 'canvas';
import 'dotenv/config';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Middlewares
app.use(cors());
app.use(express.json({ limit: '50mb' })); // support large payloads for image base64
app.use('/uploads', express.static(path.join(__dirname, 'public', 'uploads')));

// DB setup
const dbPath = path.join(__dirname, 'database.db');
const db = new Database(dbPath);

// Initialize DB tables
db.exec(`
  CREATE TABLE IF NOT EXISTS personas (
    id TEXT PRIMARY KEY,
    data TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS days (
    id TEXT PRIMARY KEY,
    personaId TEXT NOT NULL,
    data TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS video_tasks (
    taskId TEXT PRIMARY KEY,
    dayId  TEXT NOT NULL,
    createdAt INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS drive_assets (
    id TEXT PRIMARY KEY,
    driveFileId TEXT UNIQUE NOT NULL,
    fileName TEXT NOT NULL,
    mimeType TEXT NOT NULL,
    fileSize INTEGER,
    driveUrl TEXT,
    thumbnailUrl TEXT,
    contentType TEXT DEFAULT 'Photo',
    status TEXT DEFAULT 'unused',
    linkedDayId TEXT,
    syncedAt INTEGER NOT NULL
  );
`);

// API Endpoints
// Personas
app.get('/api/personas', (req, res) => {
  try {
    const rows = db.prepare('SELECT data FROM personas').all();
    const personas = rows.map((r: any) => JSON.parse(r.data));
    res.json(personas);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/personas', (req, res) => {
  try {
    const persona = req.body;
    if (!persona.id) return res.status(400).json({ error: 'id is required' });

    // Scaffolds the persona's dedicated physical storage namespace independently instantly 
    const uploadsDir = path.join(__dirname, 'public', 'uploads', persona.id);
    if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

    db.prepare('INSERT OR REPLACE INTO personas (id, data) VALUES (?, ?)')
      .run(persona.id, JSON.stringify(persona));
    res.json({ success: true, id: persona.id });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/personas/:id', (req, res) => {
  try {
    const id = req.params.id;
    db.prepare('DELETE FROM personas WHERE id = ?').run(id);
    db.prepare('DELETE FROM days WHERE personaId = ?').run(id);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Days
app.get('/api/days', (req, res) => {
  try {
    const rows = db.prepare('SELECT data FROM days').all();
    const days = rows.map((r: any) => JSON.parse(r.data));
    res.json(days);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/days', (req, res) => {
  try {
    const day = req.body;
    if (!day.id) return res.status(400).json({ error: 'id is required' });
    if (!day.personaId) return res.status(400).json({ error: 'personaId is required' });

    db.prepare('INSERT OR REPLACE INTO days (id, personaId, data) VALUES (?, ?, ?)')
      .run(day.id, day.personaId, JSON.stringify(day));
    res.json({ success: true, id: day.id });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/days/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM days WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// File Uploads (save Base64 images)
app.post('/api/images/save', (req, res) => {
  try {
    const { base64, filename, personaId } = req.body;
    if (!base64 || !filename) return res.status(400).json({ error: 'base64 and filename are required' });

    const uploadsDir = personaId
      ? path.join(__dirname, 'public', 'uploads', personaId)
      : path.join(__dirname, 'public', 'uploads');
    if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

    const filepath = path.join(uploadsDir, filename);
    const buffer = Buffer.from(base64.split(',')[1], 'base64');
    fs.writeFileSync(filepath, buffer);

    const relPath = personaId ? `/uploads/${personaId}/${filename}` : `/uploads/${filename}`;
    res.json({ success: true, url: relPath });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

import crypto from 'crypto';

function generateKlingJWT(apiKey: string, apiSecret: string): string {
  const header = { alg: "HS256", typ: "JWT" };
  const payload = {
    iss: apiKey,
    exp: Math.floor(Date.now() / 1000) + 1800,
    nbf: Math.floor(Date.now() / 1000) - 60
  };

  const base64Url = (obj: any) => {
    return Buffer.from(JSON.stringify(obj))
      .toString('base64')
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');
  };

  const headStr = base64Url(header);
  const payStr = base64Url(payload);
  const dataToSign = `${headStr}.${payStr}`;

  const signature = crypto.createHmac('sha256', apiSecret)
    .update(dataToSign)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  return `${dataToSign}.${signature}`;
}

// Proxy NanoBanana API
app.post('/api/nanobanana/proxy', async (req, res) => {
  try {
    const { endpoint, method, payload, apiKey } = req.body;
    if (!endpoint || !apiKey) return res.status(400).json({ error: "Missing proxy requirements" });

    const response = await fetch(`https://api.nanobananaapi.ai${endpoint}`, {
      method: method || 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: method === 'GET' ? undefined : JSON.stringify(payload)
    });

    const data = await response.json();
    res.json(data);
  } catch (err: any) {
    console.error("[NanoBanana Proxy] Failed:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// Proxy Kling Video Generation
app.post('/api/videos/generate', async (req, res) => {
  const { prompt, image_url, apiKey, apiSecret, model_name, dayId, publicTunnelUrl } = req.body;

  if (!apiKey || !apiSecret) {
    return res.status(400).json({ error: "Kling API Key and Secret are required." });
  }

  console.log(`[Server] Proxying Kling Video Trigger for ${model_name}, dayId=${dayId}...`);
  const jwt = generateKlingJWT(apiKey, apiSecret);
  let activeBaseUrl = 'https://api.klingai.com';

  const buildBody = () => JSON.stringify({
    model_name: model_name || 'kling-v1',
    image: image_url,
    image_url: image_url,
    prompt: prompt,
    duration: 5,
    callback_url: publicTunnelUrl
      ? `${publicTunnelUrl.replace(/\/$/, '')}/api/videos/callback`
      : undefined
  });

  try {
    let response = await fetch(`${activeBaseUrl}/v1/videos/image2video`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${jwt}`, 'Content-Type': 'application/json' },
      body: buildBody()
    });

    if (response.status === 404) {
      console.log("[Server] Falling back to Singapore gateway...");
      activeBaseUrl = 'https://api-singapore.klingai.com';
      response = await fetch(`${activeBaseUrl}/v1/videos/image2video`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${jwt}`, 'Content-Type': 'application/json' },
        body: buildBody()
      });
    }

    const data = await response.json();
    console.log("[Server] Kling API Reply:", JSON.stringify(data));
    const taskId = data.task_id || data.data?.task_id;
    if (!taskId) throw new Error(`Kling failed to return task ID. Status: ${response.status}. Reply: ${JSON.stringify(data)}`);

    // Store taskId → dayId mapping so the webhook can auto-link the video
    if (dayId) {
      db.prepare('INSERT OR REPLACE INTO video_tasks (taskId, dayId, createdAt) VALUES (?, ?, ?)')
        .run(taskId, dayId, Date.now());
      console.log(`[Server] Mapped taskId=${taskId} → dayId=${dayId}`);
    }

    return res.json({ success: true, taskId });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/videos/status/:taskId', async (req, res) => {
  try {
    const { taskId } = req.params;
    const apiKey = req.headers['x-api-key'] as string;
    const apiSecret = req.headers['x-api-secret'] as string;

    if (!apiKey || !apiSecret) return res.status(400).json({ error: "Missing API credentials." });

    const jwt = generateKlingJWT(apiKey, apiSecret);

    // Correct Kling status endpoint: GET /v1/videos/image2video/{task_id}
    let activeBaseUrl = 'https://api.klingai.com';
    let statusResp = await fetch(`${activeBaseUrl}/v1/videos/image2video/${taskId}`, {
      headers: { 'Authorization': `Bearer ${jwt}`, 'Content-Type': 'application/json' }
    });

    if (statusResp.status === 404) {
      activeBaseUrl = 'https://api-singapore.klingai.com';
      statusResp = await fetch(`${activeBaseUrl}/v1/videos/image2video/${taskId}`, {
        headers: { 'Authorization': `Bearer ${jwt}`, 'Content-Type': 'application/json' }
      });
    }

    const statusData = await statusResp.json();
    console.log(`[Server] Status for task ${taskId}:`, JSON.stringify(statusData));

    // Extract status and video URL from Kling's actual response structure
    const taskStatus = statusData.data?.task_status;
    // Kling returns: data.task_result.videos[0].url
    const videoUrl = statusData.data?.task_result?.videos?.[0]?.url
      || statusData.data?.task_result?.video_url
      || statusData.data?.video_url;

    res.json({
      raw: statusData,
      task_status: taskStatus,
      video_url: videoUrl
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});


app.post('/api/videos/save', async (req, res) => {
  try {
    const { videoUrl, personaId } = req.body;
    if (!videoUrl) return res.status(400).json({ error: "videoUrl is required." });

    const videoResponse = await fetch(videoUrl);
    const arrayBuffer = await videoResponse.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const filename = `kling_${Date.now()}.mp4`;
    const uploadsDir = personaId
      ? path.join(__dirname, 'public', 'uploads', personaId)
      : path.join(__dirname, 'public', 'uploads');
    if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

    fs.writeFileSync(path.join(uploadsDir, filename), buffer);
    const relPath = personaId ? `/uploads/${personaId}/${filename}` : `/uploads/${filename}`;
    res.json({ success: true, url: relPath });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/videos/callback', async (req, res) => {
    try {
        console.log("[Webhook] Kling Callback:", JSON.stringify(req.body));
        const data = req.body;
        const taskId = data.task_id;
        const status = data.task_status;
        const videoUrl = data.task_result?.videos?.[0]?.url;

        if (status === 'succeed' && videoUrl && taskId) {
            // Download video to local uploads
            const videoResponse = await fetch(videoUrl);
            const arrayBuffer = await videoResponse.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            const filename = `kling_${taskId}.mp4`;
            const uploadsDir = path.join(__dirname, 'public', 'uploads');
            if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
            const localPath = `/uploads/${filename}`;
            fs.writeFileSync(path.join(uploadsDir, filename), buffer);
            console.log(`[Webhook] Saved video: ${localPath}`);

            // Look up which dayId this task belongs to
            const taskRow = db.prepare('SELECT dayId FROM video_tasks WHERE taskId = ?').get(taskId) as any;
            if (taskRow?.dayId) {
                const dayRow = db.prepare('SELECT data FROM days WHERE id = ?').get(taskRow.dayId) as any;
                if (dayRow) {
                    const dayData = JSON.parse(dayRow.data);
                    dayData.generatedVideoUrl = localPath;
                    dayData.status = 'completed';
                    db.prepare('INSERT OR REPLACE INTO days (id, personaId, data) VALUES (?, ?, ?)')
                        .run(dayData.id, dayData.personaId, JSON.stringify(dayData));
                    console.log(`[Webhook] Auto-linked video to dayId=${taskRow.dayId}`);
                }
            } else {
                console.log(`[Webhook] No dayId found for taskId=${taskId} — video saved but not linked.`);
            }
        }
        res.json({ success: true });
    } catch (error: any) {
        console.error("[Webhook] Error:", error);
        res.status(500).json({ error: error.message });
    }
});

// --- Blotato Direct Publisher Real API Integration ---
// Supports Instagram + TikTok. Publishes to all requested platforms.
app.post('/api/blotato/publish', async (req, res) => {
    try {
        const { image, video, caption, hashtags, onScreenText, contentType, blotatoApiKey, dayId, isDraft, scheduledTime, platforms } = req.body;
        if (!blotatoApiKey) {
            return res.status(400).json({ error: "Blotato API Key missing. Please set it in Settings." });
        }

        // Default behavior for videos:
        //   TikTok → isDraft (supported by Blotato)
        //   Instagram → schedule 1 hour from now (isDraft NOT supported for Instagram)
        // Photos → publish live on all platforms
        const isVideoContent = !!video;
        const userWantsDraft = isDraft !== undefined ? isDraft : isVideoContent;

        // Platforms to publish to (default: ['instagram'])
        const targetPlatforms: string[] = platforms || ['instagram'];

        console.log(`\n[Blotato Publisher] DayID: ${dayId} | Platforms: ${targetPlatforms.join(',')} | WantsDraft: ${userWantsDraft} | Type: ${isVideoContent ? 'video' : 'photo'}`);

        // 1. Fetch ALL connected accounts
        const authHeaders = { 'Authorization': `Bearer ${blotatoApiKey}`, 'x-api-key': blotatoApiKey };
        const accountsRes = await fetch('https://backend.blotato.com/v2/users/me/accounts', {
            headers: authHeaders
        });

        if (!accountsRes.ok) {
            const err = await accountsRes.text();
            throw new Error(`Failed to authenticate with Blotato: ${err}`);
        }

        const accountsData = await accountsRes.json();
        const accountsArray = Array.isArray(accountsData) ? accountsData : accountsData.items || accountsData.data || [];
        console.log(`[Blotato Publisher] Found ${accountsArray.length} connected accounts: ${accountsArray.map((a: any) => `${a.platform}(${a.id})`).join(', ')}`);

        // Find accounts for each target platform
        const instagramAccount = accountsArray.find((acc: any) => acc.platform === 'instagram');
        const tiktokAccount = accountsArray.find((acc: any) => acc.platform === 'tiktok');

        if (targetPlatforms.includes('instagram') && !instagramAccount) {
            console.warn('[Blotato Publisher] No Instagram account connected — skipping Instagram');
        }
        if (targetPlatforms.includes('tiktok') && !tiktokAccount) {
            console.warn('[Blotato Publisher] No TikTok account connected — skipping TikTok');
        }

        const targetAccount = instagramAccount || tiktokAccount || accountsArray[0];
        if (!targetAccount) {
            throw new Error('No connected social media accounts found in Blotato.');
        }

        console.log(`[Blotato Publisher] Found Account ID: ${targetAccount.id}. Sending post...`);

        // 2. Process media — strategy depends on source and type:
        //    - Google Drive URLs → convert to direct download URL, pass to Blotato directly (no size limit)
        //    - Remote URLs (videos) → pass directly to Blotato (Blotato fetches it)
        //    - Remote URLs (images with text) → download, burn text, upload as base64
        //    - Local files (small) → upload as base64
        //    - Local files (large videos) → need public URL via tunnel

        const isGoogleDriveUrl = (url: string) =>
          url.includes('drive.google.com') || url.includes('googleusercontent.com');

        const getDirectDriveUrl = (url: string) => {
          // Convert Google Drive share URLs to direct download URLs
          const match = url.match(/\/file\/d\/([-_a-zA-Z0-9]+)/);
          if (match) return `https://drive.google.com/uc?export=download&id=${match[1]}`;
          const idMatch = url.match(/[?&]id=([-_a-zA-Z0-9]+)/);
          if (idMatch) return `https://drive.google.com/uc?export=download&id=${idMatch[1]}`;
          return url;
        };

        const uploadToBlotato = async (dataUri: string) => {
          const uploadRes = await fetch('https://backend.blotato.com/v2/media', {
            method: 'POST',
            headers: { ...authHeaders, 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: dataUri })
          });
          if (!uploadRes.ok) throw new Error(`Blotato Media Upload Failed: ${await uploadRes.text()}`);
          const uploadData = await uploadRes.json();
          return uploadData.url;
        };

        const processMedia = async (mediaPath: string, isVideoMedia: boolean) => {
             if (!mediaPath) return null;

             // Google Drive URLs — pass directly, no download needed (bypasses 20MB base64 limit)
             if (isGoogleDriveUrl(mediaPath)) {
                 const directUrl = getDirectDriveUrl(mediaPath);
                 console.log(`[Blotato Publisher] Using Google Drive direct URL: ${directUrl}`);
                 // Upload the URL to Blotato (Blotato fetches it server-side, no base64 limit)
                 const uploadRes = await fetch('https://backend.blotato.com/v2/media', {
                   method: 'POST',
                   headers: { ...authHeaders, 'Content-Type': 'application/json' },
                   body: JSON.stringify({ url: directUrl })
                 });
                 if (!uploadRes.ok) {
                   const errText = await uploadRes.text();
                   // If URL upload fails, Blotato might accept it directly in mediaUrls
                   console.warn(`[Blotato Publisher] URL upload failed (${errText}), using direct URL in mediaUrls`);
                   return directUrl;
                 }
                 const uploadData = await uploadRes.json();
                 console.log(`[Blotato Publisher] Drive media hosted at: ${uploadData.url}`);
                 return uploadData.url;
             }

             // Remote HTTP URLs — for videos, pass directly; for images, download for text overlay
             if (mediaPath.startsWith('http')) {
                 if (isVideoMedia) {
                     // Videos: pass URL directly to Blotato (no text overlay, no download needed)
                     console.log(`[Blotato Publisher] Passing remote video URL directly: ${mediaPath}`);
                     try {
                       return await uploadToBlotato(mediaPath);
                     } catch {
                       console.log(`[Blotato Publisher] URL upload failed, using direct URL`);
                       return mediaPath;
                     }
                 }
                 // Images: download for potential text overlay
                 console.log(`[Blotato Publisher] Downloading remote image for text overlay: ${mediaPath}`);
                 const dlRes = await fetch(mediaPath);
                 if (!dlRes.ok) throw new Error("Failed to download remote image: " + (await dlRes.text()));
                 const arrayBuffer = await dlRes.arrayBuffer();
                 let buffer = Buffer.from(arrayBuffer);
                 let mimeType = dlRes.headers.get('content-type') || 'image/jpeg';
                 let finalBase64 = buffer.toString('base64');

                 // Apply text overlay on images
                 if (mimeType.includes('image') && onScreenText) {
                    console.log(`[Blotato Publisher] Applying text overlay to image...`);
                    const img = await loadImage(buffer);
                    const canvas = createCanvas(img.width, img.height);
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, img.width, img.height);
                    const boxWidth = img.width * 0.75;
                    const fontSize = Math.floor(img.width * 0.038);
                    const padding = fontSize * 1.5;
                    const lineHeight = fontSize * 1.35;
                    ctx.font = `bold ${fontSize}px sans-serif`;
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    const cleanText = onScreenText.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
                    const words = cleanText.split(' ');
                    let line = '';
                    const lines: string[] = [];
                    for (let n = 0; n < words.length; n++) {
                        const testLine = line + words[n] + ' ';
                        if (ctx.measureText(testLine).width > (boxWidth - padding * 2) && n > 0) {
                            if (lines.length >= 2) { line = line.trim() + '...'; break; }
                            lines.push(line); line = words[n] + ' ';
                        } else { line = testLine; }
                    }
                    if (lines.length < 3 && line) lines.push(line);
                    const boxHeight = (lines.length * lineHeight) + (padding * 1.5);
                    const boxX = (img.width - boxWidth) / 2;
                    const boxY = img.height - boxHeight - (img.height * 0.12);
                    const r = Math.min(24, boxHeight / 2);
                    ctx.fillStyle = 'rgba(70, 60, 50, 0.85)';
                    ctx.beginPath();
                    ctx.moveTo(boxX + r, boxY); ctx.lineTo(boxX + boxWidth - r, boxY);
                    ctx.quadraticCurveTo(boxX + boxWidth, boxY, boxX + boxWidth, boxY + r);
                    ctx.lineTo(boxX + boxWidth, boxY + boxHeight - r);
                    ctx.quadraticCurveTo(boxX + boxWidth, boxY + boxHeight, boxX + boxWidth - r, boxY + boxHeight);
                    ctx.lineTo(boxX + r, boxY + boxHeight);
                    ctx.quadraticCurveTo(boxX, boxY + boxHeight, boxX, boxY + boxHeight - r);
                    ctx.lineTo(boxX, boxY + r);
                    ctx.quadraticCurveTo(boxX, boxY, boxX + r, boxY);
                    ctx.closePath(); ctx.fill();
                    ctx.fillStyle = '#ffffff';
                    let textY = boxY + padding + (fontSize / 2);
                    for (const l of lines) { ctx.fillText(l.trim(), img.width / 2, textY); textY += lineHeight; }
                    const outputBuffer = canvas.toBuffer('image/jpeg', { quality: 0.95 });
                    finalBase64 = outputBuffer.toString('base64');
                    mimeType = 'image/jpeg';
                 }

                 return await uploadToBlotato(`data:${mimeType};base64,${finalBase64}`);
             }

             // Local files
             if (mediaPath.includes('/uploads/')) {
                 const localRelativePath = mediaPath.substring(mediaPath.indexOf('/uploads/'));
                 const absoluteDiskPath = path.join(__dirname, 'public', localRelativePath);
                 if (!fs.existsSync(absoluteDiskPath)) throw new Error(`Media not found locally: ${absoluteDiskPath}`);
                 console.log(`[Blotato Publisher] Processing local file: ${localRelativePath}`);
                 const buffer = fs.readFileSync(absoluteDiskPath);
                 const mimeType = localRelativePath.endsWith('.mp4') ? 'video/mp4' : 'image/jpeg';

                 // Check size — if >15MB, we can't base64 upload. Need public URL.
                 if (buffer.length > 15 * 1024 * 1024) {
                     console.warn(`[Blotato Publisher] File too large for base64 (${(buffer.length / 1024 / 1024).toFixed(1)}MB). Needs public tunnel URL.`);
                     throw new Error(`File is ${(buffer.length / 1024 / 1024).toFixed(1)}MB — too large for base64 upload. Use a Google Drive link or public tunnel URL.`);
                 }

                 let finalBase64 = buffer.toString('base64');

                 // Text overlay for local images
                 if (mimeType.includes('image') && onScreenText) {
                    const img = await loadImage(buffer);
                    const canvas = createCanvas(img.width, img.height);
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, img.width, img.height);
                    const boxWidth = img.width * 0.75;
                    const fontSize = Math.floor(img.width * 0.038);
                    const padding = fontSize * 1.5;
                    const lineHeight = fontSize * 1.35;
                    ctx.font = `bold ${fontSize}px sans-serif`;
                    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                    const cleanText = onScreenText.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
                    const words = cleanText.split(' ');
                    let line = '';
                    const lines: string[] = [];
                    for (let n = 0; n < words.length; n++) {
                        const testLine = line + words[n] + ' ';
                        if (ctx.measureText(testLine).width > (boxWidth - padding * 2) && n > 0) {
                            if (lines.length >= 2) { line = line.trim() + '...'; break; }
                            lines.push(line); line = words[n] + ' ';
                        } else { line = testLine; }
                    }
                    if (lines.length < 3 && line) lines.push(line);
                    const boxHeight = (lines.length * lineHeight) + (padding * 1.5);
                    const boxX = (img.width - boxWidth) / 2;
                    const boxY = img.height - boxHeight - (img.height * 0.12);
                    const r = Math.min(24, boxHeight / 2);
                    ctx.fillStyle = 'rgba(70, 60, 50, 0.85)';
                    ctx.beginPath();
                    ctx.moveTo(boxX + r, boxY); ctx.lineTo(boxX + boxWidth - r, boxY);
                    ctx.quadraticCurveTo(boxX + boxWidth, boxY, boxX + boxWidth, boxY + r);
                    ctx.lineTo(boxX + boxWidth, boxY + boxHeight - r);
                    ctx.quadraticCurveTo(boxX + boxWidth, boxY + boxHeight, boxX + boxWidth - r, boxY + boxHeight);
                    ctx.lineTo(boxX + r, boxY + boxHeight);
                    ctx.quadraticCurveTo(boxX, boxY + boxHeight, boxX, boxY + boxHeight - r);
                    ctx.lineTo(boxX, boxY + r);
                    ctx.quadraticCurveTo(boxX, boxY, boxX + r, boxY);
                    ctx.closePath(); ctx.fill();
                    ctx.fillStyle = '#ffffff';
                    let textY = boxY + padding + (fontSize / 2);
                    for (const l of lines) { ctx.fillText(l.trim(), img.width / 2, textY); textY += lineHeight; }
                    finalBase64 = canvas.toBuffer('image/jpeg', { quality: 0.95 }).toString('base64');
                 }

                 return await uploadToBlotato(`data:${mimeType.includes('image') ? 'image/jpeg' : mimeType};base64,${finalBase64}`);
             }

             return mediaPath;
        };

        const finalMediaUrls = [];
        if (video) finalMediaUrls.push(await processMedia(video, true));
        else if (image) finalMediaUrls.push(await processMedia(image, false));
        // Filter out nulls
        const cleanMediaUrls = finalMediaUrls.filter(Boolean) as string[];

        // Hashtags — max 5 for Instagram, TikTok can have more
        let processedHashtags = '';
        if (hashtags) {
            const tagsArray = hashtags.split(/[\s#]+/).filter(Boolean).map((t: string) => `#${t}`);
            processedHashtags = tagsArray.slice(0, 5).join(' ');
        }

        const finalText = `${caption ? caption.trim() : ''}\n\n${processedHashtags}`.trim();

        // 3. Publish to each target platform
        const results: any[] = [];

        for (const platform of targetPlatforms) {
            const account = platform === 'tiktok' ? tiktokAccount : instagramAccount;
            if (!account) {
                console.warn(`[Blotato Publisher] Skipping ${platform} — no account connected`);
                results.push({ platform, success: false, error: `No ${platform} account connected` });
                continue;
            }

            const postPayload: any = {
                post: {
                    accountId: account.id,
                    content: {
                        text: finalText,
                        mediaUrls: cleanMediaUrls,
                        platform
                    },
                    target: platform === 'tiktok' ? {
                        targetType: 'tiktok',
                        privacyLevel: 'PUBLIC_TO_EVERYONE',
                        isAiGenerated: true
                    } : {
                        targetType: 'instagram',
                        mediaType: isVideoContent ? 'reel' : undefined
                    }
                }
            };

            // Platform-specific draft/schedule behavior:
            // TikTok: isDraft works → save as draft so user can add sound/text
            // Instagram: isDraft NOT supported → schedule 1 hour out for videos so user can edit
            if (platform === 'tiktok' && userWantsDraft) {
                postPayload.isDraft = true;
            } else if (platform === 'instagram' && userWantsDraft && !scheduledTime) {
                // Schedule 1 hour from now — gives user time to edit in Instagram app
                const oneHourLater = new Date(Date.now() + 60 * 60 * 1000).toISOString();
                postPayload.scheduledTime = scheduledTime || oneHourLater;
                console.log(`[Blotato Publisher] Instagram doesn't support drafts — scheduling video for ${oneHourLater}`);
            }
            if (scheduledTime) postPayload.scheduledTime = scheduledTime;

            const mode = postPayload.isDraft ? 'draft' : postPayload.scheduledTime ? `scheduled ${postPayload.scheduledTime}` : 'publish now';
            console.log(`[Blotato Publisher] ${platform} (account: ${account.id}) → ${mode}`);

            const publishRes = await fetch('https://backend.blotato.com/v2/posts', {
                method: 'POST',
                headers: { ...authHeaders, 'Content-Type': 'application/json' },
                body: JSON.stringify(postPayload)
            });

            if (!publishRes.ok) {
                const postErr = await publishRes.text();
                console.error(`[Blotato Publisher] ${platform} failed: ${postErr}`);
                results.push({ platform, success: false, error: postErr });
            } else {
                const publishData = await publishRes.json();
                console.log(`[Blotato Publisher] ${platform} success! ID: ${publishData.postSubmissionId || 'unknown'}`);
                const resultEntry: any = { platform, success: true, postId: publishData.postSubmissionId };
                if (postPayload.isDraft) resultEntry.mode = 'draft';
                else if (postPayload.scheduledTime) resultEntry.mode = 'scheduled';
                else resultEntry.mode = 'published';
                results.push(resultEntry);
            }
        }

        const anySuccess = results.some(r => r.success);
        const summary = results.map(r => `${r.platform}: ${r.success ? r.mode : 'failed'}`).join(', ');
        console.log(`[Blotato Publisher] Results: ${summary}`);

        res.json({ success: anySuccess, results, publishedAt: new Date().toISOString(), isVideoContent });
    } catch (error: any) {
        console.error("[Blotato Publisher Error]", error.message);
        res.status(500).json({ error: error.message });
    }
});

// =========== Google Drive Public Folder Listing ===========

const extractFolderId = (url: string): string | null => {
  // Handle: https://drive.google.com/drive/folders/FOLDER_ID?usp=sharing
  const match = url.match(/\/folders\/([-_a-zA-Z0-9]+)/);
  return match ? match[1] : null;
};

app.post('/api/drive/list', async (req, res) => {
  try {
    const { folderUrl } = req.body;
    const folderId = extractFolderId(folderUrl);
    if (!folderId) return res.status(400).json({ error: 'Invalid Google Drive folder URL' });

    const apiKey = process.env.DRIVE_API_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey) return res.status(400).json({ error: 'No Google API key configured in .env' });

    console.log(`[Drive] Listing files in folder: ${folderId}`);

    const allFiles: any[] = [];
    let pageToken = '';

    do {
      const params = new URLSearchParams({
        q: `'${folderId}' in parents and trashed = false and (mimeType contains 'image/' or mimeType contains 'video/')`,
        fields: 'nextPageToken, files(id, name, mimeType, size, webContentLink, thumbnailLink, createdTime)',
        pageSize: '100',
        key: apiKey,
        orderBy: 'createdTime desc',
      });
      if (pageToken) params.set('pageToken', pageToken);

      const driveRes = await fetch(`https://www.googleapis.com/drive/v3/files?${params}`);
      if (!driveRes.ok) {
        const errText = await driveRes.text();
        console.error('[Drive] API error:', errText);
        throw new Error(`Drive API error: ${driveRes.status} - ${errText}`);
      }
      const data = await driveRes.json();
      allFiles.push(...(data.files || []));
      pageToken = data.nextPageToken || '';
    } while (pageToken);

    console.log(`[Drive] Found ${allFiles.length} media files`);

    // Upsert into drive_assets table
    const upsert = db.prepare(`
      INSERT OR REPLACE INTO drive_assets (id, driveFileId, fileName, mimeType, fileSize, driveUrl, thumbnailUrl, contentType, status, syncedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, COALESCE((SELECT status FROM drive_assets WHERE driveFileId = ?), 'unused'), ?)
    `);

    const now = Date.now();
    for (const f of allFiles) {
      const isVideo = f.mimeType?.startsWith('video/');
      const driveUrl = `https://drive.google.com/uc?export=download&id=${f.id}`;
      upsert.run(
        f.id, f.id, f.name, f.mimeType || '', parseInt(f.size || '0'),
        driveUrl, f.thumbnailLink || '', isVideo ? 'Video' : 'Photo',
        f.id, now
      );
    }

    res.json({
      files: allFiles.map(f => ({
        id: f.id,
        name: f.name,
        mimeType: f.mimeType,
        size: f.size,
        thumbnailLink: f.thumbnailLink,
        driveUrl: `https://drive.google.com/uc?export=download&id=${f.id}`,
        contentType: f.mimeType?.startsWith('video/') ? 'Video' : 'Photo',
        createdTime: f.createdTime
      })),
      total: allFiles.length
    });
  } catch (error: any) {
    console.error('[Drive] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Get synced drive assets with filtering
app.get('/api/drive/assets', (req, res) => {
  try {
    const { status, contentType } = req.query;
    let sql = 'SELECT * FROM drive_assets WHERE 1=1';
    const params: any[] = [];
    if (status) { sql += ' AND status = ?'; params.push(status); }
    if (contentType) { sql += ' AND contentType = ?'; params.push(contentType); }
    sql += ' ORDER BY syncedAt DESC';
    const rows = db.prepare(sql).all(...params);
    res.json(rows);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Update drive asset status
app.patch('/api/drive/assets/:id', (req, res) => {
  try {
    const { status, linkedDayId } = req.body;
    const updates: string[] = [];
    const params: any[] = [];
    if (status) { updates.push('status = ?'); params.push(status); }
    if (linkedDayId) { updates.push('linkedDayId = ?'); params.push(linkedDayId); }
    if (updates.length === 0) return res.status(400).json({ error: 'Nothing to update' });
    params.push(req.params.id);
    db.prepare(`UPDATE drive_assets SET ${updates.join(', ')} WHERE id = ?`).run(...params);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Drive stats
app.get('/api/drive/stats', (req, res) => {
  try {
    const total = (db.prepare('SELECT COUNT(*) as c FROM drive_assets').get() as any).c;
    const unused = (db.prepare("SELECT COUNT(*) as c FROM drive_assets WHERE status = 'unused'").get() as any).c;
    const queued = (db.prepare("SELECT COUNT(*) as c FROM drive_assets WHERE status = 'queued'").get() as any).c;
    const published = (db.prepare("SELECT COUNT(*) as c FROM drive_assets WHERE status = 'published'").get() as any).c;
    const photos = (db.prepare("SELECT COUNT(*) as c FROM drive_assets WHERE contentType = 'Photo'").get() as any).c;
    const videos = (db.prepare("SELECT COUNT(*) as c FROM drive_assets WHERE contentType = 'Video'").get() as any).c;
    res.json({ total, unused, queued, published, photos, videos });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Settings — stored in SQLite for local dev (matches Worker's user_settings table behavior)
db.exec(`
  CREATE TABLE IF NOT EXISTS user_settings (
    id INTEGER PRIMARY KEY DEFAULT 1,
    data TEXT NOT NULL DEFAULT '{}'
  );
`);

app.get('/api/settings', (req, res) => {
  try {
    const row = db.prepare('SELECT data FROM user_settings WHERE id = 1').get() as any;
    res.json(row ? JSON.parse(row.data) : {});
  } catch {
    res.json({});
  }
});

app.post('/api/settings', (req, res) => {
  try {
    const existing = db.prepare('SELECT data FROM user_settings WHERE id = 1').get() as any;
    const current = existing ? JSON.parse(existing.data) : {};
    const merged = { ...current, ...req.body };
    db.prepare('INSERT OR REPLACE INTO user_settings (id, data) VALUES (1, ?)').run(JSON.stringify(merged));
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});
