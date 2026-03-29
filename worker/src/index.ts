/**
 * CreatorStudio — Cloudflare Workers API
 * Framework : Hono 4.x
 * Database  : Supabase (Postgres + RLS + Storage)
 *
 * Replaces the local Express + SQLite server.ts.
 *
 * Auth model
 * ----------
 * Every route except POST /api/videos/callback requires a valid Supabase
 * user JWT in `Authorization: Bearer <token>`.  We forward that token to
 * the Supabase JS client so RLS policies run as the authenticated user —
 * no manual user_id filters needed in SQL.
 *
 * The callback webhook uses the service-role key (bypasses RLS) because
 * Kling calls it directly with no user context.
 *
 * Kling JWT
 * ---------
 * The original server used Node's `crypto.createHmac`.  Workers ship the
 * Web Crypto API (crypto.subtle) instead.  We implement HS256 signing with
 * SubtleCrypto.importKey + SubtleCrypto.sign.
 *
 * Canvas text overlay
 * -------------------
 * Removed from this server (no canvas/node-canvas in Workers).
 * The browser applies text overlays before calling POST /api/blotato/publish.
 *
 * Required Supabase tables (run the migration at the bottom of this file)
 * -----------------------------------------------------------------------
 *   personas      — id uuid, user_id uuid, data jsonb
 *   days          — id uuid, persona_id uuid, user_id uuid, data jsonb
 *   video_tasks   — task_id text, day_id uuid, user_id uuid, created_at timestamptz
 *   drive_assets  — see migration below
 *
 * Required Supabase Storage bucket
 * ----------------------------------
 *   uploads  — public bucket (or private with signed URLs — your call)
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// ---------------------------------------------------------------------------
// Env bindings (Cloudflare Workers typed env)
// ---------------------------------------------------------------------------

interface Env {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  /** Google Drive API key (falls back to GEMINI_API_KEY if unset) */
  DRIVE_API_KEY: string;
  GEMINI_API_KEY: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a Supabase client that acts as the authenticated user.
 * RLS policies run as that user automatically.
 */
function userClient(env: Env, token: string): SupabaseClient {
  return createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Build a Supabase client with the service-role key.
 * Use only for trusted server-side operations (webhooks, etc.).
 */
function serviceClient(env: Env): SupabaseClient {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Extract and validate the bearer token from Authorization header.
 * Returns the token string or throws a 401 Response.
 */
function extractToken(authHeader: string | null): string {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('Missing or invalid Authorization header');
  }
  return authHeader.slice(7).trim();
}

/**
 * Resolve the authenticated user's ID from the Supabase client.
 * Throws on failure.
 */
async function resolveUserId(supabase: SupabaseClient): Promise<string> {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new Error('Unauthorized — invalid token');
  return user.id;
}

/**
 * Generate a Kling HS256 JWT using the Web Crypto API.
 * Drop-in replacement for the Node.js crypto.createHmac approach.
 */
async function generateKlingJWT(apiKey: string, apiSecret: string): Promise<string> {
  const b64url = (input: string): string =>
    btoa(input).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = b64url(JSON.stringify({
    iss: apiKey,
    exp: Math.floor(Date.now() / 1000) + 1800,
    nbf: Math.floor(Date.now() / 1000) - 60,
  }));

  const dataToSign = `${header}.${payload}`;
  const enc = new TextEncoder();

  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(apiSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );

  const sigBuffer = await crypto.subtle.sign('HMAC', key, enc.encode(dataToSign));

  // ArrayBuffer → base64url
  const sigBytes = new Uint8Array(sigBuffer);
  let binary = '';
  for (const byte of sigBytes) binary += String.fromCharCode(byte);
  const signature = btoa(binary).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

  return `${dataToSign}.${signature}`;
}

/** Extract Google Drive folder ID from a share URL. */
function extractFolderId(url: string): string | null {
  const match = url.match(/\/folders\/([-_a-zA-Z0-9]+)/);
  return match ? match[1] : null;
}

// ---------------------------------------------------------------------------
// Auth middleware (applied to all routes except the Kling callback)
// ---------------------------------------------------------------------------

/**
 * Attaches `supabase` (user-scoped client) and `userId` to the Hono context.
 * Skipped for routes that declare their own auth (like the webhook).
 */
type Variables = {
  supabase: SupabaseClient;
  userId: string;
};

const appWithVars = new Hono<{ Bindings: Env; Variables: Variables }>();

appWithVars.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'x-api-key'],
}));

