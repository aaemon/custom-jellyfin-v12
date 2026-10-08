(function (global) {
    'use strict';
    var inventories = new Map();
    var feeds = new Map();
    var readyLists = new Map();

    function ready(client) {
        var key = client.serverId();
        var cached = readyLists.get(key);
        if (cached && cached.until > Date.now()) return cached.promise;
        var promise = fetch(client.getUrl('web/bijoy-trending-ready.json'), { cache: 'no-store' })
            .then(function (response) {
                if (!response.ok) throw new Error('Prepared trending list unavailable');
                return response.json();
            }).then(function (value) { return value.updatedAt ? value : null; });
        readyLists.set(key, { until: Date.now() + 60000, promise: promise });
        promise.catch(function () { readyLists.delete(key); });
        return promise;
    }

    async function cardDetails(api, userId, kind, identifiers, deps) {
        if (!identifiers.length) return [];
        var selected = identifiers.slice(0, 16);
        var load = async function (context) {
            var details = await deps.libraryApi(api).getItems({ userId: userId, ids: selected,
                includeItemTypes: [kind], fields: ['PrimaryImageAspectRatio'],
                enableImageTypes: ['Primary', 'Backdrop', 'Thumb'], imageTypeLimit: 1,
                enableTotalRecordCount: false }, { signal: context && context.signal });
            var byId = new Map((details.data.Items || []).map(function (item) { return [item.Id, item]; }));
            return selected.map(function (id) { return byId.get(id); }).filter(Boolean);
        };
        if (!deps.queryClient) return load();
        return deps.queryClient.fetchQuery({
            queryKey: ['User', userId, 'Items', 'BijoyTrendingCards', kind, selected],
            queryFn: load, staleTime: 60000
        });
    }

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
                    includeItemTypes: ['Movie', 'Series'], excludeLocationTypes: ['Virtual', 'Remote'],
                    fields: ['ProviderIds'], enableImages: false, enableUserData: false,
                    sortBy: ['SortName'], sortOrder: ['Ascending'],
                    startIndex: start, limit: 2000, enableTotalRecordCount: false });
                var items = response.data.Items || [];
                all = all.concat(items);
                if (items.length < 2000) return all;
                start += items.length;
            }
        })();
        inventories.set(cacheKey, { until: Date.now() + 300000, promise: promise });
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
        var prepared = await ready(client).catch(function () { return null; });
        if (prepared) {
            // The shared file contains only opaque item IDs. Authenticated
            // detail reads enforce current visibility before rendering cards.
            return cardDetails(api, userId, kind, prepared[kind === 'Movie' ? 'movies' : 'tv'], deps);
        }
        var values = await Promise.all([
            feed(client), inventory(api, userId, deps.libraryApi, client.serverId() + ':' + userId)
        ]);
        var matching = match(values[0][kind === 'Movie' ? 'movies' : 'tv'], values[1], kind);
        var selected = matching.slice(0, 16);
        if (kind === 'Series') {
            var playable = [];
            // Batch checks in parallel, but retain feed order when selecting.
            for (var start = 0; start < matching.length && playable.length < 16; start += 8) {
                var batch = matching.slice(start, start + 8);
                var available = await Promise.all(batch.map(async function (series) {
                    var response = await deps.libraryApi(api).getItems({ userId: userId,
                        parentId: series.Id, recursive: true, includeItemTypes: ['Episode'],
                        isMissing: false, excludeLocationTypes: ['Virtual', 'Remote'],
                        enableImages: false, enableUserData: false,
                        limit: 1, enableTotalRecordCount: false });
                    return (response.data.Items || []).some(function (episode) {
                        return !episode.IsVirtualItem && !['Virtual', 'Remote'].includes(episode.LocationType);
                    });
                }));
                batch.forEach(function (series, index) {
                    if (available[index]) playable.push(series);
                });
            }
            selected = playable.slice(0, 16);
        }
        return cardDetails(api, userId, kind, selected.map(function (item) { return item.Id; }), deps);
    }

    function install(host, client, user, options, deps) {
        var home = host.closest('.homeSectionsContainer') || host;
        if (home.querySelector('[data-bijoy-trending]')) return;
        var api = deps.connections.getApi(client.serverId());
        [ ['Movie', 'Trending Movies'], ['Series', 'Trending TV Shows'] ]
            .forEach(function (entry) {
                var section = document.createElement('div');
                section.classList.add('verticalSection', 'hide');
                section.setAttribute('data-bijoy-trending', entry[0]);
                var html = '<div class="sectionTitleContainer sectionTitleContainer-cards padded-left">'
                    + '<h2 class="sectionTitle sectionTitle-cards">' + entry[1] + '</h2></div>';
                if (options.enableOverflow) {
                    html += '<div is="emby-scroller" class="padded-top-focusscale padded-bottom-focusscale" data-centerfocus="true">';
                    html += '<div is="emby-itemscontainer" class="itemsContainer scrollSlider focuscontainer-x">';
                    html += '</div></div>';
                } else {
                    html += '<div is="emby-itemscontainer" class="itemsContainer focuscontainer-x padded-left padded-right vertical-wrap">';
                    html += '</div>';
                }
                section.innerHTML = html;
                host.appendChild(section);
                var container = section.querySelector('.itemsContainer');
                container.fetchData = function () {
                    return select(api, client, user, entry[0], deps).catch(function () {
                        // A feed outage must not reject Jellyfin's combined home
                        // section loader or prevent the existing rows loading.
                        console.warn('[trending] Row unavailable; keeping other home sections active.');
                        return [];
                    });
                };
                container.getItemsHtml = function (items) {
                    return deps.cards.getCardsHtml({ items: items, shape: deps.portraitShape(options.enableOverflow),
                        context: 'home', preferParentPoster: true, showUnplayedIndicator: false,
                        showChildCountIndicator: entry[0] === 'Series', overlayText: false,
                        centerText: true, overlayPlayButton: true, allowBottomPadding: !options.enableOverflow,
                        cardLayout: false, showTitle: true, showYear: true, lines: 2 });
                };
                // Match Jellyfin's native home-row scroller parent so the
                // native carousel arrows/focus behavior remain identical.
                container.parentContainer = section;
            });
    }

    function prefetch(client, user, deps) {
        var api = deps.connections.getApi(client.serverId());
        if (!api) return Promise.resolve([]);
        return Promise.all(['Movie', 'Series'].map(function (kind) {
            return select(api, client, user, kind, deps).catch(function () {
                // Preloading must never interrupt the native home loader.
                return [];
            });
        }));
    }

    global.BijoyTrendingRows = { install: install, match: match, select: select, prefetch: prefetch };
})(window);
