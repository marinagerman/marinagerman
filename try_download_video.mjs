import fs from 'fs';
import https from 'https';
import http from 'http';
import { URL } from 'url';
import path from 'path';

const DIR = 'e:\\КУРСОР МАРИНА КУРС ГЕРМАН';
const BASE = 'https://marinagerman.getcourse.ru';
let cookies = JSON.parse(fs.readFileSync(`${DIR}\\cookies.json`, 'utf8'));

function cookieHeader() {
  return Object.entries(cookies)
    .map(([k, v]) => `${k}=${v}`)
    .join('; ');
}

function request(method, urlStr, { redirects = 8, binary = false } = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(urlStr);
    const lib = u.protocol === 'http:' ? http : https;
    const req = lib.request(
      {
        method,
        hostname: u.hostname,
        path: u.pathname + u.search,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36',
          Cookie: cookieHeader(),
          Referer: BASE + '/',
          Accept: '*/*',
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
          res.resume();
          return resolve(request(method, loc, { redirects: redirects - 1, binary }));
        }
        const chunks = [];
        res.on('data', (d) => chunks.push(d));
        res.on('end', () => {
          const buf = Buffer.concat(chunks);
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: binary ? buf : buf.toString('utf8'),
            url: urlStr,
          });
        });
      }
    );
    req.on('error', reject);
    req.end();
  });
}

function extractVideos(html) {
  const videos = [];
  const re =
    /data-file-id="(\d+)"[\s\S]{0,300}?data-video-hash="([a-f0-9]+)"[\s\S]{0,300}?data-iframe-src="([^"]+)"/gi;
  let m;
  while ((m = re.exec(html))) {
    const iframeSrc = m[3].replace(/&amp;/g, '&');
    let player = null;
    try {
      const u = new URL(iframeSrc);
      const raw = u.searchParams.get('json');
      if (raw) player = JSON.parse(Buffer.from(raw, 'base64').toString('utf8'));
    } catch {}
    videos.push({ fileId: m[1], videoHash: m[2], iframeSrc, player });
  }
  return videos;
}

async function tryDownloadCandidates(video, outFile) {
  const candidates = [];
  if (video.player) {
    const p = video.player;
    for (const key of Object.keys(p)) {
      const val = p[key];
      if (typeof val === 'string' && /^https?:\/\//.test(val)) candidates.push(val);
      if (val && typeof val === 'object') {
        for (const k2 of Object.keys(val)) {
          if (typeof val[k2] === 'string' && /^https?:\/\//.test(val[k2])) {
            candidates.push(val[k2]);
          }
        }
      }
    }
  }

  // Common GetCourse / VH patterns
  candidates.push(
    `https://api2.gcvh.ru/file/${video.videoHash}`,
    `https://api2.gcvh.ru/video/${video.videoHash}`,
    `${BASE}/fileservice/file/download?id=${video.fileId}`,
    `${BASE}/pl/fileservice/file/download?id=${video.fileId}`,
    `https://fs.getcourse.ru/fileservice/file/download/a/790166/sc/131/h/${video.videoHash}`,
    `https://fs22.getcourse.ru/fileservice/file/download/a/790166/sc/246/h/${video.videoHash}.mp4`
  );

  console.log('Player JSON keys:', video.player ? Object.keys(video.player) : null);
  console.log('Player JSON:', JSON.stringify(video.player, null, 2)?.slice(0, 2000));

  // Hit the signed player page — often contains m3u8 / mp4
  if (video.iframeSrc) {
    console.log('Fetching player page...');
    const playerPage = await request('GET', video.iframeSrc);
    fs.writeFileSync(`${DIR}\\player_page_sample.html`, playerPage.body);
    console.log('player page status', playerPage.status, 'len', playerPage.body.length);
    const urls = [
      ...playerPage.body.matchAll(/https?:\/\/[^"'\\\s]+(?:m3u8|mp4|mpegts)[^"'\\\s]*/gi),
    ].map((x) => x[0]);
    console.log('media urls in player:', urls.slice(0, 20));
    candidates.push(...urls);

    // Also look for JSON configs
    const jsonMatches = [
      ...playerPage.body.matchAll(/"(?:src|url|file|playlist|hls|master)":\s*"(https?:[^"]+)"/gi),
    ];
    for (const jm of jsonMatches) candidates.push(jm[1]);
  }

  const tried = new Set();
  for (const url of candidates) {
    if (!url || tried.has(url)) continue;
    tried.add(url);
    try {
      console.log('TRY', url.slice(0, 180));
      const res = await request('GET', url, { binary: true, redirects: 5 });
      const ct = String(res.headers['content-type'] || '');
      const len = res.body.length;
      console.log('  ->', res.status, ct, 'bytes', len);
      if (
        res.status === 200 &&
        len > 100000 &&
        (/video|octet|mpeg|mp4/i.test(ct) || url.includes('.mp4'))
      ) {
        fs.writeFileSync(outFile, res.body);
        console.log('SAVED', outFile, len);
        return { ok: true, url, size: len };
      }
      // Save small responses for debug
      if (res.status === 200 && len < 50000 && !binaryLooksLikeVideo(res.body)) {
        const text = res.body.toString('utf8').slice(0, 500);
        if (text.includes('http') || text.includes('#EXTM3U')) {
          console.log('  body preview:', text.replace(/\s+/g, ' ').slice(0, 300));
          if (text.startsWith('#EXTM3U')) {
            fs.writeFileSync(outFile.replace(/\.mp4$/, '.m3u8'), res.body);
            console.log('Saved m3u8 playlist');
            return { ok: true, url, size: len, type: 'm3u8' };
          }
        }
      }
    } catch (e) {
      console.log('  err', e.message);
    }
  }
  return { ok: false };
}

function binaryLooksLikeVideo(buf) {
  // ftyp box for mp4
  return buf.length > 12 && buf.slice(4, 8).toString() === 'ftyp';
}

async function main() {
  const html = fs.readFileSync(`${DIR}\\video_lesson_332493229_0.html`, 'utf8');
  const videos = extractVideos(html);
  console.log('videos found', videos.length);
  if (!videos.length) {
    console.log('No videos parsed');
    return;
  }
  const outDir = `${DIR}\\export\\videos`;
  fs.mkdirSync(outDir, { recursive: true });
  const v = videos[0];
  const outFile = path.join(outDir, `lesson_332493229_${v.fileId}.mp4`);
  const result = await tryDownloadCandidates(v, outFile);
  console.log('RESULT', result);
  fs.writeFileSync(`${DIR}\\cookies.json`, JSON.stringify(cookies, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