// Auth guard — runs before every route except the callback webhook
appWithVars.use('/api/*', async (c, next) => {
  // The Kling callback is a server-to-server call — no user token.
  if (c.req.path === '/api/videos/callback' && c.req.method === 'POST') {
    return next();
  }

  try {
    const token = extractToken(c.req.header('Authorization') ?? null);
    const supabase = userClient(c.env, token);
    const userId = await resolveUserId(supabase);
    c.set('supabase', supabase);
    c.set('userId', userId);
    return next();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unauthorized';
    return c.json({ error: msg }, 401);
  }
});

// ---------------------------------------------------------------------------
// Route: GET /api/personas
// ---------------------------------------------------------------------------

appWithVars.get('/api/personas', async (c) => {
  const supabase = c.get('supabase');
  const { data, error } = await supabase
    .from('personas')
    .select('data')
    .order('created_at', { ascending: true });

  if (error) return c.json({ error: error.message }, 500);

  // Each row stores the full persona object as JSONB; unwrap it
  const personas = (data ?? []).map((r: { data: unknown }) => r.data);
  return c.json(personas);
});

// ---------------------------------------------------------------------------
// Route: POST /api/personas
// ---------------------------------------------------------------------------

appWithVars.post('/api/personas', async (c) => {
  const supabase = c.get('supabase');
  const userId = c.get('userId');

  let persona: Record<string, unknown>;
  try {
    persona = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }

  if (!persona.id) return c.json({ error: 'id is required' }, 400);

  const { error } = await supabase
    .from('personas')
    .upsert({ id: persona.id, user_id: userId, data: persona }, { onConflict: 'id' });

  if (error) return c.json({ error: error.message }, 500);
  return c.json({ success: true, id: persona.id });
});

// ---------------------------------------------------------------------------
// Route: DELETE /api/personas/:id
// ---------------------------------------------------------------------------

appWithVars.delete('/api/personas/:id', async (c) => {
  const supabase = c.get('supabase');
  const id = c.req.param('id');

  // Delete dependent days first (cascade via app logic; Supabase FK cascade
  // handles this automatically if you define it in the migration, but we do
  // it explicitly here so it works regardless of FK config)
  const { error: daysErr } = await supabase
    .from('days')
    .delete()
    .eq('persona_id', id);

  if (daysErr) return c.json({ error: daysErr.message }, 500);

  const { error } = await supabase
    .from('personas')
    .delete()
    .eq('id', id);

  if (error) return c.json({ error: error.message }, 500);
  return c.json({ success: true });
});

// ---------------------------------------------------------------------------
// Route: GET /api/days
// ---------------------------------------------------------------------------

appWithVars.get('/api/days', async (c) => {
  const supabase = c.get('supabase');
  const { data, error } = await supabase
    .from('days')
    .select('data')
    .order('created_at', { ascending: true });

  if (error) return c.json({ error: error.message }, 500);

  const days = (data ?? []).map((r: { data: unknown }) => r.data);
  return c.json(days);
});

// ---------------------------------------------------------------------------
// Route: POST /api/days
// ---------------------------------------------------------------------------

appWithVars.post('/api/days', async (c) => {
  const supabase = c.get('supabase');
  const userId = c.get('userId');

  let day: Record<string, unknown>;
  try {
    day = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }

  if (!day.id) return c.json({ error: 'id is required' }, 400);
  if (!day.personaId) return c.json({ error: 'personaId is required' }, 400);

  const { error } = await supabase
    .from('days')
    .upsert(
      { id: day.id, persona_id: day.personaId, user_id: userId, data: day },
      { onConflict: 'id' },
    );

  if (error) return c.json({ error: error.message }, 500);
  return c.json({ success: true, id: day.id });
});

// ---------------------------------------------------------------------------
// Route: DELETE /api/days/:id
// ---------------------------------------------------------------------------

appWithVars.delete('/api/days/:id', async (c) => {
  const supabase = c.get('supabase');
  const id = c.req.param('id');

  const { error } = await supabase.from('days').delete().eq('id', id);
  if (error) return c.json({ error: error.message }, 500);
  return c.json({ success: true });
});

// ---------------------------------------------------------------------------
// Route: POST /api/images/save
// Save a base64-encoded image to Supabase Storage under
//   uploads/{userId}/{personaId}/{filename}
// Returns a public URL (or a path suitable for re-fetching).
// ---------------------------------------------------------------------------

