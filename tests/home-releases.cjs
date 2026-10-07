const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const web = process.env.WEB_ROOT || '/jellyfin/jellyfin-web';
const helpers = process.env.HELPER_ROOT || '/opt/bijoy';
const window = {};
vm.runInNewContext(fs.readFileSync(path.join(helpers, 'home-release-order.js'), 'utf8'), { window });
const contents = fs.readFileSync(path.join(web, '65126.bijoyreleasesv1.chunk.js'), 'utf8');
const start = contents.indexOf('function(e,t,r,n,i){var a=i.enableOverflow;return function()');
const end = contents.indexOf('}}(t,r,n.Id,n.CollectionType,a)', start);
assert.ok(start >= 0 && end > start);
let requested;
let oldQueryCalls = 0;
const api = {};
const sdk = () => ({ getItems: async (params, options) => {
    requested = { params, options };
    return { data: { Items: [{ Id: 'latest-release' }] } };
} });
const fetchFunction = vm.runInNewContext('(' + contents.slice(start, end + 2) + ')', {
    window, l: { A: { getApi: () => api } },
    L: { X: { Movies: 'movies', Music: 'music', Tvshows: 'tvshows' } },
    C: { y: { Primary: 'Primary', Backdrop: 'Backdrop', Thumb: 'Thumb' } },
    d: { z: { PrimaryImageAspectRatio: 'PrimaryImageAspectRatio', Path: 'Path' } },
    R: { Q: sdk },
    P: () => { oldQueryCalls++; return { queryFn: async () => ['existing-latest-row'] }; },
    u: { q: { fetchQuery: options => options.queryFn({ signal: 'abort-signal' }) } }
});
(async () => {
    const client = { serverId: () => 'server' };
    const user = { Id: 'user', Configuration: { HidePlayedInLatest: true } };
    const result = await fetchFunction(client, user, 'english', 'movies', { enableOverflow: true })();
    assert.equal(result[0].Id, 'latest-release');
    assert.equal(requested.params.parentId, 'english');
    assert.equal(requested.params.userId, 'user');
    assert.equal(requested.params.limit, 16);
    assert.equal(requested.params.recursive, true);
    assert.equal(requested.params.includeItemTypes.join(','), 'Movie');
    assert.equal(requested.params.sortBy.join(','), 'PremiereDate,ProductionYear,SortName');
    assert.equal(requested.params.sortOrder.join(','), 'Descending');
    assert.equal(requested.params.isPlayed, false);
    assert.equal(requested.options.signal, 'abort-signal');
    assert.equal(oldQueryCalls, 0);
    await fetchFunction(client, { Id: 'user', Configuration: {} }, 'foreign', 'movies', { enableOverflow: false })();
    assert.equal(requested.params.limit, 8);
    assert.equal(requested.params.parentId, 'foreign');
    assert.equal(requested.params.isPlayed, undefined);
    const tv = await fetchFunction(client, user, 'tv', 'tvshows', { enableOverflow: false })();
    assert.equal(tv[0], 'existing-latest-row');
    assert.equal(oldQueryCalls, 1);
    assert.equal((contents.match(/Latest releases in /g) || []).length, 2);
    console.log('Home releases: release-date query, permissions scope, row limits, and played-item preference passed.');
})().catch(error => { console.error(error); process.exitCode = 1; });
