import fs from 'fs';
import https from 'https';
import http from 'http';
import { URL } from 'url';

const DIR = 'e:\\КУРСОР МАРИНА КУРС ГЕРМАН';
const html = fs.readFileSync(`${DIR}\\player_page_sample.html`, 'utf8');
const configs = JSON.parse(html.match(/window\.configs = (\{[\s\S]*?\})\s*<\/script>/)[1]);

function request(method, urlStr, body) {
  return new Promise((resolve, reject) => {
    const u = new URL(urlStr);
    const lib = u.protocol === 'http:' ? http : https;
    const opts = {
      method,
      hostname: u.hostname,
      path: u.pathname + u.search,
      headers: {
        'User-Agent': 'Mozilla/5.0',
        Referer: 'https://api2.gcvh.ru/',
        Accept: '*/*',
      },
    };
    if (body) {
      opts.headers['Content-Type'] = 'application/json';
      opts.headers['Content-Length'] = Buffer.byteLength(body);
    }
    const req = lib.request(opts, (res) => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
        res.resume();
        return resolve(request(method, res.headers.location, null));
      }
      const chunks = [];
      res.on('data', (d) => chunks.push(d));
      res.on('end', () => {
        const buf = Buffer.concat(chunks);
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: buf,
          text: buf.toString('utf8'),
        });
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

const base = 'https://api2.gcvh.ru';
console.log('createPersonalVideoUrl', configs.createPersonalVideoUrl);
console.log('checkPersonalVideoUrl', configs.checkPersonalVideoUrl);

for (const path of [configs.createPersonalVideoUrl, configs.checkPersonalVideoUrl]) {
  const url = path.startsWith('http') ? path : base + path;
  console.log('\nPOST', url);
  const res = await request('POST', url, '{}');
  console.log('status', res.status, res.headers['content-type']);
  console.log(res.text.slice(0, 800));
}

console.log('\nGET master playlist');
const master = await request('GET', configs.masterPlaylistUrl);
console.log('status', master.status);
console.log(master.text.slice(0, 1000));
fs.mkdirSync(`${DIR}\\export\\videos`, { recursive: true });
fs.writeFileSync(`${DIR}\\export\\videos\\sample_master.m3u8`, master.text);
