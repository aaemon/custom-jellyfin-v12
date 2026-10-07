(function () {
    'use strict';
    function updateTitle() {
        if (/^Jellyfin$/i.test(document.title.trim())) {
            document.title = 'Bijoy Media';
        }
    }
    updateTitle();
    new MutationObserver(updateTitle).observe(document.head, {
        childList: true, subtree: true, characterData: true
    });
})();
