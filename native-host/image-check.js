'use strict';
// Checks that an image URL is publicly reachable WITHOUT cookies or a Referer,
// which is how Discord's image proxy will fetch it.

const https = require('https');
const http = require('http');

const TIMEOUT_MS = 4000;
const MAX_REDIRECTS = 3;
const CACHE_MAX = 200;
const cache = new Map();   // url -> { ok, at }
const OK_TTL_MS = 30 * 60 * 1000;
const BAD_TTL_MS = 5 * 60 * 1000;

function probe(url, redirects) {
  return new Promise((resolve) => {
    let u;
    try { u = new URL(url); } catch (e) { return resolve(false); }
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return resolve(false);
    const mod = u.protocol === 'https:' ? https : http;

    const req = mod.request(u, {
      method: 'GET',
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Discordbot/2.0)', 'Range': 'bytes=0-0', 'Accept': 'image/*' },
      timeout: TIMEOUT_MS
    }, (res) => {
      const code = res.statusCode || 0;
      res.destroy();   // headers are enough, do not download the image
      if (code >= 300 && code < 400 && res.headers.location && redirects < MAX_REDIRECTS) {
        let next;
        try { next = new URL(res.headers.location, u).href; } catch (e) { return resolve(false); }
        return resolve(probe(next, redirects + 1));
      }
      const type = String(res.headers['content-type'] || '').toLowerCase();
      resolve((code === 200 || code === 206) && type.startsWith('image/'));
    });
    req.on('timeout', () => { req.destroy(); resolve(false); });
    req.on('error', () => resolve(false));
    req.end();
  });
}

async function isPublicImage(url) {
  const hit = cache.get(url);
  if (hit && Date.now() - hit.at < (hit.ok ? OK_TTL_MS : BAD_TTL_MS)) return hit.ok;
  const ok = await probe(url, 0);
  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value);
  cache.set(url, { ok, at: Date.now() });
  return ok;
}

// Returns the first candidate that works, or null.
async function firstWorking(candidates) {
  for (const url of candidates || []) {
    if (await isPublicImage(url)) return url;
  }
  return null;
}

module.exports = { isPublicImage, firstWorking };
