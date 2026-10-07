#!/bin/sh
set -eu

# New installations get the Bijoy name. Existing configuration stays intact.
mkdir -p /config/config
if [ ! -f /config/config/system.xml ]; then
    cp /opt/bijoy/system.xml /config/config/system.xml
fi
if [ -f "${BIJOY_TRENDING_CONFIG:-/trending/settings.json}" ]; then
    python3 /opt/bijoy/trending-feed.py --config "${BIJOY_TRENDING_CONFIG:-/trending/settings.json}" &
fi
exec /jellyfin/jellyfin "$@"