appWithVars.post('/api/images/save', async (c) => {
  const supabase = c.get('supabase');
  const userId = c.get('userId');

  let body: { base64?: string; filename?: string; personaId?: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }

  const { base64, filename, personaId } = body;
  if (!base64 || !filename) {
    return c.json({ error: 'base64 and filename are required' }, 400);
  }

  // Strip the data URI prefix if present: "data:image/jpeg;base64,..."
  const rawBase64 = base64.includes(',') ? base64.split(',')[1] : base64;

  // Decode to binary
  const binaryString = atob(rawBase64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  // Infer MIME type from filename extension
  const ext = filename.split('.').pop()?.toLowerCase() ?? 'jpg';
  const mimeMap: Record<string, string> = {
    jpg: 'image/jpeg', jpeg: 'image/jpeg',
    png: 'image/png', gif: 'image/gif',
    webp: 'image/webp', mp4: 'video/mp4',
  };
  const mimeType = mimeMap[ext] ?? 'image/jpeg';

  const storagePath = personaId
    ? `${userId}/${personaId}/${filename}`
    : `${userId}/${filename}`;

  const { error: uploadError } = await supabase.storage
    .from('uploads')
    .upload(storagePath, bytes.buffer, {
      contentType: mimeType,
      upsert: true,
    });

  if (uploadError) return c.json({ error: uploadError.message }, 500);

  const { data: urlData } = supabase.storage
    .from('uploads')
    .getPublicUrl(storagePath);

  return c.json({ success: true, url: urlData.publicUrl });
});

// ---------------------------------------------------------------------------
// Route: POST /api/nanobanana/proxy
// ---------------------------------------------------------------------------

appWithVars.post('/api/nanobanana/proxy', async (c) => {
  let body: { endpoint?: string; method?: string; payload?: unknown; apiKey?: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }

  const { endpoint, method, payload, apiKey } = body;
  if (!endpoint || !apiKey) {
    return c.json({ error: 'Missing proxy requirements: endpoint and apiKey are required' }, 400);
  }

  const httpMethod = (method ?? 'POST').toUpperCase();
  const response = await fetch(`https://api.nanobananaapi.ai${endpoint}`, {
    method: httpMethod,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: httpMethod === 'GET' ? undefined : JSON.stringify(payload),
  });

  const data = await response.json();
  return c.json(data, response.status as 200);
});

// ---------------------------------------------------------------------------
// Route: POST /api/videos/generate
// Trigger Kling image-to-video, store task_id → day_id mapping in Supabase.
// ---------------------------------------------------------------------------

appWithVars.post('/api/videos/generate', async (c) => {
  const supabase = c.get('supabase');
  const userId = c.get('userId');

  let body: {
    prompt?: string;
    image_url?: string;
    apiKey?: string;
    apiSecret?: string;
    model_name?: string;
    dayId?: string;
    publicTunnelUrl?: string;
  };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }

  const { prompt, image_url, apiKey, apiSecret, model_name, dayId, publicTunnelUrl } = body;

  if (!apiKey || !apiSecret) {
    return c.json({ error: 'Kling API Key and Secret are required.' }, 400);
  }

  console.log(`[Worker] Triggering Kling video for model=${model_name}, dayId=${dayId}`);

  const jwt = await generateKlingJWT(apiKey, apiSecret);

  const callbackUrl = publicTunnelUrl
    ? `${publicTunnelUrl.replace(/\/$/, '')}/api/videos/callback`
    : undefined;

  const klingBody = JSON.stringify({
    model_name: model_name ?? 'kling-v1',
    image: image_url,
    image_url: image_url,
    prompt: prompt,
    duration: 5,
    ...(callbackUrl ? { callback_url: callbackUrl } : {}),
  });

  const klingHeaders = {
    Authorization: `Bearer ${jwt}`,
    'Content-Type': 'application/json',
  };

  // Primary endpoint — fallback to Singapore on 404
  let response = await fetch('https://api.klingai.com/v1/videos/image2video', {
    method: 'POST',
    headers: klingHeaders,
    body: klingBody,
  });

  if (response.status === 404) {
    console.log('[Worker] Kling primary 404 — falling back to Singapore gateway');
    response = await fetch('https://api-singapore.klingai.com/v1/videos/image2video', {
      method: 'POST',
      headers: klingHeaders,
      body: klingBody,
    });
  }

  const data = await response.json() as Record<string, unknown>;
  console.log('[Worker] Kling API reply:', JSON.stringify(data));

  const taskData = data.data as Record<string, unknown> | undefined;
  const taskId = (data.task_id as string | undefined) ?? (taskData?.task_id as string | undefined);

  if (!taskId) {
    throw new Error(
      `Kling did not return a task_id. HTTP ${response.status}. Reply: ${JSON.stringify(data)}`,
    );
  }

  // Persist the task_id → day_id mapping so the webhook can auto-link later
  if (dayId) {
    const { error: taskErr } = await supabase
      .from('video_tasks')
      .upsert({ task_id: taskId, day_id: dayId, user_id: userId }, { onConflict: 'task_id' });

    if (taskErr) {
      console.error('[Worker] Failed to store video task mapping:', taskErr.message);
    } else {
      console.log(`[Worker] Mapped task_id=${taskId} → day_id=${dayId}`);
    }
  }

  return c.json({ success: true, taskId });
});

