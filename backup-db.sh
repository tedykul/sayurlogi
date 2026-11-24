#!/bin/bash

# ============================================================
# SayurLogi — Automated DB Backup Script
# ============================================================
# Runs daily via cron. Copies SQLite DB from Docker container
# to host filesystem, compresses, and keeps last 30 days.
# ============================================================

BACKUP_DIR="$HOME/backups/sayurlogi"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="$BACKUP_DIR/sayurlogi_db_$TIMESTAMP.db.gz"
CONTAINER_NAME="sayurlogi-app"
DB_PATH="/app/prisma/dev.db"

# Create backup directory if not exists
mkdir -p "$BACKUP_DIR"

# Copy DB from Docker container to host
echo "[$(date)] Starting backup..."
docker cp "$CONTAINER_NAME:$DB_PATH" "/tmp/sayurlogi_temp.db"

if [ $? -eq 0 ]; then
    # Compress
    gzip -c "/tmp/sayurlogi_temp.db" > "$BACKUP_FILE"
    rm "/tmp/sayurlogi_temp.db"
    
    # Get file size
    SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
    echo "[$(date)] ✅ Backup success: $BACKUP_FILE ($SIZE)"
else
    echo "[$(date)] ❌ Backup failed: cannot copy DB from container"
    exit 1
fi

# Cleanup: keep only last 30 days of backups
find "$BACKUP_DIR" -name "sayurlogi_db_*.db.gz" -mtime +30 -delete
echo "[$(date)] Old backups cleaned (kept last 30 days)"
echo "---"
