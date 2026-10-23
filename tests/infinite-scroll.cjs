const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const web = process.env.WEB_ROOT || '/jellyfin/jellyfin-web';
const script = fs.readFileSync(path.join(web, 'jellyfin-infinite-scroll.js'), 'utf8');
let clicks = 0;
let ariaDisabled = 'false';
let currentButton;
const button = { disabled: false, getAttribute: () => ariaDisabled, click: () => clicks++ };
const doc = { scrollTop: 0, clientHeight: 1000, scrollHeight: 3000 };
const listeners = {};
let interval;
const window = {
    innerHeight: 1000, pageYOffset: 0,
    addEventListener: (event, callback) => { assert.ok(!listeners[event]); listeners[event] = callback; },
    setInterval: callback => { assert.ok(!interval); interval = callback; }
};
const document = { documentElement: doc, body: { scrollHeight: 3000 }, querySelector: selector => {
    assert.equal(selector, '[data-jf-next]');
    return currentButton;
} };
const context = vm.createContext({ window, document });
vm.runInContext(script, context);
vm.runInContext(script, context); // Installation must be idempotent.
interval(); // No button on non-library pages.
currentButton = button;
listeners.scroll(); // Not near the bottom.
assert.equal(clicks, 0);
window.pageYOffset = 1500;
button.disabled = true;
interval();
button.disabled = false;
ariaDisabled = 'true';
interval();
assert.equal(clicks, 0);
ariaDisabled = 'false';
listeners.scroll();
assert.equal(clicks, 1);
interval(); // Do not submit another request before the list grows.
assert.equal(clicks, 1);
doc.scrollHeight = document.body.scrollHeight = 4000;
listeners.resize(); // Newly loaded items are not yet near the viewport.
assert.equal(clicks, 1);
window.pageYOffset = 2500;
listeners.scroll();
assert.equal(clicks, 2);
console.log('Infinite scroll: bottom detection, disabled states, growing lists, and duplicate-load guards passed.');