// ---------------------------------------------------------------------------
// Route: GET /api/videos/status/:taskId
// Poll Kling for render progress.
// ---------------------------------------------------------------------------

appWithVars.get('/api/videos/status/:taskId', async (c) => {
  const taskId = c.req.param('taskId');
  const apiKey = c.req.header('x-api-key');
  const apiSecret = c.req.header('x-api-secret');

  if (!apiKey || !apiSecret) {
    return c.json({ error: 'Missing API credentials — provide x-api-key and x-api-secret headers' }, 400);
  }

  const jwt = await generateKlingJWT(apiKey, apiSecret);
  const klingHeaders = {
    Authorization: `Bearer ${jwt}`,
    'Content-Type': 'application/json',
  };

  let statusResp = await fetch(
    `https://api.klingai.com/v1/videos/image2video/${taskId}`,
    { headers: klingHeaders },
  );

  if (statusResp.status === 404) {
    statusResp = await fetch(
      `https://api-singapore.klingai.com/v1/videos/image2video/${taskId}`,
      { headers: klingHeaders },
    );
  }

  const statusData = await statusResp.json() as Record<string, unknown>;
  console.log(`[Worker] Kling status for task ${taskId}:`, JSON.stringify(statusData));

  const taskResult = (statusData.data as Record<string, unknown> | undefined)?.task_result as Record<string, unknown> | undefined;
  const videos = taskResult?.videos as { url?: string }[] | undefined;

  const taskStatus = (statusData.data as Record<string, unknown> | undefined)?.task_status;
  const videoUrl =
    videos?.[0]?.url ??
    (taskResult?.video_url as string | undefined) ??
    ((statusData.data as Record<string, unknown> | undefined)?.video_url as string | undefined);

  return c.json({
    raw: statusData,
    task_status: taskStatus,
    video_url: videoUrl,
  });
});

// ---------------------------------------------------------------------------
// Route: POST /api/videos/callback  (Kling webhook — no user auth)
// Uses service-role key to update days directly, bypassing RLS.
// ---------------------------------------------------------------------------

appWithVars.post('/api/videos/callback', async (c) => {
  const supabase = serviceClient(c.env);

  let data: Record<string, unknown>;
  try {
    data = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }

  console.log('[Webhook] Kling callback received:', JSON.stringify(data));

  const taskId = data.task_id as string | undefined;
  const status = data.task_status as string | undefined;
  const taskResult = data.task_result as Record<string, unknown> | undefined;
  const videoUrl = (taskResult?.videos as { url?: string }[] | undefined)?.[0]?.url;

  if (status !== 'succeed' || !videoUrl || !taskId) {
    // Kling sends callbacks for intermediate states too — just ack them
    return c.json({ success: true });
  }

  // Look up which day this task belongs to
  const { data: taskRow, error: taskErr } = await supabase
    .from('video_tasks')
    .select('day_id, user_id')
    .eq('task_id', taskId)
    .single();

  if (taskErr || !taskRow) {
    console.log(`[Webhook] No day mapping found for task_id=${taskId}`);
    return c.json({ success: true });
  }

  const { day_id, user_id } = taskRow as { day_id: string; user_id: string };

  // Fetch the day's JSONB blob
  const { data: dayRow, error: dayErr } = await supabase
    .from('days')
    .select('data')
    .eq('id', day_id)
    .single();

  if (dayErr || !dayRow) {
    console.log(`[Webhook] Day ${day_id} not found for task ${taskId}`);
    return c.json({ success: true });
  }

  const dayData = dayRow.data as Record<string, unknown>;
  dayData.generatedVideoUrl = videoUrl;
  dayData.status = 'completed';

  const { error: updateErr } = await supabase
    .from('days')
    .update({ data: dayData })
    .eq('id', day_id);

  if (updateErr) {
    console.error(`[Webhook] Failed to update day ${day_id}:`, updateErr.message);
  } else {
    console.log(`[Webhook] Auto-linked video to day_id=${day_id} (user_id=${user_id})`);
  }

  return c.json({ success: true });
});

