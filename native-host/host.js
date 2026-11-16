'use strict';
// BingoRPC native helper.
// The browser starts this program. It talks to the extension over stdin/stdout
// (4-byte length + JSON) and to Discord over Discord's local connection.
// NEVER write logs to stdout: stdout is the message channel. Logs go to host.log.

const fs = require('fs');
const path = require('path');
const { Client } = require('@xhayper/discord-rpc');
const { firstWorking } = require('./image-check');

const HOST_VERSION = '0.3.0';

// Folder that holds config.json and host.log.
// Normal run: this folder. Packaged .exe: the folder the .exe sits in.
let BASE = __dirname;
try {
  if (require('node:sea').isSea()) BASE = path.dirname(process.execPath);
} catch (e) { /* not packaged */ }
const LOG_FILE = path.join(BASE, 'host.log');
const RETRY_MS = 10000;

function log(...args) {
  try {
    if (fs.existsSync(LOG_FILE) && fs.statSync(LOG_FILE).size > 1e6) fs.truncateSync(LOG_FILE, 0);
    fs.appendFileSync(LOG_FILE, new Date().toISOString() + ' ' + args.join(' ') + '\n');
  } catch (e) { /* ignore */ }
}

let config = {};
try {
  config = JSON.parse(fs.readFileSync(path.join(BASE, 'config.json'), 'utf8'));
} catch (e) {
  log('Could not read config.json:', e.message);
}
const CLIENT_ID = String(config.clientId || '').trim();
const CLIENT_ID_OK = /^\d{15,25}$/.test(CLIENT_ID);
const DEFAULT_IMAGE = config.defaultImage || 'default';

function send(obj) {
  try {
    const body = Buffer.from(JSON.stringify(obj), 'utf8');
    const len = Buffer.alloc(4);
    len.writeUInt32LE(body.length, 0);
    process.stdout.write(Buffer.concat([len, body]));
  } catch (e) {
    log('send failed:', e.message);
  }
}

let rpc = null;
let ready = false;
let connecting = false;
let retryTimer = null;
let pending = null;   // newest activity waiting for Discord to be ready

function scheduleRetry() {
  if (retryTimer) return;
  retryTimer = setTimeout(() => { retryTimer = null; connect(); }, RETRY_MS);
}

function onReady() {
  if (ready) return;
  ready = true;
  connecting = false;
  const u = rpc && rpc.user;
  log('Discord ready', u ? u.username : '');
  send({ type: 'RPC_STATUS', status: 'connected', user: u ? u.username : null });
  if (pending) {
    const data = pending;
    pending = null;
    applyActivity(data);
  }
}

async function connect() {
  if (ready || connecting) return;
  if (!CLIENT_ID_OK) {
    send({ type: 'RPC_ERROR', message: 'Helper has no valid Discord Application ID (config.json).' });
    return;
  }
  connecting = true;
  if (rpc) { try { await rpc.destroy(); } catch (e) { /* ignore */ } }
  rpc = new Client({ clientId: CLIENT_ID });
  rpc.on('ready', onReady);
  rpc.on('disconnected', () => {
    log('Discord disconnected');
    ready = false;
    connecting = false;
    send({ type: 'RPC_STATUS', status: 'disconnected' });
    scheduleRetry();
  });
  try {
    await rpc.login();
    onReady();
  } catch (e) {
    connecting = false;
    ready = false;
    log('Discord login failed:', e.message);
    send({ type: 'RPC_ERROR', message: 'Could not reach Discord. Is the desktop app open? (' + e.message + ')' });
    send({ type: 'RPC_STATUS', status: 'disconnected' });
    scheduleRetry();
  }
}

const FIELDS = ['details', 'state', 'startTimestamp', 'endTimestamp',
  'largeImageKey', 'largeImageText', 'smallImageKey', 'smallImageText'];

let applySeq = 0;
const IMAGE_WAIT_MS = 2500;

