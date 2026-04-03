/**
 * CreatorStudio — Cloudflare Workers API
 * Framework : Hono 4.x
 * Database  : Supabase (Postgres + RLS + Storage)
 *
 * Auth model
 * ----------
 * Every route except POST /api/videos/callback requires a valid Supabase
 * user JWT in `Authorization: Bearer <token>`.  We forward that token to
 * the Supabase JS client so RLS policies run as the authenticated user.
 *
 * The callback webhook uses the service-role key (bypasses RLS) because
 * Kling calls it directly with no user context.
 *
 * Schema
 * ------
 * All tables use normalized columns — no `data` JSONB blobs.
 * Conversion between frontend camelCase and DB snake_case is handled by
 * personaToDb / dbToPersona / dayToDb / dbToDay.
 *
 * Storage: Cloudflare R2 bucket 'creatorstudio-media'
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
  DRIVE_API_KEY: string;
  GEMINI_API_KEY: string;
  MEDIA_BUCKET: R2Bucket;
  R2_PUBLIC_URL: string;
}

// ---------------------------------------------------------------------------
// Frontend TypeScript types (what the API receives / returns)
// ---------------------------------------------------------------------------

interface PersonaIdentity {
  fullName: string;
  age: number;
  gender: string;
  nationality: string;
  birthplace: string;
  profession: string;
  locations: string[];
}

interface PersonaAppearance {
  height: string;
  bodyType: string;
  faceShape: string;
  eyes: string;
  hair: string;
  distinctFeatures: string[];
}

interface PersonaPsychographic {
  coreTraits: string[];
  interests: string[];
  values: string[];
  fears: string[];
  motivations: string[];
  mission: string;
}

interface PersonaFashionStyle {
  aesthetic: string;
  signatureItems: string[];
  photographyStyle: string;
}

interface PersonaLifestyle {
  routine: string;
  diet: string;
  pet?: string;
  socialMediaPresence: string;
}

interface PersonaSocialHandles {
  instagram?: string;
  tiktok?: string;
  youtube?: string;
  twitter?: string;
  x?: string;
}

interface Persona {
  id: string;
  identity: PersonaIdentity;
  appearance: PersonaAppearance;
  psychographic: PersonaPsychographic;
  backstory: string;
  fashionStyle: PersonaFashionStyle;
  lifestyle: PersonaLifestyle;
  socialHandles?: PersonaSocialHandles;
  referenceImageUrl?: string;
  referenceImageUrls?: string[];
  aiAnalysis?: string;
  instagramAccountId?: string;
  facebookPageId?: string;
}

interface ContentDay {
  id: string;
  dayNumber: number;
  date: string;
  platforms: string[];
  theme: string;
  sceneDescription: string;
  onScreenText: string;
  caption: string;
  hook: string;
  hashtags: string;
  cta: string;
  location: string;
  musicSuggestion: string;
  notes: string;
  contentType: 'Photo' | 'Carousel' | 'Video';
  generatedImageUrl?: string;
  generatedVideoUrl?: string;
  customMediaUrl?: string;
  pendingVideoTaskId?: string;
  status: 'draft' | 'generating' | 'completed' | 'published';
  personaId: string;
  styleOption?: string;
  isAIGenerated?: boolean;
  isGoodToPost?: boolean;
  postImageReferences?: unknown[];
  slides?: unknown[];
  hairstyle?: string;
}

// ---------------------------------------------------------------------------
// Conversion: Persona ↔ DB row
// ---------------------------------------------------------------------------

function personaToDb(persona: Persona, userId: string): Record<string, unknown> {
  return {
    id: persona.id,
    user_id: userId,
    full_name: persona.identity?.fullName ?? null,
    age: persona.identity?.age ?? null,
    gender: persona.identity?.gender ?? null,
    nationality: persona.identity?.nationality ?? null,
    birthplace: persona.identity?.birthplace ?? null,
    profession: persona.identity?.profession ?? null,
    locations: persona.identity?.locations ?? null,
    height: persona.appearance?.height ?? null,
    body_type: persona.appearance?.bodyType ?? null,
    face_shape: persona.appearance?.faceShape ?? null,
    eyes: persona.appearance?.eyes ?? null,
    hair: persona.appearance?.hair ?? null,
    distinct_features: persona.appearance?.distinctFeatures ?? null,
    psychographic: persona.psychographic ?? null,
    backstory: persona.backstory ?? null,
    fashion_style: persona.fashionStyle ?? null,
    lifestyle: persona.lifestyle ?? null,
    social_handles: persona.socialHandles ?? null,
    reference_image_url: persona.referenceImageUrl ?? null,
    reference_image_urls: persona.referenceImageUrls ?? null,
    ai_analysis: persona.aiAnalysis ?? null,
    instagram_account_id: persona.instagramAccountId ?? null,
    facebook_page_id: persona.facebookPageId ?? null,
  };
}

function dbToPersona(row: Record<string, unknown>): Persona {
  const psychographic = (row.psychographic as PersonaPsychographic | null) ?? {
    coreTraits: [],
    interests: [],
    values: [],
    fears: [],
    motivations: [],
    mission: '',
  };

  const fashionStyle = (row.fashion_style as PersonaFashionStyle | null) ?? {
    aesthetic: '',
    signatureItems: [],
    photographyStyle: '',
  };

  const lifestyle = (row.lifestyle as PersonaLifestyle | null) ?? {
    routine: '',
    diet: '',
    socialMediaPresence: '',
  };

  return {
    id: row.id as string,
    identity: {
      fullName: (row.full_name as string) ?? '',
      age: (row.age as number) ?? 0,
      gender: (row.gender as string) ?? '',
      nationality: (row.nationality as string) ?? '',
      birthplace: (row.birthplace as string) ?? '',
      profession: (row.profession as string) ?? '',
      locations: (row.locations as string[]) ?? [],
    },
    appearance: {
      height: (row.height as string) ?? '',
      bodyType: (row.body_type as string) ?? '',
      faceShape: (row.face_shape as string) ?? '',
      eyes: (row.eyes as string) ?? '',
      hair: (row.hair as string) ?? '',
      distinctFeatures: (row.distinct_features as string[]) ?? [],
    },
    psychographic,
    backstory: (row.backstory as string) ?? '',
    fashionStyle,
    lifestyle,
    socialHandles: (row.social_handles as PersonaSocialHandles | undefined) ?? undefined,
    referenceImageUrl: (row.reference_image_url as string | undefined) ?? undefined,
    referenceImageUrls: (row.reference_image_urls as string[] | undefined) ?? undefined,
    aiAnalysis: (row.ai_analysis as string | undefined) ?? undefined,
    instagramAccountId: (row.instagram_account_id as string | undefined) ?? undefined,
    facebookPageId: (row.facebook_page_id as string | undefined) ?? undefined,
  };
}

// ---------------------------------------------------------------------------
// Conversion: ContentDay ↔ DB row
// ---------------------------------------------------------------------------

function dayToDb(day: ContentDay, userId: string): Record<string, unknown> {
  return {
    id: day.id,
    user_id: userId,
    persona_id: day.personaId,
    day_number: day.dayNumber ?? null,
    date: day.date ?? null,
    platforms: day.platforms ?? null,
    content_type: day.contentType ?? null,
    theme: day.theme ?? null,
    scene_description: day.sceneDescription ?? null,
    on_screen_text: day.onScreenText ?? null,
    hairstyle: day.hairstyle ?? null,
    style_option: day.styleOption ?? null,
    caption: day.caption ?? null,
    hook: day.hook ?? null,
    hashtags: day.hashtags ?? null,
    cta: day.cta ?? null,
    location: day.location ?? null,
    music_suggestion: day.musicSuggestion ?? null,
    notes: day.notes ?? null,
    generated_image_url: day.generatedImageUrl ?? null,
    generated_video_url: day.generatedVideoUrl ?? null,
    custom_media_url: day.customMediaUrl ?? null,
    pending_video_task_id: day.pendingVideoTaskId ?? null,
    status: day.status ?? 'draft',
    is_ai_generated: day.isAIGenerated ?? null,
    is_good_to_post: day.isGoodToPost ?? null,
    post_image_references: day.postImageReferences ?? null,
    slides: day.slides ?? null,
  };
}

function dbToDay(row: Record<string, unknown>): ContentDay {
  return {
    id: row.id as string,
    personaId: (row.persona_id as string) ?? '',
    dayNumber: (row.day_number as number) ?? 0,
    date: (row.date as string) ?? '',
    platforms: (row.platforms as string[]) ?? [],
    contentType: (row.content_type as 'Photo' | 'Carousel' | 'Video') ?? 'Photo',
    theme: (row.theme as string) ?? '',
    sceneDescription: (row.scene_description as string) ?? '',
    onScreenText: (row.on_screen_text as string) ?? '',
    hairstyle: (row.hairstyle as string | undefined) ?? undefined,
    styleOption: (row.style_option as string | undefined) ?? undefined,
    caption: (row.caption as string) ?? '',
    hook: (row.hook as string) ?? '',
    hashtags: (row.hashtags as string) ?? '',
    cta: (row.cta as string) ?? '',
    location: (row.location as string) ?? '',
    musicSuggestion: (row.music_suggestion as string) ?? '',
    notes: (row.notes as string) ?? '',
    generatedImageUrl: (row.generated_image_url as string | undefined) ?? undefined,
    generatedVideoUrl: (row.generated_video_url as string | undefined) ?? undefined,
    customMediaUrl: (row.custom_media_url as string | undefined) ?? undefined,
    pendingVideoTaskId: (row.pending_video_task_id as string | undefined) ?? undefined,
    status: (row.status as 'draft' | 'generating' | 'completed' | 'published') ?? 'draft',
    isAIGenerated: (row.is_ai_generated as boolean | undefined) ?? undefined,
    isGoodToPost: (row.is_good_to_post as boolean | undefined) ?? undefined,
    postImageReferences: (row.post_image_references as unknown[] | undefined) ?? undefined,
    slides: (row.slides as unknown[] | undefined) ?? undefined,
  };
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
 * Returns the token string or throws an Error.
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
// Hono app setup
// ---------------------------------------------------------------------------

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

// Auth guard — runs before every route except the Kling callback webhook
appWithVars.use('/api/*', async (c, next) => {
  if (c.req.path === '/api/videos/callback' && c.req.method === 'POST') {
    return next();
  }
  // Serve R2 media files without auth (public assets)
  if (c.req.path.startsWith('/api/media/') && c.req.method === 'GET') {
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
    .select('*')
    .order('created_at', { ascending: true });

  if (error) return c.json({ error: error.message }, 500);

  const personas = (data ?? []).map((row: Record<string, unknown>) => dbToPersona(row));
  return c.json(personas);
});

// ---------------------------------------------------------------------------
// Route: POST /api/personas
// ---------------------------------------------------------------------------

appWithVars.post('/api/personas', async (c) => {
  const supabase = c.get('supabase');
  const userId = c.get('userId');

  let persona: Persona;
  try {
    persona = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }

  if (!persona.id) return c.json({ error: 'id is required' }, 400);

  const row = personaToDb(persona, userId);

  const { error } = await supabase
    .from('personas')
    .upsert(row, { onConflict: 'id' });

  if (error) return c.json({ error: error.message }, 500);
  return c.json({ success: true, id: persona.id });
});

// ---------------------------------------------------------------------------
// Route: DELETE /api/personas/:id
// ---------------------------------------------------------------------------

appWithVars.delete('/api/personas/:id', async (c) => {
  const supabase = c.get('supabase');
  const id = c.req.param('id');

  // Delete dependent days first (handles cases without FK cascade configured)
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
    .select('*')
    .order('created_at', { ascending: true });

  if (error) return c.json({ error: error.message }, 500);

  const days = (data ?? []).map((row: Record<string, unknown>) => dbToDay(row));
  return c.json(days);
});

// ---------------------------------------------------------------------------
// Route: POST /api/days
// ---------------------------------------------------------------------------

appWithVars.post('/api/days', async (c) => {
  const supabase = c.get('supabase');
  const userId = c.get('userId');

  let day: ContentDay;
  try {
    day = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }

  if (!day.id) return c.json({ error: 'id is required' }, 400);
  if (!day.personaId) return c.json({ error: 'personaId is required' }, 400);

  const row = dayToDb(day, userId);

  const { error } = await supabase
    .from('days')
    .upsert(row, { onConflict: 'id' });

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
// Route: GET /api/settings
// ---------------------------------------------------------------------------

appWithVars.get('/api/settings', async (c) => {
  const supabase = c.get('supabase');
  const userId = c.get('userId');

  const { data, error } = await supabase
    .from('user_settings')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error && error.code !== 'PGRST116') {
    // PGRST116 = "row not found" — return empty object instead of 500
    return c.json({ error: error.message }, 500);
  }

  // Convert snake_case DB columns → camelCase for frontend
  const row = data as Record<string, unknown> | null;
  if (!row) return c.json({});
  return c.json({
    blotatoApiKey: row.blotato_api_key ?? '',
    klingApiKey: row.kling_api_key ?? '',
    klingApiSecret: row.kling_api_secret ?? '',
    nanobananaApiKey: row.nanobanana_api_key ?? '',
    driveFolderUrl: row.drive_folder_url ?? '',
    postingMode: row.posting_mode ?? 'manual',
    postingTime: row.posting_time ?? '',
    postingEndTime: row.posting_end_time ?? '',
    postsPerDay: row.posts_per_day ?? 1,
    publicTunnelUrl: row.public_tunnel_url ?? '',
    metaAccessToken: row.meta_access_token ?? '',
    metaAppId: row.meta_app_id ?? '',
  });
});

// ---------------------------------------------------------------------------
// Route: POST /api/settings
// ---------------------------------------------------------------------------

appWithVars.post('/api/settings', async (c) => {
  const supabase = c.get('supabase');
  const userId = c.get('userId');

  let body: Record<string, unknown>;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }

  // Map camelCase frontend keys → snake_case DB columns
  const keyMap: Record<string, string> = {
    blotatoApiKey: 'blotato_api_key',
    klingApiKey: 'kling_api_key',
    klingApiSecret: 'kling_api_secret',
    nanobananaApiKey: 'nanobanana_api_key',
    driveFolderUrl: 'drive_folder_url',
    postingMode: 'posting_mode',
    postingTime: 'posting_time',
    postingEndTime: 'posting_end_time',
    postsPerDay: 'posts_per_day',
    publicTunnelUrl: 'public_tunnel_url',
    metaAccessToken: 'meta_access_token',
    metaAppId: 'meta_app_id',
  };

  const row: Record<string, unknown> = { user_id: userId };
  for (const [camel, snake] of Object.entries(keyMap)) {
    if (camel in body) row[snake] = body[camel];
  }

  const { error } = await supabase
    .from('user_settings')
    .upsert(row, { onConflict: 'user_id' });

  if (error) return c.json({ error: error.message }, 500);
  return c.json({ success: true });
});

// ---------------------------------------------------------------------------
// Route: POST /api/images/save
// Save a base64-encoded image to R2 under
//   {userId}/{personaId}/{filename}
// Returns a public URL.
// ---------------------------------------------------------------------------

appWithVars.post('/api/images/save', async (c) => {
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

  try {
    await c.env.MEDIA_BUCKET.put(storagePath, bytes.buffer, {
      httpMetadata: { contentType: mimeType },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return c.json({ error: `R2 upload failed: ${msg}` }, 500);
  }

  const publicUrl = c.env.R2_PUBLIC_URL
    ? `${c.env.R2_PUBLIC_URL}/${storagePath}`
    : `/api/media/${storagePath}`;

  return c.json({ success: true, url: publicUrl });
});

// ---------------------------------------------------------------------------
// Route: POST /api/videos/save
// Download a video from a URL and upload it to R2.
// Returns the public URL.
// ---------------------------------------------------------------------------

appWithVars.post('/api/videos/save', async (c) => {
  const userId = c.get('userId');

  let body: { videoUrl?: string; filename?: string; personaId?: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }

  const { videoUrl, filename, personaId } = body;
  if (!videoUrl) return c.json({ error: 'videoUrl is required' }, 400);

  const safeFilename = filename ?? `video_${Date.now()}.mp4`;

  console.log(`[Worker] Downloading video from: ${videoUrl}`);

  let videoBytes: Uint8Array;
  let mimeType = 'video/mp4';
  try {
    const dlRes = await fetch(videoUrl);
    if (!dlRes.ok) {
      return c.json(
        { error: `Failed to download video: HTTP ${dlRes.status}` },
        502,
      );
    }
    mimeType = dlRes.headers.get('content-type') ?? 'video/mp4';
    videoBytes = new Uint8Array(await dlRes.arrayBuffer());
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return c.json({ error: `Download error: ${msg}` }, 500);
  }

  const storagePath = personaId
    ? `${userId}/${personaId}/${safeFilename}`
    : `${userId}/${safeFilename}`;

  console.log(`[Worker] Uploading video to R2: ${storagePath}`);

  try {
    await c.env.MEDIA_BUCKET.put(storagePath, videoBytes.buffer, {
      httpMetadata: { contentType: mimeType },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return c.json({ error: `R2 upload failed: ${msg}` }, 500);
  }

  const publicUrl = c.env.R2_PUBLIC_URL
    ? `${c.env.R2_PUBLIC_URL}/${storagePath}`
    : `/api/media/${storagePath}`;

  console.log(`[Worker] Video saved: ${publicUrl}`);

  return c.json({ success: true, url: publicUrl });
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

  let payload: Record<string, unknown>;
  try {
    payload = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }

  console.log('[Webhook] Kling callback received:', JSON.stringify(payload));

  const taskId = payload.task_id as string | undefined;
  const status = payload.task_status as string | undefined;
  const taskResult = payload.task_result as Record<string, unknown> | undefined;
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

  // Update normalized columns directly — no JSONB blob fetch needed
  const { error: updateErr } = await supabase
    .from('days')
    .update({
      generated_video_url: videoUrl,
      status: 'completed',
    })
    .eq('id', day_id);

  if (updateErr) {
    console.error(`[Webhook] Failed to update day ${day_id}:`, updateErr.message);
  } else {
    console.log(`[Webhook] Auto-linked video to day_id=${day_id} (user_id=${user_id})`);
  }

  return c.json({ success: true });
});

// ---------------------------------------------------------------------------
// Route: GET /api/meta/accounts
// Discover Instagram Business Account IDs from the Meta token.
// ---------------------------------------------------------------------------

appWithVars.get('/api/meta/accounts', async (c) => {
  const token = c.req.query('token');
  if (!token) return c.json({ error: 'Provide ?token=YOUR_META_TOKEN' }, 400);

  const GRAPH_URL = 'https://graph.facebook.com/v22.0';

  try {
    // Get all Facebook Pages
    const pagesRes = await fetch(`${GRAPH_URL}/me/accounts?fields=id,name&access_token=${token}`);
    const pagesData = await pagesRes.json() as any;
    if (pagesData.error) return c.json({ error: pagesData.error.message }, 400);

    const pages = pagesData.data || [];
    const accounts: any[] = [];

    // For each page, get linked Instagram Business Account
    for (const page of pages) {
      const igRes = await fetch(
        `${GRAPH_URL}/${page.id}?fields=instagram_business_account{id,name,username,profile_picture_url}&access_token=${token}`
      );
      const igData = await igRes.json() as any;
      const ig = igData.instagram_business_account;

      accounts.push({
        facebookPageId: page.id,
        facebookPageName: page.name,
        instagramAccountId: ig?.id || null,
        instagramUsername: ig?.username || null,
        status: ig ? 'connected' : 'no Instagram linked',
      });
    }

    return c.json({
      accounts,
      hint: 'Use instagramAccountId (NOT facebookPageId) in persona settings.',
    });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// ---------------------------------------------------------------------------
// Route: POST /api/meta/publish
// Publish to Instagram via Meta Graph API (Photo, Carousel, Reel).
// ---------------------------------------------------------------------------

appWithVars.post('/api/meta/publish', async (c) => {
  const body = await c.req.json();
  const {
    imageUrl,
    videoUrl,
    caption,
    contentType,
    slideImageUrls,
    instagramAccountId,
    metaAccessToken,
  } = body as {
    imageUrl?: string;
    videoUrl?: string;
    caption?: string;
    contentType?: string;
    slideImageUrls?: string[];
    instagramAccountId?: string;
    metaAccessToken?: string;
  };

  if (!instagramAccountId || !metaAccessToken) {
    return c.json({ error: 'Instagram Account ID and Meta Access Token required' }, 400);
  }

  const GRAPH_URL = 'https://graph.facebook.com/v22.0';

  // Helper: Meta Graph API uses URL-encoded form params, NOT JSON body
  const graphPost = async (endpoint: string, params: Record<string, string>) => {
    params.access_token = metaAccessToken;
    const formBody = new URLSearchParams(params).toString();
    console.log(`[Meta] POST ${endpoint}`);
    const res = await fetch(`${GRAPH_URL}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formBody,
    });
    const data = await res.json() as any;
    console.log(`[Meta] Response:`, JSON.stringify(data).slice(0, 300));
    if (data.error) throw new Error(`Meta API: ${data.error.message} (code: ${data.error.code})`);
    return data;
  };

  try {
    if (contentType === 'Photo') {
      // Step 1: Create media container
      const container = await graphPost(`/${instagramAccountId}/media`, {
        image_url: imageUrl!,
        caption: caption || '',
      });

      // Step 2: Publish
      const published = await graphPost(`/${instagramAccountId}/media_publish`, {
        creation_id: container.id,
      });

      return c.json({ success: true, postId: published.id });
    }

    if (contentType === 'Carousel') {
      // Step 1: Create containers for each slide
      const childIds: string[] = [];
      for (const slideUrl of (slideImageUrls || [])) {
        const data = await graphPost(`/${instagramAccountId}/media`, {
          image_url: slideUrl,
          is_carousel_item: 'true',
        });
        childIds.push(data.id);
      }

      // Step 2: Create carousel container
      const carousel = await graphPost(`/${instagramAccountId}/media`, {
        media_type: 'CAROUSEL',
        children: childIds.join(','),
        caption: caption || '',
      });

      // Step 3: Publish
      const published = await graphPost(`/${instagramAccountId}/media_publish`, {
        creation_id: carousel.id,
      });

      return c.json({ success: true, postId: published.id });
    }

    if (contentType === 'Video') {
      // Step 1: Create reel container
      const container = await graphPost(`/${instagramAccountId}/media`, {
        media_type: 'REELS',
        video_url: videoUrl!,
        caption: caption || '',
        share_to_feed: 'true',
      });

      // Step 2: Poll until video is processed
      let status = 'IN_PROGRESS';
      let attempts = 0;
      while (status === 'IN_PROGRESS' && attempts < 30) {
        await new Promise(r => setTimeout(r, 5000));
        attempts++;
        const statusRes = await fetch(
          `${GRAPH_URL}/${container.id}?fields=status_code&access_token=${metaAccessToken}`
        );
        const statusData = await statusRes.json() as any;
        status = statusData.status_code || 'IN_PROGRESS';
        console.log(`[Meta] Video processing: attempt ${attempts}, status: ${status}`);
        if (status === 'ERROR') throw new Error('Video processing failed on Meta servers');
      }
      if (status !== 'FINISHED') throw new Error('Video processing timed out');

      // Step 3: Publish
      const published = await graphPost(`/${instagramAccountId}/media_publish`, {
        creation_id: container.id,
      });


      return c.json({ success: true, postId: published.id });
    }

    return c.json({ error: 'Invalid content type' }, 400);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[Meta Publish] Error:', msg);
    return c.json({ error: msg }, 500);
  }
});

// ---------------------------------------------------------------------------
// Route: POST /api/blotato/publish
// Fetch media (R2 storage or remote URL), upload to Blotato,
// publish to Instagram.
//
// NOTE: Canvas text overlay has moved to the browser.
//       The caller should burn text into the image before sending.
// ---------------------------------------------------------------------------

appWithVars.post('/api/blotato/publish', async (c) => {
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
      // Remote URL — fetch directly
      const dlRes = await fetch(mediaPath);
      if (!dlRes.ok) {
        throw new Error(`Failed to download media from ${mediaPath}: ${await dlRes.text()}`);
      }
      mimeType = dlRes.headers.get('content-type') ?? 'image/jpeg';
      bytes = new Uint8Array(await dlRes.arrayBuffer());
    } else {
      // Treat as an R2 storage path: strip leading slash if present
      const storagePath = mediaPath.startsWith('/') ? mediaPath.slice(1) : mediaPath;

      // Re-map legacy paths to userId/personaId/filename inside the bucket
      const pathParts = storagePath.replace(/^uploads\//, '').split('/');
      const resolvedPath = pathParts.length >= 2
        ? `${userId}/${pathParts.join('/')}`
        : `${userId}/${storagePath}`;

      const obj = await c.env.MEDIA_BUCKET.get(resolvedPath);
      if (!obj) {
        throw new Error(`Media not found in R2 at ${resolvedPath}`);
      }

      mimeType = obj.httpMetadata?.contentType ?? (resolvedPath.endsWith('.mp4') ? 'video/mp4' : 'image/jpeg');
      bytes = new Uint8Array(await obj.arrayBuffer());
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
  const userId = c.get('userId');

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

  // Upsert into drive_assets
  // - Do NOT set `id` — let DB auto-generate UUID
  // - Use composite unique constraint (user_id, drive_file_id)
  const now = new Date().toISOString();
  const upsertRows = allFiles.map((f) => ({
    user_id: userId,
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
        onConflict: 'user_id,drive_file_id',
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
// Route: GET /api/media/*
// Serve R2 files directly (fallback when R2 public access isn't configured).
// ---------------------------------------------------------------------------

appWithVars.get('/api/media/*', async (c) => {
  const key = c.req.path.replace('/api/media/', '');
  const obj = await c.env.MEDIA_BUCKET.get(key);
  if (!obj) return c.json({ error: 'Not found' }, 404);
  const headers = new Headers();
  headers.set('Content-Type', obj.httpMetadata?.contentType || 'application/octet-stream');
  headers.set('Cache-Control', 'public, max-age=31536000');
  return new Response(obj.body, { headers });
});

// ---------------------------------------------------------------------------
// Health check
// ---------------------------------------------------------------------------

appWithVars.get('/health', (c) => c.json({ status: 'ok', ts: Date.now() }));

// ---------------------------------------------------------------------------
// Default export (Cloudflare Workers entry point)
// ---------------------------------------------------------------------------

export default appWithVars;
