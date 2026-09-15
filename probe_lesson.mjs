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

function request(method, urlStr) {
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
  const lessonId = '343445607';
  const res = await request('GET', `${BASE}/teach/control/lesson/view/id/${lessonId}`);
  fs.writeFileSync(`${DIR}\\sample_lesson.html`, res.body);
  console.log('status', res.status, 'len', res.body.length);
  console.log('title', (res.body.match(/<title>([^<]+)<\/title>/) || [])[1]);

  const keys = [
    'videoId',
    'fileHash',
    'vh-',
    'gcvh',
    'player',
    'fileservice',
    'data-video',
    'lessonParams',
    'contentHtml',
    'xdget-video',
    'type: \'video\'',
    'type: "video"',
    'videoFile',
    'missionId',
  ];
  for (const key of keys) {
    let idx = 0;
    let n = 0;
    while ((idx = res.body.indexOf(key, idx)) !== -1 && n < 3) {
      console.log('\n===', key, 'at', idx, '===');
      console.log(res.body.slice(idx, idx + 350).replace(/\s+/g, ' '));
      idx += key.length;
      n++;
    }
  }

  // Also try tree
  const tree = await request('GET', `${BASE}/teach/control/stream/tree`);
  fs.writeFileSync(`${DIR}\\tree.html`, tree.body);
  console.log('\ntree len', tree.body.length, 'title', (tree.body.match(/<title>([^<]+)<\/title>/) || [])[1]);
  const treeLessons = [...tree.body.matchAll(/lesson\/view\/id\/(\d+)/g)];
  console.log('tree lesson refs', new Set(treeLessons.map((m) => m[1])).size);
}

main().catch(console.error);
