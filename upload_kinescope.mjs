import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';
import { URL } from 'url';

const ROOT = 'e:\\КУРСОР МАРИНА КУРС ГЕРМАН';
const VIDEOS = path.join(ROOT, 'export', 'videos');
const MANIFEST = path.join(VIDEOS, 'kinescope_manifest.json');
const LOG = path.join(VIDEOS, 'kinescope_upload.log');
const ENV = path.join(ROOT, 'website', '.env.local');
const COURSES = path.join(ROOT, 'website', 'data', 'courses');
const CHUNK = 8 * 1024 * 1024; // 8MB tus chunks for large files

function loadEnv() {
  const text = fs.readFileSync(ENV, 'utf8');
  const out = {};
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) out[m[1]] = m[2].trim();
  }
  return out;
}

const env = loadEnv();
const TOKEN = env.KINESCOPE_API_TOKEN;
const PROJECT_ID = env.KINESCOPE_PROJECT_ID;
if (!TOKEN || !PROJECT_ID) {
  console.error('Missing token/project');
  process.exit(1);
}

const manifest = fs.existsSync(MANIFEST)
  ? JSON.parse(fs.readFileSync(MANIFEST, 'utf8'))
  : { videos: {}, errors: [], updatedLessons: 0 };

function log(...args) {
  const line = `[${new Date().toISOString()}] ${args.join(' ')}`;
  console.log(line);
  try {
    fs.appendFileSync(LOG, line + '\n', 'utf8');
  } catch {}
}

function saveManifest() {
  fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2), 'utf8');
}

function request(method, urlStr, { headers = {}, body = null, timeout = 300000 } = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(urlStr);
    const lib = u.protocol === 'http:' ? http : https;
    const req = lib.request(
      {
        method,
        hostname: u.hostname,
        path: u.pathname + u.search,
        headers: {
          Authorization: `Bearer ${TOKEN}`,
          Accept: 'application/json',
          ...headers,
        },
      },
      (res) => {
        const chunks = [];
        res.on('data', (d) => chunks.push(d));
        res.on('end', () => {
          const buf = Buffer.concat(chunks);
          let json = null;
          try {
            json = JSON.parse(buf.toString('utf8'));
          } catch {}
          resolve({
            status: res.statusCode,
            headers: res.headers,
            text: buf.toString('utf8'),
            json,
            buf,
          });
        });
      }
    );
    req.setTimeout(timeout, () => req.destroy(new Error('timeout')));
    req.on('error', reject);
    if (body) {
      if (Buffer.isBuffer(body) || typeof body === 'string') {
        req.write(body);
        req.end();
      } else if (typeof body.pipe === 'function') {
        body.pipe(req);
      } else {
        req.end();
      }
    } else req.end();
  });
}

function parseName(name) {
  const m = name.match(/^l(\d+)_(\d+)\.mp4$/i);
  return m
    ? { lessonId: m[1], gcFileId: m[2], title: `lesson-${m[1]}` }
    : { lessonId: null, gcFileId: null, title: name.replace(/\.mp4$/i, '') };
}

async function initUpload(filePath, title) {
  const size = fs.statSync(filePath).size;
  const name = path.basename(filePath);
  const res = await request('POST', 'https://uploader.kinescope.io/v2/init', {
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      parent_id: PROJECT_ID,
      type: 'video',
      filename: name,
      filesize: size,
      title,
    }),
  });
  if (res.status < 200 || res.status >= 300 || !res.json?.data?.endpoint) {
    throw new Error(`init failed ${res.status} ${res.text.slice(0, 300)}`);
  }
  return {
    id: res.json.data.id,
    endpoint: res.json.data.endpoint,
    size,
  };
}

async function tusUpload(endpoint, filePath, size) {
  let offset = 0;
  // HEAD to resume if possible
  try {
    const head = await request('HEAD', endpoint, {
      headers: { 'Tus-Resumable': '1.0.0' },
    });
    const off = head.headers['upload-offset'];
    if (off != null) offset = Number(off) || 0;
  } catch {}

  const fd = fs.openSync(filePath, 'r');
  try {
    while (offset < size) {
      const len = Math.min(CHUNK, size - offset);
      const buf = Buffer.alloc(len);
      fs.readSync(fd, buf, 0, len, offset);

      let attempt = 0;
      while (true) {
        attempt++;
        try {
          const res = await request('PATCH', endpoint, {
            headers: {
              'Tus-Resumable': '1.0.0',
              'Upload-Offset': String(offset),
              'Content-Type': 'application/offset+octet-stream',
              'Content-Length': String(len),
            },
            body: buf,
            timeout: 300000,
          });
          if (res.status !== 204 && res.status !== 200) {
            throw new Error(`chunk ${res.status} ${res.text.slice(0, 200)}`);
          }
          const newOff = Number(res.headers['upload-offset'] || offset + len);
          offset = newOff;
          break;
        } catch (e) {
          if (attempt >= 5) throw e;
          await new Promise((r) => setTimeout(r, 1000 * attempt));
        }
      }

      if (offset % (CHUNK * 8) < CHUNK || offset >= size) {
        const pct = ((offset / size) * 100).toFixed(1);
        process.stdout.write(`\r  ${pct}% (${offset}/${size})   `);
      }
    }
  } finally {
    fs.closeSync(fd);
  }
  process.stdout.write('\n');
}

