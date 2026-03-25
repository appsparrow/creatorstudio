const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const db = new Database(path.join(__dirname, 'database.db'));
const PERSONA_ID = 'persona_sofia_laurant_v1';
const uploadsRoot = path.join(__dirname, 'public', 'uploads');
const personaDir = path.join(uploadsRoot, PERSONA_ID);

if (!fs.existsSync(personaDir)) fs.mkdirSync(personaDir, { recursive: true });

// Move stray persona_ images from root to the persona folder
const files = fs.readdirSync(uploadsRoot);
let movedCount = 0;
for (const file of files) {
  if (fs.statSync(path.join(uploadsRoot, file)).isFile() && file.startsWith('persona_')) {
    fs.renameSync(path.join(uploadsRoot, file), path.join(personaDir, file));
    console.log(`Moved ${file} -> ${PERSONA_ID}/`);
    movedCount++;
  }
}

const fixPath = (url) => {
  if (!url) return url;
  if (url.startsWith(`/uploads/${PERSONA_ID}/`)) return url; // Already good
  if (url.startsWith('/uploads/persona_')) {
    const filename = path.basename(url);
    return `/uploads/${PERSONA_ID}/${filename}`;
  }
  return url;
};

// Update persona DB entries to point to new subfolder paths
const personas = db.prepare('SELECT id, data FROM personas').all();
let updated = 0;
for (const row of personas) {
  const data = JSON.parse(row.data);
  let changed = false;
  
  const newRefUrl = fixPath(data.referenceImageUrl);
  if (newRefUrl !== data.referenceImageUrl) {
    data.referenceImageUrl = newRefUrl;
    changed = true;
  }
  
  if (Array.isArray(data.referenceImageUrls)) {
    data.referenceImageUrls = data.referenceImageUrls.map(url => {
      const fixed = fixPath(url);
      if (fixed !== url) changed = true;
      return fixed;
    });
  }
  
  if (changed) {
    db.prepare('UPDATE personas SET data = ? WHERE id = ?').run(JSON.stringify(data), row.id);
    console.log(`Updated paths in DB for persona ${row.id}`);
    updated++;
  }
}

console.log(`\nCleanup complete: Moved ${movedCount} stray files, updated ${updated} DB records.`);
