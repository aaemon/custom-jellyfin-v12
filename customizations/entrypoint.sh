#!/bin/sh
set -eu

# New installations get the Bijoy name. Existing configuration stays intact.
mkdir -p /config/config
if [ ! -f /config/config/system.xml ]; then
    cp /opt/bijoy/system.xml /config/config/system.xml
fi
exec /jellyfin/jellyfin "$@"
