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
            buf,
          });
        });
      }
    );
    req.on('error', reject);
    req.end();
  });
}

async function getPlayerConfigs(lessonId) {
  const lesson = await request(
    'GET',
    `${BASE}/pl/teach/control/lesson/view?id=${lessonId}&editMode=0`
  );
  const iframe = (lesson.body.match(/data-iframe-src="([^"]+)"/) || [])[1];
  if (!iframe) return null;
  const player = await request('GET', iframe.replace(/&amp;/g, '&'));
  const raw = (player.body.match(/window\.configs = (\{[\s\S]*?\})\s*<\/script>/) || [])[1];
  return raw ? JSON.parse(raw) : null;
}

function pickBestMediaUrl(masterText) {
  const lines = masterText.split(/\r?\n/);
  let best = null;
  let bestH = -1;
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].startsWith('#EXT-X-STREAM-INF:')) continue;
    const res = (lines[i].match(/RESOLUTION=\d+x(\d+)/) || [])[1];
    const h = Number(res || 0);
    const next = lines[i + 1];
    if (next && /^https?:/.test(next) && h >= bestH && next.includes('cdnvideo')) {
      bestH = h;
      best = next.trim();
    }
  }
  if (!best) {
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith('#EXT-X-STREAM-INF:')) {
        const next = lines[i + 1];
        if (next && /^https?:/.test(next)) return next.trim();
      }
    }
  }
  return best;
}

async function downloadVideo(lessonId, outFile) {
  const configs = await getPlayerConfigs(lessonId);
  if (!configs?.masterPlaylistUrl) throw new Error('no master playlist');
  console.log('duration', configs.videoDuration, 'sec');

  const master = await request('GET', configs.masterPlaylistUrl);
  const mediaUrl = pickBestMediaUrl(master.body);
  if (!mediaUrl) throw new Error('no media playlist');
  console.log('media', mediaUrl.slice(0, 120), '...');

  const media = await request('GET', mediaUrl);
  console.log('media playlist len', media.body.length);
  console.log(media.body.slice(0, 500));

  const workDir = path.join(path.dirname(outFile), `_tmp_${lessonId}`);
  fs.mkdirSync(workDir, { recursive: true });
  fs.writeFileSync(path.join(workDir, 'media.m3u8.orig'), media.body);

  const lines = media.body.split(/\r?\n/);
  const localLines = [];
  let segIndex = 0;
  const segmentFiles = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) {
      localLines.push(line);
      continue;
    }
    if (line.startsWith('#')) {
      // keep tags, but skip map if we handle init separately
      localLines.push(line);
      continue;
    }
    if (!/^https?:/.test(line)) {
      localLines.push(line);
      continue;
    }

    const segName = `seg_${String(segIndex).padStart(5, '0')}.ts`;
    const segPath = path.join(workDir, segName);
    process.stdout.write(`\rseg ${segIndex + 1}...`);
    const seg = await request('GET', line, { binary: true });
    if (seg.status !== 200 || seg.buf.length < 100) {
      throw new Error(`segment fail ${segIndex} status=${seg.status} len=${seg.buf.length}`);
    }
    fs.writeFileSync(segPath, seg.buf);
    segmentFiles.push(segPath);
    localLines.push(segName);
    segIndex++;
  }
  console.log(`\nsegments downloaded: ${segIndex}`);

  // Rewrite playlist: change .bin references already replaced; fix EXT-X-MAP if any
  const localPlaylist = localLines
    .map((line) => {
      if (line.startsWith('#EXT-X-MAP:')) {
        // download init map if present
        const uri = (line.match(/URI="([^"]+)"/) || [])[1];
        if (uri && /^https?:/.test(uri)) {
          return line; // handled below
        }
      }
      return line;
    })
    .join('\n');

  // Handle init segment separately if MAP exists
  const mapMatch = media.body.match(/#EXT-X-MAP:URI="([^"]+)"/);
  if (mapMatch) {
    const init = await request('GET', mapMatch[1], { binary: true });
    const initPath = path.join(workDir, 'init.mp4');
    fs.writeFileSync(initPath, init.buf);
    console.log('init map', init.buf.length);
  }

  // Concat via ffmpeg concat demuxer (safer for fmp4/ts mix)
  const listFile = path.join(workDir, 'concat.txt');
  const concatList = [];
  if (mapMatch && fs.existsSync(path.join(workDir, 'init.mp4'))) {
    // For fMP4: use ffmpeg with local m3u8 after rewriting MAP URI
    const rewritten = media.body
      .split(/\r?\n/)
      .map((line) => {
        if (line.startsWith('#EXT-X-MAP:')) {
          return '#EXT-X-MAP:URI="init.mp4"';
        }
        if (/^https?:/.test(line)) {
          // already consumed in order — rebuild from segmentFiles
          return null;
        }
        return line;
      })
      .filter((l) => l !== null);

    // Better: rebuild playlist with local names in order
    const rebuilt = [];
    let si = 0;
    for (const line of media.body.split(/\r?\n/)) {
      if (line.startsWith('#EXT-X-MAP:')) {
        rebuilt.push('#EXT-X-MAP:URI="init.mp4"');
      } else if (/^https?:/.test(line)) {
        rebuilt.push(`seg_${String(si).padStart(5, '0')}.ts`);
        si++;
      } else {
        rebuilt.push(line);
      }
    }
    const localM3u8 = path.join(workDir, 'local.m3u8');
    fs.writeFileSync(localM3u8, rebuilt.join('\n'));

    await runFfmpeg([
      '-y',
      '-protocol_whitelist',
      'file,crypto',
      '-allowed_extensions',
      'ALL',
      '-i',
      localM3u8,
      '-c',
      'copy',
      '-bsf:a',
      'aac_adtstoasc',
      outFile,
    ]);
  } else {
    // MPEG-TS segments — concat
    fs.writeFileSync(
      listFile,
      segmentFiles.map((f) => `file '${f.replace(/\\/g, '/')}'`).join('\n')
    );
    await runFfmpeg([
      '-y',
      '-f',
      'concat',
      '-safe',
      '0',
      '-i',
      listFile,
      '-c',
      'copy',
      outFile,
    ]);
  }

  if (!fs.existsSync(outFile) || fs.statSync(outFile).size < 1000) {
    throw new Error('output missing or too small');
  }
  console.log('SAVED', outFile, fs.statSync(outFile).size, 'bytes');

  // cleanup tmp
  try {
    fs.rmSync(workDir, { recursive: true, force: true });
  } catch {}
  return outFile;
}

function runFfmpeg(args) {
  return new Promise((resolve, reject) => {
    const ff = spawn('ffmpeg', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let err = '';
    ff.stderr.on('data', (d) => {
      err += d.toString();
    });
    ff.on('close', (code) => {
      if (code === 0) resolve();
      else {
        console.error(err.slice(-2000));
        reject(new Error('ffmpeg failed ' + code));
      }
    });
  });
}

const outDir = `${DIR}\\export\\videos`;
fs.mkdirSync(outDir, { recursive: true });
const outFile = `${outDir}\\lesson_332493229.mp4`;

downloadVideo('332493229', outFile)
  .then(() => {
    fs.writeFileSync(`${DIR}\\cookies.json`, JSON.stringify(cookies, null, 2));
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
