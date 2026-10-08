#!/bin/sh
set -eu
database=${1:-/config/data/jellyfin.db}
[ -f "$database" ] || exit 3
users_table=$(sqlite3 -cmd '.timeout 15000' "$database" \
    "SELECT count(*) FROM sqlite_master WHERE type='table' AND name='Users';" 2>/dev/null) || exit 3
[ "$users_table" -eq 1 ] || exit 3

sqlite3 -cmd '.timeout 15000' "$database" <<'SQL'
.bail on
BEGIN IMMEDIATE;
CREATE TABLE IF NOT EXISTS BijoyMediaMigrations (
    Id TEXT PRIMARY KEY NOT NULL
);
CREATE TRIGGER IF NOT EXISTS BijoyMediaDefaultLatestVisible
AFTER INSERT ON Users
WHEN NEW.HidePlayedInLatest <> 0
BEGIN
    UPDATE Users SET HidePlayedInLatest = 0 WHERE Id = NEW.Id;
END;
UPDATE Users SET HidePlayedInLatest = 0
WHERE NOT EXISTS (
    SELECT 1 FROM BijoyMediaMigrations WHERE Id = '20261008_ShowPlayedInLatestByDefault'
);
INSERT OR IGNORE INTO BijoyMediaMigrations (Id)
VALUES ('20261008_ShowPlayedInLatestByDefault');
COMMIT;
SQL
