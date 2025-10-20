#!/usr/bin/env node
const { spawn } = require('child_process');
const http = require('http');

async function fetchText(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

async function waitFor(url, timeoutMs = 5000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const txt = await fetchText(url);
      if (txt && txt.length > 0) return txt;
    } catch (e) {
      await new Promise(r => setTimeout(r, 250));
    }
  }
  throw new Error('Timeout waiting for ' + url);
}

(async function main(){
  const url = 'http://localhost:5001/';
  let serverProc = null;
  let startedByScript = false;

  // Check if a server is already running
  try {
    await waitFor(url, 500);
    console.log('Found existing server on', url);
  } catch (e) {
    // start a static server to serve dist/
    console.log('Starting static server on port 5001 (serving ./dist)...');
    serverProc = spawn('python3', ['-m', 'http.server', '5001', '--directory', 'dist'], { stdio: 'ignore' });
    startedByScript = true;
  }

  try {
    const html = await waitFor(url, 5000);

    const errors = [];

    // Fail if any Cyrillic characters remain (indicates Russian left)
    if (/[0-\u04FF]/.test(html) || /[\u0400-\u04FF]/.test(html)) {
      errors.push('Found Cyrillic characters in output — Russian text may remain.');
    }

    // Check for presence of a few Romanian phrases we expect
    const requiredRomanian = ['Se încarcă', 'Activează', 'Buget', 'Backup automat', 'Importă', 'Exportă'];
    const missingRomanian = requiredRomanian.filter(p => !html.includes(p));
    if (missingRomanian.length) errors.push('Missing expected Romanian phrases: ' + missingRomanian.join(', '));

    if (errors.length === 0) {
      console.log('PASS: No obvious English/Cyrillic leftovers and required Romanian phrases present.');
      process.exit(0);
    } else {
      console.error('FAIL: translation checks failed:');
      errors.forEach(e => console.error(' -', e));
      process.exit(2);
    }
  } catch (err) {
    console.error('ERROR during check:', err.message || err);
    process.exit(3);
  } finally {
    if (startedByScript && serverProc) {
      try { serverProc.kill(); } catch (e) {}
    }
  }
})();
