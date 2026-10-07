# Custom Navbar Jellyfin v12

Custom Jellyfin v12 image based on
`ghcr.io/aaemon/loginfix-jellyfin-v12`.

Included customizations:

- Configured external menu links remain in the primary toolbar.
- All Jellyfin libraries are placed in the existing overflow menu.
- The overflow menu is labelled `Libraries`.
- Library backdrops are enabled by default.
- The public login toolbar and signed-in drawer use `Bijoy Media` as the fallback server name.
- Library pages use progressive (infinite) scrolling: more items load automatically as you
  reach the bottom of the page instead of stopping at a single page.
- The page-size preference is capped at 400, including an unlimited setting. This
  controls the increment; progressive scrolling expands the displayed range.
- Bijoy Media browser title, icon, theme banners, and favicon are included in the image.
- Movie detail pages and automatic web playback prefer an available, playable 1080p
  source. Explicit 2160p/720p selections still take priority.
- Movie versions show the full filename suffix, e.g. `Bluray-1080p` instead of `1080p`.
- Home-page movie-library rows show `Latest releases in ...`, ordered by release date
  descending, while preserving the user/library scope and played-item preferences.
- Two native-style rows appear before the latest-media sections: `Trending (Movies (All))`
  and `Trending (TV Shows (All))`, with at most 16 available titles each. Seerr supplies
  daily trending order; Jellyfin supplies the user-visible local media and artwork.

The new web assets are patched at image build time and use content-derived cache
URLs. No Compose-mounted web patch scripts or runtime asset downloads are required.
The movie preferences and home-row behavior apply to Jellyfin Web; native clients
can have their own selection and sorting behavior.

## Trending feed

Mount a private directory at `/trending` containing `settings.json`:

```json
{"url":"http://seerr:5055","api_key":"your-seerr-api-key","pages":10}
```

The Seerr container must be reachable on the same Docker network, or use a reachable
server-side URL. The Compose example mounts `/docker/jellyfin/trending`, configurable
with `TRENDING_CONFIG_PATH`. Keep this directory private; never commit the real API key.

The image fetches movie and TV trending IDs from Seerr every six hours and retains the
last good feed across restarts. Only the public IDs are served to the browser, not the
Seerr credentials or its local-availability records. The frontend matches TMDb IDs
against the signed-in user's Jellyfin libraries, excludes virtual/remote movies,
deduplicates titles, and verifies that each TV series has an available episode.
When fewer than 16 titles match, fewer are shown; empty rows stay hidden. Existing
home sections remain usable if the feed service is unavailable.

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

NPM's proxy-host definitions and API restrictions stay in `/docker/npm/data`.
The Compose example reuses that directory; a new NPM installation needs its
proxy host configured separately.

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
WEB_ROOT=/path/to/extracted/web HELPER_ROOT="$PWD/customizations" node tests/home-releases.cjs
```
