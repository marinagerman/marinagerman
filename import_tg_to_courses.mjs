/**
 * Import downloaded Telegram media into site courses + Kinescope.
 * Run after download_telegram_high_priority.mjs
 *
 * - video/*.mp4 → Kinescope → lesson.kinescope
 * - voice/*.ogg → convert to mp4 (ffmpeg) → Kinescope, or keep as local audio
 * - text/messages.txt → lesson content on site
 */
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import https from 'https';
import http from 'http';
import { URL } from 'url';

const ROOT = 'e:\\КУРСОР МАРИНА КУРС ГЕРМАН';
const BASE = path.join(ROOT, 'export', 'tg_media');
const COURSES = path.join(ROOT, 'website', 'data', 'courses');
const VIDEOS = path.join(ROOT, 'export', 'videos');
const ENV = path.join(ROOT, 'website', '.env.local');
const MANIFEST = path.join(VIDEOS, 'tg_kinescope_manifest.json');
const LOG = path.join(BASE, 'import.log');
const CHUNK = 8 * 1024 * 1024;

function loadEnv() {
  const out = {};
  for (const line of fs.readFileSync(ENV, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) out[m[1]] = m[2].trim();
  }
  return out;
}

const env = loadEnv();
const TOKEN = env.KINESCOPE_API_TOKEN;
const PROJECT_ID = env.KINESCOPE_PROJECT_ID;

function log(...args) {
  const line = `[${new Date().toISOString()}] ${args.join(' ')}`;
  console.log(line);
  fs.appendFileSync(LOG, line + '\n', 'utf8');
}

const manifest = fs.existsSync(MANIFEST)
  ? JSON.parse(fs.readFileSync(MANIFEST, 'utf8'))
  : { videos: {} };

function saveManifest() {
  fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2), 'utf8');
}

function request(method, urlStr, { headers = {}, body = null } = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(urlStr);
    const lib = u.protocol === 'http:' ? http : https;
    const req = lib.request(
      {
        method,
        hostname: u.hostname,
        path: u.pathname + u.search,
        headers: { Authorization: `Bearer ${TOKEN}`, Accept: 'application/json', ...headers },
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
          resolve({ status: res.statusCode, headers: res.headers, text: buf.toString('utf8'), json, buf });
        });
      }
    );
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function uploadFile(filePath, title) {
  const key = path.basename(filePath);
  if (manifest.videos[key]?.id) return manifest.videos[key];

  const size = fs.statSync(filePath).size;
  const init = await request('POST', 'https://uploader.kinescope.io/v2/init', {
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      filesize: size,
      type: 'video',
      title,
      parent_id: PROJECT_ID,
    }),
  });
  if (init.status >= 400) throw new Error(`init ${init.status} ${init.text}`);
  const data = init.json?.data || init.json;
  const videoId = data.id;
  const endpoint = data.endpoint;
  log('init', key, videoId);

  const fd = fs.openSync(filePath, 'r');
  let offset = 0;
  const buf = Buffer.alloc(CHUNK);
  try {
    while (offset < size) {
      const read = fs.readSync(fd, buf, 0, Math.min(CHUNK, size - offset), offset);
      const chunk = buf.subarray(0, read);
      const end = offset + read - 1;
      const res = await request('PATCH', endpoint, {
        headers: {
          'Content-Type': 'application/offset+octet-stream',
          'Upload-Offset': String(offset),
          'Tus-Resumable': '1.0.0',
          'Content-Length': String(read),
        },
        body: chunk,
      });
      if (res.status >= 400 && res.status !== 204) {
        throw new Error(`patch ${res.status} ${res.text}`);
      }
      offset += read;
    }
  } finally {
    fs.closeSync(fd);
  }

  const info = {
    id: videoId,
    embed: `https://kinescope.io/embed/${videoId}`,
    playLink: `https://kinescope.io/${videoId}`,
    title,
    file: key,
  };
  // Some Kinescope responses use short id in play link differently — keep embed pattern used before
  manifest.videos[key] = info;
  saveManifest();
  return info;
}

