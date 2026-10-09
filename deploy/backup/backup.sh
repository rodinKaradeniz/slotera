#!/bin/sh
# One dump per day in custom format (restore with pg_restore). Keeps 14 days here and,
# when STORAGE_BOX is set (user@host of a Hetzner Storage Box), mirrors them off-box.
set -eu
stamp=$(date -u +%Y-%m-%dT%H%MZ)
pg_dump --format=custom --file="/backups/slotera-$stamp.dump"
find /backups -name 'slotera-*.dump' -mtime +14 -delete
echo "backup written: slotera-$stamp.dump"
if [ -n "${STORAGE_BOX:-}" ]; then
  rsync -a --delete -e "ssh -p 23 -o StrictHostKeyChecking=accept-new" \
    /backups/ "$STORAGE_BOX:slotera-backups/"
  echo "backups copied to storage box"
fi
