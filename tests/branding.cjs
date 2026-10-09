const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const web = process.env.WEB_ROOT || '/jellyfin/jellyfin-web';
const helpers = process.env.HELPER_ROOT || '/opt/bijoy';
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
for (const [source, target] of [
    ['bijoy-logo.png', 'bijoy-icon-v1.png'],
    ['bijoy-full.png', 'bijoy-banner-dark-v1.png'],
    ['bijoy-full.png', 'bijoy-banner-light-v1.png'],
    ['bijoy-fav.ico', 'bijoy-favicon-v1.ico']
]) {
    assert.equal(hash(path.join(web, target)), hash(path.join(helpers, 'assets', source)));
}
const index = fs.readFileSync(path.join(web, 'index.html'), 'utf8');
assert.ok(index.includes('<title>Bijoy Media</title>'));
assert.ok(index.includes('bijoy-favicon-v1.ico'));
assert.ok(index.includes('jellyfin-infinite-scroll.js?bijoy-'));
assert.ok(index.indexOf('trending-rows-v1.js') < index.indexOf('runtime.bundle.js'));
assert.ok(index.indexOf('4k-badge.js?bijoy-') < index.indexOf('runtime.bundle.js'));
assert.ok(!index.includes('home-release-order'));
const assets = [...index.matchAll(/(?:src|href)="([^"?]+\.(?:js|css))\?bijoy-([a-f0-9]{16})"/g)];
assert.ok(assets.length > 10);
for (const [, url, cacheHash] of assets) {
    assert.equal(hash(path.join(web, decodeURIComponent(url))).slice(0, 16), cacheHash);
}
console.log('Branding: original Bijoy artwork, browser title, helper order, and content cache tags passed.');
