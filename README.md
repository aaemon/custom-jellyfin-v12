# Custom Navbar Jellyfin v12

Custom Jellyfin v12 image based on
`ghcr.io/aaemon/cusom-jellyfin-v12`.

Included navbar change:

- Configured external menu links remain in the primary toolbar.
- All Jellyfin libraries are placed in the existing overflow menu.
- The overflow menu is labelled `Libraries`.

The underlying image retains the existing passwordless auto-login, library
backdrop, and startup synchronization patches.

## Image

GitHub Actions publishes:

```text
ghcr.io/aaemon/custom_navbar:<jellyfin-version>
ghcr.io/aaemon/custom_navbar:latest
```

Published manifests support `linux/amd64` and `linux/arm64`.

Pin a version in production. For Jellyfin v12.0:

```yaml
services:
  jellyfin:
    image: ghcr.io/aaemon/custom_navbar:12.0
```

## Local build

```bash
docker build -t custom-navbar:local .
```
