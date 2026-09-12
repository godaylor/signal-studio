import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';
import { getPrismaPgConfig } from './prisma-pg-config.js';
import { lockdownDataApi } from './supabase-lockdown.js';

// Explicit operator command after migrations. Never invoked by build/startup.
// Requires an existing Free project; does not purchase/provision a provider plan.
async function main() {
  const ref = process.env.SIGNAL_STUDIO_SUPABASE_PROJECT_REF;
  const dbUrl = new URL(
    process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL || 'https://invalid.local',
  );
  const origin = new URL(process.env.SUPABASE_URL || 'https://invalid.local');
  if (
    !ref ||
    !/^[a-z0-9]{20}$/.test(ref) ||
    origin.origin !== `https://${ref}.supabase.co` ||
    origin.pathname !== '/' ||
    !(
      dbUrl.hostname === `db.${ref}.supabase.co` ||
      (dbUrl.hostname.endsWith('.pooler.supabase.com') &&
        decodeURIComponent(dbUrl.username).endsWith(`.${ref}`))
    )
  )
    throw new Error(
      'Explicit Signal Studio project ref must match both the Supabase API and database.',
    );
  const client = new PrismaClient({
    adapter: new PrismaPg(getPrismaPgConfig(dbUrl.toString(), { max: 1 })),
  });
  try {
    const timezone = await client.$queryRawUnsafe("SELECT current_setting('TimeZone') AS zone");
    if (!['UTC', 'Etc/UTC'].includes(timezone[0]?.zone)) throw new Error('Signal Studio requires a UTC database session.');
    console.log(JSON.stringify(await lockdownDataApi(client)));
    if (process.argv.includes('--lockdown-only')) return;
    const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const cronSecret = process.env.JOBS_CRON_SECRET;
    const publicUrl = new URL(process.env.SIGNAL_STUDIO_PUBLIC_URL || 'https://invalid.local');
    if (
      !secret ||
      !cronSecret ||
      cronSecret.length < 32 ||
      !process.env.SIGNAL_STUDIO_PUBLIC_URL ||
      publicUrl.protocol !== 'https:' ||
      publicUrl.username ||
      publicUrl.password ||
      publicUrl.pathname !== '/' ||
      publicUrl.search ||
      publicUrl.hash
    )
      throw new Error('Storage key, independent cron secret and HTTPS public origin are required.');
    const bucket = process.env.SUPABASE_EXPORT_BUCKET || 'signal-exports';
    if (!/^[a-z0-9-]+$/.test(bucket)) throw new Error('Invalid export bucket name.');
    const headers = {
      apikey: secret,
      Authorization: `Bearer ${secret}`,
      'content-type': 'application/json',
    };
    const bucketUrl = `${origin.origin}/storage/v1/bucket`;
    const existing = await fetch(`${bucketUrl}/${bucket}`, {
      headers,
      redirect: 'error',
      signal: AbortSignal.timeout(20_000),
    });
    if (existing.ok) {
      const value = await existing.json();
      if (value.public !== false) throw new Error('Existing export bucket must be private.');
    } else {
      const error = await existing.json().catch(() => ({}));
      if (
        existing.status !== 404 &&
        !(existing.status === 400 && String(error.statusCode) === '404')
      )
        throw new Error('Cannot inspect export bucket; no replacement attempted.');
      const created = await fetch(bucketUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          id: bucket,
          name: bucket,
          public: false,
          file_size_limit: 3 * 1024 * 1024 + 28,
          allowed_mime_types: ['application/octet-stream'],
        }),
        redirect: 'error',
        signal: AbortSignal.timeout(20_000),
      });
      if (!created.ok) throw new Error('Export bucket creation failed.');
    }
    await client.$executeRawUnsafe('CREATE EXTENSION IF NOT EXISTS pg_cron');
    await client.$executeRawUnsafe('CREATE EXTENSION IF NOT EXISTS pg_net');
    for (const [name, value] of [
      ['signal_studio_jobs_origin', publicUrl.origin],
      ['signal_studio_jobs_secret', cronSecret],
    ]) {
      const rows = await client.$queryRawUnsafe('SELECT id FROM vault.secrets WHERE name=$1', name);
      if (rows.length > 1)
        throw new Error('Duplicate Signal Studio Vault entries need operator review.');
      if (rows.length)
        await client.$queryRawUnsafe(
          'SELECT vault.update_secret($1::uuid,$2,$3)::text',
          rows[0].id,
          value,
          name,
        );
      else await client.$queryRawUnsafe('SELECT vault.create_secret($1,$2)::text', value, name);
    }
    // Poll only persistent pending work. No artificial traffic to defeat Free pausing.
    const command = `SELECT net.http_post(
      url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='signal_studio_jobs_origin') || '/api/internal/jobs',
      headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='signal_studio_jobs_secret')),
      body := '{}'::jsonb, timeout_milliseconds := 290000)
      WHERE EXISTS (SELECT 1 FROM public.export_job WHERE (status='queued' AND expires_at>now()) OR (status='running' AND started_at<now()-interval '5 minutes') OR (status<>'expired' AND expires_at<=now()))
         OR EXISTS (SELECT 1 FROM public.data_lifecycle_job WHERE status IN ('queued','running'))`;
    await client.$queryRawUnsafe(
      "SELECT cron.schedule('signal-studio-jobs', '*/5 * * * *', $1)::text",
      command,
    );
    const scheduled = await client.$queryRawUnsafe(
      "SELECT active, schedule FROM cron.job WHERE jobname='signal-studio-jobs'",
    );
    if (scheduled.length !== 1 || !scheduled[0].active)
      throw new Error('Cron verification failed.');
    console.log(
      JSON.stringify({
        storage: 'private',
        scheduler: 'every-5-minutes-when-pending',
        paidResourcesCreated: false,
      }),
    );
  } finally {
    await client.$disconnect();
  }
}

main().catch(() => {
  console.error(
    'Supabase setup failed. Verify the dedicated project, migrations, bucket and extension permissions; credentials are not logged.',
  );
  process.exitCode = 1;
});
