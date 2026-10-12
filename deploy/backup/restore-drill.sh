#!/bin/sh
# Proves a backup can be restored: restores the newest dump into a scratch database,
# prints what it contains, then drops it. Production data is never touched.
#   restore-drill.sh                     newest dump on this server
#   restore-drill.sh --from-storage-box  first copy the dumps back from the Storage Box
set -eu
drill_db=restore_drill
dir=/backups

if [ "${1:-}" = "--from-storage-box" ]; then
  [ -n "${STORAGE_BOX:-}" ] || { echo "STORAGE_BOX is not set" >&2; exit 1; }
  dir=$(mktemp -d)
  rsync -a -e "ssh -p 23 -o StrictHostKeyChecking=accept-new" \
    "$STORAGE_BOX:slotera-backups/" "$dir/"
  echo "copied dumps from the storage box"
fi

dump=$(ls -t "$dir"/slotera-*.dump 2>/dev/null | head -1)
[ -n "$dump" ] || { echo "no dump found in $dir" >&2; exit 1; }
echo "restoring $(basename "$dump")"

cleanup() {
  dropdb --if-exists "$drill_db"
  [ "$dir" = /backups ] || rm -rf "$dir"
}
trap cleanup EXIT

dropdb --if-exists "$drill_db"
createdb "$drill_db"
pg_restore --exit-on-error --no-owner --dbname="$drill_db" "$dump"
psql -d "$drill_db" -v ON_ERROR_STOP=1 -tA -F ' ' -c "
  SELECT 'migration', version_num FROM alembic_version
  UNION ALL SELECT 'workspaces', count(*)::text FROM workspaces
  UNION ALL SELECT 'clients', count(*)::text FROM clients
  UNION ALL SELECT 'bookings', count(*)::text FROM bookings"
echo "restore drill passed"
