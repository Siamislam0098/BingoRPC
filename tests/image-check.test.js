// Run with: node tests/image-check.test.js
const assert = require('assert');
const http = require('http');
const { isPublicImage, firstWorking } = require('../native-host/image-check.js');

const seen = [];
const server = http.createServer((req, res) => {
  seen.push({ url: req.url, referer: req.headers.referer || null, cookie: req.headers.cookie || null });
  if (req.url === '/ok.jpg') { res.writeHead(206, { 'Content-Type': 'image/jpeg' }); return res.end('x'); }
  if (req.url === '/blocked.jpg') { res.writeHead(403, { 'Content-Type': 'text/html' }); return res.end('no'); }
  if (req.url === '/page.html') { res.writeHead(200, { 'Content-Type': 'text/html' }); return res.end('<html>'); }
  if (req.url === '/redirect.jpg') { res.writeHead(302, { Location: '/ok.jpg' }); return res.end(); }
  if (req.url === '/loop.jpg') { res.writeHead(302, { Location: '/loop.jpg' }); return res.end(); }
  if (req.url === '/hang.jpg') return;   // never answers
  res.writeHead(404); res.end();
});

server.listen(0, '127.0.0.1', async () => {
  const base = 'http://127.0.0.1:' + server.address().port;
  try {
    assert.strictEqual(await isPublicImage(base + '/ok.jpg'), true, 'public image');
    assert.strictEqual(await isPublicImage(base + '/blocked.jpg'), false, '403 is rejected');
    assert.strictEqual(await isPublicImage(base + '/page.html'), false, 'html is not an image');
    assert.strictEqual(await isPublicImage(base + '/missing.jpg'), false, '404 is rejected');
    assert.strictEqual(await isPublicImage(base + '/redirect.jpg'), true, 'redirect is followed');
    assert.strictEqual(await isPublicImage(base + '/loop.jpg'), false, 'redirect loop gives up');
    assert.strictEqual(await isPublicImage('not a url'), false, 'bad url');
    assert.strictEqual(await isPublicImage('file:///etc/passwd'), false, 'non-http is rejected');

    // No cookies or Referer are sent (Discord's proxy sends none).
    assert.ok(seen.every((r) => r.referer === null && r.cookie === null), 'no referer/cookie');

    // First working candidate wins, in order.
    assert.strictEqual(await firstWorking([base + '/blocked.jpg', base + '/ok.jpg', base + '/redirect.jpg']), base + '/ok.jpg');
    assert.strictEqual(await firstWorking([base + '/blocked.jpg', base + '/page.html']), null);
    assert.strictEqual(await firstWorking([]), null);

    // A server that never answers must time out (about 4s), not hang.
    const t0 = Date.now();
    assert.strictEqual(await isPublicImage(base + '/hang.jpg'), false, 'timeout');
    const took = Date.now() - t0;
    assert.ok(took >= 3500 && took < 6000, 'timeout took ' + took + 'ms');

    // Results are cached: a second call makes no new request.
    const before = seen.length;
    await isPublicImage(base + '/ok.jpg');
    assert.strictEqual(seen.length, before, 'cached');

    console.log('Image checker tests passed');
  } catch (e) {
    console.error('FAILED:', e.message);
    process.exitCode = 1;
  } finally {
    server.closeAllConnections && server.closeAllConnections();
    server.close();
  }
});
