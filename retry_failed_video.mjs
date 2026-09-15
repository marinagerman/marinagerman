import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import https from 'https';
import http from 'http';
import { URL } from 'url';

const DIR = 'e:\\КУРСОР МАРИНА КУРС ГЕРМАН';
const BASE = 'https://marinagerman.getcourse.ru';
const OUT = path.join(DIR, 'export', 'videos');
const lessonId = '347365600';

let cookies = JSON.parse(fs.readFileSync(path.join(DIR, 'cookies.json'), 'utf8'));

function cookieHeader() {
  return Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join('; ');
}

function request(method, urlStr, { redirects = 8, binary = false, timeout = 120000 } = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(urlStr);
    const lib = u.protocol === 'http:' ? http : https;
    const req = lib.request(
      {
        method,
        hostname: u.hostname,
        path: u.pathname + u.search,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/122.0.0.0 Safari/537.36',
          Cookie: cookieHeader(),
          Referer: 'https://api2.gcvh.ru/',
          Accept: '*/*',
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
          return resolve(request(method, loc, { redirects: redirects - 1, binary, timeout }));
        }
        const chunks = [];
        res.on('data', (d) => chunks.push(d));
        res.on('end', () => {
          const buf = Buffer.concat(chunks);
          resolve({ status: res.statusCode, body: binary ? buf : buf.toString('utf8'), buf });
        });
      }
    );
    req.setTimeout(timeout, () => req.destroy(new Error('timeout')));
    req.on('error', reject);
    req.end();
  });
}

async function ensureLogin() {
  const check = await request('GET', `${BASE}/teach/control/stream`);
  if (/accountUserId = (?!-1)\d+/.test(check.body)) return true;
  const loginPage = await request('GET', `${BASE}/cms/system/login`);
  const csrf = (loginPage.body.match(/window\.csrfToken = "([^"]+)"/) || [])[1];
  const body = new URLSearchParams({
    action: 'processXdget',
    xdgetId: '99945_1_1',
    'params[action]': 'login',
    'params[email]': 'Marinagerman.nails@gmail.com',
    'params[password]': 'Marina2609!',
    requestType: 'json',
  }).toString();
  await new Promise((resolve, reject) => {
    const u = new URL(`${BASE}/cms/system/login`);
    const req = https.request(
      {
        method: 'POST',
        hostname: u.hostname,
        path: u.pathname,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'X-Requested-With': 'XMLHttpRequest',
          'X-CSRF-Token': csrf || '',
          Cookie: cookieHeader(),
          'Content-Length': Buffer.byteLength(body),
          Referer: `${BASE}/cms/system/login`,
          Origin: BASE,
        },
      },
      (res) => {
        for (const c of res.headers['set-cookie'] || []) {
          const part = c.split(';')[0];
          const eq = part.indexOf('=');
          if (eq > 0) cookies[part.slice(0, eq)] = part.slice(eq + 1);
        }
        res.resume();
        res.on('end', resolve);
      }
    );
    req.on('error', reject);
    req.write(body);
    req.end();
  });
  return true;
}

function pickBestMediaUrl(masterText) {
  const lines = masterText.split(/\r?\n/);
  let best = null;
  let bestH = -1;
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].startsWith('#EXT-X-STREAM-INF:')) continue;
    const h = Number((lines[i].match(/RESOLUTION=\d+x(\d+)/) || [])[1] || 0);
    const next = (lines[i + 1] || '').trim();
    if (!/^https?:/.test(next)) continue;
    if (h > bestH || (h === bestH && next.includes('cdnvideo'))) {
      bestH = h;
      best = next;
    }
  }
  return best;
}

function runFfmpeg(args) {
  return new Promise((resolve, reject) => {
    const ff = spawn('ffmpeg', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let err = '';
    ff.stderr.on('data', (d) => { err += d.toString(); });
    ff.on('close', (code) => (code === 0 ? resolve() : reject(new Error(err.slice(-800)))));
  });
}

async function main() {
  console.log('Retry lesson', lessonId);
  await ensureLogin();
  const lesson = await request('GET', `${BASE}/pl/teach/control/lesson/view?id=${lessonId}&editMode=0`);
  const iframe = (lesson.body.match(/data-iframe-src="([^"]+)"/) || [])[1]?.replace(/&amp;/g, '&');
  if (!iframe) throw new Error('no iframe');
  const player = await request('GET', iframe);
  const configs = JSON.parse((player.body.match(/window\.configs = (\{[\s\S]*?\})\s*<\/script>/) || [])[1]);
  console.log('duration', configs.videoDuration, 'file', configs.gcFileId);

  const outFile = path.join(OUT, `l${lessonId}_${configs.gcFileId}.mp4`);
  if (fs.existsSync(outFile) && fs.statSync(outFile).size > 100000) {
    console.log('already exists', fs.statSync(outFile).size);
    return;
  }

  const master = await request('GET', configs.masterPlaylistUrl);
  const mediaUrl = pickBestMediaUrl(master.body);
  const media = await request('GET', mediaUrl);
  const urls = media.body.split(/\r?\n/).filter((l) => /^https?:/.test(l));
  console.log('segments', urls.length);

  const workDir = path.join(OUT, `_tmp_${lessonId}`);
  fs.mkdirSync(workDir, { recursive: true });

  for (let i = 0; i < urls.length; i++) {
    const segPath = path.join(workDir, `seg_${String(i).padStart(5, '0')}.ts`);
    if (fs.existsSync(segPath) && fs.statSync(segPath).size > 50) {
      if ((i + 1) % 200 === 0) console.log('resume', i + 1, '/', urls.length);
      continue;
    }
    let ok = false;
    for (let a = 1; a <= 5; a++) {
      try {
        const seg = await request('GET', urls[i], { binary: true, timeout: 120000 });
        if (seg.status === 200 && seg.buf.length > 50) {
          fs.writeFileSync(segPath, seg.buf);
          ok = true;
          break;
        }
      } catch (e) {
        if (a === 5) throw e;
        await new Promise((r) => setTimeout(r, 800 * a));
      }
    }
    if (!ok) throw new Error('seg fail ' + i);
    if ((i + 1) % 100 === 0) console.log(i + 1, '/', urls.length);
  }

  const mapMatch = media.body.match(/#EXT-X-MAP:URI="([^"]+)"/);
  if (mapMatch) {
    const init = await request('GET', mapMatch[1], { binary: true });
    fs.writeFileSync(path.join(workDir, 'init.mp4'), init.buf);
  }

  const rebuilt = [];
  let si = 0;
  for (const line of media.body.split(/\r?\n/)) {
    if (line.startsWith('#EXT-X-MAP:')) rebuilt.push('#EXT-X-MAP:URI="init.mp4"');
    else if (/^https?:/.test(line)) {
      rebuilt.push(`seg_${String(si).padStart(5, '0')}.ts`);
      si++;
    } else rebuilt.push(line);
  }
  const localM3u8 = path.join(workDir, 'local.m3u8');
  fs.writeFileSync(localM3u8, rebuilt.join('\n'));

  await runFfmpeg([
    '-y', '-protocol_whitelist', 'file,crypto', '-allowed_extensions', 'ALL',
    '-i', localM3u8, '-c', 'copy', '-bsf:a', 'aac_adtstoasc', outFile,
  ]);

  console.log('SAVED', outFile, fs.statSync(outFile).size);
  fs.rmSync(workDir, { recursive: true, force: true });
  fs.writeFileSync(path.join(DIR, 'cookies.json'), JSON.stringify(cookies, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
