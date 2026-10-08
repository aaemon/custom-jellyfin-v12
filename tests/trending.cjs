const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const web = process.env.WEB_ROOT || '/jellyfin/jellyfin-web';
const helpers = process.env.HELPER_ROOT || '/opt/bijoy';
const window = {};
const movies = Array.from({ length: 22 }, (_, i) => ({ Id: 'movie-' + i, Type: 'Movie',
    Name: 'Movie ' + i, ProviderIds: { Tmdb: String(i + 1) }, LocationType: 'FileSystem' }));
const series = Array.from({ length: 18 }, (_, i) => ({ Id: 'series-' + i, Type: 'Series',
    Name: 'Series ' + i, ProviderIds: { Tmdb: String(i + 100) }, LocationType: 'FileSystem' }));
const local = movies.concat(series, [Object.assign({}, movies[0], { Id: 'duplicate-version' }),
    { Id: 'virtual', Type: 'Movie', ProviderIds: { Tmdb: '999' }, IsVirtualItem: true },
    { Id: 'remote', Type: 'Movie', ProviderIds: { Tmdb: '888' }, LocationType: 'Remote' }]);
const requests = [];
let activeEpisodeRequests = 0;
let maxEpisodeRequests = 0;
const feed = { movies: ['999', '888', '5000'].concat(movies.map(m => m.ProviderIds.Tmdb).reverse()),
    tv: series.map(s => s.ProviderIds.Tmdb) };
let failFeed = false;
let preparedReady = null;
const document = { createElement: () => ({
    classList: { names: [], add(...names) { this.names.push(...names); } },
    setAttribute(name, value) { this[name] = value; },
    querySelector(selector) {
        if (selector === '.bijoyTrendingStatus') return this.status || (this.status = {});
        if (selector === '.bijoyTrendingContent') return this.content || (this.content = {});
        return this.container || (this.container = {});
    }
}) };
vm.runInNewContext(fs.readFileSync(path.join(helpers, 'trending-rows.js'), 'utf8'), {
    window, document, console: { warn() {} },
    fetch: async url => ({ ok: !failFeed,
        json: async () => url.includes('bijoy-trending-ready.json')
            ? (preparedReady || { updatedAt: null, movies: [], tv: [] }) : feed })
});
const client = { serverId: () => 'server', getUrl: route => '/base/' + route, getCurrentUserId: () => 'user' };
const deps = {
    connections: { getApi: () => ({}) },
    libraryApi: () => ({ getItems: async params => {
        requests.push(params);
        if (params.includeItemTypes[0] === 'Episode') {
            activeEpisodeRequests++;
            maxEpisodeRequests = Math.max(maxEpisodeRequests, activeEpisodeRequests);
            await new Promise(resolve => setTimeout(resolve, 1));
            activeEpisodeRequests--;
            return { data: { Items: params.parentId === 'series-0' ? [] : [{ Id: 'episode', Type: 'Episode', LocationType: 'FileSystem' }] } };
        }
        if (params.ids) return { data: { Items: local.filter(item => params.ids.includes(item.Id)).reverse() } };
        return { data: { Items: local } };
    } }),
    portraitShape: overflow => overflow ? 'PortraitOverflow' : 'Portrait',
    cards: { getCardsHtml: options => options }
};
const host = { children: [], closest() { return this; },
    querySelector() { return this.children.find(node => node['data-bijoy-trending']); },
    appendChild(node) { this.children.push(node); } };

