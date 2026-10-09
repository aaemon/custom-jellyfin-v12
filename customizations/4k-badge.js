(function (global) {
    'use strict';

    var fourKMovieIds = new Set();

    function idFrom(card) {
        return card.getAttribute('data-id') || card.getAttribute('data-itemid');
    }

    function labelFor(itemId, existingCount) {
        return existingCount > 1 && fourKMovieIds.has(String(itemId)) ? '4K' : String(existingCount);
    }

    function decorate(root) {
        if (!fourKMovieIds.size || !root || !root.querySelectorAll) return;
        root.querySelectorAll('.mediaSourceIndicator').forEach(function (badge) {
            var card = badge.closest('.card');
            if (!card) return;
            var type = card.getAttribute('data-type') || card.getAttribute('data-itemtype');
            if (type !== 'Movie') return;
            var id = idFrom(card);
            if (id && fourKMovieIds.has(id)) {
                badge.textContent = '4K';
                badge.setAttribute('title', '4K version available');
                badge.setAttribute('aria-label', '4K version available');
                badge.classList.add('bijoy4kMediaSourceIndicator');
            }
        });
    }

    var observerInstalled = false;
    function start() {
        return fetch('bijoy-trending-ready.json?bijoy-4k-index-v1', { cache: 'no-store' })
            .then(function (response) {
                if (!response.ok) throw new Error('4K index unavailable');
                return response.json();
            })
            .then(function (data) {
                fourKMovieIds = new Set((data.fourkMovies || []).map(String));
                decorate(document);
                if (!observerInstalled && typeof MutationObserver !== 'undefined' && document.body) {
                    new MutationObserver(function (records) {
                        records.forEach(function (record) {
                            record.addedNodes.forEach(function (node) {
                                if (node.nodeType === 1) decorate(node);
                            });
                        });
                    }).observe(document.body, { childList: true, subtree: true });
                    observerInstalled = true;
                }
            })
            .catch(function () {
                // Regular Jellyfin version-count indicators remain if unavailable.
            });
    }

    global.Bijoy4kBadge = { labelFor: labelFor, start: start };
    start();
    // On a new installation, the first generated ready file may be empty while
    // Jellyfin finishes its initial scan. Refresh the small index periodically.
    global.setInterval(start, 60000);
})(window);
