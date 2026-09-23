import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { appendFile } from 'node:fs/promises';

// Manual acceptance only: no database/admin credentials and no production seed.
const origin = 'https://signal-studio-smoky.vercel.app';
const fixture = JSON.parse(process.env.PRODUCTION_ACCEPTANCE_CREDENTIALS || '{}');
assert.match(fixture.username || '', /^acceptance-/);
assert.match(fixture.projectId || '', /^[0-9a-f-]{36}$/);
const phase = process.env.ACCEPTANCE_PHASE || 'scenario';
const passed = [];
async function request(path, { method = 'GET', token, body, status = 200 } = {}) {
  const response = await fetch(new URL(path, origin), {
    method, redirect: 'error', signal: AbortSignal.timeout(60000),
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  assert.equal(response.status, status, `${method} ${path}: unexpected HTTP status`);
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}
function pass(label) { passed.push(label); console.log(`PASS ${label}`); }
async function login(username, password) {
  const result = await request('/api/auth/login', { method: 'POST', body: { username, password } });
  assert.equal(typeof result.token, 'string');
  return result.token;
}
try {
  const ready = await request('/api/ready');
  assert.equal(ready.dependencies.database, 'ready');
  pass('HTTPS readiness with PostgreSQL dependency');
  await request('/api/internal/jobs', { method: 'POST', status: 401 });
  pass('Maintenance rejects anonymous caller');
  const token = await login(fixture.username, fixture.password);
  pass('Production login');
  const base = `/api/projects/${fixture.projectId}`;
  if (phase === 'expiry') {
    const jobs = await request(`${base}/exports`, { token });
    assert.equal(jobs.data.length, 1);
    assert.equal(jobs.data[0].status, 'expired');
    await request(`${base}/exports/${jobs.data[0].id}`, { token, status: 410 });
    pass('Expired artifact cannot be downloaded');
  } else {
    const site = await request('/api/websites', { method: 'POST', token, body: {
      id: fixture.projectId, name: `Production acceptance ${fixture.projectId.slice(0, 8)}`, domain: 'acceptance.example.com',
    } });
    assert.equal(site.id, fixture.projectId);
    pass('Create real Source using authenticated API');
    const payload = { website: fixture.projectId, hostname: 'acceptance.example.com',
      url: 'https://acceptance.example.com/verification', language: 'en-US', screen: '1440x900',
      userAgent: 'Mozilla/5.0 Chrome/130.0.0.0 Safari/537.36' };
    await request('/api/send', { method: 'POST', body: { type: 'identify', payload: {
      ...payload, identityVersion: 1, id: `acceptance-${fixture.projectId.slice(0, 8)}`,
    } } });
    for (let index = 0; index < 3; index++) await request('/api/send', {
      method: 'POST', body: { type: 'event', payload: { ...payload, name: 'production_acceptance' } },
    });
    pass('Public ingestion: one identity and three events');
    const query = { version: 1, projectId: fixture.projectId, mode: 'breakdown',
      range: { startAt: new Date(Date.now() - 3600000).toISOString(), endAt: new Date(Date.now() + 60000).toISOString(), timezone: 'UTC', unit: 'day' },
      measure: { source: 'event', key: '*', aggregation: 'count' }, filters: [], match: 'all', comparison: 'none',
      breakdown: { field: 'eventName', limit: 10 }, visualization: 'table' };
    const result = await request(`${base}/analytics/query`, { method: 'POST', token, body: query });
    assert.deepEqual(result.data.rows, [{ key: 'production_acceptance', value: 3 }]);
    pass('Analytics returns exact event count 3');
    const insight = await request(`${base}/insights`, { method: 'POST', token, body: { title: 'Production acceptance count', query } });
    const dashboard = await request(`${base}/dashboards`, { method: 'POST', token, body: { title: 'Production acceptance dashboard' } });
    await request(`${base}/dashboards/${dashboard.id}/widgets`, { method: 'POST', token, body: { kind: 'insight', insightId: insight.id } });
    const restored = await request(`${base}/dashboards/${dashboard.id}`, { token });
    assert.equal(restored.widgets[0].insight.id, insight.id);
    pass('Save Insight and reload Dashboard with its reference');
    const users = await request(`${base}/tracked-users`, { token });
    assert.equal(users.data.length, 1);
    const definition = { version: 1, entity: 'user', match: 'all', conditions: [
      { kind: 'behavior', eventName: 'production_acceptance', withinDays: 1, minCount: 1 },
    ] };
    const audience = await request(`${base}/segments/preview`, { method: 'POST', token, body: { definition } });
    assert.equal(audience.count, 1);
    assert.equal(audience.exactness, 'exact');
    const segment = await request(`${base}/segments`, { method: 'POST', token, body: { name: 'Production acceptance audience', definition } });
    const restoredSegment = await request(`${base}/segments/${segment.id}`, { token });
    assert.deepEqual(restoredSegment.definition, definition);
    pass('Audience contains the ingested identity; behavioral segment saves and reloads');
    const exported = await request(`${base}/exports`, { method: 'POST', token, body: {
      version: 1, source: { kind: 'analysis', query }, format: 'json', allRows: false, idempotencyKey: randomUUID(),
    } });
    assert.equal(exported.metadata.exactness, 'exact');
    assert.deepEqual(exported.rows, result.data.rows.map(row => ({ series: 'primary', ...row })));
    pass('Synchronous JSON export matches exact analytics');
    const exportDefinition = { version: 1, source: { kind: 'users', list: {} }, format: 'json', allRows: true, idempotencyKey: randomUUID() };
    const queued = await request(`${base}/exports`, { method: 'POST', token, status: 202, body: exportDefinition });
    const duplicate = await request(`${base}/exports`, { method: 'POST', token, status: 202, body: exportDefinition });
    assert.equal(duplicate.data.id, queued.data.id);
    pass('Background audience export queues idempotently');
    let job;
    for (let attempt = 0; attempt < 36; attempt++) {
      const list = await request(`${base}/exports`, { token });
      job = list.data.find(item => item.id === queued.data.id);
      assert.notEqual(job?.status, 'failed', `Export failed: ${job?.errorCode}`);
      if (job?.status === 'completed') break;
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
    assert.equal(job.status, 'completed');
    assert.equal(job.rowCount, 1);
    const downloadPath = `${base}/exports/${job.id}`;
    const download = await request(downloadPath, { token });
    assert.equal(download.rows.length, 1);
    pass('Serverless background job completes and downloads one identity');
    await request(downloadPath, { status: 401 });
    const outsider = await login(fixture.outsiderUsername, fixture.outsiderPassword);
    await request(downloadPath, { token: outsider, status: 403 });
    pass('Artifact rejects anonymous and unrelated user');
  }
  await request('/api/auth/logout', { method: 'POST', token });
  await request('/api/websites', { token, status: 401 });
  pass('Logout revokes previous session');
} finally {
  if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY,
    `## Production acceptance (${phase})\nOrigin: ${origin}\nProject: ${fixture.projectId}\n\n${passed.map(label => `- PASS: ${label}`).join('\n')}\n`);
}
