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

await check('classify API responds', async () => {
  const r = await fetch(BASE + '/api/classify', { method: 'POST', body: new FormData() });
  const j = await r.json();
  if (!j.type && !j.error) throw new Error('unexpected response');
});

console.log(failed ? `\n${failed} check(s) failed` : '\nAll checks passed');
process.exit(failed ? 1 : 0);
