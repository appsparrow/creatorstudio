import express from 'express';
import cors from 'cors';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

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
    const { base64, filename } = req.body;
    if (!base64 || !filename) return res.status(400).json({ error: 'base64 and filename are required' });

    // Ensure uploads directory exists
    const uploadsDir = path.join(__dirname, 'public', 'uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const filepath = path.join(uploadsDir, filename);
    const buffer = Buffer.from(base64.split(',')[1], 'base64');
    fs.writeFileSync(filepath, buffer);

    res.json({ success: true, url: `/uploads/${filename}` });
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

// Proxy Kling Video Generation to avoid CORS on client sets
app.post('/api/videos/generate', async (req, res) => {
  const { prompt, image_url, apiKey, apiSecret, model_name } = req.body;
  const BASE_URL = 'https://api.klingai.com';

  if (!apiKey || !apiSecret) {
    return res.status(400).json({ error: "Kling API Key and Secret are required for JWT signature." });
  }

  console.log(`[Server] Proxying Kling Video Trigger for ${model_name}...`);
  const jwt = generateKlingJWT(apiKey, apiSecret);
  let activeBaseUrl = 'https://api.klingai.com';

  try {
    let response = await fetch(`${activeBaseUrl}/v1/videos/image2video`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${jwt}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model_name: model_name || 'kling-v1',
        image: image_url,
        image_url: image_url,
        prompt: prompt,
        duration: 5,
        callback_url: req.body.publicTunnelUrl ? `${req.body.publicTunnelUrl.replace(/\/$/, '')}/api/videos/callback` : undefined
      })
    });

    // Failover to Singapore Gateway if 404
    if (response.status === 404) {
      console.log("[Server] Base API 404, falling back to Singapore Gateway...");
      activeBaseUrl = 'https://api-singapore.klingai.com';
      response = await fetch(`${activeBaseUrl}/v1/videos/image2video`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${jwt}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model_name: model_name || 'kling-v1',
          image: image_url,
          image_url: image_url,
          prompt: prompt,
          duration: 5,
          callback_url: req.body.publicTunnelUrl ? `${req.body.publicTunnelUrl.replace(/\/$/, '')}/api/videos/callback` : undefined
        })
      });
    }

    const data = await response.json();
    console.log("[Server] Kling API Reply:", JSON.stringify(data));
    const taskId = data.task_id || data.data?.task_id;
    if (!taskId) throw new Error(`Kling failed to return task ID. Status: ${response.status}. Reply: ${JSON.stringify(data)}`);

    console.log(`[Server] Task ID Created: ${taskId}`);

    console.log(`[Server] Task ID Created: ${taskId}`);

    // Return immediately with the Task ID to empower client-side loop visibility!
    return res.json({ success: true, taskId: taskId });
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
    const { videoUrl } = req.body;
    if (!videoUrl) return res.status(400).json({ error: "videoUrl is required." });

    const videoResponse = await fetch(videoUrl);
    const arrayBuffer = await videoResponse.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const filename = `kling_${Date.now()}.mp4`;
    const uploadsDir = path.join(__dirname, 'public', 'uploads');
    if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

    fs.writeFileSync(path.join(uploadsDir, filename), buffer);
    res.json({ success: true, url: `/uploads/${filename}` });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/videos/callback', async (req, res) => {
  try {
    console.log("[Server] Kling Callback Triggered:", JSON.stringify(req.body));
    const data = req.body;
    const status = data.task_status;
    const videoUrl = data.task_result?.videos?.[0]?.url || data.video_url;

    if (status === 'succeed' && videoUrl) {
      console.log(`[Webhook] Success found! Saving video to local downloads...`);
      const videoResponse = await fetch(videoUrl);
      const arrayBuffer = await videoResponse.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const filename = `kling_callback_${Date.now()}.mp4`;
      const uploadsDir = path.join(__dirname, 'public', 'uploads');
      if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
      fs.writeFileSync(path.join(uploadsDir, filename), buffer);
      console.log(`[Webhook] Saved video to public/uploads/${filename}`);
    }
    res.json({ success: true });
  } catch (error: any) {
    console.error("[Webhook] Webhook crash error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});