(async () => {
    window.BijoyTrendingRows.install(host, client, { Id: 'user' }, { enableOverflow: true }, deps);
    assert.equal(host.children.length, 2);
    assert.ok(host.children[0].innerHTML.includes('Trending Movies'));
    assert.ok(host.children[1].innerHTML.includes('Trending TV Shows'));
    assert.ok(host.children.every(section => !section.classList.names.includes('hide')),
        'Titles must be visible immediately, before network requests finish');
    window.BijoyTrendingRows.install(host, client, { Id: 'user' }, { enableOverflow: true }, deps);
    assert.equal(host.children.length, 2, 'Rows must not be duplicated');
    const [movieResult, tvResult] = await Promise.all(host.children.map(node => node.container.fetchData()));
    assert.equal(movieResult.length, 16);
    assert.equal(movieResult[0].Id, 'movie-21', 'Trending order must survive local filtering');
    assert.equal(new Set(movieResult.map(item => item.ProviderIds.Tmdb)).size, 16);
    assert.equal(tvResult.length, 16);
    assert.equal(tvResult[0].Id, 'series-1', 'Series without playable episodes must be excluded');
    assert.ok(requests.every(request => request.userId === 'user'));
    assert.equal(requests.filter(request => request.includeItemTypes.length === 2).length, 1,
        'Movie and TV rows share the user-scoped inventory request');
    const inventory = requests.find(request => request.includeItemTypes.length === 2);
    assert.equal(inventory.enableImages, false);
    assert.equal(inventory.enableUserData, false);
    assert.equal(inventory.fields.join(','), 'ProviderIds');
    assert.ok(requests.filter(request => request.ids).every(request => request.ids.length <= 16),
        'Detailed artwork/user data must only be fetched for displayed cards');
    assert.ok(maxEpisodeRequests > 1 && maxEpisodeRequests <= 8,
        'Episode checks must run in bounded parallel batches');
    const cards = host.children[0].container.getItemsHtml(movieResult);
    assert.equal(cards.context, 'home');
    assert.equal(cards.shape, 'PortraitOverflow');
    assert.equal(cards.items.length, 16);
    assert.equal(host.children[0].container.parentContainer, host.children[0].content,
        'Native loading/empty-state hiding must not hide the title');
    const otherUser = await window.BijoyTrendingRows.select({}, client, { Id: 'other' }, 'Movie', deps);
    assert.equal(otherUser.length, 16);
    assert.ok(requests.some(request => request.userId === 'other'));
    preparedReady = { updatedAt: 123, movies: ['movie-8','movie-2'], tv: ['series-4'] };
    const preparedClient = Object.assign({}, client, { serverId: () => 'ready-server' });
    const requestCount = requests.length;
    const prepared = await Promise.all(['Movie','Series'].map(kind =>
        window.BijoyTrendingRows.select({}, preparedClient, { Id: 'ready-user' }, kind, deps)));
    assert.equal(prepared[0].map(item => item.Id).join(','), 'movie-8,movie-2');
    assert.equal(prepared[1][0].Id, 'series-4');
    assert.ok(requests.slice(requestCount).every(request => request.ids),
        'Ready-list path must only fetch selected cards: no inventory scans or episode checks');
    const anotherPrepared = await window.BijoyTrendingRows.select({}, preparedClient, { Id: 'another-ready-user' }, 'Movie', deps);
    assert.equal(anotherPrepared.map(item => item.Id).join(','), 'movie-8,movie-2');
    assert.equal(requests[requests.length - 1].userId, 'another-ready-user',
        'Shared IDs still require each user’s authenticated detail request');
    failFeed = true;
    const failureHost = { children: [], closest() { return this; },
        querySelector() { return this.children.find(node => node['data-bijoy-trending']); },
        appendChild(node) { this.children.push(node); } };
    const failureClient = Object.assign({}, client, { serverId: () => 'unavailable-server' });
    window.BijoyTrendingRows.install(failureHost, failureClient, { Id: 'user' }, { enableOverflow: true }, deps);
    const failureResults = await Promise.all(failureHost.children.map(node => node.container.fetchData()));
    assert.ok(failureResults.every(items => items.length === 0), 'Feed errors must not reject the combined home loader');
    assert.ok(failureHost.children.every(section => section.status.textContent.includes('temporarily unavailable')));
    const chunk = fs.readFileSync(path.join(web, '65126.bijoytrendingv1.chunk.js'), 'utf8');
    assert.ok(chunk.includes('bijoyTrendingDependencies={libraryApi:bijoyLibraryApi,cards:p.Ay,portraitShape:I.xK,connections:l.A}'));
    assert.ok(chunk.includes('case n.LatestMedia:window.BijoyTrendingRows.install(v,t,r,h,bijoyTrendingDependencies),!function'));
    assert.ok(fs.readFileSync(path.join(web, 'index.html'), 'utf8').includes('trending-rows-v1.js?bijoy-'));
    console.log('Trending: native row design, max 16, local-only matching, rank order, deduplication, episode availability, user scope, and insertion point passed.');
})().catch(error => { console.error(error); process.exitCode = 1; });
