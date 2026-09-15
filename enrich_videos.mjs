import fs from 'fs';
import https from 'https';
import { URL } from 'url';

const DIR = 'e:\\КУРСОР МАРИНА КУРС ГЕРМАН';
const BASE = 'https://marinagerman.getcourse.ru';
let cookies = JSON.parse(fs.readFileSync(`${DIR}\\cookies.json`, 'utf8'));

function cookieHeader() {
  return Object.entries(cookies)
    .map(([k, v]) => `${k}=${v}`)
    .join('; ');
}

function request(method, urlStr, redirects = 8) {
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
        if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location && redirects > 0) {
          const loc = res.headers.location.startsWith('http')
            ? res.headers.location
            : `${u.protocol}//${u.host}${res.headers.location}`;
          res.resume();
          return resolve(request(method, loc, redirects - 1));
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

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function extractVideos(html) {
  const videos = [];
  const re =
    /data-file-id="(\d+)"[^>]*data-user-id="(\d+)"[^>]*data-video-hash="([a-f0-9]+)"[^>]*data-lesson-id="(\d+)"[^>]*data-iframe-src="([^"]+)"/gi;
  let m;
  while ((m = re.exec(html))) {
    let playerJson = null;
    try {
      const u = new URL(m[5].replace(/&amp;/g, '&'));
      const raw = u.searchParams.get('json');
      if (raw) playerJson = JSON.parse(Buffer.from(raw, 'base64').toString('utf8'));
    } catch {}
    videos.push({
      type: 'gcvh',
      fileId: m[1],
      videoHash: m[3],
      lessonId: m[4],
      iframeSrc: m[5].replace(/&amp;/g, '&'),
      player: playerJson,
    });
  }
  // alternate attribute order
  const re2 =
    /data-video-hash="([a-f0-9]+)"[\s\S]{0,400}?data-file-id="(\d+)"[\s\S]{0,400}?data-iframe-src="([^"]+)"/gi;
  while ((m = re2.exec(html))) {
    if (!videos.some((v) => v.videoHash === m[1])) {
      videos.push({
        type: 'gcvh',
        fileId: m[2],
        videoHash: m[1],
        iframeSrc: m[3].replace(/&amp;/g, '&'),
      });
    }
  }
  for (const y of html.matchAll(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([A-Za-z0-9_\-]+)/g)) {
    videos.push({ type: 'youtube', id: y[1], embed: `https://www.youtube.com/embed/${y[1]}` });
  }
  return videos;
}

async function enrichLesson(lesson) {
  if (!lesson?.id) return lesson;
  try {
    const res = await request(
      'GET',
      `${BASE}/pl/teach/control/lesson/view?id=${lesson.id}&editMode=0`
    );
    const videos = extractVideos(res.body);
    return { ...lesson, videos };
  } catch (e) {
    return { ...lesson, videoError: e.message };
  }
}

async function main() {
  const check = await request('GET', `${BASE}/teach/control/stream`);
  if (!/accountUserId = (?!-1)\d+/.test(check.body)) {
    console.log('Session expired — run login.mjs first');
    process.exit(1);
  }

  const dir = `${DIR}\\export\\courses`;
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'));
  let found = 0;
  let lessonsDone = 0;

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const path = `${dir}\\${file}`;
    const course = JSON.parse(fs.readFileSync(path, 'utf8'));
    console.log(`[${i + 1}/${files.length}] ${course.title}`);

    const lessons = [];
    for (const les of course.lessons || []) {
      await sleep(180);
      const enriched = await enrichLesson(les);
      lessons.push(enriched);
      lessonsDone++;
      if (enriched.videos?.length) {
        found += enriched.videos.length;
        console.log(`  lesson ${les.id}: ${enriched.videos.length} video(s)`);
      }
    }
    course.lessons = lessons;

    const children = [];
    for (const ch of course.children || []) {
      const childLessons = [];
      for (const les of ch.lessons || []) {
        await sleep(180);
        const enriched = await enrichLesson(les);
        childLessons.push(enriched);
        lessonsDone++;
        if (enriched.videos?.length) {
          found += enriched.videos.length;
          console.log(`  child lesson ${les.id}: ${enriched.videos.length} video(s)`);
        }
      }
      children.push({ ...ch, lessons: childLessons });
    }
    course.children = children;
    fs.writeFileSync(path, JSON.stringify(course, null, 2), 'utf8');
  }

  fs.writeFileSync(`${DIR}\\cookies.json`, JSON.stringify(cookies, null, 2));
  console.log('DONE lessons', lessonsDone, 'videos found', found);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