// ---------------------------------------------------------------------------
// Route: POST /api/blotato/publish
// Fetch media (local Supabase Storage or remote URL), upload to Blotato,
// publish to Instagram.
//
// NOTE: Canvas text overlay has moved to the browser.
//       The caller should burn text into the image before sending.
// ---------------------------------------------------------------------------

appWithVars.post('/api/blotato/publish', async (c) => {
  const supabase = c.get('supabase');
  const userId = c.get('userId');

  let body: {
    image?: string;
    video?: string;
    caption?: string;
    hashtags?: string;
    contentType?: string;
    blotatoApiKey?: string;
    dayId?: string;
  };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }

  const { image, video, caption, hashtags, blotatoApiKey, dayId } = body;

  if (!blotatoApiKey) {
    return c.json({ error: 'Blotato API Key missing. Please set it in Settings.' }, 400);
  }

  console.log(`[Blotato] Preparing publish request for dayId=${dayId}`);

  // 1. Fetch connected Blotato Instagram account
  const accountsRes = await fetch(
    'https://backend.blotato.com/v2/users/me/accounts?platform=instagram',
    {
      headers: {
        Authorization: `Bearer ${blotatoApiKey}`,
        'x-api-key': blotatoApiKey,
      },
    },
  );

  if (!accountsRes.ok) {
    const err = await accountsRes.text();
    return c.json({ error: `Failed to authenticate with Blotato: ${err}` }, 502);
  }

  const accountsData = await accountsRes.json() as Record<string, unknown>;
  console.log('[Blotato] Accounts response:', JSON.stringify(accountsData));

  const accountsArray: Array<Record<string, unknown>> = Array.isArray(accountsData)
    ? accountsData
    : (accountsData.items as Array<Record<string, unknown>> | undefined)
      ?? (accountsData.data as Array<Record<string, unknown>> | undefined)
      ?? [];

  const targetAccount =
    accountsArray.find((acc) => acc.platform === 'instagram') ?? accountsArray[0];

  if (!targetAccount?.id) {
    return c.json(
      { error: `No connected Instagram account found. Blotato returned: ${JSON.stringify(accountsData)}` },
      502,
    );
  }

  console.log(`[Blotato] Using account ID: ${targetAccount.id}`);

  // 2. Fetch media bytes and upload to Blotato hosting
  const processMedia = async (mediaPath: string): Promise<string> => {
    let bytes: Uint8Array;
    let mimeType = 'image/jpeg';

    if (mediaPath.startsWith('http')) {
      // Could be a Supabase Storage public URL or any remote URL
      const dlRes = await fetch(mediaPath);
      if (!dlRes.ok) {
        throw new Error(`Failed to download media from ${mediaPath}: ${await dlRes.text()}`);
      }
      mimeType = dlRes.headers.get('content-type') ?? 'image/jpeg';
      bytes = new Uint8Array(await dlRes.arrayBuffer());
    } else {
      // Treat as a Supabase Storage path: strip leading slash if present
      const storagePath = mediaPath.startsWith('/') ? mediaPath.slice(1) : mediaPath;

      // Check if it looks like a Supabase storage path (uploads/...) or
      // a legacy local path (/uploads/personaId/file.jpg).
      // We re-map legacy paths to userId/personaId/filename inside the bucket.
      const pathParts = storagePath.replace(/^uploads\//, '').split('/');
      const resolvedPath = pathParts.length >= 2
        ? `${userId}/${pathParts.join('/')}`
        : `${userId}/${storagePath}`;

      const { data: fileData, error: dlErr } = await supabase.storage
        .from('uploads')
        .download(resolvedPath);

      if (dlErr || !fileData) {
        throw new Error(`Media not found in Supabase Storage at ${resolvedPath}: ${dlErr?.message}`);
      }

      mimeType = resolvedPath.endsWith('.mp4') ? 'video/mp4' : 'image/jpeg';
      bytes = new Uint8Array(await fileData.arrayBuffer());
    }

    // Encode bytes to base64 for Blotato upload
    let binary = '';
    for (const byte of bytes) binary += String.fromCharCode(byte);
    const base64 = btoa(binary);
    const dataUri = `data:${mimeType};base64,${base64}`;

    console.log(`[Blotato] Uploading media to Blotato hosting (${mimeType})...`);

    const uploadRes = await fetch('https://backend.blotato.com/v2/media', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${blotatoApiKey}`,
        'x-api-key': blotatoApiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url: dataUri }),
    });

    if (!uploadRes.ok) {
      throw new Error(`Blotato media upload failed: ${await uploadRes.text()}`);
    }

    const uploadData = await uploadRes.json() as { url?: string };
    console.log(`[Blotato] Media uploaded: ${uploadData.url}`);
    return uploadData.url ?? '';
  };

  let finalMediaUrls: string[] = [];
  try {
    if (video) finalMediaUrls.push(await processMedia(video));
    else if (image) finalMediaUrls.push(await processMedia(image));
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return c.json({ error: msg }, 500);
  }

  // 3. Process hashtags — Blotato limits Instagram to 5
  let processedHashtags = '';
  if (hashtags) {
    const tagsArray = hashtags
      .split(/[\s#]+/)
      .filter(Boolean)
      .map((t: string) => `#${t}`);
    processedHashtags = tagsArray.slice(0, 5).join(' ');
  }

  const finalText = `${caption ? caption.trim() : ''}\n\n${processedHashtags}`.trim();

  // 4. Publish
  const postPayload = {
    post: {
      accountId: targetAccount.id,
      content: {
        text: finalText,
        mediaUrls: finalMediaUrls,
        platform: 'instagram',
      },
      target: {
        targetType: 'instagram',
        mediaType: video ? 'reel' : undefined,
      },
    },
  };

  const publishRes = await fetch('https://backend.blotato.com/v2/posts', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${blotatoApiKey}`,
      'x-api-key': blotatoApiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(postPayload),
  });

  if (!publishRes.ok) {
    const postErr = await publishRes.text();
    return c.json({ error: `Failed to publish post: ${postErr}` }, 502);
  }

  const publishData = await publishRes.json() as { postSubmissionId?: string };
  console.log(`[Blotato] Published! ID: ${publishData.postSubmissionId ?? 'unknown'}`);

  return c.json({
    success: true,
    publishedAt: new Date().toISOString(),
    platformPostId: publishData.postSubmissionId,
  });
});

// ---------------------------------------------------------------------------
// Route: POST /api/drive/list
// List files from a public Google Drive folder, upsert into drive_assets.
// ---------------------------------------------------------------------------

appWithVars.post('/api/drive/list', async (c) => {
  const supabase = c.get('supabase');

  let body: { folderUrl?: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }

  const folderId = extractFolderId(body.folderUrl ?? '');
  if (!folderId) return c.json({ error: 'Invalid Google Drive folder URL' }, 400);

  // Prefer DRIVE_API_KEY; fall back to GEMINI_API_KEY (same Google account key)
  const apiKey = c.env.DRIVE_API_KEY || c.env.GEMINI_API_KEY;
  if (!apiKey) return c.json({ error: 'No Google API key configured' }, 500);

  console.log(`[Drive] Listing files in folder: ${folderId}`);

  const allFiles: Array<{
    id: string;
    name: string;
    mimeType: string;
    size?: string;
    webContentLink?: string;
    thumbnailLink?: string;
    createdTime?: string;
  }> = [];

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
      return c.json({ error: `Drive API error: ${driveRes.status} — ${errText}` }, 502);
    }

    const page = await driveRes.json() as {
      files?: typeof allFiles;
      nextPageToken?: string;
    };
    allFiles.push(...(page.files ?? []));
    pageToken = page.nextPageToken ?? '';
  } while (pageToken);

  console.log(`[Drive] Found ${allFiles.length} media files`);

  // Upsert into drive_assets — preserve existing status on conflict
  const now = new Date().toISOString();
  const upsertRows = allFiles.map((f) => ({
    id: f.id,
    drive_file_id: f.id,
    file_name: f.name,
    mime_type: f.mimeType ?? '',
    file_size: parseInt(f.size ?? '0', 10),
    drive_url: `https://drive.google.com/uc?export=download&id=${f.id}`,
    thumbnail_url: f.thumbnailLink ?? '',
    content_type: f.mimeType?.startsWith('video/') ? 'Video' : 'Photo',
    synced_at: now,
  }));

  if (upsertRows.length > 0) {
    const { error: upsertErr } = await supabase
      .from('drive_assets')
      .upsert(upsertRows, {
        onConflict: 'drive_file_id',
        ignoreDuplicates: false,
      });

    if (upsertErr) {
      console.error('[Drive] Upsert error:', upsertErr.message);
      // Non-fatal — still return the file list
    }
  }

  return c.json({
    files: allFiles.map((f) => ({
      id: f.id,
      name: f.name,
      mimeType: f.mimeType,
      size: f.size,
      thumbnailLink: f.thumbnailLink,
      driveUrl: `https://drive.google.com/uc?export=download&id=${f.id}`,
      contentType: f.mimeType?.startsWith('video/') ? 'Video' : 'Photo',
      createdTime: f.createdTime,
    })),
    total: allFiles.length,
  });
});

