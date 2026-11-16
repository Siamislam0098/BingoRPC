// Page text is untrusted: always use textContent, never innerHTML.
const $ = (id) => document.getElementById(id);
let last = null;
// Where users download the helper installer. Change Siamislam0098 once.
const RELEASES_URL = 'https://github.com/Siamislam0098/BingoRPC/releases/latest';
let addPattern = null;     // pattern the "Add this site" button will request

function setText(id, text, cls) {
  const el = $(id);
  el.textContent = text;
  el.className = 'value' + (cls ? ' ' + cls : '');
}

function fmt(sec) {
  sec = Math.max(0, Math.floor(sec || 0));
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  const mm = h ? String(m).padStart(2, '0') : String(m);
  return (h ? h + ':' : '') + mm + ':' + String(s).padStart(2, '0');
}

// The popup refreshes every second. Rebuilding buttons every second would eat
// clicks, so a list is only rebuilt when its content really changed.
const signatures = {};
function rebuild(boxId, signature, build) {
  if (signatures[boxId] === signature) return;
  signatures[boxId] = signature;
  const box = $(boxId);
  box.textContent = '';
  build(box);
}

function makeButton(text, onClick, cls) {
  const b = document.createElement('button');
  b.textContent = text;
  b.className = cls || '';
  b.addEventListener('click', onClick);
  return b;
}

// Must run straight from a click. The browser shows its own permission prompt.
function requestOrigin(pattern) {
  if (!pattern) return;
  chrome.permissions.request({ origins: [pattern] }, () => {
    void chrome.runtime.lastError;
    setTimeout(poll, 700);
  });
}

function render(data) {
  last = data;
  const s = data.status;

  if (s.host === 'connected') setText('host', 'Connected', 'ok');
  else if (s.host === 'starting') setText('host', 'Starting...', 'warn');
  else if (s.host === 'missing') setText('host', 'Not installed / not running', 'bad');
  else setText('host', 'Unknown', 'warn');

  $('helperHelp').hidden = s.host !== 'missing';

  if (s.discord === 'connected') setText('discord', 'Connected' + (s.discordUser ? ' as ' + s.discordUser : ''), 'ok');
  else if (s.discord === 'disconnected') setText('discord', 'Not connected', 'bad');
  else setText('discord', 'Unknown', 'warn');

  const d = data.debug;
  setText('frame', d && d.frameHost ? d.frameHost : 'none');

  if (!s.image) setText('poster', '-');
  else if (/^https?:/i.test(s.image)) {
    let h = s.image;
    try { h = new URL(s.image).hostname; } catch (e) { /* keep raw */ }
    setText('poster', 'Web image (' + h + ')', 'ok');
  } else setText('poster', 'Default image', 'warn');

  const a = data.activity;
  $('details').textContent = a ? a.details : 'Nothing playing';
  $('state').textContent = a ? a.state : '';
  if (d && d.video) {
    $('time').textContent = (d.video.playing ? 'Playing ' : 'Paused ') +
      fmt(d.video.t) + ' / ' + fmt(d.video.d);
  } else {
    $('time').textContent = '';
  }

  const err = s.host === 'missing' ? s.hostError : s.lastError;
  $('error').textContent = err || '';
}

async function hasOrigin(pattern) {
  try { return await chrome.permissions.contains({ origins: [pattern] }); } catch (e) { return false; }
}

