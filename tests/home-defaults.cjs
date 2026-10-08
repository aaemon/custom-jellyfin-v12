const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const web = process.env.WEB_ROOT || '/jellyfin/jellyfin-web';
const contents = fs.readFileSync(path.join(web, '65126.bijoytrendingv2.chunk.js'), 'utf8');
const start = contents.indexOf('function(e,t,r,n,i){var a=i.enableOverflow;return function()');
const end = contents.indexOf('}}(t,r,n.Id,n.CollectionType,a)', start);
assert.ok(start >= 0 && end > start);
let query;
const fetch = vm.runInNewContext('(' + contents.slice(start, end + 2) + ')', {
    l: { A: { getApi: () => ({}) } },
    L: { X: { Music: 'music', Tvshows: 'tvshows' } },
    C: { y: { Primary: 'Primary', Backdrop: 'Backdrop', Thumb: 'Thumb' } },
    d: { z: { PrimaryImageAspectRatio: 'PrimaryImageAspectRatio', Path: 'Path' } },
    R: [],
    P: (_api, options) => { query = options; return { nativeLatest: true }; },
    u: { q: { fetchQuery: options => options } }
});
const client = { serverId: () => 'server' };
for (const kind of ['movies', 'tvshows']) {
    assert.equal(fetch(client, { Id: 'user' }, 'library', kind, { enableOverflow: true })().nativeLatest, true);
    assert.equal(query.userId, 'user');
    assert.equal(query.parentId, 'library');
    assert.equal(query.limit, 16);
    assert.equal(query.sortBy, undefined);
}
assert.equal((contents.match(/translate\("LatestFromLibrary",g\(\)\(n.Name\)\)/g) || []).length, 2);
assert.ok(!contents.includes('Latest releases in '));
assert.ok(!contents.includes('BijoyHomeLatest'));
assert.ok(contents.includes('window.BijoyTrendingRows.install'));
console.log('Home defaults: native LatestMedia query and headings restored; trending rows preserved.');