// ---------------------------------------------------------------------------
// Route: GET /api/drive/assets
// Query persisted drive_assets with optional status/contentType filters.
// ---------------------------------------------------------------------------

appWithVars.get('/api/drive/assets', async (c) => {
  const supabase = c.get('supabase');
  const status = c.req.query('status');
  const contentType = c.req.query('contentType');

  let query = supabase
    .from('drive_assets')
    .select('*')
    .order('synced_at', { ascending: false });

  if (status) query = query.eq('status', status);
  if (contentType) query = query.eq('content_type', contentType);

  const { data, error } = await query;
  if (error) return c.json({ error: error.message }, 500);
  return c.json(data ?? []);
});

// ---------------------------------------------------------------------------
// Route: PATCH /api/drive/assets/:id
// Update status and/or linkedDayId for a single drive asset.
// ---------------------------------------------------------------------------

appWithVars.patch('/api/drive/assets/:id', async (c) => {
  const supabase = c.get('supabase');
  const id = c.req.param('id');

  let body: { status?: string; linkedDayId?: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }

  const updates: Record<string, string> = {};
  if (body.status) updates.status = body.status;
  if (body.linkedDayId) updates.linked_day_id = body.linkedDayId;

  if (Object.keys(updates).length === 0) {
    return c.json({ error: 'Nothing to update — provide status and/or linkedDayId' }, 400);
  }

  const { error } = await supabase
    .from('drive_assets')
    .update(updates)
    .eq('id', id);

  if (error) return c.json({ error: error.message }, 500);
  return c.json({ success: true });
});

