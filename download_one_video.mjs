import fs from 'fs';
import https from 'https';
import http from 'http';
import { URL } from 'url';
import { spawn } from 'child_process';
import path from 'path';

const DIR = 'e:\\КУРСОР МАРИНА КУРС ГЕРМАН';
const BASE = 'https://marinagerman.getcourse.ru';
let cookies = JSON.parse(fs.readFileSync(`${DIR}\\cookies.json`, 'utf8'));

function cookieHeader() {
  return Object.entries(cookies)
    .map(([k, v]) => `${k}=${v}`)
    .join('; ');
}

function request(method, urlStr, { redirects = 8, headers = {} } = {}) {
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
          Referer: 'https://api2.gcvh.ru/',
          ...headers,
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
          return resolve(request(method, loc, { redirects: redirects - 1, headers }));
        }
        const chunks = [];
        res.on('data', (d) => chunks.push(d));
        res.on('end', () =>
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: Buffer.concat(chunks).toString('utf8'),
            buf: Buffer.concat(chunks),
          })
        );
      }
    );
    req.on('error', reject);
    req.end();
  });
}

function findFfmpeg() {
  const candidates = [
    'ffmpeg',
    'C:\\ffmpeg\\bin\\ffmpeg.exe',
    path.join(
      process.env.LOCALAPPDATA || '',
      'Microsoft',
      'WinGet',
      'Links',
      'ffmpeg.exe'
    ),
  ];
  // Also search WinGet packages
  const wingetRoot = path.join(
    process.env.LOCALAPPDATA || '',
    'Microsoft',
    'WinGet',
    'Packages'
  );
  try {
    if (fs.existsSync(wingetRoot)) {
      for (const name of fs.readdirSync(wingetRoot)) {
        if (/ffmpeg/i.test(name)) {
          const baseDir = path.join(wingetRoot, name);
          const walk = (dir, depth = 0) => {
            if (depth > 4) return;
            for (const f of fs.readdirSync(dir)) {
              const p = path.join(dir, f);
              const st = fs.statSync(p);
              if (st.isFile() && f.toLowerCase() === 'ffmpeg.exe') candidates.push(p);
              if (st.isDirectory()) walk(p, depth + 1);
            }
          };
          walk(baseDir);
        }
      }
    }
  } catch {}
  return candidates.find((c) => {
    try {
      if (c === 'ffmpeg') return true;
      return fs.existsSync(c);
    } catch {
      return false;
    }
  });
}

async function getPlayerConfigs(lessonId) {
  const lesson = await request(
    'GET',
    `${BASE}/pl/teach/control/lesson/view?id=${lessonId}&editMode=0`
  );
  const iframe = (lesson.body.match(/data-iframe-src="([^"]+)"/) || [])[1];
  if (!iframe) return null;
  const iframeSrc = iframe.replace(/&amp;/g, '&');
  const player = await request('GET', iframeSrc);
  const raw = (player.body.match(/window\.configs = (\{[\s\S]*?\})\s*<\/script>/) || [])[1];
  if (!raw) return null;
  return JSON.parse(raw);
}

async function main() {
  const configs = await getPlayerConfigs('332493229');
  if (!configs) {
    console.log('No configs — session may be expired');
    process.exit(1);
  }
  console.log('Got master:', configs.masterPlaylistUrl?.slice(0, 120));
  console.log('duration', configs.videoDuration);

  const outDir = `${DIR}\\export\\videos`;
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = `${outDir}\\lesson_332493229_${configs.gcFileId}.mp4`;
  const masterFile = `${outDir}\\_tmp_master.m3u8`;

  // Save master locally so ffmpeg gets .m3u8 extension
  const master = await request('GET', configs.masterPlaylistUrl);
  console.log('master status', master.status, 'len', master.body.length);
  // Rewrite relative media URLs to absolute if needed
  let playlist = master.body;
  const baseUrl = configs.masterPlaylistUrl;
  playlist = playlist
    .split(/\r?\n/)
    .map((line) => {
      if (!line || line.startsWith('#')) return line;
      if (/^https?:\/\//i.test(line)) return line;
      return new URL(line, baseUrl).href;
    })
    .join('\n');
  fs.writeFileSync(masterFile, playlist);

  // Also fetch one media playlist and rewrite segments for local ffmpeg
  const mediaLine = playlist
    .split(/\r?\n/)
    .find((l) => l.includes('/api/playlist/media/') && l.includes('360'));
  console.log('media line sample', mediaLine?.slice(0, 150));

  const ffmpeg = findFfmpeg();
  console.log('ffmpeg', ffmpeg);

  const args = [
    '-y',
    '-protocol_whitelist',
    'file,http,https,tcp,tls,crypto',
    '-allowed_extensions',
    'ALL',
    '-headers',
    'Referer: https://api2.gcvh.ru/\r\nUser-Agent: Mozilla/5.0\r\n',
    '-i',
    masterFile,
    '-c',
    'copy',
    '-bsf:a',
    'aac_adtstoasc',
    outFile,
  ];

  await new Promise((resolve) => {
    const ff = spawn(ffmpeg, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let err = '';
    ff.stderr.on('data', (d) => {
      err += d.toString();
      process.stderr.write(d);
    });
    ff.on('close', (code) => {
      console.log('\nffmpeg exit', code);
      if (fs.existsSync(outFile)) {
        console.log('SAVED', outFile, fs.statSync(outFile).size, 'bytes');
      } else {
        console.log('FAILED tail:\n', err.slice(-2000));
      }
      resolve();
    });
  });

  // Try personal download endpoints
  const hash = configs.videoHash;
  const view = configs.supportInfo?.data?.ViewId;
  const tries = [
    `https://api2.gcvh.ru/player/${hash}/${view}/download`,
    `https://api2.gcvh.ru/player/${hash}/${view}/personal-video`,
    `https://api2.gcvh.ru/api/personal-video/${hash}`,
    `https://v01.getcourse.ru/api/personal-video/${hash}`,
  ];
  for (const url of tries) {
    const res = await request('GET', url);
    console.log('try', url, res.status, res.headers['content-type'], res.body.slice(0, 200));
  }

  fs.writeFileSync(`${DIR}\\cookies.json`, JSON.stringify(cookies, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