function convertVoiceToMp4(oggPath) {
  const out = oggPath.replace(/\.ogg$/i, '.mp4');
  if (fs.existsSync(out)) return out;
  const r = spawnSync(
    'ffmpeg',
    ['-y', '-f', 'lavfi', '-i', 'color=c=black:s=1280x720:d=1', '-i', oggPath, '-shortest', '-c:v', 'libx264', '-c:a', 'aac', '-pix_fmt', 'yuv420p', out],
    { encoding: 'utf8' }
  );
  if (r.status !== 0) {
    log('ffmpeg fail', oggPath, r.stderr?.slice(-300));
    return null;
  }
  return out;
}

function listFiles(dir, exts) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => exts.some((e) => f.toLowerCase().endsWith(e)))
    .map((f) => path.join(dir, f))
    .sort();
}

function enrichCourseFromTg(courseId) {
  const dir = path.join(BASE, courseId);
  const coursePath = path.join(COURSES, `${courseId}.json`);
  if (!fs.existsSync(coursePath) || !fs.existsSync(dir)) return null;

  const course = JSON.parse(fs.readFileSync(coursePath, 'utf8'));
  const job = JSON.parse(fs.readFileSync(path.join(dir, 'job.json'), 'utf8'));
  const textPath = path.join(dir, 'text', 'messages.txt');
  const textDigest = fs.existsSync(textPath) ? fs.readFileSync(textPath, 'utf8').slice(0, 50000) : '';

  const lessons = [];

  // Intro lesson with TG texts
  lessons.push({
    id: `tg-text-${courseId}`,
    title: 'Материалы из Telegram (тексты)',
    shortDescription: 'Сообщения и пояснения Марины из учебной группы',
    description:
      textDigest ||
      'Текстовые материалы из Telegram будут здесь после выгрузки группы.',
    contentHtml: textDigest
      ? `<div class="tg-digest"><p>Ниже — важные сообщения из Telegram-группы курса (голос овые пояснения Марины также перенесены как отдельные уроки).</p><pre style="white-space:pre-wrap;font-family:inherit">${textDigest
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .slice(0, 30000)}</pre></div>`
      : '<p>Ожидается импорт текстов из Telegram.</p>',
    videos: [],
    localVideos: [],
    kinescope: [],
    localAudio: [],
  });

  return { course, job, lessons, dir };
}