// ---------------------------------------------------------------------------
// Route: GET /api/drive/stats
// Aggregate counts across drive_assets.
// ---------------------------------------------------------------------------

appWithVars.get('/api/drive/stats', async (c) => {
  const supabase = c.get('supabase');

  // Run all count queries in parallel
  const [total, unused, queued, published, photos, videos] = await Promise.all([
    supabase.from('drive_assets').select('*', { count: 'exact', head: true }),
    supabase.from('drive_assets').select('*', { count: 'exact', head: true }).eq('status', 'unused'),
    supabase.from('drive_assets').select('*', { count: 'exact', head: true }).eq('status', 'queued'),
    supabase.from('drive_assets').select('*', { count: 'exact', head: true }).eq('status', 'published'),
    supabase.from('drive_assets').select('*', { count: 'exact', head: true }).eq('content_type', 'Photo'),
    supabase.from('drive_assets').select('*', { count: 'exact', head: true }).eq('content_type', 'Video'),
  ]);

  // Surface any query error
  const firstErr = [total, unused, queued, published, photos, videos].find((r) => r.error);
  if (firstErr?.error) return c.json({ error: firstErr.error.message }, 500);

  return c.json({
    total: total.count ?? 0,
    unused: unused.count ?? 0,
    queued: queued.count ?? 0,
    published: published.count ?? 0,
    photos: photos.count ?? 0,
    videos: videos.count ?? 0,
  });
});

// ---------------------------------------------------------------------------
// Health check
// ---------------------------------------------------------------------------

appWithVars.get('/health', (c) => c.json({ status: 'ok', ts: Date.now() }));

// ---------------------------------------------------------------------------
// Default export (Cloudflare Workers entry point)
// ---------------------------------------------------------------------------

export default appWithVars;

