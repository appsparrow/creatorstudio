/**
 * Migration script: SQLite (database.db) → Supabase PostgreSQL
 *
 * Usage:
 *   SUPABASE_URL=https://xxx.supabase.co SUPABASE_SERVICE_ROLE_KEY=xxx TARGET_USER_ID=xxx npx tsx scripts/migrate-to-supabase.ts
 *
 * This script:
 * 1. Reads all personas and days from the local SQLite database
 * 2. Parses the JSON blobs into normalized columns
 * 3. Inserts them into Supabase PostgreSQL
 * 4. Migrates drive_assets and video_tasks
 */

import Database from 'better-sqlite3';
import { createClient } from '@supabase/supabase-js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TARGET_USER_ID = process.env.TARGET_USER_ID;

if (!SUPABASE_URL || !SUPABASE_KEY || !TARGET_USER_ID) {
  console.error('Required env vars: SUPABASE_URL (or VITE_SUPABASE_URL), SUPABASE_SERVICE_ROLE_KEY, TARGET_USER_ID');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const db = new Database(path.join(__dirname, '..', 'database.db'));

async function migratePersonas() {
  console.log('📋 Migrating personas...');
  const rows = db.prepare('SELECT id, data FROM personas').all() as any[];

  for (const row of rows) {
    const p = JSON.parse(row.data);
    const { error } = await supabase.from('personas').upsert({
      id: p.id,
      user_id: TARGET_USER_ID,
      full_name: p.identity?.fullName || 'Unknown',
      age: p.identity?.age || null,
      gender: p.identity?.gender || null,
      nationality: p.identity?.nationality || null,
      birthplace: p.identity?.birthplace || null,
      profession: p.identity?.profession || null,
      locations: p.identity?.locations || [],
      height: p.appearance?.height || null,
      body_type: p.appearance?.bodyType || null,
      face_shape: p.appearance?.faceShape || null,
      eyes: p.appearance?.eyes || null,
      hair: p.appearance?.hair || null,
      distinct_features: p.appearance?.distinctFeatures || [],
      // JSONB columns — store the nested objects as-is
      psychographic: p.psychographic || {},
      backstory: p.backstory || null,
      fashion_style: p.fashionStyle || {},
      lifestyle: p.lifestyle || {},
      social_handles: p.socialHandles || {},
      reference_image_url: p.referenceImageUrl || null,
      reference_image_urls: p.referenceImageUrls || [],
      ai_analysis: p.aiAnalysis || null,
    });

    if (error) {
      console.error(`  ❌ Persona ${p.identity?.fullName}: ${error.message}`);
    } else {
      console.log(`  ✅ Persona: ${p.identity?.fullName}`);
    }
  }
}

async function migrateDays() {
  console.log('📅 Migrating content days...');
  const rows = db.prepare('SELECT id, personaId, data FROM days').all() as any[];

  // Normalize content types that don't match the enum
  const validContentTypes = new Set(['Photo', 'Carousel', 'Video']);
  const validStatuses = new Set(['draft', 'generating', 'completed', 'published']);

  for (const row of rows) {
    const d = JSON.parse(row.data);

    let contentType = d.contentType || 'Photo';
    if (!validContentTypes.has(contentType)) {
      contentType = contentType === 'Reel' ? 'Video' : 'Photo';
    }

    let status = d.status || 'draft';
    if (!validStatuses.has(status)) {
      status = 'draft';
    }

    // Normalize platforms — "Both" → ["Instagram", "TikTok"]
    let platforms = d.platforms || ['Instagram'];
    platforms = platforms.flatMap((p: string) =>
      p === 'Both' ? ['Instagram', 'TikTok'] : [p]
    );

    const { error } = await supabase.from('days').upsert({
      id: d.id,
      user_id: TARGET_USER_ID,
      persona_id: d.personaId,
      day_number: d.dayNumber || 1,
      date: d.date || null,
      platforms,
      theme: d.theme || null,
      scene_description: d.sceneDescription || null,
      on_screen_text: d.onScreenText || null,
      caption: d.caption || null,
      hook: d.hook || null,
      hashtags: d.hashtags || null,
      cta: d.cta || null,
      location: d.location || null,
      music_suggestion: d.musicSuggestion || null,
      notes: d.notes || null,
      content_type: contentType,
      status,
      generated_image_url: d.generatedImageUrl || null,
      generated_video_url: d.generatedVideoUrl || null,
      custom_media_url: d.customMediaUrl || null,
      pending_video_task_id: d.pendingVideoTaskId || null,
      is_good_to_post: d.isGoodToPost || false,
      is_ai_generated: d.isAIGenerated || false,
      style_option: d.styleOption || null,
      hairstyle: d.hairstyle || null,
      post_image_references: d.postImageReferences || [],
      slides: d.slides || [],
    });

    if (error) {
      console.error(`  ❌ Day ${d.dayNumber} (${d.theme}): ${error.message}`);
    } else {
      console.log(`  ✅ Day ${d.dayNumber}: ${d.theme}`);
    }
  }
}

async function migrateVideoTasks() {
  console.log('🎬 Migrating video tasks...');
  const rows = db.prepare('SELECT * FROM video_tasks').all() as any[];

  for (const row of rows) {
    const { error } = await supabase.from('video_tasks').upsert({
      task_id: row.taskId,
      day_id: row.dayId,
      user_id: TARGET_USER_ID,
      created_at: new Date(row.createdAt).toISOString(),
    });

    if (error) {
      console.error(`  ❌ Task ${row.taskId}: ${error.message}`);
    } else {
      console.log(`  ✅ Task: ${row.taskId}`);
    }
  }
}

async function migrateDriveAssets() {
  console.log('📁 Migrating drive assets...');
  const rows = db.prepare('SELECT * FROM drive_assets').all() as any[];

  const validContentTypes = new Set(['Photo', 'Carousel', 'Video']);
  const validStatuses = new Set(['unused', 'linked', 'archived']);

  for (const row of rows) {
    let contentType = row.contentType || 'Photo';
    if (!validContentTypes.has(contentType)) contentType = 'Photo';

    let status = row.status || 'unused';
    if (!validStatuses.has(status)) status = 'unused';

    const { error } = await supabase.from('drive_assets').upsert({
      id: row.id,
      user_id: TARGET_USER_ID,
      drive_file_id: row.driveFileId,
      file_name: row.fileName,
      mime_type: row.mimeType,
      file_size: row.fileSize,
      drive_url: row.driveUrl,
      thumbnail_url: row.thumbnailUrl,
      content_type: contentType,
      status,
      linked_day_id: row.linkedDayId || null,
      synced_at: new Date(row.syncedAt).toISOString(),
    });

    if (error) {
      console.error(`  ❌ Asset ${row.fileName}: ${error.message}`);
    } else {
      console.log(`  ✅ Asset: ${row.fileName}`);
    }
  }
}

async function main() {
  console.log('🚀 Starting migration: SQLite → Supabase\n');

  await migratePersonas();
  console.log('');
  await migrateDays();
  console.log('');
  await migrateVideoTasks();
  console.log('');
  await migrateDriveAssets();

  console.log('\n✅ Migration complete!');
  console.log(`   Migrated all data to user: ${TARGET_USER_ID}`);
}

main().catch(console.error);
