/*
 * Progressive (infinite) scrolling for Jellyfin library pages.
 *
 * Jellyfin's modern library view still paginates through its toolbar "Next"
 * button. This script keeps that button working but automatically presses it
 * whenever the reader reaches the bottom of the page, so a library keeps
 * loading as you scroll. The bundled fetch patch keeps earlier items in place,
 * so the list grows instead of replacing the page.
 */
(function () {
    'use strict';

    if (window.__jfInfiniteScroll) {
        return;
    }
    window.__jfInfiniteScroll = true;

    var BOTTOM_OFFSET = 800;
    var lastHeight = -1;

    function nearBottom() {
        var doc = document.documentElement;
        var scrollTop = window.pageYOffset || doc.scrollTop || 0;
        var viewport = window.innerHeight || doc.clientHeight || 0;
        var height = Math.max(
            doc.scrollHeight,
            document.body ? document.body.scrollHeight : 0
        );
        return scrollTop + viewport >= height - BOTTOM_OFFSET;
    }

    function tryLoadMore() {
        var button = document.querySelector('[data-jf-next]');
        if (!button || button.disabled || button.getAttribute('aria-disabled') === 'true') {
            return;
        }
        if (!nearBottom()) {
            return;
        }
        var height = document.documentElement.scrollHeight;
        if (height <= lastHeight) {
            return;
        }
        lastHeight = height;
        try {
            button.click();
        } catch (err) {
            /* Ignore transient DOM errors while React re-renders. */
        }
    }

    window.addEventListener('scroll', tryLoadMore, { passive: true });
    window.addEventListener('resize', tryLoadMore, { passive: true });
    window.setInterval(tryLoadMore, 1000);
})();
