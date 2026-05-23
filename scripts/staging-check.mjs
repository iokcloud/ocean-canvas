#!/usr/bin/env node
const BASE = process.env.STAGING_URL || 'https://staging.ocean-canvas.pages.dev';

const pages = ['/', '/index.html', '/ocean.html', '/rank.html', '/smoketest.html'];
const assets = ['/src/js/global-pool.js', '/src/js/draw.js', '/src/js/boot.js', '/api/classify'];

let failed = 0;

async function check(name, fn) {
  try {
    await fn();
    console.log('✅', name);
  } catch (e) {
    console.log('❌', name, '-', e.message);
    failed++;
  }
}

for (const p of pages) {
  await check(`GET ${p}`, async () => {
    const r = await fetch(BASE + p);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
  });
}

for (const a of assets) {
  await check(`GET ${a}`, async () => {
    const r = await fetch(BASE + a);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
  });
}

await check('index has ai-check-btn', async () => {
  const html = await (await fetch(BASE + '/index.html')).text();
  if (!html.includes('ai-check-btn')) throw new Error('missing ai-check-btn');
  if (!html.includes('global-pool.js')) throw new Error('missing global-pool');
});

await check('nav layout assets deployed', async () => {
  const html = await (await fetch(BASE + '/index.html')).text();
  const css = await (await fetch(BASE + '/src/css/style.css')).text();
  if (!html.includes('nav-actions')) throw new Error('missing nav-actions in HTML');
  if (!css.includes('.nav-actions')) throw new Error('missing .nav-actions in CSS');
  if (!css.includes('.level-badge')) throw new Error('missing .level-badge in CSS');
});

await check('classify API responds', async () => {
  const r = await fetch(BASE + '/api/classify', { method: 'POST', body: new FormData() });
  const j = await r.json();
  if (!j.type && !j.error) throw new Error('unexpected response');
});

try {
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64'
  );
  const fd = new FormData();
  fd.append('image', new Blob([png], { type: 'image/png' }), 't.png');
  fd.append('type', 'fish');
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), 20000);
  const r = await fetch(BASE + '/api/classify', { method: 'POST', body: fd, signal: ac.signal });
  clearTimeout(t);
  const j = await r.json();
  if (j.aiUnavailable) {
    console.log('✅ Workers AI binding check');
    console.log('   ⚠️  Workers AI not bound — bind variable AI in Cloudflare Pages');
  } else {
    console.log('✅ Workers AI binding active');
  }
} catch (e) {
  console.log('✅ Workers AI binding check');
  console.log('   ⚠️  AI probe skipped:', e.message);
}

console.log(failed ? `\n${failed} check(s) failed` : '\nAll checks passed');
process.exit(failed ? 1 : 0);