async function getVideo(id) {
  const res = await request('GET', `https://api.kinescope.io/v1/videos/${id}`);
  return res.json?.data || null;
}

function updateSiteLesson(lessonId, kinescope) {
  if (!lessonId || !fs.existsSync(COURSES)) return false;
  let changed = false;
  for (const file of fs.readdirSync(COURSES).filter((f) => f.endsWith('.json'))) {
    const p = path.join(COURSES, file);
    const course = JSON.parse(fs.readFileSync(p, 'utf8'));
    const touch = (les) => {
      if (String(les.id) !== String(lessonId)) return les;
      changed = true;
      const embeds = [
        {
          type: 'kinescope',
          id: kinescope.kinescopeId,
          embed: kinescope.embed,
          playLink: kinescope.playLink || null,
        },
      ];
      return {
        ...les,
        kinescope: embeds,
        // keep localVideos for backup, but player prefers kinescope
      };
    };
    course.lessons = (course.lessons || []).map(touch);
    course.children = (course.children || []).map((ch) => ({
      ...ch,
      lessons: (ch.lessons || []).map(touch),
    }));
    if (changed) {
      fs.writeFileSync(p, JSON.stringify(course, null, 2), 'utf8');
      return true;
    }
  }
  return false;
}

async function uploadOne(filePath) {
  const name = path.basename(filePath);
  const meta = parseName(name);
  const size = fs.statSync(filePath).size;

  if (manifest.videos[name]?.kinescopeId && !manifest.videos[name]?.error) {
    log('SKIP', name);
    return manifest.videos[name];
  }

  log(`UPLOAD ${name} (${(size / 1e9).toFixed(2)} GB) lesson=${meta.lessonId || '-'}`);
  const init = await initUpload(filePath, meta.title);
  log('  init id', init.id);
  await tusUpload(init.endpoint, filePath, size);

  let embed = `https://kinescope.io/embed/${init.id}`;
  let playLink = null;
  let status = 'uploaded';
  try {
    const info = await getVideo(init.id);
    if (info) {
      embed = info.embed_link || embed;
      playLink = info.play_link || null;
      status = info.status || status;
    }
  } catch {}

  const record = {
    file: name,
    lessonId: meta.lessonId,
    gcFileId: meta.gcFileId,
    size,
    kinescopeId: init.id,
    embed,
    playLink,
    status,
    uploadedAt: new Date().toISOString(),
  };
  manifest.videos[name] = record;
  saveManifest();

  if (meta.lessonId && updateSiteLesson(meta.lessonId, record)) {
    manifest.updatedLessons = (manifest.updatedLessons || 0) + 1;
    saveManifest();
    log('  site link updated for lesson', meta.lessonId);
  } else {
    log('  uploaded (lesson link pending map)');
  }

  log('OK', name, init.id);
  return record;
}

async function main() {
  log('=== START Kinescope upload ===');
  log('NOTE: local mp4 files will NOT be deleted');
  log('project', PROJECT_ID);

  const files = fs
    .readdirSync(VIDEOS)
    .filter((f) => f.toLowerCase().endsWith('.mp4'))
    .map((f) => {
      const p = path.join(VIDEOS, f);
      return { name: f, path: p, size: fs.statSync(p).size };
    })
    .sort((a, b) => a.size - b.size);

  log('files to process', files.length);

  let ok = 0;
  let skip = 0;
  let fail = 0;

  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    log(`[${i + 1}/${files.length}] ${f.name}`);
    try {
      if (manifest.videos[f.name]?.kinescopeId && !manifest.videos[f.name]?.error) {
        // still ensure site link
        const rec = manifest.videos[f.name];
        if (rec.lessonId) updateSiteLesson(rec.lessonId, rec);
        skip++;
        continue;
      }
      await uploadOne(f.path);
      ok++;
    } catch (e) {
      fail++;
      log('FAIL', f.name, e.message);
      manifest.errors.push({ file: f.name, error: e.message, at: new Date().toISOString() });
      saveManifest();
      await new Promise((r) => setTimeout(r, 2000));
    }
  }

  log('=== DONE ===', JSON.stringify({ ok, skip, fail, total: files.length }));
}

main().catch((e) => {
  log('FATAL', e.stack || e.message);
  process.exit(1);
});
