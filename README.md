# Custom Navbar Jellyfin v12

Custom Jellyfin v12 image based on
`ghcr.io/aaemon/loginfix-jellyfin-v12`.

Included customizations:

- Configured external menu links remain in the primary toolbar.
- All Jellyfin libraries are placed in the existing overflow menu.
- The overflow menu is labelled `Libraries`.
- Library backdrops are enabled by default.
- The public login toolbar and signed-in drawer use `Bijoy Media` as the fallback server name.
- The shared `Bijoy` account has Jellyfin user-preference access disabled at startup,
  preventing profile-image, password, and user-configuration changes.
- Library pages use progressive (infinite) scrolling: more items load automatically as you
  reach the bottom of the page instead of stopping at a single page.
- The page-size preference is capped at 400, including an unlimited setting. This
  controls the increment; progressive scrolling expands the displayed range.
- Bijoy Media browser title, icon, theme banners, and favicon are included in the image.
- Movie detail pages and automatic web playback prefer an available, playable 1080p
  source. Explicit 2160p/720p selections still take priority.
- Movie versions show the full filename suffix, e.g. `Bluray-1080p` instead of `1080p`.
- Home-page library rows use Jellyfin's default Recently Added queries and headings.
- Two native-style rows appear before the latest-media sections: `Trending Movies`
  and `Trending TV Shows`, with at most 16 available titles each. Seerr supplies
  daily trending order; Jellyfin supplies the user-visible local media and artwork.

The new web assets are patched at image build time and use content-derived cache
URLs. No Compose-mounted web patch scripts or runtime asset downloads are required.
The movie preferences and home-row behavior apply to Jellyfin Web; native clients
can have their own selection and sorting behavior.

## Trending feed

Mount a private directory at `/trending` containing `settings.json` with a
TMDb v4 API Read Access Token:

```json
{"tmdb_bearer_token":"your-tmdb-v4-read-token","language":"en-US","pages":10}
```

The worker calls TMDb directly; no Seerr container or Seerr API key is required.
The Compose example mounts `/docker/jellyfin/trending`, configurable with
`TRENDING_CONFIG_PATH`. Keep this directory private; never commit the bearer token.
The former Seerr settings format (`url`/`api_key`) is not used by the TMDb worker.
After switching, replace `settings.json` with the TMDb format shown above.
The repository includes `customizations/trending-settings.example.json` as a
field reference. Never put a real token in Compose, Git, or the image.

The image fetches daily Trending, Popular, and Top Rated movie/TV IDs directly
from TMDb every six hours and retains the last good feed across restarts. It fills
one shared available list in strict order: Trending first, then Popular, then Top
Rated until each row has up to 16 downloaded titles. The fallback lists are only
used to fill slots left by downloaded matches from higher-priority lists. Titles
are deduplicated across lists and library versions. It prepares one
shared available movie/series list on the server, including playable-episode checks. The selection
uses Bijoy's common library access (or an enabled user's access on a new server).
The shared ready file contains only opaque item IDs and a timestamp, not media
names, paths, user data, or credentials. A short-lived preparation key is removed
after each pass. The frontend reads the ready list and requests details for the selected
cards, so a page reload does not scan the library or check episode availability.
Trending cards are preloaded alongside the initial home-page queries and reuse
Jellyfin's native user-scoped query cache, like the existing library rows.
Those authenticated card requests enforce the user's current access permissions.
This shared-list mode is intended for this deployment's common library access.
Before a new server's first preparation completes, the lightweight matching
fallback remains available. No Seerr credentials are sent to the browser.
When fewer than 16 titles match, fewer are shown. The entire row stays blank
until cards are ready. Scrollers use the same Jellyfin markup and native arrow
controls as the other horizontal home rows.
The fallback local index excludes artwork and user-data calculations, full card
details are fetched only for selected IDs, and fallback TV checks run in parallel.
Existing home sections remain usable if the feed service is unavailable.

The underlying image retains only the passwordless auto-login and its required
startup synchronization.

## Image

GitHub Actions publishes:

```text
ghcr.io/aaemon/custom-jellyfin-v12:<jellyfin-version>
ghcr.io/aaemon/custom-jellyfin-v12:latest
```

Published manifests support `linux/amd64` and `linux/arm64`.

Pin a version in production. For Jellyfin v12.2:

```yaml
services:
  jellyfin:
    image: ghcr.io/aaemon/custom-jellyfin-v12:12.2
```

## Local build

```bash
docker build -t custom-jellyfin-v12:local .
```

## Reusable deployment

Use the repository's `compose.yml`:

```bash
docker network inspect internal || docker network create internal
docker compose -f compose.yml pull
docker compose -f compose.yml up -d
```

The example defaults to `/docker/jellyfin/config`, `/docker/jellyfin/cache`, and
`/mnt/storage/jellyfin` mounted read-only at `/data`. Direct Jellyfin access is
on port 8096. NPM binds to `10.20.30.50` by default, configurable with `NPM_BIND_IP`.
Set `JELLYFIN_IMAGE` to a newer published version when upgrading.

The default entrypoint seeds `Bijoy Media` only when `system.xml` is absent, then
starts the login-fix wrapper. Existing users, passwords, policies, artwork,
server ID, and libraries stay in the configuration volume. Keep `data/device.txt`
when replacing an instance to retain its server identity. Jellyfin's generated
login background is served natively from `/Branding/Splashscreen` and stored in
`data/splashscreen.png`; it is not baked into the image.

On each start, the image sets the shared `Bijoy` user's Jellyfin
`EnableUserPreferenceAccess` setting to false. This prevents profile-image,
password, and user-configuration changes through Jellyfin's guarded APIs. NPM
also blocks display-preference writes for requests through the proxy. Treat
direct port 8096 as administrator-only; nginx restrictions do not apply there.

NPM's proxy-host definitions and API restrictions stay in `/docker/npm/data`.
The Compose example reuses that directory; a new NPM installation needs its
proxy host configured separately.
NPM blocks display-preference and settings writes for all proxied users. Direct
port 8096 is the administrator path and bypasses NPM's nginx rules; the Bijoy
user's Jellyfin preference permission is still enforced directly by Jellyfin.

## Publishing and future Jellyfin releases

Pushing to `main` or dispatching `publish.yml` rebuilds the latest upstream
version when its matching login-fix image is available. Scheduled runs publish
new versions automatically. Images support amd64 and arm64 and carry the Git
commit in `org.opencontainers.image.revision`.

Build-time scripts under `customizations/` verify the expected upstream bundle
patterns. CI also checks JavaScript syntax and executes tests against the
patched playback selector and home-row query before publishing. When an
upstream release changes those patterns, update the affected patch script and
tests; mismatches fail the build instead of publishing partially patched assets.

The Node tests accept `WEB_ROOT` for an extracted image web directory and
`HELPER_ROOT` for the `customizations` directory:

```bash
WEB_ROOT=/path/to/extracted/web HELPER_ROOT="$PWD/customizations" node tests/movie-versions.cjs
WEB_ROOT=/path/to/extracted/web node tests/home-defaults.cjs
```