async function pushActivity(data, image) {
  if (!ready || !rpc || !rpc.user) return;
  const a = {};
  for (const k of FIELDS) if (data[k] !== undefined) a[k] = data[k];
  a.largeImageKey = image;
  a.instance = false;
  // 0 = Playing (shows "time left"), 2 = Listening, 3 = Watching
  if (Number.isInteger(config.activityType) && config.activityType !== 0) a.type = config.activityType;

  try {
    await rpc.user.setActivity(a);
    send({ type: 'ACTIVITY_STATUS', ok: true, image });
  } catch (e) {
    log('setActivity failed:', e.message, '- retrying with default image');
    try {
      const b = Object.assign({}, a, { largeImageKey: DEFAULT_IMAGE });
      delete b.smallImageKey;
      delete b.smallImageText;
      await rpc.user.setActivity(b);
      send({ type: 'ACTIVITY_STATUS', ok: true, image: DEFAULT_IMAGE, message: 'Used default image' });
    } catch (e2) {
      log('setActivity retry failed:', e2.message);
      send({ type: 'ACTIVITY_STATUS', ok: false, message: e2.message });
    }
  }
}

async function applyActivity(data) {
  if (!ready || !rpc || !rpc.user) { pending = data; return; }
  const seq = ++applySeq;
  const candidates = Array.isArray(data.imageCandidates) ? data.imageCandidates.slice(0, 3) : [];
  let image = DEFAULT_IMAGE;

  if (candidates.length) {
    // Discord shows nothing (and gives no error) for an image it cannot fetch,
    // so check that the image is public before sending it.
    const check = firstWorking(candidates).catch(() => null);
    const quick = await Promise.race([check, new Promise((r) => setTimeout(() => r('__slow__'), IMAGE_WAIT_MS))]);
    if (quick === '__slow__') {
      // Show the default image now; swap in the real poster if the check succeeds later.
      check.then((url) => { if (url && seq === applySeq) pushActivity(data, url); });
    } else if (quick) {
      image = quick;
    } else {
      log('No public poster found among:', candidates.join(' | '));
    }
  }
  if (seq !== applySeq) return;   // a newer update arrived while checking
  await pushActivity(data, image);
}

async function clearActivity() {
  pending = null;
  if (!ready || !rpc || !rpc.user) return;
  try {
    if (typeof rpc.user.clearActivity === 'function') await rpc.user.clearActivity();
    else await rpc.user.setActivity({});
  } catch (e) {
    log('clearActivity failed:', e.message);
  }
}

function handleMessage(msg) {
  switch (msg && msg.type) {
    case 'SET_ACTIVITY':
      if (msg.data) { pending = ready ? null : msg.data; if (ready) applyActivity(msg.data); else connect(); }
      break;
    case 'CLEAR_ACTIVITY':
      clearActivity();
      break;
    case 'RECONNECT':
      ready = false; connecting = false;
      connect();
      break;
    default:
      log('Unknown message type:', msg && msg.type);
  }
}

// ---- Native messaging input (4-byte little-endian length + JSON) ----
let input = Buffer.alloc(0);
process.stdin.on('data', (chunk) => {
  input = Buffer.concat([input, chunk]);
  while (input.length >= 4) {
    const len = input.readUInt32LE(0);
    if (input.length < 4 + len) break;
    const json = input.toString('utf8', 4, 4 + len);
    input = input.subarray(4 + len);
    try {
      handleMessage(JSON.parse(json));
    } catch (e) {
      log('Bad message:', e.message);
    }
  }
});

function shutdown() {
  const done = () => process.exit(0);
  if (rpc) rpc.destroy().then(done, done); else done();
}
process.stdin.on('end', shutdown);
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
process.on('uncaughtException', (e) => { log('uncaughtException:', e.stack || e.message); process.exit(1); });
process.on('unhandledRejection', (e) => { log('unhandledRejection:', e && (e.stack || e.message)); });

send({ type: 'HOST_STARTED', version: HOST_VERSION });
connect();
