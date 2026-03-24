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
              model_name: model_name || 'kling-v2-5-Turbo',
              image: image_url,
              image_url: image_url,
              prompt: prompt,
              duration: 5
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
                  model_name: model_name || 'kling-v2-5-Turbo',
                  image: image_url,
                  image_url: image_url,
                  prompt: prompt,
                  duration: 5
              })
          });
      }

      const data = await response.json();
      console.log("[Server] Kling API Reply:", JSON.stringify(data));
      const taskId = data.task_id || data.data?.taskId;
      if (!taskId) throw new Error(`Kling failed to return task ID. Status: ${response.status}. Reply: ${JSON.stringify(data)}`);

      console.log(`[Server] Task ID Created: ${taskId}`);

      // Polling inside server node loop
      let attempts = 0;
      const maxAttempts = 40;
      const pollInterval = 10000;

      while (attempts < maxAttempts) {
          await new Promise(r => setTimeout(r, pollInterval));
          attempts++;
          const statusResp = await fetch(`${activeBaseUrl}/v1/videos/task-status?id=${taskId}`, {
              headers: { 'Authorization': `Bearer ${jwt}` }
          });
          const statusData = await statusResp.json();
       
          const status = statusData.status || statusData.data?.status;
          const videoUrl = statusData.video_url || statusData.data?.videoUrl;

          if (status === 'SUCCESS' || status === 'COMPLETED' || status === 1) {
              if (videoUrl) {
                  // Download and Save Video locally into uploads as well!
                  const videoResponse = await fetch(videoUrl);
                  const arrayBuffer = await videoResponse.arrayBuffer();
                  const buffer = Buffer.from(arrayBuffer);
                  const filename = `kling_${Date.now()}.mp4`;
                  const uploadsDir = path.join(__dirname, 'public', 'uploads');
                  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
                  fs.writeFileSync(path.join(uploadsDir, filename), buffer);

                  return res.json({ success: true, url: `/uploads/${filename}` });
              }
              throw new Error("No video URL returned.");
          } else if (status === 'FAILED' || status === -1) {
              throw new Error("Kling task failed completion setups.");
          }
          console.log(`Polling Kling Server... Attempt ${attempts}/${maxAttempts}`);
      }
      res.status(500).json({ error: "Kling timed out." });
  } catch (error: any) {
      res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});
