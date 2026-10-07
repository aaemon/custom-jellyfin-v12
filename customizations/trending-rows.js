(function (global) {
    'use strict';
    var inventories = new Map();
    var feeds = new Map();

    function tmdbId(item) {
        var ids = item.ProviderIds || {};
        var key = Object.keys(ids).find(function (name) { return name.toLowerCase() === 'tmdb'; });
        return key && String(ids[key]);
    }

    function match(feed, items, kind) {
        var index = new Map();
        items.forEach(function (item) {
            if (item.Type !== kind || item.IsVirtualItem || ['Virtual', 'Remote'].includes(item.LocationType)) return;
            var id = tmdbId(item);
            if (id && !index.has(id)) index.set(id, item);
        });
        var seen = new Set();
        return (feed || []).reduce(function (result, id) {
            id = String(id);
            if (!seen.has(id) && index.has(id)) {
                seen.add(id);
                result.push(index.get(id));
            }
            return result;
        }, []);
    }

    function inventory(api, userId, factory, cacheKey) {
        var cached = inventories.get(cacheKey);
        if (cached && cached.until > Date.now()) return cached.promise;
        var promise = (async function () {
            var all = [], start = 0;
            while (true) {
                var response = await factory(api).getItems({ userId: userId, recursive: true,
                    includeItemTypes: ['Movie', 'Series'], isVirtualItem: false,
                    fields: ['ProviderIds', 'ItemCounts'], enableImageTypes: ['Primary', 'Backdrop', 'Thumb'],
                    imageTypeLimit: 1, sortBy: ['SortName'], sortOrder: ['Ascending'],
                    startIndex: start, limit: 500, enableTotalRecordCount: false });
                var items = response.data.Items || [];
                all = all.concat(items);
                if (items.length < 500) return all;
                start += items.length;
            }
        })();
        inventories.set(cacheKey, { until: Date.now() + 60000, promise: promise });
        promise.catch(function () { inventories.delete(cacheKey); });
        return promise;
    }

    function feed(client) {
        var key = client.serverId();
        var cached = feeds.get(key);
        if (cached && cached.until > Date.now()) return cached.promise;
        var promise = fetch(client.getUrl('web/bijoy-trending.json'), { cache: 'no-store' })
            .then(function (response) {
                if (!response.ok) throw new Error('Trending feed unavailable');
                return response.json();
            });
        feeds.set(key, { until: Date.now() + 60000, promise: promise });
        promise.catch(function () { feeds.delete(key); });
        return promise;
    }

    async function select(api, client, user, kind, deps) {
        var userId = user.Id || client.getCurrentUserId();
        var values = await Promise.all([
            feed(client), inventory(api, userId, deps.libraryApi, client.serverId() + ':' + userId)
        ]);
        var matching = match(values[0][kind === 'Movie' ? 'movies' : 'tv'], values[1], kind);
        if (kind === 'Movie') return matching.slice(0, 16);
        var playable = [];
        for (var i = 0; i < matching.length && playable.length < 16; i++) {
            var response = await deps.libraryApi(api).getItems({ userId: userId,
                parentId: matching[i].Id, recursive: true, includeItemTypes: ['Episode'],
                isVirtualItem: false, limit: 1, enableTotalRecordCount: false });
            var episodes = response.data.Items || [];
            if (episodes.some(function (episode) {
                return !episode.IsVirtualItem && !['Virtual', 'Remote'].includes(episode.LocationType);
            })) playable.push(matching[i]);
        }
        return playable;
    }

    function install(host, client, user, options, deps) {
        var home = host.closest('.homeSectionsContainer') || host;
        if (home.querySelector('[data-bijoy-trending]')) return;
        var api = deps.connections.getApi(client.serverId());
        [ ['Movie', 'Trending (Movies (All))'], ['Series', 'Trending (TV Shows (All))'] ]
            .forEach(function (entry) {
                var section = document.createElement('div');
                section.classList.add('verticalSection', 'hide');
                section.setAttribute('data-bijoy-trending', entry[0]);
                section.innerHTML = '<div class="sectionTitleContainer sectionTitleContainer-cards padded-left">'
                    + '<h2 class="sectionTitle sectionTitle-cards">' + entry[1] + '</h2></div>'
                    + (options.enableOverflow ? '<div is="emby-scroller" class="padded-top-focusscale padded-bottom-focusscale" data-centerfocus="true">' : '')
                    + '<div is="emby-itemscontainer" class="itemsContainer '
                    + (options.enableOverflow ? 'scrollSlider focuscontainer-x' : 'focuscontainer-x padded-left padded-right vertical-wrap')
                    + '"></div>' + (options.enableOverflow ? '</div>' : '');
                host.appendChild(section);
                var container = section.querySelector('.itemsContainer');
                container.fetchData = function () { return select(api, client, user, entry[0], deps); };
                container.getItemsHtml = function (items) {
                    return deps.cards.getCardsHtml({ items: items, shape: deps.portraitShape(options.enableOverflow),
                        context: 'home', preferParentPoster: true, showUnplayedIndicator: false,
                        showChildCountIndicator: entry[0] === 'Series', overlayText: false,
                        centerText: true, overlayPlayButton: true, allowBottomPadding: !options.enableOverflow,
                        cardLayout: false, showTitle: true, showYear: true, lines: 2 });
                };
                container.parentContainer = section;
            });
    }

    global.BijoyTrendingRows = { install: install, match: match, select: select };
})(window);
