#!/bin/bash
REPO_DIR="/opt/data/projects/palm-mvp"
BACKUP_DIR="/opt/data/projects/palm-mvp/backups"
DATE=$(date +%Y%m%d)
mkdir -p "$BACKUP_DIR"
git -C "$REPO_DIR" bundle create "$BACKUP_DIR/repo-backup-$DATE.bundle" --all
