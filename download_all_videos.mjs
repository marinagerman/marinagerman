import fs from 'fs';
import https from 'https';
import http from 'http';
import { URL } from 'url';
import { spawn } from 'child_process';
import path from 'path';

const DIR = 'e:\\КУРСОР МАРИНА КУРС ГЕРМАН';
const BASE = 'https://marinagerman.getcourse.ru';
const OUT = path.join(DIR, 'export', 'videos');
const META = path.join(OUT, 'manifest.json');
const LOG = path.join(OUT, 'download_progress.log');

fs.mkdirSync(OUT, { recursive: true });

let cookies = JSON.parse(fs.readFileSync(path.join(DIR, 'cookies.json'), 'utf8'));
const manifest = fs.existsSync(META)
  ? JSON.parse(fs.readFileSync(META, 'utf8'))
  : { videos: {}, errors: [] };

function log(...args) {
  const line = `[${new Date().toISOString()}] ${args.join(' ')}`;
  console.log(line);
  try {
    fs.appendFileSync(LOG, line + '\n', 'utf8');
  } catch {
    // ignore log lock issues
  }
}

function cookieHeader() {
  return Object.entries(cookies)
    .map(([k, v]) => `${k}=${v}`)
    .join('; ');
}

function saveCookies() {
  fs.writeFileSync(path.join(DIR, 'cookies.json'), JSON.stringify(cookies, null, 2));
}

function saveManifest() {
  fs.writeFileSync(META, JSON.stringify(manifest, null, 2));
}

function request(method, urlStr, { redirects = 8, binary = false, timeout = 60000 } = {}) {
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
        if (
          [301, 302, 303, 307, 308].includes(res.statusCode) &&
          res.headers.location &&
          redirects > 0
        ) {
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
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: binary ? buf : buf.toString('utf8'),
            buf,
          });
        });
      }
    );
    req.setTimeout(timeout, () => {
      req.destroy(new Error('timeout'));
    });
    req.on('error', reject);
    req.end();
  });
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function ensureLogin() {
  const check = await request('GET', `${BASE}/teach/control/stream`);
  if (/accountUserId = (?!-1)\d+/.test(check.body)) {
    saveCookies();
    return true;
  }
  log('Session expired, re-login...');
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
        const chunks = [];
        res.on('data', (d) => chunks.push(d));
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8');
          log('login response', text.slice(0, 200));
          resolve();
        });
      }
    );
    req.on('error', reject);
    req.write(body);
    req.end();
  });
  saveCookies();
  const again = await request('GET', `${BASE}/teach/control/stream`);
  return /accountUserId = (?!-1)\d+/.test(again.body);
}

function collectLessons() {
  const dir = path.join(DIR, 'export', 'courses');
  const lessons = [];
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.json'))) {
    const course = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
    for (const les of course.lessons || []) {
      lessons.push({
        lessonId: String(les.id),
        title: les.title,
        courseId: String(course.id),
        courseTitle: course.title,
      });
    }
    for (const ch of course.children || []) {
      for (const les of ch.lessons || []) {
        lessons.push({
          lessonId: String(les.id),
          title: les.title,
          courseId: String(course.id),
          courseTitle: course.title,
          childId: String(ch.id),
          childTitle: ch.title,
        });
      }
    }
  }
  // unique by lessonId
  const map = new Map();
  for (const l of lessons) if (!map.has(l.lessonId)) map.set(l.lessonId, l);
  return [...map.values()];
}

function extractIframeSrc(html) {
  const m = html.match(/data-iframe-src="([^"]+)"/i);
  return m ? m[1].replace(/&amp;/g, '&') : null;
}

async function getPlayerConfigs(lessonId) {
  const lesson = await request(
    'GET',
    `${BASE}/pl/teach/control/lesson/view?id=${lessonId}&editMode=0`
  );
  const iframe = extractIframeSrc(lesson.body);
  if (!iframe) return { noVideo: true, htmlLen: lesson.body.length };
  const player = await request('GET', iframe);
  const raw = (player.body.match(/window\.configs = (\{[\s\S]*?\})\s*<\/script>/) || [])[1];
  if (!raw) return { noVideo: true, hasIframe: true };
  return JSON.parse(raw);
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
    // Prefer cdnvideo pathway at highest resolution
    if (h > bestH || (h === bestH && next.includes('cdnvideo'))) {
      bestH = h;
      best = next;
    }
  }
  return best;
}

function runFfmpeg(args) {
  return new Promise((resolve, reject) => {
    const ff = spawn('ffmpeg', args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: process.env,
    });
    let err = '';
    ff.stderr.on('data', (d) => {
      err += d.toString();
    });
    ff.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error('ffmpeg failed ' + code + '\n' + err.slice(-1500)));
    });
  });
}

