import fs from 'fs';
import https from 'https';
import { URL } from 'url';

const DIR = 'e:\\КУРСОР МАРИНА КУРС ГЕРМАН';
const BASE = 'https://marinagerman.getcourse.ru';
let cookies = JSON.parse(fs.readFileSync(`${DIR}\\cookies.json`, 'utf8'));

function cookieHeader() {
  return Object.entries(cookies)
    .map(([k, v]) => `${k}=${v}`)
    .join('; ');
}

function request(method, urlStr, redirects = 8) {
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
        },
      },
      (res) => {
        for (const c of res.headers['set-cookie'] || []) {
          const part = c.split(';')[0];
          const eq = part.indexOf('=');
          if (eq > 0) cookies[part.slice(0, eq)] = part.slice(eq + 1);
        }
        if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location && redirects > 0) {
          const loc = res.headers.location.startsWith('http')
            ? res.headers.location
            : `${u.protocol}//${u.host}${res.headers.location}`;
          res.resume();
          return resolve(request(method, loc, redirects - 1));
        }
        const chunks = [];
        res.on('data', (d) => chunks.push(d));
        res.on('end', () =>
          resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString('utf8') })
        );
      }
    );
    req.on('error', reject);
    req.end();
  });
}

async function main() {
  // Pick a lesson that likely has video - from Tarot marathon day with content
  const ids = ['332493229', '331781141', '347341869', '328483780'];
  for (const id of ids) {
    for (const mode of [0, 1]) {
      const res = await request(
        'GET',
        `${BASE}/pl/teach/control/lesson/view?id=${id}&editMode=${mode}`
      );
      const title = (res.body.match(/<title>([^<]+)<\/title>/) || [])[1];
      const hasVideo =
        /lt-lesson-video|video-js|vh-player|gc-video|data-file-id|kinescope|fileHash|mpegts|\.mp4/i.test(
          res.body
        );
      console.log(`lesson ${id} edit=${mode} len=${res.body.length} title=${title} hasVideoMarkers=${hasVideo}`);
      if (hasVideo) {
        fs.writeFileSync(`${DIR}\\video_lesson_${id}_${mode}.html`, res.body);
        // Find interesting snippets
        for (const key of ['lt-lesson-video', 'data-file-id', '.mp4', 'fileHash', 'vhPlayer', 'VIDEO']) {
          let idx = res.body.indexOf(key);
          let n = 0;
          while (idx !== -1 && n < 2) {
            console.log(' ', key, res.body.slice(idx, idx + 200).replace(/\s+/g, ' '));
            idx = res.body.indexOf(key, idx + 1);
            n++;
          }
        }
      }
    }
  }
}

main().catch(console.error);
