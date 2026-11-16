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

// 9. Allowed-site matching (used by the popup)
const pats = ['https://*.crunchyroll.com/*', 'https://player.example.org/*'];
assert.strictEqual(L.urlAllowed(pats, 'https://www.crunchyroll.com/watch/abc/x'), true);
assert.strictEqual(L.urlAllowed(pats, 'https://crunchyroll.com/'), true);
assert.strictEqual(L.urlAllowed(pats, 'https://player.example.org/embed/1'), true);
assert.strictEqual(L.urlAllowed(pats, 'https://evilcrunchyroll.com/'), false);
assert.strictEqual(L.urlAllowed(pats, 'http://www.crunchyroll.com/'), false);
assert.strictEqual(L.urlAllowed(pats, 'https://other.org/'), false);
assert.strictEqual(L.urlAllowed(pats, undefined), false);

// 10. Real title from anikototv.bz: "English Sub/Dub online Free on Anikoto" is not an episode name
i = L.parseInfo({
  host: 'anikototv.bz',
  pageTitle: 'Watch Kiss Him, Not Me! Episode 1 English Sub/Dub online Free on Anikoto',
  ogTitle: 'Watch Kiss Him, Not Me! Episode 1 English Sub/Dub online Free on Anikoto',
  h1: 'Kiss Him, Not Me!'
});
assert.strictEqual(i.show, 'Kiss Him, Not Me!');
assert.strictEqual(i.num, '1');
assert.strictEqual(i.name, null);
assert.strictEqual(L.cleanEpisodeName('The Hero\'s Party English Sub'), "The Hero's Party");
assert.strictEqual(L.cleanEpisodeName('Free at last'), 'Free at last');       // real name is kept
assert.strictEqual(L.cleanEpisodeName('Online Free on'), null);                // junk is dropped
assert.strictEqual(L.stripSite('Foo Episode 2 on Anikoto', 'anikototv.bz'), 'Foo Episode 2');
assert.strictEqual(L.cleanPlainTitle('Some Show English Sub/Dub online Free'), 'Some Show');

// 11. Real title from the second test: site says "Anikoto", domain is anikototv.bz
i = L.parseInfo({
  host: 'anikototv.bz',
  pageTitle: 'Watch The Apothecary Diaries Season 3 Episode 7 in HD Online for Free - Anikoto',
  ogTitle: 'Watch The Apothecary Diaries Season 3 Episode 7 in HD Online for Free - Anikoto',
  h1: 'The Apothecary Diaries Season 3'
});
assert.strictEqual(i.show, 'The Apothecary Diaries Season 3');
assert.strictEqual(i.num, '7');
assert.strictEqual(i.name, null);
assert.strictEqual(L.stripSite('Foo Episode 2 - Anikoto', 'anikototv.bz'), 'Foo Episode 2');
assert.strictEqual(L.stripSite('Foo Episode 2 - Dr Stone', 'anikototv.bz'), 'Foo Episode 2 - Dr Stone'); // not a site name
assert.strictEqual(L.cleanEpisodeName('in HD Online for Free'), null);
assert.strictEqual(L.cleanEpisodeName('The Hero\'s Party in HD Online for Free'), "The Hero's Party");
assert.strictEqual(L.cleanEpisodeName('In the Hall of Fame'), 'In the Hall of Fame');

