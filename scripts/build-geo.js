/* eslint-disable no-console */
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import https from 'node:https';
import { list } from 'tar';
import zlib from 'node:zlib';

if (process.env.SKIP_BUILD_GEO) {
  console.log('SKIP_BUILD_GEO is set. Skipping geo setup.');
  process.exit(0);
}

if (process.env.VERCEL && !process.env.BUILD_GEO) {
  console.log('Vercel environment detected. Skipping geo setup.');
  process.exit(0);
}

const database = 'GeoLite2-City';
let url = process.env.GEO_DATABASE_URL;

if (!url && process.env.MAXMIND_LICENSE_KEY) {
  url =
    `https://download.maxmind.com/app/geoip_download?edition_id=${database}` +
    `&license_key=${process.env.MAXMIND_LICENSE_KEY}&suffix=tar.gz`;
}

if (!url) {
  console.log(
    'No licensed GEO_DATABASE_URL or MAXMIND_LICENSE_KEY is configured; skipping GeoLite2.',
  );
  process.exit(0);
}

const destination = path.resolve(process.cwd(), 'geo');
fs.mkdirSync(destination, { recursive: true });
const isDirectDatabase = new URL(url).pathname.endsWith('.mmdb');

function get(urlValue, onResponse) {
  https.get(urlValue, response => {
    if (response.statusCode && [301, 302, 307, 308].includes(response.statusCode)) {
      if (!response.headers.location) {
        throw new Error('Geo database redirect did not include a location.');
      }
      get(new URL(response.headers.location, urlValue).toString(), onResponse);
      return;
    }
    if (response.statusCode !== 200) {
      throw new Error(`Geo database download failed with HTTP ${response.statusCode}.`);
    }
    onResponse(response);
  }).on('error', error => {
    console.error('Failed to download geo database:', error);
    process.exit(1);
  });
}

if (isDirectDatabase) {
  get(url, response => {
    const filename = path.join(destination, path.basename(new URL(url).pathname));
    response.pipe(fs.createWriteStream(filename)).on('finish', () => {
      console.log('Saved geo database:', filename);
    });
  });
} else {
  get(url, response => {
    const archive = response.pipe(zlib.createGunzip()).pipe(list());
    archive.on('entry', entry => {
      if (entry.path.endsWith('.mmdb')) {
        const filename = path.join(destination, path.basename(entry.path));
        entry.pipe(fs.createWriteStream(filename));
        console.log('Saved geo database:', filename);
      }
    });
    archive.on('error', error => {
      console.error('Failed to extract geo database:', error);
      process.exit(1);
    });
  });
}
