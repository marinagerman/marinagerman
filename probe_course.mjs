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

function request(method, urlStr, { body, headers = {} } = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(urlStr);
    const opts = {
      method,
      hostname: u.hostname,
      path: u.pathname + u.search,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        Cookie: cookieHeader(),
        ...headers,
      },
    };
    if (body) opts.headers['Content-Length'] = Buffer.byteLength(body);
    const req = https.request(opts, (res) => {
      const set = res.headers['set-cookie'] || [];
      for (const c of set) {
        const part = c.split(';')[0];
        const eq = part.indexOf('=');
        if (eq > 0) cookies[part.slice(0, eq)] = part.slice(eq + 1);
      }
      const chunks = [];
      res.on('data', (d) => chunks.push(d));
      res.on('end', () =>
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: Buffer.concat(chunks).toString('utf8'),
        })
      );
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

function decodeHtml(s) {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

async function main() {
  // Fetch one rich course - Tarolog course
  const id = '934618752'; // Курс ТАРОЛОГ ступень 1
  const url = `${BASE}/teach/control/stream/view/id/${id}`;
  console.log('Fetching', url);
  const res = await request('GET', url);
  fs.writeFileSync(`${DIR}\\sample_course.html`, res.body);
  console.log('status', res.status, 'len', res.body.length);
  console.log('title', (res.body.match(/<title>([^<]+)<\/title>/) || [])[1]);

  // lesson links
  const lessonLinks = [
    ...res.body.matchAll(/href=['"](\/teach\/control\/lesson\/view\/id\/\d+[^'"]*)['"]/g),
  ].map((m) => m[1]);
  console.log('lesson links', [...new Set(lessonLinks)].slice(0, 30));

  // lesson titles in list
  const lessons = [
    ...res.body.matchAll(
      /data-lesson-id="(\d+)"[\s\S]*?(?:lesson-title|title)[^>]*>([^<]+)/gi
    ),
  ];
  console.log('lesson data attrs', lessons.slice(0, 20));

  // Alternative patterns
  const alt = [
    ...res.body.matchAll(
      /href=['"]\/teach\/control\/lesson\/view\/id\/(\d+)[^'"]*['"][^>]*>[\s\S]*?<span[^>]*>([^<]+)<\/span>/gi
    ),
  ];
  console.log('alt lessons', alt.slice(0, 20).map((m) => ({ id: m[1], t: decodeHtml(m[2]).trim() })));

  // Find description / video markers
  for (const key of ['videoId', 'fileId', 'vhVideo', 'lesson-description', 'stream-description', 'data-file-id']) {
    const i = res.body.indexOf(key);
    console.log(key, 'idx', i);
    if (i >= 0) console.log(res.body.slice(i, i + 200).replace(/\s+/g, ' '));
  }

  // children streams
  const children = [
    ...res.body.matchAll(/data-training-id="(\d+)"[\s\S]*?<span class="stream-title">([^<]*)<\/span>/g),
  ];
  console.log('children', children.map((m) => ({ id: m[1], t: m[2].trim() })));
}

main().catch(console.error);
