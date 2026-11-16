// Service worker. Joins video + page info per tab, builds the Discord
// activity and sends it to the native helper. Also keeps the page script
// registered for exactly the sites the user has allowed.
importScripts('lib.js');

const HOST_NAME = 'com.bingorpc.host';
const SCRIPT_ID = 'bingorpc-content';
const DEFAULT_IMAGE = 'default';          // asset name in the Discord Developer Portal
const STALE_MS = 20000;                   // no video message for this long = tab is gone
const PAUSE_CLEAR_MS = 10 * 60 * 1000;    // clear the status after 10 min of pause
const MIN_SEND_GAP_MS = 3000;             // Discord limits how fast we may update

const tabs = new Map();   // tabId -> { video, media, frameHost, videoAt, meta, pausedSince, frames, tabHost, disabled }
let port = null;
let lastSent = null;
let lastSentAt = 0;
let lastKey = '';
let timer = null;

const status = {
  host: 'unknown',          // unknown | starting | connected | missing
  hostError: null,
  discord: 'unknown',       // unknown | connected | disconnected
  discordUser: null,
  lastError: null
};

// ---------- Sites the user switched off (saved in storage) ----------

let disabledSites = [];
const settingsReady = chrome.storage.local.get('disabledSites')
  .then((r) => { disabledSites = r.disabledSites || []; })
  .catch(() => {});

function hostOf(url) {
  try { return new URL(url).hostname; } catch (e) { return null; }
}

function isDisabledHost(host) {
  return !!host && disabledSites.some((label) => BingoLib.hostMatchesLabel(host, label));
}

// A tab is off if its page host OR the host of its video frame is switched off.
function isDisabledTab(t) {
  return isDisabledHost(t.tabHost) || isDisabledHost(t.frameHost);
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local' || !changes.disabledSites) return;
  disabledSites = changes.disabledSites.newValue || [];
  for (const t of tabs.values()) t.disabled = isDisabledTab(t);
  lastKey = '';
  schedule();
});

// ---------- Registering the page script for allowed sites ----------
// The user grants access per site in the popup (optional host permissions).
// The page script is registered for exactly the origins that are granted.

let syncChain = Promise.resolve();

function syncScripts() {
  syncChain = syncChain.then(doSync).catch((e) => {
    status.lastError = 'Could not update site scripts: ' + e.message;
  });
  return syncChain;
}

