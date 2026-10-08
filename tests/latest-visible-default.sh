#!/bin/sh
set -eu
database=$(mktemp)
trap 'rm -f "$database"' EXIT
sqlite3 "$database" 'CREATE TABLE Users (Id TEXT PRIMARY KEY, Username TEXT, HidePlayedInLatest INTEGER);
INSERT INTO Users VALUES ("one","one",1),("two","two",0);'
/bin/sh /opt/bijoy/apply-latest-visible-default.sh "$database"
[ "$(sqlite3 "$database" "SELECT sum(HidePlayedInLatest) FROM Users;")" -eq 0 ]
# Respect a user's later manual opt-in after the one-time migration.
sqlite3 "$database" 'UPDATE Users SET HidePlayedInLatest=1 WHERE Id="one";'
# New users inherit show-watched even if the caller inserts Jellyfin's old default.
sqlite3 "$database" 'INSERT INTO Users VALUES ("three","three",1);'
/bin/sh /opt/bijoy/apply-latest-visible-default.sh "$database"
[ "$(sqlite3 "$database" "SELECT HidePlayedInLatest FROM Users WHERE Id=\"one\";")" -eq 1 ]
[ "$(sqlite3 "$database" "SELECT HidePlayedInLatest FROM Users WHERE Id=\"three\";")" -eq 0 ]
printf '%s\n' 'Recently Added default policy test passed.'
