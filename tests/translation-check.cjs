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

    // Fetch referenced JS/CSS assets listed in the HTML so we can inspect compiled strings
  const assetUrls = [];
    // simple regex to find src/href values for scripts and modulepreload/stylesheet
    const scriptRegex = /<script[^>]+type="module"[^>]*src="([^"]+)"/g;
    const preloadRegex = /<link[^>]+href="([^"]+)"/g;
    let m;
    while ((m = scriptRegex.exec(html)) !== null) assetUrls.push(m[1]);
    while ((m = preloadRegex.exec(html)) !== null) assetUrls.push(m[1]);

    const contents = [html];
    for (const u of assetUrls) {
      // skip large vendor bundles we can't control (firebase SDK etc.)
      if (u.includes('firebase-vendor') || u.includes('react-vendor')) continue;
      try {
        // resolve relative path against the base url
        const full = new URL(u, url).toString();
        const txt = await fetchText(full);
        contents.push(txt);
      } catch (e) {
        // ignore asset fetch errors
      }
    }

    const combined = contents.join('\n');

    const errors = [];

    // Fail if any Cyrillic characters remain (indicates Russian text may remain)
    if (/[\u0400-\u04FF]/.test(combined)) {
      errors.push('Found Cyrillic characters in output — Russian text may remain.');
    }

    // Common English phrases to detect
    const englishPhrases = [
      'Welcome', 'Firebase Hosting', 'Please enable JavaScript', 'Firebase SDK', 'Loading',
      'Sign in', 'Import', 'Export', 'Open Hosting Documentation', 'Enable JavaScript'
    ];

    // Use a regex that matches the phrase followed by a space, punctuation, or end-of-string.
    // This avoids matching Romanian variants like 'Importă' or 'Exportă' where the English
    // substring is followed by a non-ASCII letter.
    const foundEnglish = englishPhrases.filter(p => {
      const esc = p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      // Match the exact phrase not followed by any Unicode letter (so 'Import' won't match 'Importă')
      const re = new RegExp('\\b' + esc + '(?![\\p{L}])', 'u');
      return re.test(combined);
    });
    if (foundEnglish.length) errors.push('Found English phrases: ' + foundEnglish.join(', '));

    // Check for presence of a few Romanian phrases we expect
      const requiredRomanian = ['Se încarcă', 'Activează', 'Buget', 'Backup automat', 'Importă', 'Exportă'];
    const missingRomanian = requiredRomanian.filter(p => !combined.includes(p));
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