// ===========================================================================
// SUPABASE MIGRATION
// Run this SQL in the Supabase SQL editor (or save as a migration file).
// ===========================================================================
//
// -- Enable UUID generation
// CREATE EXTENSION IF NOT EXISTS "pgcrypto";
//
// -- personas
// CREATE TABLE IF NOT EXISTS personas (
//   id          TEXT PRIMARY KEY,
//   user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
//   data        JSONB NOT NULL DEFAULT '{}',
//   created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
// );
// CREATE INDEX IF NOT EXISTS personas_user_id_idx ON personas(user_id);
//
// ALTER TABLE personas ENABLE ROW LEVEL SECURITY;
// CREATE POLICY "Users can CRUD their own personas"
//   ON personas FOR ALL USING (auth.uid() = user_id);
//
// -- days
// CREATE TABLE IF NOT EXISTS days (
//   id          TEXT PRIMARY KEY,
//   persona_id  TEXT NOT NULL REFERENCES personas(id) ON DELETE CASCADE,
//   user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
//   data        JSONB NOT NULL DEFAULT '{}',
//   created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
// );
// CREATE INDEX IF NOT EXISTS days_user_id_idx      ON days(user_id);
// CREATE INDEX IF NOT EXISTS days_persona_id_idx   ON days(persona_id);
//
// ALTER TABLE days ENABLE ROW LEVEL SECURITY;
// CREATE POLICY "Users can CRUD their own days"
//   ON days FOR ALL USING (auth.uid() = user_id);
//
// -- video_tasks
// CREATE TABLE IF NOT EXISTS video_tasks (
//   task_id     TEXT PRIMARY KEY,
//   day_id      TEXT NOT NULL,
//   user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
//   created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
// );
// CREATE INDEX IF NOT EXISTS video_tasks_user_id_idx ON video_tasks(user_id);
//
// ALTER TABLE video_tasks ENABLE ROW LEVEL SECURITY;
// CREATE POLICY "Users can read their own video tasks"
//   ON video_tasks FOR SELECT USING (auth.uid() = user_id);
// CREATE POLICY "Service role can manage all video tasks"
//   ON video_tasks FOR ALL USING (auth.role() = 'service_role');
//
// -- drive_assets  (no user_id — shared/global asset library)
// CREATE TABLE IF NOT EXISTS drive_assets (
//   id             TEXT PRIMARY KEY,
//   drive_file_id  TEXT UNIQUE NOT NULL,
//   file_name      TEXT NOT NULL,
//   mime_type      TEXT NOT NULL DEFAULT '',
//   file_size      BIGINT DEFAULT 0,
//   drive_url      TEXT DEFAULT '',
//   thumbnail_url  TEXT DEFAULT '',
//   content_type   TEXT DEFAULT 'Photo',
//   status         TEXT DEFAULT 'unused',
//   linked_day_id  TEXT,
//   synced_at      TIMESTAMPTZ NOT NULL DEFAULT now()
// );
// CREATE INDEX IF NOT EXISTS drive_assets_status_idx       ON drive_assets(status);
// CREATE INDEX IF NOT EXISTS drive_assets_content_type_idx ON drive_assets(content_type);
//
// ALTER TABLE drive_assets ENABLE ROW LEVEL SECURITY;
// -- Authenticated users can read all drive assets
// CREATE POLICY "Authenticated users can read drive_assets"
//   ON drive_assets FOR SELECT USING (auth.role() = 'authenticated');
// -- Authenticated users can insert/update/delete
// CREATE POLICY "Authenticated users can write drive_assets"
//   ON drive_assets FOR ALL USING (auth.role() = 'authenticated');
//
// -- Storage: create the uploads bucket
// INSERT INTO storage.buckets (id, name, public)
// VALUES ('uploads', 'uploads', true)
// ON CONFLICT (id) DO NOTHING;
//
// -- Storage RLS: allow authenticated users to manage their own files
// CREATE POLICY "Users can upload to their own folder"
//   ON storage.objects FOR INSERT
//   WITH CHECK (bucket_id = 'uploads' AND (storage.foldername(name))[1] = auth.uid()::text);
//
// CREATE POLICY "Users can update their own files"
//   ON storage.objects FOR UPDATE
//   USING (bucket_id = 'uploads' AND (storage.foldername(name))[1] = auth.uid()::text);
//
// CREATE POLICY "Users can delete their own files"
//   ON storage.objects FOR DELETE
//   USING (bucket_id = 'uploads' AND (storage.foldername(name))[1] = auth.uid()::text);
//
// CREATE POLICY "Public read access to uploads bucket"
//   ON storage.objects FOR SELECT
//   USING (bucket_id = 'uploads');
