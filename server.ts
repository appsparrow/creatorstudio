import express from 'express';
import cors from 'cors';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createCanvas, loadImage } from 'canvas';

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
app.post('/api/blotato/publish', async (req, res) => {
    try {
        const { image, video, caption, hashtags, onScreenText, contentType, blotatoApiKey, dayId } = req.body;
        if (!blotatoApiKey) {
            return res.status(400).json({ error: "Blotato API Key missing. Please set it in Settings." });
        }

        console.log(`\n[Blotato Publisher] Preparing live request for DayID: ${dayId}...`);

        // 1. Fetch the user's connected Blotato accounts to get the required Account ID (Targeting Instagram directly)
        const accountsRes = await fetch('https://backend.blotato.com/v2/users/me/accounts?platform=instagram', {
            headers: { 'Authorization': `Bearer ${blotatoApiKey}`, 'x-api-key': blotatoApiKey }
        });
        
        if (!accountsRes.ok) {
            const err = await accountsRes.text();
            throw new Error(`Failed to authenticate with Blotato: ${err}`);
        }
        
        const accountsData = await accountsRes.json();
        console.log(`[Blotato Publisher] Raw Accounts API Response:`, JSON.stringify(accountsData, null, 2));
        
        // Blotato docs specify response is in `{ items: [...] }`
        const accountsArray = Array.isArray(accountsData) ? accountsData : accountsData.items || accountsData.data || [];
        const targetAccount = accountsArray.find((acc: any) => acc.platform === 'instagram') || accountsArray[0];

        if (!targetAccount || !targetAccount.id) {
            throw new Error(`No connected Instagram account found. Blotato returned: ${JSON.stringify(accountsData)}`);
        }

        console.log(`[Blotato Publisher] Found Account ID: ${targetAccount.id}. Sending post...`);

        // 2. Upload Local Media to Blotato Servers natively (Bypasses Ngrok Free-Tier Anti-Phishing blocks)
        const processMedia = async (mediaPath: string) => {
             // Handle local or mapped Google Drive downloads!
             if (mediaPath.includes('/uploads/') || mediaPath.startsWith('http')) {
                 let buffer: Buffer;
                 let mimeType = 'image/jpeg';
                 
                 if (mediaPath.includes('/uploads/')) {
                     const localRelativePath = mediaPath.substring(mediaPath.indexOf('/uploads/'));
                     const absoluteDiskPath = path.join(__dirname, 'public', localRelativePath);
                     if (!fs.existsSync(absoluteDiskPath)) throw new Error(`Media not found locally: ${absoluteDiskPath}`);

                     console.log(`[Blotato Publisher] Processing local media ${localRelativePath} ...`);
                     buffer = fs.readFileSync(absoluteDiskPath);
                     mimeType = localRelativePath.endsWith('.mp4') ? 'video/mp4' : 'image/jpeg';
                 } else {
                     console.log(`[Blotato Publisher] Fetching Remote Media Buffer -> ${mediaPath} ...`);
                     const dlRes = await fetch(mediaPath);
                     if (!dlRes.ok) throw new Error("Failed to download remote media buffer: " + (await dlRes.text()));
                     const arrayBuffer = await dlRes.arrayBuffer();
                     buffer = Buffer.from(arrayBuffer);
                     mimeType = dlRes.headers.get('content-type') || 'image/jpeg';
                 }
                 
                 let finalBase64 = buffer.toString('base64');
                 
                 // --- CANVAS TEXT BURNER (Images Only) ---
                 if (mimeType.includes('image') && onScreenText) {
                    console.log(`[Blotato Publisher] Applying Text Burner overlay to image...`);
                    const img = await loadImage(buffer);
                    const canvas = createCanvas(img.width, img.height);
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, img.width, img.height);
                    
                    const boxWidth = img.width * 0.75;
                    const fontSize = Math.floor(img.width * 0.038); // tighter, elegantly smaller scaling
                    const padding = fontSize * 1.5;
                    const lineHeight = fontSize * 1.35;
                    
                    ctx.font = `bold ${fontSize}px sans-serif`;
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    
                    // Flatten out AI-generated newlines into a continuous string
                    const cleanContinuousText = onScreenText.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
                    const words = cleanContinuousText.split(' ');
                    
                    let line = '';
                    const lines = [];
                    for (let n = 0; n < words.length; n++) {
                        const testLine = line + words[n] + ' ';
                        const metrics = ctx.measureText(testLine);
                        if (metrics.width > (boxWidth - padding * 2) && n > 0) {
                            if (lines.length >= 2) { 
                                // Hard cap at maximum 3 lines: replace last word logic with an ellipsis
                                line = line.trim() + '...';
                                break; 
                            }
                            lines.push(line);
                            line = words[n] + ' ';
                        } else {
                            line = testLine;
                        }
                    }
                    if (lines.length < 3 && line) {
                        lines.push(line);
                    }
                    
                    const boxHeight = (lines.length * lineHeight) + (padding * 1.5);
                    const boxX = (img.width - boxWidth) / 2;
                    const boxY = img.height - boxHeight - (img.height * 0.12); // Place 12% above bottom frame
                    const r = Math.min(24, boxHeight / 2); // rounded corner radius

                    // Background Box
                    ctx.fillStyle = 'rgba(70, 60, 50, 0.85)';
                    ctx.beginPath();
                    ctx.moveTo(boxX + r, boxY);
                    ctx.lineTo(boxX + boxWidth - r, boxY);
                    ctx.quadraticCurveTo(boxX + boxWidth, boxY, boxX + boxWidth, boxY + r);
                    ctx.lineTo(boxX + boxWidth, boxY + boxHeight - r);
                    ctx.quadraticCurveTo(boxX + boxWidth, boxY + boxHeight, boxX + boxWidth - r, boxY + boxHeight);
                    ctx.lineTo(boxX + r, boxY + boxHeight);
                    ctx.quadraticCurveTo(boxX, boxY + boxHeight, boxX, boxY + boxHeight - r);
                    ctx.lineTo(boxX, boxY + r);
                    ctx.quadraticCurveTo(boxX, boxY, boxX + r, boxY);
                    ctx.closePath();
                    ctx.fill();
                    
                    // Text
                    ctx.fillStyle = '#ffffff';
                    let textY = boxY + padding + (fontSize/2);
                    for (const l of lines) {
                        ctx.fillText(l.trim(), img.width / 2, textY);
                        textY += lineHeight;
                    }

                    // Export the newly stamped PNG buffer directly into Base64 format!
                    const outputBuffer = canvas.toBuffer('image/jpeg', { quality: 0.95 });
                    finalBase64 = outputBuffer.toString('base64');
                 }
                 // ----------------------------------------
                 
                 const dataUri = `data:${mimeType};base64,${finalBase64}`;

                 console.log(`[Blotato Publisher] Uploading finalized media to Blotato Hosting...`);
                 const uploadRes = await fetch('https://backend.blotato.com/v2/media', {
                     method: 'POST',
                     headers: {
                         'Authorization': `Bearer ${blotatoApiKey}`,
                         'x-api-key': blotatoApiKey,
                         'Content-Type': 'application/json'
                     },
                     body: JSON.stringify({ url: dataUri })
                 });

                 if (!uploadRes.ok) {
                     throw new Error(`Blotato Media Upload Failed: ${await uploadRes.text()}`);
                 }
                 const uploadData = await uploadRes.json();
                 console.log(`[Blotato Publisher] Media successfully uploaded onto Blotato: ${uploadData.url}`);
                 return uploadData.url;
             }
             return mediaPath;
        };

        const finalMediaUrls = [];
        if (video) finalMediaUrls.push(await processMedia(video));
        else if (image) finalMediaUrls.push(await processMedia(image));

        // 3. Prepare exact schema as requested by API v2
        // Blotato explicitly limits Hashtags to 5 for Instagram
        let processedHashtags = '';
        if (hashtags) {
            // Split by space or #, clean up, and slice to 5 max
            const tagsArray = hashtags.split(/[\s#]+/).filter(Boolean).map((t: string) => `#${t}`);
            processedHashtags = tagsArray.slice(0, 5).join(' ');
        }

        const finalText = `${caption ? caption.trim() : ''}\n\n${processedHashtags}`.trim();

        // NOTE: We default to Instagram for Creator Studio MVP, passing data down directly
        const postPayload = {
            post: {
                accountId: targetAccount.id,
                content: {
                    text: finalText,
                    mediaUrls: finalMediaUrls,
                    platform: "instagram"
                },
                target: {
                    targetType: "instagram",
                    mediaType: video ? "reel" : undefined // "reel" or "story". Undefined for photos.
                }
            }
        };

        const publishRes = await fetch('https://backend.blotato.com/v2/posts', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${blotatoApiKey}`,
                'x-api-key': blotatoApiKey,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(postPayload)
        });

        if (!publishRes.ok) {
             const postErr = await publishRes.text();
             throw new Error(`Failed to publish post: ${postErr}`);
        }

        const publishData = await publishRes.json();
        console.log(`[Blotato Publisher] Success: POSTED LIVE! ID: ${publishData.postSubmissionId || 'unknown'}`);
        
        res.json({ success: true, publishedAt: new Date().toISOString(), platformPostId: publishData.postSubmissionId });
    } catch (error: any) {
        console.error("[Blotato Publisher Error]", error.message);
        res.status(500).json({ error: error.message });
    }
});

app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});
