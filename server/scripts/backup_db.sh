#!/bin/bash

# MySQL Database Backup Script for MixSense
# This script creates a compressed backup of the MySQL database

# Configuration
BACKUP_DIR="/backups/mixsense"
DB_USER="${DB_USER:-dbuser}"
DB_PASS="${DB_PASS:-dbpass}"
DB_NAME="${DB_NAME:-mixer_db}"
DATE=$(date +%F_%H-%M-%S)
BACKUP_FILE="mixer_db_${DATE}.sql.gz"

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Log file
LOG_FILE="$BACKUP_DIR/backup.log"

# Function to log messages
log_message() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

log_message "Starting database backup..."

# Perform the backup
if mysqldump -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" | gzip > "$BACKUP_DIR/$BACKUP_FILE"; then
    log_message "Backup successful: $BACKUP_FILE"

    # Get backup file size
    BACKUP_SIZE=$(du -h "$BACKUP_DIR/$BACKUP_FILE" | cut -f1)
    log_message "Backup size: $BACKUP_SIZE"
else
    log_message "ERROR: Backup failed!"
    exit 1
fi

# Delete backups older than 30 days
log_message "Cleaning up old backups (older than 30 days)..."
DELETED_COUNT=$(find "$BACKUP_DIR" -name "mixer_db_*.sql.gz" -mtime +30 -delete -print | wc -l)
log_message "Deleted $DELETED_COUNT old backup(s)"

# Keep only the last 10 backups
log_message "Keeping only the last 10 backups..."
ls -t "$BACKUP_DIR"/mixer_db_*.sql.gz | tail -n +11 | xargs -r rm
log_message "Cleanup completed"

log_message "Backup process completed successfully"

exit 0
