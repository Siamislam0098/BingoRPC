// Runs in EVERY frame of the matched sites (all_frames: true).
// - The frame that holds the <video> reports time, length and play/pause.
// - The top frame reports page info (title, show/episode text, poster).
// The background script joins both by tab.
(() => {
  if (window.__bingoRpcLoaded) return;
  window.__bingoRpcLoaded = true;

  const MIN_DURATION = 60;      // ignore tiny videos (previews, ads)
  const HEARTBEAT_MS = 5000;    // resend even if nothing changed
  const isTop = window === window.top;
  const hooked = new WeakSet();

  // Selectors for show / episode text, per site.
  // These are GUESSES for Crunchyroll. Check them in DevTools and fix if needed.
  const PRESETS = {
    'crunchyroll.com': {
      show: ['a.show-title-link h4', 'a.show-title-link', '[data-t="show-title-link"]'],
      episode: ['h1.title', 'h1']
    }
  };

  function safeSend(msg) {
    try {
      if (chrome.runtime && chrome.runtime.id) {
        const p = chrome.runtime.sendMessage(msg);
        if (p && p.catch) p.catch(() => {});
      }
    } catch (e) { /* extension was reloaded; ignore */ }
  }

  function area(a) {
    const m = String((a && a.sizes) || '').match(/(\d+)x(\d+)/);
    return m ? Number(m[1]) * Number(m[2]) : 0;
  }

  function readMedia() {
    try {
      const m = navigator.mediaSession && navigator.mediaSession.metadata;
      if (!m) return null;
      const art = Array.from(m.artwork || []).sort((a, b) => area(b) - area(a))[0];
      let artwork = null;
      if (art && art.src) {
        try { artwork = new URL(art.src, location.href).href; } catch (e) { /* ignore */ }
      }
      return { title: m.title || null, artist: m.artist || null, album: m.album || null, artwork };
    } catch (e) {
      return null;
    }
  }

  // Finds <video> elements, including inside open shadow roots.
  function findVideos(root) {
    const out = [];
    const walk = (node) => {
      node.querySelectorAll('video').forEach((v) => out.push(v));
      node.querySelectorAll('*').forEach((el) => { if (el.shadowRoot) walk(el.shadowRoot); });
    };
    try { walk(root); } catch (e) { /* ignore */ }
    return out;
  }

  // What this frame can see. Used by the popup to explain why nothing is detected.
  function readFrame() {
    const all = findVideos(document);
    const frame = {
      frameHost: location.hostname,
      isTop,
      videoCount: all.length,
      videos: all.slice(0, 3).map((v) => ({
        d: isFinite(v.duration) ? Math.round(v.duration) : null,
        ready: v.readyState,
        paused: v.paused
      }))
    };
    // Frames inside this frame (every frame reports them, so nested players are found too).
    // fs = the frame asks for fullscreen/autoplay, which video players almost always do.
    const seen = new Set();
    const iframes = [];
    document.querySelectorAll('iframe').forEach((f) => {
      try {
        const u = new URL(f.src, location.href);
        // Skip frames injected by other browser extensions (chrome-extension:, edge-extension:, ...).
        if (u.protocol !== 'https:' && u.protocol !== 'http:') return;
        if (u.hostname === location.hostname || seen.has(u.hostname)) return;
        seen.add(u.hostname);
        iframes.push({
          host: u.hostname,
          fs: f.hasAttribute('allowfullscreen') || /fullscreen|autoplay/i.test(f.getAttribute('allow') || '')
        });
      } catch (e) { /* no src */ }
    });
    frame.iframes = iframes.slice(0, 10);
    return frame;
  }

  function pickVideo() {
    const vids = findVideos(document)
      .filter((v) => isFinite(v.duration) && v.duration >= MIN_DURATION);
    if (!vids.length) return null;
    const playing = vids.find((v) => !v.paused && !v.ended);
    if (playing) return playing;
    return vids.sort((a, b) => (b.videoWidth * b.videoHeight) - (a.videoWidth * a.videoHeight))[0];
  }

  function sendVideo() {
    const v = pickVideo();
    if (!v) return;
    hook(v);
    safeSend({
      type: 'VIDEO',
      frameHost: location.hostname,
      media: readMedia(),
      video: { t: v.currentTime, d: v.duration, playing: !v.paused && !v.ended }
    });
  }

  function hook(v) {
    if (hooked.has(v)) return;
    hooked.add(v);
    ['play', 'playing', 'pause', 'seeked', 'ended', 'durationchange', 'loadedmetadata']
      .forEach((ev) => v.addEventListener(ev, sendVideo));
  }

  function firstText(selectors) {
    for (const sel of selectors || []) {
      try {
        const el = document.querySelector(sel);
        const t = el && (el.textContent || '').trim();
        if (t) return t.slice(0, 200);
      } catch (e) { /* bad selector */ }
    }
    return null;
  }

  function currentPreset() {
    const h = location.hostname.replace(/^www\./, '');
    for (const k of Object.keys(PRESETS)) {
      if (h === k || h.endsWith('.' + k)) return PRESETS[k];
    }
    return null;
  }

  function readMeta() {
    const p = currentPreset();
    const og = (name) => {
      const el = document.querySelector('meta[property="' + name + '"]');
      return el && el.content ? el.content : null;
    };
    const h1 = document.querySelector('h1');
    return {
      host: location.hostname,            // domain only, never the full address
      pageTitle: document.title || null,
      ogTitle: og('og:title'),
      ogImage: og('og:image'),
      siteName: og('og:site_name'),
      h1: h1 ? (h1.textContent || '').trim().slice(0, 200) : null,
      showText: p ? firstText(p.show) : null,
      episodeText: p ? firstText(p.episode) : null
    };
  }

  let lastMetaJson = '';
  let lastBeat = 0;

  function tick() {
    const v = pickVideo();
    if (v) hook(v);
    const now = Date.now();
    const beat = now - lastBeat >= HEARTBEAT_MS;

    if (v && beat) sendVideo();
    if (beat) safeSend({ type: 'FRAME', frame: readFrame() });

    if (isTop) {
      const meta = readMeta();
      const json = JSON.stringify(meta);
      if (json !== lastMetaJson || beat) {
        lastMetaJson = json;
        safeSend({ type: 'META', meta });
      }
    }
    if (beat) lastBeat = now;
  }

  setInterval(tick, 1000);
  tick();
})();