// 12. Site permission helpers (add-a-site menu)
assert.strictEqual(L.originPatternForHost('www.anikototv.bz'), 'https://*.anikototv.bz/*');
assert.strictEqual(L.originPatternForHost('megaplay.buzz'), 'https://*.megaplay.buzz/*');
assert.strictEqual(L.originPatternForHost('Beta.Example.COM'), 'https://*.beta.example.com/*');
assert.strictEqual(L.originPatternForHost('192.168.1.5'), 'https://192.168.1.5/*');   // no wildcard on IPs
assert.strictEqual(L.originPatternForHost('localhost'), 'https://localhost/*');
assert.strictEqual(L.originPatternForHost('bad host/../x'), null);
assert.strictEqual(L.originPatternForHost(''), null);
assert.strictEqual(L.originPatternForHost(null), null);
assert.strictEqual(L.labelForOrigin('https://*.crunchyroll.com/*'), 'crunchyroll.com');
assert.strictEqual(L.labelForOrigin('https://crunchyroll.com/*'), 'crunchyroll.com');
assert.strictEqual(L.labelForOrigin('https://*/*'), null);            // "all sites" is never listed as a site
assert.strictEqual(L.labelForOrigin('<all_urls>'), null);
assert.strictEqual(L.hostMatchesLabel('www.crunchyroll.com', 'crunchyroll.com'), true);
assert.strictEqual(L.hostMatchesLabel('beta.crunchyroll.com', 'crunchyroll.com'), true);
assert.strictEqual(L.hostMatchesLabel('evilcrunchyroll.com', 'crunchyroll.com'), false);
assert.strictEqual(L.hostMatchesLabel('crunchyroll.com', ''), false);
// round trip: what we request is what we list
assert.strictEqual(L.labelForOrigin(L.originPatternForHost('www.Some-Site.net')), 'some-site.net');

// 13. Site name unrelated to the domain (found by the real-browser test)
const adTitle = 'Watch Demo Show Episode 3 in HD Online for Free - Test Site';
i = L.parseInfo({ host: '127.0.0.1', pageTitle: adTitle });
assert.deepStrictEqual(i, { show: 'Demo Show', num: '3', name: null });
assert.strictEqual(L.cleanEpisodeName('in HD Online for Free - Test Site'), null);
assert.strictEqual(L.cleanEpisodeName("The Hero's Party in HD Online for Free - Test Site"), "The Hero's Party");
assert.strictEqual(L.cleanEpisodeName('Free at last'), 'Free at last');
assert.strictEqual(L.cleanEpisodeName('In the Hall of Fame'), 'In the Hall of Fame');
assert.strictEqual(L.cleanEpisodeName('Online Date'), 'Online Date');
assert.strictEqual(L.cleanPlainTitle('Some Movie Online Free - Test Site'), 'Some Movie');
// og:site_name lets us remove a site name that has no ad text before it
i = L.parseInfo({ host: '127.0.0.1', siteName: 'Test Site', pageTitle: 'Demo Show Episode 3 - Test Site' });
assert.deepStrictEqual(i, { show: 'Demo Show', num: '3', name: null });
i = L.parseInfo({ host: '127.0.0.1', siteName: 'Test Site', pageTitle: 'Demo Show Episode 3 - The Party - Test Site' });
assert.deepStrictEqual(i, { show: 'Demo Show', num: '3', name: 'The Party' });
// without og:site_name an unknown site name can still end up as the episode name (known limit)
i = L.parseInfo({ host: '127.0.0.1', pageTitle: 'Demo Show Episode 3 - Test Site' });
assert.strictEqual(i.name, 'Test Site');

// 14. Typed site addresses
assert.strictEqual(L.hostFromInput('crunchyroll.com'), 'crunchyroll.com');
assert.strictEqual(L.hostFromInput('  megaplay.buzz  '), 'megaplay.buzz');
assert.strictEqual(L.hostFromInput('https://www.Crunchyroll.com/watch/abc?x=1'), 'www.crunchyroll.com');
assert.strictEqual(L.hostFromInput('http://example.org/a'), 'example.org');
assert.strictEqual(L.hostFromInput('localhost:3000'), 'localhost');
assert.strictEqual(L.hostFromInput('javascript:alert(1)'), null);
assert.strictEqual(L.hostFromInput('ftp://example.com'), null);
assert.strictEqual(L.hostFromInput('file:///etc/passwd'), null);
assert.strictEqual(L.hostFromInput('not a site!!'), null);
assert.strictEqual(L.hostFromInput(''), null);
assert.strictEqual(L.hostFromInput(null), null);
assert.strictEqual(L.originPatternForHost(L.hostFromInput('https://www.Crunchyroll.com/watch/abc')), 'https://*.crunchyroll.com/*');

// 8. Text limits
assert.strictEqual(L.clamp('a'), undefined);
assert.strictEqual(L.clamp('x'.repeat(300)).length, 128);

console.log('All tests passed');
