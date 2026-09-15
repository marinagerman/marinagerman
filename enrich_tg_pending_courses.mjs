/**
 * Enrich high-priority TG-only courses with richer on-site text
 * (while Telegram media download is pending).
 */
import fs from 'fs';
import path from 'path';

const ROOT = 'e:\\КУРСОР МАРИНА КУРС ГЕРМАН';
const COURSES = path.join(ROOT, 'website', 'data', 'courses');
const report = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'export', 'telegram_upload_recommendation.json'), 'utf8')
);
const high = report.courses.filter((c) => c.priority === 'high');

function buildTextLesson(course, link) {
  return {
    id: `pending-tg-${course.id}`,
    title: 'Как проходит обучение',
    shortDescription: 'Формат и что будет после переноса материалов',
    description: [
      `Курс «${course.title}» сейчас выдан ученикам через Telegram-группу.`,
      '',
      'Мы переносим материалы на сайт для удобства:',
      '• видеозаписи встреч и уроков → Kinescope (с защитой от скачивания)',
      '• голосовые пояснения Марины → на сайт (плеер) и при возможности в Kinescope',
      '• важные текстовые сообщения → в уроки курса',
      '',
      link ? `Исходная группа: ${link}` : '',
      '',
      'После импорта здесь появятся отдельные уроки с видео и аудио.',
    ]
      .filter(Boolean)
      .join('\n'),
    contentHtml: `<p>Курс <strong>«${course.title}»</strong> исторически шёл через Telegram.</p>
<p>Идёт перенос материалов на платформу: видео → Kinescope, голосовые и тексты Марины → в уроки личного кабинета.</p>
${link ? `<p>Группа: <a href="${link}" target="_blank" rel="noreferrer">${link}</a></p>` : ''}
<p><em>Статус: ожидает выгрузки из Telegram (нужен вход в аккаунт Марины).</em></p>`,
    videos: [],
    localVideos: [],
    kinescope: [],
    localAudio: [],
  };
}

let n = 0;
for (const item of high) {
  const p = path.join(COURSES, `${item.id}.json`);
  if (!fs.existsSync(p)) continue;
  const course = JSON.parse(fs.readFileSync(p, 'utf8'));
  const link = item.tg?.[0] || '';

  // don't duplicate
  const exists = (course.lessons || []).some((l) => l.id === `pending-tg-${course.id}`);
  if (!exists) {
    course.lessons = [buildTextLesson(course, link), ...(course.lessons || [])];
  }

  // ensure marketing description mentions transfer
  if (!/Telegram|телеграм/i.test(course.description || '')) {
    course.description =
      (course.description || '') +
      '\n\nФормат: материалы курса переносятся из Telegram-группы в личный кабинет (видео, голосовые пояснения и тексты).';
  }

  course.lessonsCount =
    (course.lessons || []).length +
    (course.children || []).reduce((s, ch) => s + (ch.lessons?.length || 0), 0);

  fs.writeFileSync(p, JSON.stringify(course, null, 2), 'utf8');
  n++;
}

// update catalog counts
const catalogPath = path.join(ROOT, 'website', 'data', 'catalog.json');
const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
for (const item of catalog) {
  const p = path.join(COURSES, `${item.id}.json`);
  if (!fs.existsSync(p)) continue;
  const c = JSON.parse(fs.readFileSync(p, 'utf8'));
  item.lessonsCount = c.lessonsCount;
  if (c.description) item.description = c.description.split('\n')[0].slice(0, 400);
}
fs.writeFileSync(catalogPath, JSON.stringify(catalog, null, 2), 'utf8');

console.log('Enriched', n, 'high-priority TG courses with on-site text lessons');
