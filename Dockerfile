ARG JELLYFIN_BASE_IMAGE=ghcr.io/aaemon/loginfix-jellyfin-v12:12.0
FROM ${JELLYFIN_BASE_IMAGE}

ARG JELLYFIN_VERSION=12.0
ARG JELLYFIN_BASE_IMAGE
LABEL org.opencontainers.image.source="https://github.com/aaemon/custom-jellyfin-v12"
LABEL org.opencontainers.image.description="Jellyfin v12 with libraries in the navbar overflow menu"
LABEL io.raspicloud.custom-navbar.base-image="${JELLYFIN_BASE_IMAGE}"
LABEL io.raspicloud.custom-navbar.version="${JELLYFIN_VERSION}"

USER root

RUN set -eu; \
    web_root=/jellyfin/jellyfin-web; \
    navbar_bundle=; \
    for candidate in "$web_root"/*.chunk.js; do \
        if grep -qF 'user-view-overflow-menu' "$candidate"; then \
            test -z "$navbar_bundle"; \
            navbar_bundle=$candidate; \
        fi; \
    done; \
    test -n "$navbar_bundle"; \
    old_name=${navbar_bundle##*/}; \
    chunk_id=${old_name%%.*}; \
    old_hash=${old_name#*.}; \
    old_hash=${old_hash%.chunk.js}; \
    new_hash=customnavbar00000000; \
    new_name="${chunk_id}.${new_hash}.chunk.js"; \
    old_nav='N=(0,a.useMemo)((function(){return j.length>b+1?j.slice(0,b):j}),[b,j]),R=(0,a.useMemo)((function(){return j.slice((null==N?void 0:N.length)||0)}),[N,j])'; \
    new_nav='N=(0,a.useMemo)((function(){return f||[]}),[f]),R=(0,a.useMemo)((function(){return(null==x?void 0:x.Items)||[]}),[x])'; \
    test "$(grep -oF "$old_nav" "$navbar_bundle" | wc -l)" -eq 1; \
    OLD="$old_nav" NEW="$new_nav" perl -0pi -e 's/\Q$ENV{OLD}\E/$ENV{NEW}/' "$navbar_bundle"; \
    test "$(grep -oF "$old_nav" "$navbar_bundle" | wc -l)" -eq 0; \
    grep -qF "$new_nav" "$navbar_bundle"; \
    old_label='O.Ay.translate("ButtonMore")'; \
    new_label='O.Ay.translate("HeaderLibraries")'; \
    test "$(grep -oF "$old_label" "$navbar_bundle" | wc -l)" -eq 1; \
    OLD="$old_label" NEW="$new_label" perl -0pi -e 's/\Q$ENV{OLD}\E/$ENV{NEW}/' "$navbar_bundle"; \
    test "$(grep -oF "$old_label" "$navbar_bundle" | wc -l)" -eq 0; \
    grep -qF "$new_label" "$navbar_bundle"; \
    runtime="$web_root/runtime.bundle.js"; \
    old_runtime_entry="${chunk_id}:\"$old_hash\""; \
    new_runtime_entry="${chunk_id}:\"$new_hash\""; \
    test "$(grep -oF "$old_runtime_entry" "$runtime" | wc -l)" -eq 1; \
    OLD="$old_runtime_entry" NEW="$new_runtime_entry" perl -0pi -e 's/\Q$ENV{OLD}\E/$ENV{NEW}/' "$runtime"; \
    test "$(grep -oF "$old_runtime_entry" "$runtime" | wc -l)" -eq 0; \
    grep -qF "$new_runtime_entry" "$runtime"; \
    mv "$navbar_bundle" "$web_root/$new_name"; \
    test -f "$web_root/$new_name"; \
    test "$(grep -oE 'runtime\.bundle\.js\?[^" ]+' "$web_root/index.html" | wc -l)" -ge 1; \
    sed -i -E 's/runtime\.bundle\.js\?[^" ]+/runtime.bundle.js?custom-navbar1/g' "$web_root/index.html"; \
    grep -qF 'runtime.bundle.js?custom-navbar1' "$web_root/index.html"
