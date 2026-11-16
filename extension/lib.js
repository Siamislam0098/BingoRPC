// Pure helper functions (no browser APIs).
// Loaded by background.js with importScripts, and by Node for the tests.
(function (root) {
  'use strict';

  const MAX_TEXT = 128;
  const EP = '(?:episode|ep\\.?|e)\\s*(\\d+(?:\\.\\d+)?)';
  const SEP = '[-\\u2013\\u2014|:.]';

  function escapeRe(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  // Discord text lines must be 2 to 128 characters.
  function clamp(s) {
    if (typeof s !== 'string') return undefined;
    s = s.replace(/\s+/g, ' ').trim();
    if (s.length < 2) return undefined;
    return s.length > MAX_TEXT ? s.slice(0, MAX_TEXT - 1) + '…' : s;
  }

  function hostLabel(host) {
    return String(host || '').replace(/^www\./i, '');
  }

  // 'www.crunchyroll.com' -> 'crunchyroll'
  function siteWord(host) {
    const parts = hostLabel(host).split('.');
    return parts.length >= 2 ? parts[parts.length - 2] : (parts[0] || '');
  }

  // Removes "- Crunchyroll", "Watch ... on Crunchyroll" and a leading "Watch ".
  function stripSite(title, host) {
    let t = String(title || '').replace(/\s+/g, ' ').trim();
    const word = siteWord(host);
    if (word) {
      const w = escapeRe(word);
      t = t.replace(new RegExp('\\s*' + SEP + '\\s*(?:watch(?:\\s+\\S+){0,3}\\s+on\\s+)?' + w + '\\b.*$', 'i'), '');
      t = t.replace(new RegExp('\\s+(?:on|at)\\s+' + w + '\\s*$', 'i'), '');
    }
    // Titles often use a short site name ("Anikoto") for a longer domain ("anikototv.bz").
    const tail = t.match(new RegExp('(?:\\s*' + SEP + '\\s*|\\s+(?:on|at)\\s+)([A-Za-z0-9]{4,})\\s*$', 'i'));
    if (tail && word) {
      const a = tail[1].toLowerCase(), b = word.toLowerCase();
      if (b.startsWith(a) || a.startsWith(b)) t = t.slice(0, tail.index);
    }
    t = t.replace(/^watch\s+/i, '');
    return t.trim();
  }

  // Words that sites add to titles but that are not part of an episode name.
  const JUNK = new Set(['in', 'hd', 'online', 'for', 'free', 'english', 'sub', 'dub', 'subbed',
    'dubbed', 'watch', 'on', 'at', 'full', 'episode', 'hd+', '1080p', '720p', 'and', 'with']);

  function isJunkWord(w) {
    return JUNK.has(w.toLowerCase().replace(/[^a-z0-9+]/g, '')) || /^(?:sub|dub)\/(?:sub|dub)$/i.test(w);
  }

  // "E12 - The Hero's Party" -> { num: '12', name: "The Hero's Party" }
  function splitEpisodeOnly(text) {
    const m = String(text || '').match(
      new RegExp('^\\s*(?:s\\d+\\s*)?' + EP + '\\s*(?:' + SEP + ')?\\s*(.*)$', 'i'));
    return m ? { num: m[1], name: (m[2] || '').trim() } : null;
  }

  // "Frieren Episode 12 - The Hero's Party" -> show, num, name
  function splitTitle(text) {
    const m = String(text || '').match(
      new RegExp('^(.*?)\\s*(?:' + SEP + ')?\\s+(?:s\\d+\\s*)?' + EP + '\\s*(?:' + SEP + ')?\\s*(.*)$', 'i'));
    if (!m) return null;
    return { show: (m[1] || '').trim(), num: m[2], name: (m[3] || '').trim() };
  }

  // Sites often add "English Sub/Dub online Free on <Site>" after the episode.
  // Returns a clean episode name, or null when it is only that kind of text.
  // Start of the "advert" part of a title: everything from here on is site text,
  // including the site's own name that follows it ("... in HD Online for Free - Some Site").
  const SITE_JUNK_RE = /(?:^|\s)(?:(?:in\s+)?(?:full\s+)?hd\+?(?=\s|$)|online\s+(?:for\s+)?free\b|for\s+free\b|free\s+online\b|watch\s+online\b|(?:english\s+)?(?:sub(?:bed)?|dub(?:bed)?)\b|1080p\b|720p\b)/i;

  function cutSiteJunk(s) {
    let t = String(s || '').replace(/\s+/g, ' ').trim();
    const m = t.match(SITE_JUNK_RE);
    if (m) t = t.slice(0, m.index);
    return t.replace(/[\s\-–—|:]+$/, '').trim();
  }

  function cleanEpisodeName(s) {
    const words = cutSiteJunk(s).split(/\s+/).filter(Boolean);
    // Drop junk words at the end ("... and", "... on").
    while (words.length && isJunkWord(words[words.length - 1])) words.pop();
    // If the whole thing was junk words, there is no episode name.
    const t = words.join(' ').trim();
    if (!t || words.every(isJunkWord)) return null;
    return t.length >= 2 ? t : null;
  }

  // Same idea for a title that has no episode number.
  function cleanPlainTitle(s) {
    return cutSiteJunk(s).replace(/\s+online\b.*$/i, '').trim();
  }

  // Removes a trailing " - <site name>" when the page tells us its name (og:site_name).
  function stripTail(title, name) {
    const n = String(name || '').trim();
    if (n.length < 2) return String(title || '');
    return String(title || '').replace(
      new RegExp('(?:\\s*' + SEP + '\\s*|\\s+(?:on|at)\\s+)' + escapeRe(n) + '\\s*$', 'i'), '').trim();
  }

  // input: { host, siteName, pageTitle, ogTitle, h1, showText, episodeText, media }
  function parseInfo(i) {
    i = i || {};
    const host = i.host || '';
    const clean = (raw) => stripSite(stripTail(raw, i.siteName), host);
    let show = null, num = null, name = null;

    // 1. Text taken from specific page elements (site presets).
    if (i.showText) {
      show = String(i.showText).trim();
      if (i.episodeText) {
        const ep = splitEpisodeOnly(i.episodeText);
        if (ep) { num = ep.num; name = ep.name || null; }
        else name = String(i.episodeText).trim();
      }
    }

    // 2. Combined titles (media session, og:title, page title, h1).
    if (!show) {
      const sources = [i.media && i.media.title, i.ogTitle, i.pageTitle, i.h1];
      for (const raw of sources) {
        const t = clean(raw);
        if (!t) continue;
        const m = splitTitle(t);
        if (m && m.show) { show = m.show; num = m.num; name = cleanEpisodeName(m.name); break; }
      }
      if (!show) {
        for (const raw of sources) {
          const t = cleanPlainTitle(clean(raw));
          if (t) { show = t; break; }
        }
      }
    }
    return { show: show || null, num: num || null, name: name || null };
  }

  function okImage(u) {
    return typeof u === 'string' && /^https:\/\//i.test(u) && u.length <= 256;
  }

  // s: { info, video:{t,d,playing}, host, poster, defaultImage }
  function buildActivity(s, now) {
    const host = hostLabel(s.host);
    const info = s.info || {};
    const video = s.video || {};
    const title = info.show || host || 'Watching';
    const details = clamp(info.num ? title + ' · Episode ' + info.num : title) || 'Watching';
    const second = info.name || host || 'BingoRPC';
    const state = clamp(video.playing ? second : 'Paused · ' + second);

    // Poster candidates, best first. The helper checks which one is really public.
    const candidates = [].concat(s.posters || [], s.poster || [])
      .filter((u, i, arr) => okImage(u) && arr.indexOf(u) === i);

    const a = {
      details,
      state,
      largeImageKey: candidates[0] || s.defaultImage,
      imageCandidates: candidates.length ? candidates : undefined,
      largeImageText: clamp(host)
    };
    if (host) {
      a.smallImageKey = 'https://www.google.com/s2/favicons?domain=' + encodeURIComponent(host) + '&sz=64';
      a.smallImageText = clamp(host);
    }
    if (video.playing && isFinite(video.d) && video.d > 0) {
      const t = Math.min(Math.max(video.t || 0, 0), video.d);
      a.startTimestamp = Math.round(now - t * 1000);
      a.endTimestamp = Math.round(a.startTimestamp + video.d * 1000);
    }
    Object.keys(a).forEach((k) => a[k] === undefined && delete a[k]);
    return a;
  }

  // Chrome match pattern ("https://*.example.com/*") -> RegExp
  function patternToRegExp(p) {
    const m = String(p).match(/^(\*|https?):\/\/([^/]+)(\/.*)$/);
    if (!m) return null;
    const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const host = m[2].startsWith('*.') ? '(?:[^/]+\\.)?' + esc(m[2].slice(2)) : esc(m[2]);
    const path = esc(m[3]).replace(/\\\*/g, '.*');
    const scheme = m[1] === '*' ? 'https?' : m[1];
    return new RegExp('^' + scheme + ':\\/\\/' + host + path + '$', 'i');
  }

  function urlAllowed(patterns, url) {
    if (!url) return false;
    return (patterns || []).some((p) => {
      const re = patternToRegExp(p);
      return re ? re.test(url) : false;
    });
  }

  const IP_RE = /^\d{1,3}(?:\.\d{1,3}){3}$/;

  // "www.anime-site.com" -> "https://*.anime-site.com/*" (also covers subdomains).
  // IP addresses and single-word hosts (localhost) must be exact.
  function originPatternForHost(host) {
    const h = String(host || '').toLowerCase().replace(/^www\./, '');
    if (!/^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/.test(h)) return null;
    if (IP_RE.test(h) || !h.includes('.')) return 'https://' + h + '/*';
    return 'https://*.' + h + '/*';
  }

  // What the user typed in "Add a site": "crunchyroll.com", "www.x.com/watch?a=1",
  // "https://x.com/..." -> host name, or null when it is not a web address.
  function hostFromInput(text) {
    let t = String(text || '').trim();
    if (!t) return null;
    if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(t)) t = 'https://' + t;
    try {
      const u = new URL(t);
      if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
      return u.hostname || null;
    } catch (e) {
      return null;
    }
  }

  // "https://*.example.com/*" -> "example.com"
  function labelForOrigin(pattern) {
    const m = String(pattern || '').match(/^https?:\/\/(?:\*\.)?([^/*]+)\/\*$/i);
    return m ? m[1].toLowerCase() : null;
  }

  // Does this page host belong to a saved site label?
  function hostMatchesLabel(host, label) {
    const h = String(host || '').toLowerCase().replace(/^www\./, '');
    return !!label && (h === label || h.endsWith('.' + label));
  }

  const api = { clamp, hostLabel, stripSite, splitEpisodeOnly, splitTitle, parseInfo, buildActivity,
    patternToRegExp, urlAllowed, cleanEpisodeName, cleanPlainTitle,
    originPatternForHost, labelForOrigin, hostMatchesLabel, hostFromInput };
  root.BingoLib = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof self !== 'undefined' ? self : globalThis);
