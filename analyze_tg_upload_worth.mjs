import fs from 'fs';
import path from 'path';

const ROOT = 'e:\\КУРСОР МАРИНА КУРС ГЕРМАН';
const dir = path.join(ROOT, 'website', 'data', 'courses');
const tgRe = /https?:\/\/t\.me\/[^\s"'<>]+|t\.me\/[^\s"'<>]+/gi;

function classify(title, links) {
  const t = title.toLowerCase();
  const all = links.join(' ').toLowerCase();

  // Not groups with course videos — personal / care / 1:1
  if (/личной беседы|отдел заботы|оплата курса/i.test(t)) {
    return {
      likelyVideos: 'нет (это чат/личные сообщения, не учебная группа)',
      worthUpload: 'нет',
      priority: 'low',
      note: 'Ссылка на личку Марины или отдел заботы. Видеоуроков там обычно нет.',
    };
  }
  if (/расклад по спец|сессия таро$/i.test(t) && /marina_pogorelova|otdelzaboti|marina_germann/i.test(all)) {
    return {
      likelyVideos: 'скорее нет (персональный формат / аудиоразбор)',
      worthUpload: 'нет или точечно (если пришлют файл — да)',
      priority: 'low',
      note: 'Формат услуги: разбор/сессия через сообщения, не библиотека уроков.',
    };
  }

  // Strong candidates: named courses/trainings delivered only via TG
  if (/таролог|мастер таро|мастерская|тетахил|игра жизни|проводники|числа|границ|исцеление|интенсив|марафон|вебинар|мужчин|женск|действуй|легкая/i.test(t)) {
    return {
      likelyVideos: 'да, вероятно несколько (или много) записей встреч/уроков',
      worthUpload: 'да — высокий приоритет',
      priority: 'high',
      note: 'По названию это полноценное обучение. В GetCourse только инвайт — контент почти наверняка в Telegram.',
    };
  }

  // Groups / circles
  if (/групп|круг|проводник|сопровождение|прорыв/i.test(t)) {
    return {
      likelyVideos: 'возможно (записи встреч + тексты + аудио)',
      worthUpload: 'да, если там есть записи — выборочно самое важное',
      priority: 'medium',
      note: 'Живые группы часто копят видео/голосовые/тексты. Имеет смысл инвентаризация.',
    };
  }

  return {
    likelyVideos: 'неизвестно без входа в группу',
    worthUpload: 'проверить вручную',
    priority: 'medium',
    note: 'В GetCourse только ссылка. Нужно открыть группу и посчитать видео/файлы.',
  };
}

const rows = [];
for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.json'))) {
  const c = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8').replace(/^\uFEFF/, ''));
  if (/демонстрац/i.test(c.title || '')) continue;
  const lessons = [
    ...(c.lessons || []),
    ...(c.children || []).flatMap((ch) => ch.lessons || []),
  ];
  const videoCount = lessons.filter(
    (l) => l.kinescope?.length || l.localVideos?.length || l.videos?.length
  ).length;
  const text = lessons.map((l) => `${l.description || ''}\n${l.contentHtml || ''}`).join('\n');
  const links = [...new Set((text.match(tgRe) || []).map((l) => (l.startsWith('http') ? l : `https://${l}`)))];
  if (videoCount > 0 || !links.length) continue;

  const verdict = classify(c.title, links);
  rows.push({
    id: c.id,
    title: c.title,
    videosOnSite: videoCount,
    tg: links,
    ...verdict,
  });
}

rows.sort((a, b) => {
  const order = { high: 0, medium: 1, low: 2 };
  return (order[a.priority] ?? 9) - (order[b.priority] ?? 9) || a.title.localeCompare(b.title, 'ru');
});

const report = {
  generatedAt: new Date().toISOString(),
  important:
    'Точное число видео в закрытых Telegram-группах извне не видно (ссылки вида t.me/+... приватные). Оценка — по типу продукта + ссылкам в GetCourse. Для точных цифр нужен вход в группы с аккаунта Марины.',
  summary: {
    tgOnlyCourses: rows.length,
    highPriorityUpload: rows.filter((r) => r.priority === 'high').length,
    mediumPriority: rows.filter((r) => r.priority === 'medium').length,
    lowPrioritySkip: rows.filter((r) => r.priority === 'low').length,
  },
  recommendation:
    'Да: для high-приоритета (курсы Таролог/Мастер/Тетахилинг/марафоны/вебинары) стоит скачать видео из TG → локально → Kinescope и привязать к урокам на сайте. Для личек/отдела заботы — не нужно. Для групп «кругов» — сначала инвентаризация (сколько видео/аудио/текстов).',
  courses: rows,
};

fs.writeFileSync(
  path.join(ROOT, 'export', 'telegram_upload_recommendation.json'),
  JSON.stringify(report, null, 2),
  'utf8'
);

console.log('TG-only courses:', rows.length);
console.log('HIGH:', report.summary.highPriorityUpload, 'MED:', report.summary.mediumPriority, 'LOW:', report.summary.lowPrioritySkip);
console.log('\n=== HIGH PRIORITY (upload recommended) ===');
for (const r of rows.filter((x) => x.priority === 'high')) {
  console.log(`\n• ${r.title}`);
  console.log(`  videos on site: ${r.videosOnSite}`);
  console.log(`  likely in TG: ${r.likelyVideos}`);
  console.log(`  worth? ${r.worthUpload}`);
  console.log(`  links: ${r.tg.join(', ')}`);
}
console.log('\n=== MEDIUM ===');
for (const r of rows.filter((x) => x.priority === 'medium')) {
  console.log(`• ${r.title} — ${r.worthUpload}`);
}
console.log('\n=== LOW (skip) ===');
for (const r of rows.filter((x) => x.priority === 'low')) {
  console.log(`• ${r.title} — ${r.note}`);
}
