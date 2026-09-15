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
          Accept: 'text/html,application/json,*/*',
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
          resolve(request(method, loc, redirects - 1));
          return;
        }
        const chunks = [];
        res.on('data', (d) => chunks.push(d));
        res.on('end', () =>
          resolve({
            status: res.statusCode,
            body: Buffer.concat(chunks).toString('utf8'),
            url: urlStr,
          })
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

function slugify(s) {
  return String(s)
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^a-zа-я0-9]+/gi, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}

function stripTags(html) {
  return String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/\s+\n/g, '\n')
    .replace(/\n\s+/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

function parseLessons(html) {
  const lessons = [];
  const re =
    /data-lesson-id="(\d+)"[\s\S]*?<div class="link title"[^>]*>\s*([^<\n]+)/g;
  let m;
  while ((m = re.exec(html))) {
    lessons.push({ id: m[1], title: m[2].replace(/\s+/g, ' ').trim() });
  }
  const map = new Map();
  for (const l of lessons) if (!map.has(l.id)) map.set(l.id, l);
  return [...map.values()];
}

function parseChildTrainings(html, parentId) {
  const kids = [];
  const re =
    /data-training-id="(\d+)"[\s\S]*?<span class="stream-title">([^<]*)<\/span>/g;
  let m;
  while ((m = re.exec(html))) {
    if (m[1] !== parentId) {
      kids.push({ id: m[1], title: m[2].replace(/\s+/g, ' ').trim() });
    }
  }
  const map = new Map();
  for (const k of kids) if (!map.has(k.id)) map.set(k.id, k);
  return [...map.values()];
}

function extractText(html) {
  const parts = [];
  const shortDesc = html.match(/class="lesson-description-value">([\s\S]*?)<\/span>/);
  if (shortDesc) {
    const t = stripTags(shortDesc[1]);
    if (t) parts.push(t);
  }
  for (const b of html.matchAll(
    /lt-lesson-text[\s\S]*?<div data-editable="true"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/g
  )) {
    const t = stripTags(b[1]);
    if (t.length > 5) parts.push(t);
  }
  for (const b of html.matchAll(
    /lt-lesson-mission-block[\s\S]*?<div class="lt-block-wrapper">([\s\S]*?)<\/div><\/div>/g
  )) {
    const t = stripTags(b[1]);
    if (t.length > 20) parts.push(t);
  }
  const links = [...html.matchAll(/href="(https?:\/\/[^"]+)"/g)]
    .map((x) => x[1])
    .filter((u) => /t\.me|youtube|vk\.com|rutube|disk\.|drive\.|docs\./i.test(u));
  if (links.length) parts.push('Ссылки:\n' + [...new Set(links)].join('\n'));
  return [...new Set(parts)].join('\n\n').slice(0, 12000);
}

function extractContentHtml(html) {
  const parts = [];
  for (const m of html.matchAll(
    /lt-lesson-text[\s\S]*?<div data-editable="true"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/g
  )) {
    parts.push(m[1]);
  }
  return parts.join('\n').slice(0, 30000);
}

function extractVideos(html) {
  const videos = [];
  for (const block of html.matchAll(/lt-lesson-video[\s\S]{0,20000}/gi)) {
    const chunk = block[0];
    for (const h of chunk.matchAll(/([A-Z0-9]{2}\.[a-f0-9]{32}\.[a-z0-9.]+)/gi)) {
      videos.push({ type: 'fileservice', hash: h[1] });
    }
    for (const id of chunk.matchAll(/data-file-id=["'](\d+)["']/gi)) {
      videos.push({ type: 'fileId', id: id[1] });
    }
  }
  for (const h of html.matchAll(
    /([A-Z0-9]{2}\.[a-f0-9]{32}\.(?:mp4|mov|webm|mkv)[^"'\\\s]*)/gi
  )) {
    videos.push({
      type: 'fileservice',
      hash: h[1],
      downloadHint: `https://fs.getcourse.ru/fileservice/file/download/a/790166/sc/131/h/${h[1]}`,
    });
  }
  for (const y of html.matchAll(
    /(?:youtube\.com\/watch\?v=|youtu\.be\/)([A-Za-z0-9_\-]+)/g
  )) {
    videos.push({
      type: 'youtube',
      id: y[1],
      embed: `https://www.youtube.com/embed/${y[1]}`,
    });
  }
  for (const e of html.matchAll(
    /src=["']([^"']+(?:kinescope\.io|player\.getcourse)[^"']+)["']/gi
  )) {
    videos.push({ type: 'embed', url: e[1] });
  }
  const seen = new Set();
  return videos.filter((v) => {
    const key = JSON.stringify(v);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function fetchTraining(id) {
  const res = await request('GET', `${BASE}/teach/control/stream/view/id/${id}`);
  const title =
    (res.body.match(/<title>([^<]+)<\/title>/) || [])[1]?.replace(/\s+/g, ' ').trim() ||
    id;
  return {
    id,
    title,
    lessons: parseLessons(res.body),
    children: parseChildTrainings(res.body, id),
    description: extractText(res.body),
  };
}

async function fetchLesson(id) {
  const res = await request(
    'GET',
    `${BASE}/pl/teach/control/lesson/view?id=${id}&editMode=0`
  );
  const title =
    (res.body.match(/<title>([^<]+)<\/title>/) || [])[1]?.replace(/\s+/g, ' ').trim() ||
    id;
  return {
    id,
    title,
    shortDescription: stripTags(
      (res.body.match(/class="lesson-description-value">([\s\S]*?)<\/span>/) || [])[1] ||
        ''
    ),
    description: extractText(res.body),
    contentHtml: extractContentHtml(res.body),
    videos: extractVideos(res.body),
  };
}

async function main() {
  const check = await request('GET', `${BASE}/teach/control/stream`);
  if (!/accountUserId = (?!-1)\d+/.test(check.body)) {
    console.log('Session expired');
    process.exit(1);
  }
  fs.writeFileSync(`${DIR}\\cookies.json`, JSON.stringify(cookies, null, 2));

  const allCourses = JSON.parse(
    fs.readFileSync(`${DIR}\\courses_list.json`, 'utf8')
  ).filter((c) => c.id !== '885082881' && c.id !== '934657351' && !/демонстрац/i.test(c.title || ''));

  const outDir = `${DIR}\\export`;
  fs.mkdirSync(`${outDir}\\courses`, { recursive: true });

  const catalog = [];
  let lessonCount = 0;

  for (let i = 0; i < allCourses.length; i++) {
    const c = allCourses[i];
    console.log(`[${i + 1}/${allCourses.length}] ${c.id} ${c.title}`);
    try {
      const training = await fetchTraining(c.id);
      const lessonDetails = [];
      for (const les of training.lessons) {
        await sleep(200);
        try {
          const detail = await fetchLesson(les.id);
          lessonDetails.push(detail);
          lessonCount++;
          console.log(
            `  + lesson ${les.id}: videos=${detail.videos.length} text=${detail.description.length}`
          );
        } catch (e) {
          console.log(`  ! lesson ${les.id}`, e.message);
          lessonDetails.push({ id: les.id, title: les.title, error: e.message });
        }
      }

      const childData = [];
      for (const ch of training.children.slice(0, 40)) {
        await sleep(150);
        try {
          const ct = await fetchTraining(ch.id);
          const childLessons = [];
          for (const les of ct.lessons) {
            await sleep(200);
            try {
              const detail = await fetchLesson(les.id);
              childLessons.push(detail);
              lessonCount++;
            } catch (e) {
              childLessons.push({ id: les.id, title: les.title, error: e.message });
            }
          }
          childData.push({
            id: ct.id,
            title: ct.title,
            description: ct.description,
            lessons: childLessons,
          });
          console.log(`  child ${ch.id}: ${ct.title} lessons=${childLessons.length}`);
        } catch (e) {
          childData.push({ id: ch.id, title: ch.title, error: e.message });
        }
      }

      const record = {
        id: training.id,
        title: training.title,
        slug: slugify(training.title),
        description: training.description,
        lessons: lessonDetails,
        children: childData,
        sourceUrl: `${BASE}/teach/control/stream/view/id/${c.id}`,
        paymentUrl: '',
        category: categorize(training.title),
      };
      catalog.push({
        id: record.id,
        title: record.title,
        slug: record.slug,
        description: record.description.slice(0, 600),
        lessonsCount:
          lessonDetails.length +
          childData.reduce((n, ch) => n + (ch.lessons?.length || 0), 0),
        childrenCount: childData.length,
        category: record.category,
        paymentUrl: '',
      });
      fs.writeFileSync(
        `${outDir}\\courses\\${record.id}.json`,
        JSON.stringify(record, null, 2),
        'utf8'
      );
    } catch (e) {
      console.log('FAIL', c.id, e.message);
      catalog.push({ id: c.id, title: c.title, error: e.message });
    }
    fs.writeFileSync(`${outDir}\\catalog.json`, JSON.stringify(catalog, null, 2), 'utf8');
    await sleep(200);
  }

  fs.writeFileSync(`${DIR}\\cookies.json`, JSON.stringify(cookies, null, 2));
  console.log('DONE courses', catalog.length, 'lessons', lessonCount);
}

function categorize(title) {
  const t = title.toLowerCase();
  if (/таро|tarot/.test(t)) return 'tarot';
  if (/тета|theta|хилинг/.test(t)) return 'thetahealing';
  if (/нумеролог|числ/.test(t)) return 'numerology';
  if (/вебинар/.test(t)) return 'webinar';
  if (/сесс|расстанов|энерго/.test(t)) return 'session';
  if (/марафон|интенсив|курс|тренинг|клуб/.test(t)) return 'course';
  return 'other';
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
