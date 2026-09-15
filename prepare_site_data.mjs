import fs from 'fs';
import path from 'path';

const ROOT = 'e:\\КУРСОР МАРИНА КУРС ГЕРМАН';
const SRC = path.join(ROOT, 'export', 'courses');
const DEST = path.join(ROOT, 'website', 'data');
const VIDEOS = path.join(ROOT, 'export', 'videos');

fs.mkdirSync(path.join(DEST, 'courses'), { recursive: true });

function slimLesson(les) {
  const videoFiles = [];
  try {
    const files = fs.readdirSync(VIDEOS).filter((f) => f.startsWith(`l${les.id}_`) && f.endsWith('.mp4'));
    videoFiles.push(...files);
  } catch {}

  return {
    id: String(les.id),
    title: les.title || '',
    shortDescription: les.shortDescription || '',
    description: (les.description || '').slice(0, 8000),
    contentHtml: (les.contentHtml || '').slice(0, 20000),
    videos: (les.videos || []).map((v) => ({
      type: v.type,
      fileId: v.fileId,
      videoHash: v.videoHash,
      embed: v.embed,
      id: v.id,
    })),
    localVideos: videoFiles,
  };
}

const SKIP_IDS = new Set(['885082881', '934657351']); // демо GetCourse + «Для демонстрации»

const catalog = [];
for (const file of fs.readdirSync(SRC).filter((f) => f.endsWith('.json'))) {
  const course = JSON.parse(fs.readFileSync(path.join(SRC, file), 'utf8'));
  if (SKIP_IDS.has(String(course.id)) || /демонстрац/i.test(course.title || '')) continue;
  const lessons = (course.lessons || []).map(slimLesson);
  const children = (course.children || []).map((ch) => ({
    id: String(ch.id),
    title: ch.title,
    description: (ch.description || '').slice(0, 4000),
    lessons: (ch.lessons || []).map(slimLesson),
  }));

  const allLessons = [
    ...lessons,
    ...children.flatMap((c) => c.lessons),
  ];

  const record = {
    id: String(course.id),
    title: course.title,
    slug: course.slug,
    description: (course.description || '').slice(0, 4000),
    category: course.category || 'other',
    paymentUrl: course.paymentUrl || '',
    sourceUrl: course.sourceUrl || '',
    lessons,
    children,
    lessonsCount: allLessons.length,
    hasLocalVideo: allLessons.some((l) => l.localVideos?.length),
  };

  fs.writeFileSync(
    path.join(DEST, 'courses', `${record.id}.json`),
    JSON.stringify(record, null, 2),
    'utf8'
  );

  catalog.push({
    id: record.id,
    title: record.title,
    slug: record.slug,
    description: record.description.slice(0, 400),
    category: record.category,
    paymentUrl: record.paymentUrl,
    lessonsCount: record.lessonsCount,
    hasLocalVideo: record.hasLocalVideo,
  });
}

catalog.sort((a, b) => a.title.localeCompare(b.title, 'ru'));
fs.writeFileSync(path.join(DEST, 'catalog.json'), JSON.stringify(catalog, null, 2), 'utf8');

if (!fs.existsSync(path.join(DEST, 'users.json'))) {
  fs.writeFileSync(path.join(DEST, 'users.json'), '[]', 'utf8');
}
if (!fs.existsSync(path.join(DEST, 'purchases.json'))) {
  fs.writeFileSync(path.join(DEST, 'purchases.json'), '[]', 'utf8');
}

console.log('Prepared', catalog.length, 'courses -> website/data');
