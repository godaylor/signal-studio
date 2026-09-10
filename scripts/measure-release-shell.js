import 'dotenv/config';
import { readFile, writeFile } from 'node:fs/promises';
import { chromium, request, expect } from '@playwright/test';
const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:32140';
const target = new URL(baseURL);
if (target.hostname !== '127.0.0.1' || +target.port < 32100 || +target.port > 32199) throw new Error('Local ports only');
const credentials = JSON.parse(await readFile(process.env.E2E_CREDENTIALS_FILE || '.local/credentials/test-administrator.json', 'utf8'));
const api = await request.newContext({ baseURL });
const browser = await chromium.launch();
try {
  const login = await api.post('/api/auth/login', { data: credentials });
  expect(login.status()).toBe(200);
  const { token } = await login.json();
  const response = await api.get('/api/websites?includeTeams=1', { headers: { Authorization: 'Bearer ' + token } });
  const body = await response.json();
  const project = (Array.isArray(body) ? body : body.data).find(p => p.name === 'Portfolio · Activation Lab');
  if (!project) throw new Error('Existing portfolio seed required');
  const samples = [];
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await context.addInitScript(token => {
    localStorage.setItem('umami.auth', JSON.stringify(token));
    localStorage.setItem('umami.locale', JSON.stringify('en-US'));
    window.__metrics = { cls: 0, lcp: 0 };
    new PerformanceObserver(list => { for (const e of list.getEntries()) if (!e.hadRecentInput) window.__metrics.cls += e.value; }).observe({ type: 'layout-shift', buffered: true });
    new PerformanceObserver(list => { for (const e of list.getEntries()) window.__metrics.lcp = e.startTime; }).observe({ type: 'largest-contentful-paint', buffered: true });
  }, token);
  for (let i = 0; i < 5; i++) {
    const page = await context.newPage();
    await page.goto(baseURL + '/studio/' + project.id + '/home?locale=en-US');
    await expect(page.getByRole('link', { name: 'Open definition in Explore', exact: true }).first()).toBeVisible();
    const usableMs = await page.evaluate(() => performance.now());
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(300);
    const metrics = await page.evaluate(() => ({
      ...window.__metrics,
      scriptEncodedBytes: performance.getEntriesByType('resource').filter(e => e.initiatorType === 'script').reduce((n, e) => n + e.encodedBodySize, 0),
    }));
    samples.push({ usableMs, ...metrics });
    await page.close();
  }
  const p75 = key => samples.map(s => s[key]).sort((a,b)=>a-b)[3];
  const report = { environment: 'Windows; Node 22.22.2; Next 16.3 production standalone; local Chromium 1440x1000; existing synthetic Portfolio Activation Lab; first page cold then shared browser cache; no CPU/network throttling', samples, shellUsableP75Ms: p75('usableMs'), lcpP75Ms: p75('lcp'), clsP75: p75('cls'), note: 'Lab LCP/CLS only, not field Core Web Vitals or real-device INP.' };
  await writeFile('docs/evidence/m16/shell-release-performance.json', JSON.stringify(report, null, 2)+'\n');
  console.log(JSON.stringify(report));
  expect(report.shellUsableP75Ms).toBeLessThanOrEqual(1500);
  expect(report.clsP75).toBeLessThanOrEqual(0.1);
} finally { await browser.close(); await api.dispose(); }
