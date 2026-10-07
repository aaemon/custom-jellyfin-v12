ARG JELLYFIN_BASE_IMAGE=ghcr.io/aaemon/loginfix-jellyfin-v12:12.2
FROM ${JELLYFIN_BASE_IMAGE}

ARG JELLYFIN_VERSION=12.2
ARG JELLYFIN_BASE_IMAGE
ARG CUSTOM_REVISION=local
LABEL org.opencontainers.image.source="https://github.com/aaemon/custom-jellyfin-v12"
LABEL org.opencontainers.image.description="Bijoy Media Jellyfin with custom branding, infinite scrolling, 1080p movie defaults and release-date home rows"
LABEL org.opencontainers.image.revision="${CUSTOM_REVISION}"
LABEL io.raspicloud.custom-navbar.base-image="${JELLYFIN_BASE_IMAGE}"
LABEL io.raspicloud.custom-navbar.version="${JELLYFIN_VERSION}"

USER root

RUN apt-get update \
    && apt-get install --no-install-recommends -y python3 \
    && rm -rf /var/lib/apt/lists/*

COPY infinite-scroll.js /jellyfin/jellyfin-web/jellyfin-infinite-scroll.js
COPY customizations/ /opt/bijoy/

RUN set -eu; \
    web_root=/jellyfin/jellyfin-web; \
    backdrop_bundle="$web_root/main.jellyfin.bundle.js"; \
    test -f "$backdrop_bundle"; \
    old_backdrops='this.get("enableBackdrops",!1),!1'; \
    new_backdrops='this.get("enableBackdrops",!1),!0'; \
    test "$(grep -oF "$old_backdrops" "$backdrop_bundle" | wc -l)" -eq 1; \
    OLD="$old_backdrops" NEW="$new_backdrops" perl -0pi -e 's/\Q$ENV{OLD}\E/$ENV{NEW}/' "$backdrop_bundle"; \
    test "$(grep -oF "$old_backdrops" "$backdrop_bundle" | wc -l)" -eq 0; \
    grep -qF "$new_backdrops" "$backdrop_bundle"; \
    old_page_size='return 0===t?0:t||100'; \
    new_page_size='return 0===t?400:Math.min(t||100,400)'; \
    test "$(grep -oF "$old_page_size" "$backdrop_bundle" | wc -l)" -eq 1; \
    OLD="$old_page_size" NEW="$new_page_size" perl -0pi -e 's/\Q$ENV{OLD}\E/$ENV{NEW}/' "$backdrop_bundle"; \
    test "$(grep -oF "$old_page_size" "$backdrop_bundle" | wc -l)" -eq 0; \
    grep -qF "$new_page_size" "$backdrop_bundle"; \
    library_bundle=; \
    for candidate in "$web_root"/*.chunk.js; do \
        if grep -qF 'p=function(){return{limit:s.ex(void 0)||void 0}}' "$candidate"; then \
            test -z "$library_bundle"; \
            library_bundle=$candidate; \
        fi; \
    done; \
    test -n "$library_bundle"; \
    old_limit='p=function(){return{limit:s.ex(void 0)||void 0}}'; \
    new_limit='p=function(e){return{limit:(s.ex(void 0)||100)+(e||0)}}'; \
    test "$(grep -oF "$old_limit" "$library_bundle" | wc -l)" -eq 1; \
    OLD="$old_limit" NEW="$new_limit" perl -0pi -e 's/\Q$ENV{OLD}\E/$ENV{NEW}/' "$library_bundle"; \
    test "$(grep -oF "$old_limit" "$library_bundle" | wc -l)" -eq 0; \
    grep -qF "$new_limit" "$library_bundle"; \
    old_start='startIndex:u.StartIndex'; \
    new_start='startIndex:0'; \
    test "$(grep -oF "$old_start" "$library_bundle" | wc -l)" -eq 7; \
    OLD="$old_start" NEW="$new_start" perl -0pi -e 's/\Q$ENV{OLD}\E/$ENV{NEW}/g' "$library_bundle"; \
    test "$(grep -oF "$old_start" "$library_bundle" | wc -l)" -eq 0; \
    old_cm='(0,I.cm)()'; \
    new_cm='(0,I.cm)(u.StartIndex)'; \
    test "$(grep -oF "$old_cm" "$library_bundle" | wc -l)" -eq 6; \
    OLD="$old_cm" NEW="$new_cm" perl -0pi -e 's/\Q$ENV{OLD}\E/$ENV{NEW}/g' "$library_bundle"; \
    test "$(grep -oF "$old_cm" "$library_bundle" | wc -l)" -eq 0; \
    old_placeholder='{signal:v})},refetchOnWindowFocus:!1,enabled:!!y.api'; \
    new_placeholder='{signal:v})},placeholderData:function(e){return e},refetchOnWindowFocus:!1,enabled:!!y.api'; \
    test "$(grep -oF "$old_placeholder" "$library_bundle" | wc -l)" -eq 1; \
    OLD="$old_placeholder" NEW="$new_placeholder" perl -0pi -e 's/\Q$ENV{OLD}\E/$ENV{NEW}/' "$library_bundle"; \
    test "$(grep -oF "$old_placeholder" "$library_bundle" | wc -l)" -eq 0; \
    grep -qF "$new_placeholder" "$library_bundle"; \
    library_name=${library_bundle##*/}; \
    library_id=${library_name%%.*}; \
    library_old_hash=${library_name#*.}; \
    library_old_hash=${library_old_hash%.chunk.js}; \
    library_new_hash=custominfinite1; \
    library_new_name="${library_id}.${library_new_hash}.chunk.js"; \
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
    new_hash=customnavbarbijoy2; \
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
    server_fallback='children:n?"":(null==t?void 0:t.ServerName)||"Jellyfin"'; \
    server_brand='children:n?"":(null==t?void 0:t.ServerName)||"Bijoy Media"'; \
    drawer_fallback='primary:(null==e?void 0:e.ServerName)||"Jellyfin"'; \
    drawer_brand='primary:(null==e?void 0:e.ServerName)||"Bijoy Media"'; \
    test "$(grep -oF "$server_fallback" "$navbar_bundle" | wc -l)" -eq 1; \
    test "$(grep -oF "$drawer_fallback" "$navbar_bundle" | wc -l)" -eq 1; \
    OLD="$server_fallback" NEW="$server_brand" perl -0pi -e 's/\Q$ENV{OLD}\E/$ENV{NEW}/' "$navbar_bundle"; \
    OLD="$drawer_fallback" NEW="$drawer_brand" perl -0pi -e 's/\Q$ENV{OLD}\E/$ENV{NEW}/' "$navbar_bundle"; \
    test "$(grep -oF "$server_fallback" "$navbar_bundle" | wc -l)" -eq 0; \
    test "$(grep -oF "$drawer_fallback" "$navbar_bundle" | wc -l)" -eq 0; \
    grep -qF "$server_brand" "$navbar_bundle"; \
    grep -qF "$drawer_brand" "$navbar_bundle"; \
    old_next_btn='{title:O.Ay.translate("Next"),disabled:o||n+r>=i,onClick:c,children:'; \
    new_next_btn='{"data-jf-next":"1",title:O.Ay.translate("Next"),disabled:o||n+r>=i,onClick:c,children:'; \
    test "$(grep -oF "$old_next_btn" "$navbar_bundle" | wc -l)" -eq 1; \
    OLD="$old_next_btn" NEW="$new_next_btn" perl -0pi -e 's/\Q$ENV{OLD}\E/$ENV{NEW}/' "$navbar_bundle"; \
    test "$(grep -oF "$old_next_btn" "$navbar_bundle" | wc -l)" -eq 0; \
    grep -qF "$new_next_btn" "$navbar_bundle"; \
    old_paging_scroll=',window.scrollTo(0,0)'; \
    new_paging_scroll=''; \
    test "$(grep -oF "$old_paging_scroll" "$navbar_bundle" | wc -l)" -eq 2; \
    OLD="$old_paging_scroll" NEW="$new_paging_scroll" perl -0pi -e 's/\Q$ENV{OLD}\E/$ENV{NEW}/g' "$navbar_bundle"; \
    test "$(grep -oF "$old_paging_scroll" "$navbar_bundle" | wc -l)" -eq 0; \
    runtime="$web_root/runtime.bundle.js"; \
    old_runtime_entry="${chunk_id}:\"$old_hash\""; \
    new_runtime_entry="${chunk_id}:\"$new_hash\""; \
    test "$(grep -oF "$old_runtime_entry" "$runtime" | wc -l)" -eq 1; \
    OLD="$old_runtime_entry" NEW="$new_runtime_entry" perl -0pi -e 's/\Q$ENV{OLD}\E/$ENV{NEW}/' "$runtime"; \
    test "$(grep -oF "$old_runtime_entry" "$runtime" | wc -l)" -eq 0; \
    grep -qF "$new_runtime_entry" "$runtime"; \
    mv "$navbar_bundle" "$web_root/$new_name"; \
    test -f "$web_root/$new_name"; \
    old_library_entry="${library_id}:\"$library_old_hash\""; \
    new_library_entry="${library_id}:\"$library_new_hash\""; \
    test "$(grep -oF "$old_library_entry" "$runtime" | wc -l)" -eq 1; \
    OLD="$old_library_entry" NEW="$new_library_entry" perl -0pi -e 's/\Q$ENV{OLD}\E/$ENV{NEW}/' "$runtime"; \
    test "$(grep -oF "$old_library_entry" "$runtime" | wc -l)" -eq 0; \
    grep -qF "$new_library_entry" "$runtime"; \
    mv "$library_bundle" "$web_root/$library_new_name"; \
    test -f "$web_root/$library_new_name"; \
    test "$(grep -oE 'main\.jellyfin\.bundle\.js\?[^" ]+' "$web_root/index.html" | wc -l)" -ge 1; \
    sed -i -E 's/main\.jellyfin\.bundle\.js\?[^" ]+/main.jellyfin.bundle.js?custom-backdrops3/g' "$web_root/index.html"; \
    grep -qF 'main.jellyfin.bundle.js?custom-backdrops3' "$web_root/index.html"; \
    test "$(grep -oE 'runtime\.bundle\.js\?[^" ]+' "$web_root/index.html" | wc -l)" -ge 1; \
    sed -i -E 's/runtime\.bundle\.js\?[^" ]+/runtime.bundle.js?custom-navbar3/g' "$web_root/index.html"; \
    grep -qF 'runtime.bundle.js?custom-navbar3' "$web_root/index.html"; \
    test "$(grep -oF '</body>' "$web_root/index.html" | wc -l)" -eq 1; \
    sed -i 's#</body>#<script defer="defer" src="jellyfin-infinite-scroll.js?custom-infinite1"></script></body>#' "$web_root/index.html"; \
    grep -qF 'jellyfin-infinite-scroll.js?custom-infinite1' "$web_root/index.html"

RUN perl /opt/bijoy/prefer-1080.pl \
    && perl /opt/bijoy/home-release-order.pl \
    && perl /opt/bijoy/trending-rows.pl \
    && perl /opt/bijoy/apply-branding.pl

ENTRYPOINT ["/bin/sh", "/opt/bijoy/entrypoint.sh"]
