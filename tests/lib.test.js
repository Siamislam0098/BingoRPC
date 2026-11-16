// Run with: node tests/lib.test.js
const assert = require('assert');
const L = require('../extension/lib.js');

// 1. Typical combined title
let i = L.parseInfo({
  host: 'www.crunchyroll.com',
  pageTitle: "Frieren: Beyond Journey's End Episode 12 - The Hero's Party - Crunchyroll"
});
assert.strictEqual(i.show, "Frieren: Beyond Journey's End");
assert.strictEqual(i.num, '12');
assert.strictEqual(i.name, "The Hero's Party");

// 2. "Watch ... on Site" style
i = L.parseInfo({ host: 'www.crunchyroll.com', pageTitle: "Watch Frieren Episode 12 - The Hero's Party on Crunchyroll" });
assert.strictEqual(i.show, 'Frieren');
assert.strictEqual(i.num, '12');
assert.strictEqual(i.name, "The Hero's Party");

// 3. Separate show and episode elements
i = L.parseInfo({ host: 'crunchyroll.com', showText: 'Frieren', episodeText: "E12 - The Hero's Party" });
assert.deepStrictEqual(i, { show: 'Frieren', num: '12', name: "The Hero's Party" });

// 4. No episode marker (movie)
i = L.parseInfo({ host: 'www.crunchyroll.com', pageTitle: 'Some Movie (2020) - Crunchyroll' });
assert.strictEqual(i.show, 'Some Movie (2020)');
assert.strictEqual(i.num, null);

// 5. Media session title wins over page title
i = L.parseInfo({
  host: 'example.com',
  media: { title: 'Show Name - Episode 3 - Third Title' },
  pageTitle: 'Something else'
});
assert.strictEqual(i.show, 'Show Name');
assert.strictEqual(i.num, '3');

// 6. Activity while playing
const now = 1_000_000_000_000;
let a = L.buildActivity({
  info: { show: 'Frieren', num: '12', name: "The Hero's Party" },
  video: { t: 100, d: 1400, playing: true },
  host: 'www.crunchyroll.com',
  poster: 'https://img.example.com/p.jpg',
  defaultImage: 'default'
}, now);
assert.strictEqual(a.details, 'Frieren · Episode 12');
assert.strictEqual(a.state, "The Hero's Party");
assert.strictEqual(a.startTimestamp, now - 100000);
assert.strictEqual(a.endTimestamp, now - 100000 + 1400000);
assert.strictEqual(a.largeImageText, 'crunchyroll.com');
assert.strictEqual(a.largeImageKey, 'https://img.example.com/p.jpg');

// 7. Activity while paused: no timestamps, "Paused" text
a = L.buildActivity({
  info: { show: 'Frieren', num: '12', name: "The Hero's Party" },
  video: { t: 100, d: 1400, playing: false },
  host: 'www.crunchyroll.com',
  poster: 'http://insecure.example.com/p.jpg',
  defaultImage: 'default'
}, now);
assert.ok(a.state.startsWith('Paused'));
assert.strictEqual(a.startTimestamp, undefined);
assert.strictEqual(a.endTimestamp, undefined);
assert.strictEqual(a.largeImageKey, 'default'); // http image is rejected

// 8. Text limits
assert.strictEqual(L.clamp('a'), undefined);
assert.strictEqual(L.clamp('x'.repeat(300)).length, 128);

console.log('All tests passed');
