'use strict';
// Builds dist/BingoRPC-host(.exe): one file that runs without Node installed.
// Steps: bundle host.js -> make a Node "single executable" blob -> inject it into a copy of node.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const dist = path.join(__dirname, 'dist');
fs.mkdirSync(dist, { recursive: true });
const isWin = process.platform === 'win32';
const out = path.join(dist, isWin ? 'BingoRPC-host.exe' : 'BingoRPC-host');
const npx = isWin ? 'npx.cmd' : 'npx';
const run = (cmd, args) => execFileSync(cmd, args, { stdio: 'inherit', cwd: __dirname, shell: isWin });

run(npx, ['esbuild', 'host.js', '--bundle', '--platform=node', '--target=node22',
  '--external:bufferutil', '--external:utf-8-validate', '--outfile=dist/host.cjs']);

fs.writeFileSync(path.join(dist, 'sea-config.json'), JSON.stringify({
  main: path.join(dist, 'host.cjs'),
  output: path.join(dist, 'sea-prep.blob'),
  disableExperimentalSEAWarning: true
}));
run(process.execPath, ['--experimental-sea-config', path.join(dist, 'sea-config.json')]);

fs.copyFileSync(process.execPath, out);
if (!isWin) fs.chmodSync(out, 0o755);
const args = [out, 'NODE_SEA_BLOB', path.join(dist, 'sea-prep.blob'),
  '--sentinel-fuse', 'NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2'];
if (process.platform === 'darwin') args.push('--macho-segment-name', 'NODE_SEA');
run(npx, ['postject'].concat(args));
console.log('Built', out, (fs.statSync(out).size / 1048576).toFixed(0) + ' MB');
