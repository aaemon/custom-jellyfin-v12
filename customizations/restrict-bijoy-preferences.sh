#!/bin/sh
set -eu

database=${1:-/config/data/jellyfin.db}
[ -f "$database" ] || exit 3

count=$(sqlite3 -cmd '.timeout 10000' "$database" \
    "SELECT count(*) FROM Users WHERE lower(Username) = 'bijoy';")
[ "$count" -gt 0 ] || exit 3

sqlite3 -cmd '.timeout 10000' "$database" \
    "UPDATE Users SET EnableUserPreferenceAccess = 0 WHERE lower(Username) = 'bijoy';"

remaining=$(sqlite3 -cmd '.timeout 10000' "$database" \
    "SELECT count(*) FROM Users WHERE lower(Username) = 'bijoy' AND EnableUserPreferenceAccess != 0;")
[ "$remaining" -eq 0 ]
printf '%s\n' '[policy] Bijoy preference editing is disabled.'
