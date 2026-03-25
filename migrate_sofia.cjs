#!/usr/bin/env node
// Migration: move uploads to persona folder + update DB
// Run from: /Users/siva/Documents/GitHub/creatorstudio
// Usage: node migrate_sofia.cjs

const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const db = new Database(path.join(__dirname, 'database.db'));
const PERSONA_ID = 'persona_sofia_laurant_v1';
const uploadsRoot = path.join(__dirname, 'public', 'uploads');
const personaDir = path.join(uploadsRoot, PERSONA_ID);

// Ensure persona folder exists
if (!fs.existsSync(personaDir)) fs.mkdirSync(personaDir, { recursive: true });

// Move flat files (not in any subfolder) into persona folder
const allEntries = fs.readdirSync(uploadsRoot);
let moved = 0;
allEntries.forEach(f => {
  const full = path.join(uploadsRoot, f);
  if (fs.statSync(full).isFile()) {
    const dest = path.join(personaDir, f);
    fs.renameSync(full, dest);
    moved++;
    process.stdout.write('.');
  }
});
console.log(`\nMoved ${moved} files into ${PERSONA_ID}/`);

// Update all day records: fix flat /uploads/file.ext -> /uploads/personaId/file.ext
const days = db.prepare('SELECT id, personaId, data FROM days').all();
let daysFixed = 0;

const fixPath = (url) => {
  if (!url) return url;
  // Already in a persona subfolder? skip
  const parts = url.replace(/^\/uploads\//, '').split('/');
  if (parts.length >= 2) return url;
  // Flat path - move it
  return `/uploads/${PERSONA_ID}/${parts[0]}`;
};

const fixPersonaId = (pid) => pid === 'persona_luna_croft_v1' ? PERSONA_ID : pid;
const fixJson = (str) => str.replace(/persona_luna_croft_v1/g, PERSONA_ID).replace(/Luna Croft/g, 'Sofia Laurant');

for (const row of days) {
  const newPersonaId = fixPersonaId(row.personaId);
  const newData = fixJson(row.data);
  const parsed = JSON.parse(newData);
  parsed.generatedImageUrl = fixPath(parsed.generatedImageUrl);
  parsed.generatedVideoUrl = fixPath(parsed.generatedVideoUrl);
  if (Array.isArray(parsed.postImageReferences)) {
    parsed.postImageReferences = parsed.postImageReferences.map(r => ({ ...r, url: fixPath(r.url) }));
  }
  db.prepare('UPDATE days SET personaId = ?, data = ? WHERE id = ?')
    .run(newPersonaId, JSON.stringify(parsed), row.id);
  daysFixed++;
}
console.log(`Updated ${daysFixed} day records`);

// Update persona records
const personas = db.prepare('SELECT id, data FROM personas').all();
for (const row of personas) {
  const newData = fixJson(row.data);
  const parsed = JSON.parse(newData);
  parsed.referenceImageUrl = fixPath(parsed.referenceImageUrl);
  if (Array.isArray(parsed.referenceImageUrls)) {
    parsed.referenceImageUrls = parsed.referenceImageUrls.map(u => fixPath(u));
  }
  const newId = fixPersonaId(row.id);
  if (newId !== row.id) {
    db.prepare('DELETE FROM personas WHERE id = ?').run(row.id);
    db.prepare('INSERT OR REPLACE INTO personas (id, data) VALUES (?, ?)').run(newId, JSON.stringify(parsed));
  } else {
    db.prepare('UPDATE personas SET data = ? WHERE id = ?').run(JSON.stringify(parsed), row.id);
  }
  console.log('Updated persona:', parsed.identity.fullName);
}

// Update video_tasks table 
try {
  db.prepare('UPDATE video_tasks SET dayId = replace(dayId, ?, ?)').run('persona_luna_croft_v1', PERSONA_ID);
} catch(e) { /* table may not exist */ }

db.close();
console.log('\n✅ Migration complete! All files and DB records updated for Sofia Laurant.');