async function grantedOrigins() {
  const all = await chrome.permissions.getAll();
  return (all.origins || []).filter((o) => /^https?:\/\//i.test(o));
}

async function doSync() {
  const matches = await grantedOrigins();
  const existing = await chrome.scripting.getRegisteredContentScripts({ ids: [SCRIPT_ID] });
  if (!matches.length) {
    if (existing.length) await chrome.scripting.unregisterContentScripts({ ids: [SCRIPT_ID] });
    return;
  }
  const def = {
    id: SCRIPT_ID,
    matches,
    js: ['content.js'],
    allFrames: true,
    runAt: 'document_idle',
    persistAcrossSessions: true
  };
  if (existing.length) await chrome.scripting.updateContentScripts([def]);
  else await chrome.scripting.registerContentScripts([def]);
}

// Registered scripts only run on pages loaded AFTER the change, so also
// inject into tabs that are already open (this is what makes "Allow" instant).
async function injectIntoOpenTabs(origins) {
  const ids = new Set(tabs.keys());
  if (origins.length) {
    try {
      (await chrome.tabs.query({ url: origins })).forEach((t) => ids.add(t.id));
    } catch (e) { /* ignore */ }
  }
  for (const tabId of ids) {
    chrome.scripting.executeScript({ target: { tabId, allFrames: true }, files: ['content.js'] })
      .catch(() => { /* no access to this tab, or it is gone */ });
  }
}

chrome.runtime.onInstalled.addListener(() => { syncScripts(); });
chrome.runtime.onStartup.addListener(() => { syncScripts(); });
chrome.permissions.onAdded.addListener((p) => {
  syncScripts().then(() => injectIntoOpenTabs((p && p.origins) || []));
});
chrome.permissions.onRemoved.addListener(() => { syncScripts(); });
syncScripts();

// ---------- Native helper connection ----------

function connectHost() {
  if (port) return;
  try {
    port = chrome.runtime.connectNative(HOST_NAME);
  } catch (e) {
    port = null;
    status.host = 'missing';
    status.hostError = e.message;
    return;
  }
  status.host = 'starting';
  status.hostError = null;
  port.onMessage.addListener(onHostMessage);
  port.onDisconnect.addListener(() => {
    const err = chrome.runtime.lastError;
    port = null;
    status.host = 'missing';
    status.hostError = err ? err.message : 'Helper app closed';
    status.discord = 'unknown';
    status.discordUser = null;
    lastKey = '';
  });
}

function onHostMessage(msg) {
  if (!msg) return;
  if (msg.type === 'HOST_STARTED') {
    status.host = 'connected';
  } else if (msg.type === 'RPC_STATUS') {
    status.discord = msg.status === 'connected' ? 'connected' : 'disconnected';
    status.discordUser = msg.user || null;
    if (msg.status === 'connected') { lastKey = ''; schedule(); }
  } else if (msg.type === 'RPC_ERROR') {
    status.lastError = msg.message || 'Discord error';
  } else if (msg.type === 'ACTIVITY_STATUS') {
    status.lastError = msg.ok ? null : (msg.message || 'Activity failed');
    if (msg.image !== undefined) status.image = msg.image;   // which poster was really sent
  }
}

function sendToHost(message, key) {
  connectHost();
  if (!port) return;
  try {
    port.postMessage(message);
    lastKey = key;
    lastSentAt = Date.now();
  } catch (e) {
    status.lastError = e.message;
  }
}

// ---------- Choosing what to show ----------
// Discord shows ONE activity per app, so with several tabs playing at once
// the one that is playing and was updated most recently wins.

function pickTab(now) {
  let best = null;
  for (const t of tabs.values()) {
    if (t.disabled) continue;
    if (!t.video || now - t.videoAt > STALE_MS) continue;
    if (!t.video.playing && t.pausedSince && now - t.pausedSince > PAUSE_CLEAR_MS) continue;
    if (!best) { best = t; continue; }
    const a = t.video.playing ? 1 : 0;
    const b = best.video.playing ? 1 : 0;
    if (a > b || (a === b && t.videoAt > best.videoAt)) best = t;
  }
  return best;
}

function update() {
  timer = null;
  const now = Date.now();
  const best = pickTab(now);

  if (!best) {
    if (lastKey !== 'CLEAR') sendToHost({ type: 'CLEAR_ACTIVITY' }, 'CLEAR');
    lastSent = null;
    return;
  }

  const meta = best.meta || {};
  const media = best.media || null;
  const info = BingoLib.parseInfo({
    host: meta.host || best.frameHost,
    siteName: meta.siteName,
    pageTitle: meta.pageTitle,
    ogTitle: meta.ogTitle,
    h1: meta.h1,
    showText: meta.showText,
    episodeText: meta.episodeText,
    media
  });
  const activity = BingoLib.buildActivity({
    info,
    video: best.video,
    host: meta.host || best.frameHost,
    // Page og:image first (made for link previews, usually public), then the player's artwork.
    posters: [meta.ogImage, media && media.artwork],
    defaultImage: DEFAULT_IMAGE
  }, now);

  const key = JSON.stringify([activity.details, activity.state, activity.largeImageKey, !!activity.endTimestamp]);
  const drift = (activity.startTimestamp && lastSent && lastSent.startTimestamp)
    ? Math.abs(activity.startTimestamp - lastSent.startTimestamp) : 0;

  if (key !== lastKey || drift > 3000) {
    sendToHost({ type: 'SET_ACTIVITY', data: activity }, key);
    lastSent = activity;
  }
}

function schedule() {
  if (timer) return;
  const wait = Math.max(300, lastSentAt + MIN_SEND_GAP_MS - Date.now());
  timer = setTimeout(update, wait);
}

// ---------- Info for the popup ----------

// What the page scripts of one tab have reported (for the popup diagnostics).
function tabInfo(id) {
  const t = tabs.get(id);
  const now = Date.now();
  if (!t || !t.frames) return { running: false, disabled: !!(t && t.disabled), frames: [], iframes: [] };

  const live = Object.values(t.frames).filter((f) => now - f.at < 30000);
  const frames = live.map((f) => ({
    frameHost: f.frameHost, isTop: f.isTop, videoCount: f.videoCount, videos: f.videos
  }));

  // iframe hosts seen in ANY of our frames (players can be nested), minus hosts we already run in
  const seen = new Map();
  for (const f of live) {
    for (const i of f.iframes || []) {
      const prev = seen.get(i.host);
      seen.set(i.host, { host: i.host, fs: !!(prev && prev.fs) || !!i.fs });
    }
  }
  const running = new Set(live.map((f) => f.frameHost));
  const iframes = Array.from(seen.values()).filter((i) => !running.has(i.host));

  return { running: live.length > 0, disabled: !!t.disabled, frames, iframes };
}

function snapshot(tabId) {
  const now = Date.now();
  const t = (tabId != null && tabs.get(tabId)) || pickTab(now);
  return {
    status,
    activity: lastSent,
    tab: tabId != null ? tabInfo(tabId) : null,
    debug: t ? {
      frameHost: t.frameHost || null,
      pageHost: (t.meta && t.meta.host) || null,
      meta: t.meta || null,
      media: t.media || null,
      video: t.video || null
    } : null
  };
}

function handleTabMessage(msg, sender) {
  const id = sender.tab.id;
  const t = tabs.get(id) || {};
  t.tabHost = hostOf(sender.tab.url) || t.tabHost || null;

  if (msg.type === 'VIDEO') {
    if (msg.video.playing) t.pausedSince = null;
    else if (!t.video || t.video.playing || !t.pausedSince) t.pausedSince = Date.now();
    t.video = msg.video;
    t.media = msg.media;
    t.frameHost = msg.frameHost;
    t.videoAt = Date.now();
  } else if (msg.type === 'META') {
    t.meta = msg.meta;
  } else if (msg.type === 'FRAME') {
    t.frames = t.frames || {};
    t.frames[sender.frameId || 0] = Object.assign({}, msg.frame, { at: Date.now() });
  } else {
    return;
  }
  t.disabled = isDisabledTab(t);
  tabs.set(id, t);
  connectHost();
  schedule();
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.type === 'GET_STATUS') {
    connectHost();
    sendResponse(snapshot(msg.tabId));
    return;
  }
  if (!msg || !sender.tab) return;
  settingsReady.then(() => handleTabMessage(msg, sender));
});

chrome.tabs.onRemoved.addListener((id) => {
  tabs.delete(id);
  schedule();
});