async function downloadOne(lesson, configs) {
  const hash = configs.videoHash || configs.supportInfo?.data?.VideoHash;
  const fileId = configs.gcFileId;
  const key = hash || `lesson_${lesson.lessonId}`;
  const outName = `l${lesson.lessonId}_${fileId || hash}.mp4`;
  const outFile = path.join(OUT, outName);

  if (fs.existsSync(outFile) && fs.statSync(outFile).size > 100000) {
    log('SKIP exists', outName, fs.statSync(outFile).size);
    manifest.videos[key] = {
      ...manifest.videos[key],
      lessonId: lesson.lessonId,
      file: outName,
      size: fs.statSync(outFile).size,
      skipped: true,
    };
    saveManifest();
    return outFile;
  }

  const master = await request('GET', configs.masterPlaylistUrl);
  const mediaUrl = pickBestMediaUrl(master.body);
  if (!mediaUrl) throw new Error('no media playlist');

  const media = await request('GET', mediaUrl);
  const workDir = path.join(OUT, `_tmp_${lesson.lessonId}`);
  fs.mkdirSync(workDir, { recursive: true });

  const urlLines = media.body.split(/\r?\n/).filter((l) => /^https?:/.test(l));
  log(
    `lesson ${lesson.lessonId}: ${urlLines.length} segs, ~${configs.videoDuration || '?'}s -> ${outName}`
  );

  let segIndex = 0;
  for (const url of urlLines) {
    const segName = `seg_${String(segIndex).padStart(5, '0')}.ts`;
    const segPath = path.join(workDir, segName);
    let ok = false;
    for (let attempt = 1; attempt <= 4; attempt++) {
      try {
        const seg = await request('GET', url, { binary: true, timeout: 90000 });
        if (seg.status === 200 && seg.buf.length > 50) {
          fs.writeFileSync(segPath, seg.buf);
          ok = true;
          break;
        }
      } catch (e) {
        if (attempt === 4) throw e;
        await sleep(500 * attempt);
      }
    }
    if (!ok) throw new Error('segment failed ' + segIndex);
    segIndex++;
    if (segIndex % 50 === 0) log(`  ${lesson.lessonId}: ${segIndex}/${urlLines.length}`);
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

  try {
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
  } catch (e) {
    // fallback concat for mpegts
    const listFile = path.join(workDir, 'concat.txt');
    const files = [];
    for (let i = 0; i < si; i++) {
      files.push(path.join(workDir, `seg_${String(i).padStart(5, '0')}.ts`));
    }
    fs.writeFileSync(
      listFile,
      files.map((f) => `file '${f.replace(/\\/g, '/')}'`).join('\n')
    );
    await runFfmpeg(['-y', '-f', 'concat', '-safe', '0', '-i', listFile, '-c', 'copy', outFile]);
  }

  const size = fs.statSync(outFile).size;
  if (size < 1000) throw new Error('output too small');

  manifest.videos[key] = {
    lessonId: lesson.lessonId,
    title: lesson.title,
    courseId: lesson.courseId,
    courseTitle: lesson.courseTitle,
    fileId,
    videoHash: hash,
    duration: configs.videoDuration,
    file: outName,
    size,
    savedAt: new Date().toISOString(),
  };
  saveManifest();

  try {
    fs.rmSync(workDir, { recursive: true, force: true });
  } catch {}

  log('SAVED', outName, size);
  return outFile;
}

async function main() {
  process.env.Path =
    [process.env.Path, process.env.Path]
      .concat([
        process.env.LOCALAPPDATA + '\\Microsoft\\WinGet\\Links',
      ])
      .filter(Boolean)
      .join(';');

  // Ensure ffmpeg on PATH for this process
  const machinePath = process.env.Path || '';
  if (!machinePath.toLowerCase().includes('ffmpeg')) {
    // WinGet often puts shim in Links
  }

  log('=== START download all videos ===');
  if (!(await ensureLogin())) {
    log('LOGIN FAILED');
    process.exit(1);
  }
  log('Login OK');

  const lessons = collectLessons();
  log('Lessons to scan:', lessons.length);

  let withVideo = 0;
  let downloaded = 0;
  let skipped = 0;
  let noVideo = 0;
  let failed = 0;

  for (let i = 0; i < lessons.length; i++) {
    const lesson = lessons[i];
    log(`[${i + 1}/${lessons.length}] lesson ${lesson.lessonId} — ${lesson.title}`);
    try {
      if (i > 0 && i % 30 === 0) {
        await ensureLogin();
      }
      await sleep(200);
      const configs = await getPlayerConfigs(lesson.lessonId);
      if (configs.noVideo || !configs.masterPlaylistUrl) {
        noVideo++;
        log('  no video');
        continue;
      }
      withVideo++;
      const before = Object.keys(manifest.videos).length;
      await downloadOne(lesson, configs);
      const after = Object.keys(manifest.videos).length;
      if (after > before || manifest.videos[configs.videoHash]?.skipped) {
        if (manifest.videos[configs.videoHash]?.skipped) skipped++;
        else downloaded++;
      } else downloaded++;
      saveCookies();
    } catch (e) {
      failed++;
      log('  FAIL', e.message);
      manifest.errors.push({
        lessonId: lesson.lessonId,
        title: lesson.title,
        error: e.message,
        at: new Date().toISOString(),
      });
      saveManifest();
      // re-login on auth-ish failures
      if (/login|auth|401|403|session/i.test(e.message)) {
        await ensureLogin();
      }
      await sleep(1000);
    }
  }

  log('=== DONE ===');
  log(
    JSON.stringify({
      lessons: lessons.length,
      withVideo,
      downloaded,
      skipped,
      noVideo,
      failed,
      files: Object.keys(manifest.videos).length,
    })
  );
  saveCookies();
  saveManifest();
}

main().catch((e) => {
  log('FATAL', e.stack || e.message);
  process.exit(1);
});
