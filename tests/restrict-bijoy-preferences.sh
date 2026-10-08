#!/bin/sh
set -eu
db=$(mktemp)
trap 'rm -f "$db"' EXIT
sqlite3 "$db" 'CREATE TABLE Users (Username TEXT NOT NULL, EnableUserPreferenceAccess INTEGER NOT NULL); INSERT INTO Users VALUES ("Bijoy",1),("Ammer",1);'
[ -x /opt/bijoy/restrict-bijoy-preferences.sh ] || chmod +x /opt/bijoy/restrict-bijoy-preferences.sh
/opt/bijoy/restrict-bijoy-preferences.sh "$db"
[ "$(sqlite3 "$db" "SELECT EnableUserPreferenceAccess FROM Users WHERE Username='Bijoy';")" -eq 0 ]
[ "$(sqlite3 "$db" "SELECT EnableUserPreferenceAccess FROM Users WHERE Username='Ammer';")" -eq 1 ]
/opt/bijoy/restrict-bijoy-preferences.sh "$db"
if /opt/bijoy/restrict-bijoy-preferences.sh "$db.missing"; then
    echo 'Missing database unexpectedly succeeded' >&2
    exit 1
else
    [ "$?" -eq 3 ]
fi
printf '%s\n' 'Bijoy permission test passed; other users unchanged.'
