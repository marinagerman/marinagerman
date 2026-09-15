import fs from 'fs';
import https from 'https';
import { URL } from 'url';

const DIR = 'e:\\КУРСОР МАРИНА КУРС ГЕРМАН';
const BASE = 'https://marinagerman.getcourse.ru';
const cookies = JSON.parse(fs.readFileSync(`${DIR}\\cookies.json`, 'utf8'));

function cookieHeader() {
  return Object.entries(cookies)
    .map(([k, v]) => `${k}=${v}`)
    .join('; ');
}

function request(method, urlStr, redirects = 5) {
  return new Promise((resolve, reject) => {
    const u = new URL(urlStr);
    const req = https.request(
      {
        method,
        hostname: u.hostname,
        path: u.pathname + u.search,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36',
          Cookie: cookieHeader(),
          Accept: 'text/html,application/xhtml+xml',
        },
      },
      (res) => {
        for (const c of res.headers['set-cookie'] || []) {
          const part = c.split(';')[0];
          const eq = part.indexOf('=');
          if (eq > 0) cookies[part.slice(0, eq)] = part.slice(eq + 1);
        }
        if (
          [301, 302, 303, 307, 308].includes(res.statusCode) &&
          res.headers.location &&
          redirects > 0
        ) {
          const loc = res.headers.location.startsWith('http')
            ? res.headers.location
            : `${u.protocol}//${u.host}${res.headers.location}`;
          console.log('redirect', res.statusCode, '->', loc);
          res.resume();
          resolve(request(method, loc, redirects - 1));
          return;
        }
        const chunks = [];
        res.on('data', (d) => chunks.push(d));
        res.on('end', () =>
          resolve({
            status: res.statusCode,
            url: urlStr,
            body: Buffer.concat(chunks).toString('utf8'),
          })
        );
      }
    );
    req.on('error', reject);
    req.end();
  });
}

async function main() {
  // try several lesson URL formats
  const urls = [
    `${BASE}/teach/control/lesson/view/id/343445607`,
    `${BASE}/pl/teach/control/lesson/view?id=343445607`,
    `${BASE}/teach/control/lesson/view?id=343445607`,
    `${BASE}/pl/teach/control/lesson/view/id/343445607`,
  ];
  for (const url of urls) {
    console.log('\nTRY', url);
    const res = await request('GET', url);
    console.log('final status', res.status, 'len', res.body.length, 'url', res.url);
    console.log('title', (res.body.match(/<title>([^<]+)<\/title>/) || [])[1]);
    if (res.body.length > 1000) {
      fs.writeFileSync(`${DIR}\\sample_lesson.html`, res.body);
      // extract interesting bits
      for (const key of ['xdget-video', 'videoId', 'fileservice', 'gcvh', 'type: \'video\'', 'fileHash', 'lessonText', 'redactor']) {
        const i = res.body.indexOf(key);
        if (i >= 0) {
          console.log(key, '->', res.body.slice(i, i + 280).replace(/\s+/g, ' '));
        }
      }
      // find video iframe/src
      const videos = [...res.body.matchAll(/(?:src|data-src|file)=['"]([^'"]*(?:mp4|m3u8|video|vh|fileservice)[^'"]*)['"]/gi)];
      console.log('media urls', videos.slice(0, 15).map((m) => m[1]));
      break;
    }
  }

  // Parse tree for structure
  const tree = fs.readFileSync(`${DIR}\\tree.html`, 'utf8');
  const titles = [...tree.matchAll(/stream-title[^>]*>([^<]+)</g)].map((m) => m[1].trim());
  console.log('\ntree titles', titles.length, titles.slice(0, 10));
  const ids = [...tree.matchAll(/data-training-id="(\d+)"/g)].map((m) => m[1]);
  console.log('tree training ids', ids.length);
}

main().catch(console.error);
