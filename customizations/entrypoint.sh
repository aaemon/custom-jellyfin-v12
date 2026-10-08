#!/bin/sh
set -eu

# New installations get the Bijoy name. Existing configuration stays intact.
mkdir -p /config/config
if [ ! -f /config/config/system.xml ]; then
    cp /opt/bijoy/system.xml /config/config/system.xml
fi

database=/config/data/jellyfin.db
if [ -f "$database" ]; then
    if /bin/sh /opt/bijoy/restrict-bijoy-preferences.sh "$database"; then
        :
    else
        result=$?
        if [ "$result" -eq 3 ]; then
            # During first-run setup the shared account may be created after
            # Jellyfin starts. Enforce the policy as soon as it appears.
            (
                while ! /bin/sh /opt/bijoy/restrict-bijoy-preferences.sh "$database"; do
                    sleep 10
                done
            ) &
        else
            exit "$result"
        fi
    fi
fi

# Migrate existing users once, and set show-watched as the database default
# for subsequently created users without overwriting later user choices.
if [ -f "$database" ]; then
    if /bin/sh /opt/bijoy/apply-latest-visible-default.sh "$database"; then
        :
    else
        result=$?
        if [ "$result" -eq 3 ]; then
            (
                while [ ! -f "$database" ]; do sleep 5; done
                while ! /bin/sh /opt/bijoy/apply-latest-visible-default.sh "$database"; do
                    sleep 10
                done
            ) &
        else
            exit "$result"
        fi
    fi
else
    (
        while [ ! -f "$database" ]; do sleep 5; done
        while ! /bin/sh /opt/bijoy/apply-latest-visible-default.sh "$database"; do
            sleep 10
        done
    ) &
fi

if [ -f "${BIJOY_TRENDING_CONFIG:-/trending/settings.json}" ]; then
    python3 /opt/bijoy/trending-feed.py --config "${BIJOY_TRENDING_CONFIG:-/trending/settings.json}" &
fi
exec /jellyfin/jellyfin "$@"
