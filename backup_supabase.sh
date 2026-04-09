#!/bin/bash
# =============================================================================
# Supabase Full Database Backup — Creator Studio
# Date: 2026-04-09
# Exports all table data as JSON files using the REST API + service role key
# =============================================================================

set -euo pipefail

SUPABASE_URL="https://nstkklwfiazvytnxqfen.supabase.co"
SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5zdGtrbHdmaWF6dnl0bnhxZmVuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDc5MTQxMywiZXhwIjoyMDkwMzY3NDEzfQ.TvdglDegSS3FGTYM6tJ_qMFk-lFRIsUG5yC-1JewQYU"

BACKUP_DIR="./backups/supabase_$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"

TABLES=("user_settings" "personas" "days" "video_tasks" "drive_assets")

echo "Backing up Supabase to: $BACKUP_DIR"
echo "=========================================="

for TABLE in "${TABLES[@]}"; do
  echo -n "  Exporting $TABLE ... "

  HTTP_CODE=$(curl -s -o "$BACKUP_DIR/${TABLE}.json" -w "%{http_code}" \
    "${SUPABASE_URL}/rest/v1/${TABLE}?select=*" \
    -H "apikey: ${SERVICE_ROLE_KEY}" \
    -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
    -H "Accept: application/json" \
    -H "Prefer: return=representation")

  if [ "$HTTP_CODE" -eq 200 ]; then
    COUNT=$(python3 -c "import json; print(len(json.load(open('$BACKUP_DIR/${TABLE}.json'))))" 2>/dev/null || echo "?")
    echo "OK ($COUNT rows)"
  else
    echo "FAILED (HTTP $HTTP_CODE)"
    cat "$BACKUP_DIR/${TABLE}.json"
    echo ""
  fi
done

# Also save the schema migration for reference
cp ./supabase/migrations/001_initial_schema.sql "$BACKUP_DIR/schema.sql" 2>/dev/null || true

echo "=========================================="
echo "Backup complete: $BACKUP_DIR"
ls -lh "$BACKUP_DIR"
