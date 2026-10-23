const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const web = process.env.WEB_ROOT || '/jellyfin/jellyfin-web';
const navbarName = fs.readdirSync(web).find(name => name.endsWith('.customnavbarbijoy2.chunk.js'));
assert.ok(navbarName, 'patched navigation chunk exists');
const navbar = fs.readFileSync(path.join(web, navbarName), 'utf8');
assert.ok(navbar.includes('translate("HeaderLibraries")'));
assert.ok(navbar.includes('children:n?"":(null==t?void 0:t.ServerName)||"Bijoy Media"'));
assert.ok(navbar.includes('primary:(null==e?void 0:e.ServerName)||"Bijoy Media"'));
assert.ok(navbar.includes('"data-jf-next":"1"'));
assert.ok(!navbar.includes(',window.scrollTo(0,0)'));
const menu = navbar.match(/F=\(0,a\.useMemo\)\(\(function\(\)\{return f\|\|\[\]\}\),\[f\]\),R=\(0,a\.useMemo\)\(\(function\(\)\{return\(null==x\?void 0:x.Items\)\|\|\[\]\}\),\[x\]\)/);
assert.ok(menu, 'external links and libraries have independent menus');
for (const [links, libraries] of [[[], []], [[{ url: 'https://example.com' }], [{ Id: 'movies' }, { Id: 'tv' }]]]) {
    const result = vm.runInNewContext(`var ${menu[0]}; [F,R]`, {
        a: { useMemo: fn => fn() }, f: links, x: { Items: libraries }
    });
    assert.equal(JSON.stringify(result), JSON.stringify([links, libraries]));
}
const main = fs.readFileSync(path.join(web, 'main.jellyfin.bundle.js'), 'utf8');
assert.ok(main.includes('this.get("enableBackdrops",!1),!0'));
const pageSize = main.match(/return 0===t\?400:Math.min\(t\|\|100,400\)/);
assert.ok(pageSize);
const getPageSize = vm.runInNewContext(`(function(t){${pageSize[0]}})`);
for (const [input, expected] of [[undefined, 100], [0, 400], [100, 100], [400, 400], [1000, 400]]) {
    assert.equal(getPageSize(input), expected);
}
const libraryName = fs.readdirSync(web).find(name => name.endsWith('.custominfinite1.chunk.js'));
assert.ok(libraryName);
const library = fs.readFileSync(path.join(web, libraryName), 'utf8');
assert.ok(library.includes('p=function(e){return{limit:(s.ex(void 0)||100)+(e||0)}}'));
assert.ok(!library.includes('startIndex:u.StartIndex'));
assert.equal(library.split('(0,I.cm)(u.StartIndex)').length - 1, 6);
assert.ok(library.includes('placeholderData:function(e){return e}'));
const runtime = fs.readFileSync(path.join(web, 'runtime.bundle.js'), 'utf8');
for (const name of [navbarName, libraryName]) {
    const [id, hash] = name.split('.');
    assert.ok(runtime.includes(`${id}:"${hash}"`));
}
console.log('Navigation: external links, Libraries menu, branding, backdrops, page cap, and progressive queries passed.');
