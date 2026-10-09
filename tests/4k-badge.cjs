const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function card(id, type) {
    const attributes = { 'data-id': id, 'data-type': type };
    return {
        getAttribute: name => attributes[name] || null,
        classList: { added: [], add(name) { this.added.push(name); } }
    };
}
const firstCard = card('movie-4k', 'Movie');
const normalCard = card('movie-hd', 'Movie');
const seriesCard = card('series', 'Series');
const badges = [firstCard, normalCard, seriesCard].map(item => ({
    textContent: '2', attributes: {}, closest: selector => selector === '.card' ? item : null,
    setAttribute(key, value) { this.attributes[key] = value; },
    classList: { added: [], add(name) { this.added.push(name); } }
}));
let observed;
let refresh;
let fetchCount = 0;
const document = { body: {}, querySelectorAll: selector => selector === '.mediaSourceIndicator' ? badges : [] };
class MutationObserver { constructor(callback) { this.callback = callback; } observe(target, options) { observed = { target, options }; } }
const context = {
    window: { setInterval(callback) { refresh = callback; return 1; } }, document, MutationObserver,
    fetch: async url => {
        assert.equal(url, 'bijoy-trending-ready.json?bijoy-4k-index-v1');
        fetchCount++;
        return { ok: true, json: async () => ({ fourkMovies: fetchCount === 1 ? [] : ['movie-4k'] }) };
    }
};
vm.runInNewContext(fs.readFileSync(process.env.BADGE_JS || '/opt/bijoy/4k-badge.js', 'utf8'), context);

(async () => {
    await new Promise(resolve => setTimeout(resolve, 0));
    assert.equal(badges[0].textContent, '2', 'Empty initial ready data leaves the normal count');
    await refresh();
    assert.equal(badges[0].textContent, '4K');
    assert.equal(badges[0].attributes.title, '4K version available');
    assert.equal(badges[0].classList.added[0], 'bijoy4kMediaSourceIndicator');
    assert.equal(badges[1].textContent, '2');
    assert.equal(badges[2].textContent, '2');
    assert.equal(observed.target, document.body);
    assert.equal(observed.options.subtree, true);
    console.log('4K badges: only movies with a 4K source replace the version count.');
})().catch(error => { console.error(error); process.exitCode = 1; });
