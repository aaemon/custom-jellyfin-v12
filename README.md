# Custom Navbar Jellyfin v12

Custom Jellyfin v12 image based on
`ghcr.io/aaemon/loginfix-jellyfin-v12`.

Included navbar change:

- Configured external menu links remain in the primary toolbar.
- All Jellyfin libraries are placed in the existing overflow menu.
- The overflow menu is labelled `Libraries`.
- Library backdrops are enabled by default.

The underlying image retains only the passwordless auto-login and its required
startup synchronization.

## Image

GitHub Actions publishes:

```text
ghcr.io/aaemon/custom-jellyfin-v12:<jellyfin-version>
ghcr.io/aaemon/custom-jellyfin-v12:latest
```

Published manifests support `linux/amd64` and `linux/arm64`.

Pin a version in production. For Jellyfin v12.0:

```yaml
services:
  jellyfin:
    image: ghcr.io/aaemon/custom-jellyfin-v12:12.0
```

## Local build

```bash
docker build -t custom-jellyfin-v12:local .
```
