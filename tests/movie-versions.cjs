const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const web = process.env.WEB_ROOT || '/jellyfin/jellyfin-web';
const helpers = process.env.HELPER_ROOT || '/opt/bijoy';
const window = {};
vm.runInNewContext(fs.readFileSync(path.join(helpers, 'media-source-preference.js'), 'utf8'), { window });
const preference = window.BijoyMediaSources;
function source(id, width, height, playable = true) {
    return { Id: id, Name: id, MediaStreams: [{ Type: 'Video', Width: width, Height: height }],
        SupportsDirectStream: playable, SupportsTranscoding: playable, testPlayable: playable };
}
const sources = [source('2160p', 3840, 2160), source('1080p', 1920, 1080), source('720p', 1280, 720)];
assert.equal(preference.prefer1080(sources).map(s => s.Id).join(','), '1080p,2160p,720p');
assert.equal(sources.map(s => s.Id).join(','), '2160p,1080p,720p');
assert.equal(preference.find1080([source('letterboxed', 1920, 800)]).Id, 'letterboxed');
assert.equal(preference.find1080([{ Id: 'named', Name: 'Movie - 1080p' }]).Id, 'named');
assert.equal(preference.versionName({ Name: '1080p', Path: '/data/Captain America - Civil War (2016) - Bluray-1080p.mkv' }), 'Bluray-1080p');
assert.equal(preference.versionName({ Name: '2160p', Path: 'C:\\Movies\\Movie (2016) - Bluray-2160p.mkv' }), 'Bluray-2160p');
assert.equal(preference.versionName({ Name: '720p' }), '720p');
assert.equal(preference.versionName({ Name: 'Original', Path: '/data/Movie.mkv' }), 'Original');
const main = fs.readFileSync(path.join(web, 'main.jellyfin.bundle.js'), 'utf8');
const start = main.indexOf('function(e,t,n,bijoySourceId){var r=n.map');
const end = main.indexOf('}(t,r,a.MediaSources,i).then', start);
assert.ok(start >= 0 && end > start);
const selector = vm.runInNewContext('(' + main.slice(start, end + 1) + ')', {
    window, tt: async (_client, _item, s) => s.testPlayable
});
(async () => {
    assert.equal((await selector(null, { Type: 'Movie', Id: '2160p' }, sources)).Id, '1080p');
    assert.equal((await selector(null, { Type: 'Movie', Id: '2160p' }, sources, '2160p')).Id, '2160p');
    assert.equal((await selector(null, { Type: 'Movie', Id: '2160p' }, sources, '720p')).Id, '720p');
    assert.equal((await selector(null, { Type: 'Episode', Id: '2160p' }, sources)).Id, '2160p');
    assert.equal((await selector(null, { Type: 'Movie', Id: '2160p' }, [sources[0], sources[2]])).Id, '2160p');
    assert.equal((await selector(null, { Type: 'Movie', Id: '2160p' }, [sources[0], source('1080p', 1920, 1080, false)])).Id, '2160p');
    const details = fs.readFileSync(path.join(web, 'itemDetails.bijoy1080v2.chunk.js'), 'utf8');
    assert.ok(details.includes('window.BijoyMediaSources.prefer1080(r.MediaSources)'));
    assert.ok(details.includes('?s:a[0].Id'));
    assert.ok(main.includes('window.BijoyMediaSources.labelSources(e.MediaSources)'));
    const html = fs.readFileSync(path.join(web, 'index.html'), 'utf8');
    assert.ok(html.indexOf('media-source-preference-v2.js') < html.indexOf('main.jellyfin.bundle.js'));
    console.log('Movie versions: default 1080p, explicit choices, full labels, and fallbacks passed.');
})().catch(error => { console.error(error); process.exitCode = 1; });
