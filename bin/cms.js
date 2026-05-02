#!/usr/bin/env node
'use strict';

const path = require('path');
const { execSync, spawn } = require('child_process');
const open = require('open');

const args = process.argv.slice(2);
const cmd = args[0] || 'start';

if (cmd === 'start') {
  const portArg = args.find(a => a.startsWith('--port='));
  const port = portArg ? portArg.split('=')[1] : (process.env.CMS_PORT || 3000);
  process.env.CMS_PORT = port;

  const serverPath = path.join(__dirname, '..', 'app.js');
  const child = spawn(process.execPath, [serverPath], {
    env: { ...process.env, NODE_ENV: 'production' },
    stdio: 'inherit',
  });

  setTimeout(() => {
    const url = `http://127.0.0.1:${port}`;
    console.log(`Opening ${url} in your browser…`);
    open(url).catch(() => console.log(`Visit: ${url}`));
  }, 800);

  child.on('exit', code => process.exit(code));
} else {
  console.error(`Unknown command: ${cmd}`);
  console.log('Usage: cms start [--port=3000]');
  process.exit(1);
}