async function renderTab(tab, info) {
  let host = null, isHttps = false, readable = false;
  try { const u = new URL(tab && tab.url); host = u.hostname; isHttps = u.protocol === 'https:'; readable = true; } catch (e) { /* ignore */ }
  if (last) { last.tabUrlHost = host; last.tabUrlReadable = readable; }

  if (readable) setText('tabSite', host || 'unknown');
  else setText('tabSite', 'cannot read address', 'warn');
  const pattern = isHttps ? BingoLib.originPatternForHost(host) : null;
  const allowed = pattern ? await hasOrigin(pattern) : false;
  addPattern = pattern;

  if (!readable) setText('tabAllowed', 'Unknown', 'warn');
  else if (!pattern) setText('tabAllowed', 'Not supported', 'warn');
  else setText('tabAllowed', allowed ? 'Yes' : 'No', allowed ? 'ok' : 'bad');

  const running = !!(info && info.running);
  setText('tabRunning', running ? 'Yes' : 'No', running ? 'ok' : (allowed ? 'warn' : 'bad'));

  const frames = (info && info.frames) || [];
  const withVideo = frames.filter((f) => f.videoCount > 0);
  const playable = withVideo.filter((f) => (f.videos || []).some((v) => v.d && v.d >= 60));
  if (playable.length) setText('tabVideo', 'Yes (' + playable[0].frameHost + ')', 'ok');
  else if (withVideo.length) setText('tabVideo', 'Found, but too short / not loaded', 'warn');
  else setText('tabVideo', 'No', running ? 'warn' : 'bad');

  // Player domains: iframes on the page that we are not allowed to run in yet.
  const candidates = ((info && info.iframes) || [])
    .filter((i) => i && i.host && i.host !== host)
    .map((i) => ({ host: i.host, fs: !!i.fs, pattern: BingoLib.originPatternForHost(i.host) }))
    .filter((i) => i.pattern);
  const checked = await Promise.all(candidates.map(async (i) => Object.assign(i, { ok: await hasOrigin(i.pattern) })));
  const missing = checked.filter((i) => !i.ok)
    .sort((a, b) => Number(b.fs) - Number(a.fs))
    .slice(0, 8);

  $('playersTitle').hidden = missing.length === 0;
  rebuild('players', JSON.stringify(missing.map((m) => [m.host, m.fs])), (box) => {
    missing.forEach((m) => {
      const row = document.createElement('div');
      row.className = 'item';
      const name = document.createElement('span');
      name.className = 'name';
      name.textContent = m.host + (m.fs ? ' (likely player)' : '');
      row.appendChild(name);
      row.appendChild(makeButton('Allow', () => requestOrigin(m.pattern), 'small'));
      box.appendChild(row);
    });
  });

  $('addSite').hidden = !(pattern && !allowed);

  let note = '';
  if (!readable) {
    note = 'BingoRPC cannot read this tab\'s address. That is normal on new-tab and edge:// pages. ' +
      'On a streaming page it means the browser did not give access: reopen the popup from the page, ' +
      'or type the site in "Add a site" below.';
  } else if (!pattern) {
    note = 'BingoRPC only works on https:// pages.';
  } else if (!allowed) {
    note = 'This site is not added yet. Click "Add this site" so BingoRPC can read its video.';
  } else if (info && info.disabled) {
    note = 'This site is switched off in the Sites list below.';
  } else if (!running) {
    note = 'Site is added but the script is not running here. Reload this page (F5).';
  } else if (!withVideo.length) {
    note = missing.length
      ? 'No video found. The player is probably in another domain. Allow it below, then press play.'
      : 'No video found yet. Press play and wait a few seconds.';
  }
  $('tabNote').textContent = note;

  const box = $('tabFrames');
  box.textContent = '';
  frames.forEach((f) => {
    const line = document.createElement('div');
    line.textContent = (f.isTop ? 'page: ' : 'frame: ') + f.frameHost + ' - ' + f.videoCount + ' video(s)';
    box.appendChild(line);
  });
}

async function renderSites() {
  let origins = [];
  try { origins = ((await chrome.permissions.getAll()).origins || []); } catch (e) { /* ignore */ }
  let off = [];
  try { off = (await chrome.storage.local.get('disabledSites')).disabledSites || []; } catch (e) { /* ignore */ }

  const items = origins
    .map((origin) => ({ origin, label: BingoLib.labelForOrigin(origin) }))
    .filter((x) => x.label)
    .sort((a, b) => a.label.localeCompare(b.label));

  rebuild('sites', JSON.stringify(items.map((x) => [x.origin, off.includes(x.label)])), (box) => {
    if (!items.length) {
      const hint = document.createElement('div');
      hint.className = 'hint';
      hint.textContent = 'No sites yet. Open a streaming site and click "Add this site".';
      box.appendChild(hint);
      return;
    }
    items.forEach((x) => {
      const row = document.createElement('div');
      row.className = 'item' + (off.includes(x.label) ? ' off' : '');

      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = !off.includes(x.label);
      cb.title = 'Show activity from this site on Discord';
      cb.addEventListener('change', async () => {
        const cur = (await chrome.storage.local.get('disabledSites')).disabledSites || [];
        const next = cb.checked ? cur.filter((l) => l !== x.label)
          : cur.filter((l) => l !== x.label).concat(x.label);
        await chrome.storage.local.set({ disabledSites: next });
        poll();
      });

      const name = document.createElement('span');
      name.className = 'name';
      name.textContent = x.label;

      row.appendChild(cb);
      row.appendChild(name);
      row.appendChild(makeButton('Remove', () => {
        chrome.permissions.remove({ origins: [x.origin] }, () => { void chrome.runtime.lastError; poll(); });
      }, 'small ghost'));
      box.appendChild(row);
    });
  });
}

function poll() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs && tabs[0];
    chrome.runtime.sendMessage({ type: 'GET_STATUS', tabId: tab ? tab.id : null }, async (res) => {
      if (chrome.runtime.lastError || !res) return;
      render(res);
      await renderTab(tab, res.tab);
      await renderSites();
    });
  });
}

$('getHelper').addEventListener('click', () => chrome.tabs.create({ url: RELEASES_URL }));
$('addSite').addEventListener('click', () => requestOrigin(addPattern));

// Add a site by typing it. Works even when the tab's address cannot be read.
function addTypedSite() {
  const host = BingoLib.hostFromInput($('siteInput').value);
  const pattern = host ? BingoLib.originPatternForHost(host) : null;
  if (!pattern) {
    $('siteMsg').textContent = 'That is not a valid site. Example: crunchyroll.com';
    return;
  }
  $('siteMsg').textContent = '';
  $('siteInput').value = '';
  requestOrigin(pattern);   // straight from the click/Enter, so the browser allows the prompt
}
$('siteAdd').addEventListener('click', addTypedSite);
$('siteInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') addTypedSite(); });

$('copy').addEventListener('click', async () => {
  if (!last) return;
  try {
    await navigator.clipboard.writeText(JSON.stringify(last, null, 2));
    $('copy').textContent = 'Copied';
    setTimeout(() => { $('copy').textContent = 'Copy debug info'; }, 1500);
  } catch (e) {
    $('error').textContent = 'Could not copy: ' + e.message;
  }
});

poll();
setInterval(poll, 1000);