async function main() {
  if (!TOKEN || !PROJECT_ID) {
    console.error('Missing Kinescope env');
    process.exit(1);
  }
  if (!fs.existsSync(path.join(BASE, 'jobs.json'))) {
    console.error('No jobs.json — run prepare_tg_folders.mjs and download first');
    process.exit(1);
  }

  const data = JSON.parse(fs.readFileSync(path.join(BASE, 'jobs.json'), 'utf8'));
  let updated = 0;

  for (const job of data.jobs) {
    const packed = enrichCourseFromTg(job.courseId);
    if (!packed) continue;
    const { course, dir } = packed;
    const newLessons = [...packed.lessons];

    const videos = listFiles(path.join(dir, 'video'), ['.mp4', '.mov', '.webm', '.mkv']);
    const voices = listFiles(path.join(dir, 'voice'), ['.ogg', '.oga']);
    const audios = listFiles(path.join(dir, 'audio'), ['.mp3', '.ogg', '.m4a', '.wav']);

    let i = 1;
    for (const file of videos) {
      const title = `${course.title} — видео ${i}`;
      try {
        const ks = await uploadFile(file, title);
        // copy locally too for backup naming
        const localName = `tg_${job.courseId}_${path.basename(file)}`;
        const dest = path.join(VIDEOS, localName);
        if (!fs.existsSync(dest)) fs.copyFileSync(file, dest);
        newLessons.push({
          id: `tg-video-${job.courseId}-${i}`,
          title: `Видео ${i}`,
          shortDescription: 'Запись из Telegram-группы',
          description: `Видеоматериал курса «${course.title}», перенесённый из Telegram на Kinescope.`,
          contentHtml: `<p>Запись из учебной Telegram-группы.</p>`,
          videos: [],
          localVideos: [localName],
          kinescope: [
            {
              type: 'kinescope',
              id: ks.id,
              embed: ks.embed.includes('embed') ? ks.embed : `https://kinescope.io/embed/${ks.id}`,
              playLink: ks.playLink,
            },
          ],
          localAudio: [],
        });
        i++;
      } catch (e) {
        log('upload video fail', file, e.message);
      }
    }

    let v = 1;
    for (const file of voices) {
      const mp4 = convertVoiceToMp4(file);
      const title = `${course.title} — голосовое ${v}`;
      try {
        let kinescope = [];
        if (mp4) {
          const ks = await uploadFile(mp4, title);
          kinescope = [
            {
              type: 'kinescope',
              id: ks.id,
              embed: `https://kinescope.io/embed/${ks.id}`,
              playLink: ks.playLink,
            },
          ];
        }
        const localName = `tg_${job.courseId}_voice_${path.basename(file)}`;
        const dest = path.join(VIDEOS, localName);
        if (!fs.existsSync(dest)) fs.copyFileSync(file, dest);
        newLessons.push({
          id: `tg-voice-${job.courseId}-${v}`,
          title: `Голосовое пояснение Марины ${v}`,
          shortDescription: 'Голосовое сообщение из Telegram',
          description:
            'Голосовое пояснение Марины из учебной группы. Если плеер Kinescope недоступен — слушайте аудио ниже.',
          contentHtml: `<p>Голосовое сообщение Марины из Telegram.</p>`,
          videos: [],
          localVideos: [],
          kinescope,
          localAudio: [localName],
        });
        v++;
      } catch (e) {
        log('upload voice fail', file, e.message);
      }
    }

    let a = 1;
    for (const file of audios) {
      const localName = `tg_${job.courseId}_audio_${path.basename(file)}`;
      const dest = path.join(VIDEOS, localName);
      if (!fs.existsSync(dest)) fs.copyFileSync(file, dest);
      newLessons.push({
        id: `tg-audio-${job.courseId}-${a}`,
        title: `Аудио ${a}`,
        shortDescription: 'Аудио из Telegram',
        description: 'Аудиоматериал из учебной группы.',
        contentHtml: `<p>Аудио из Telegram.</p>`,
        videos: [],
        localVideos: [],
        kinescope: [],
        localAudio: [localName],
      });
      a++;
    }

    // Keep original access lesson at the end if existed
    const old = [...(course.lessons || [])];
    course.lessons = [...newLessons, ...old.filter((l) => !String(l.id).startsWith('tg-'))];
    course.lessonsCount =
      course.lessons.length + (course.children || []).reduce((s, ch) => s + (ch.lessons?.length || 0), 0);
    course.hasLocalVideo = course.lessons.some((l) => l.localVideos?.length || l.kinescope?.length);
    course.tgImport = {
      at: new Date().toISOString(),
      videos: videos.length,
      voices: voices.length,
      audios: audios.length,
    };

    fs.writeFileSync(path.join(COURSES, `${job.courseId}.json`), JSON.stringify(course, null, 2), 'utf8');
    updated++;
    log('course updated', job.courseId, 'lessons', course.lessons.length);
  }

  // refresh catalog blurbs lightly
  const catalogPath = path.join(ROOT, 'website', 'data', 'catalog.json');
  const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
  for (const item of catalog) {
    const p = path.join(COURSES, `${item.id}.json`);
    if (!fs.existsSync(p)) continue;
    const c = JSON.parse(fs.readFileSync(p, 'utf8'));
    item.lessonsCount = c.lessonsCount;
    item.hasLocalVideo = c.hasLocalVideo;
  }
  fs.writeFileSync(catalogPath, JSON.stringify(catalog, null, 2), 'utf8');

  console.log('Updated courses:', updated);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
