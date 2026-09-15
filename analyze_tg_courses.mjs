import fs from 'fs';
import path from 'path';

const dir = path.join('e:\\КУРСОР МАРИНА КУРС ГЕРМАН', 'website', 'data', 'courses');
const tgRe = /https?:\/\/t\.me\/[^\s"'<>]+|t\.me\/[^\s"'<>]+/gi;

const courses = [];
const allLinks = new Map();

for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.json'))) {
  const c = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
  const lessons = [
    ...(c.lessons || []),
    ...(c.children || []).flatMap((ch) => ch.lessons || []),
  ];
  const videoCount = lessons.filter(
    (l) => l.kinescope?.length || l.localVideos?.length || l.videos?.length
  ).length;
  const text = lessons.map((l) => `${l.description || ''}\n${l.contentHtml || ''}`).join('\n');
  const links = [...new Set((text.match(tgRe) || []).map((l) => l.replace(/^https?:\/\//, 'https://')))];
  for (const l of links) allLinks.set(l, (allLinks.get(l) || 0) + 1);

  courses.push({
    id: c.id,
    title: c.title,
    category: c.category,
    lessons: lessons.length,
    videos: videoCount,
    tgLinks: links,
    tgOnly: videoCount === 0 && links.length > 0,
  });
}

courses.sort((a, b) => a.videos - b.videos || b.tgLinks.length - a.tgLinks.length);

const tgOnly = courses.filter((c) => c.tgOnly);
const withVideo = courses.filter((c) => c.videos > 0);
const noVideoNoTg = courses.filter((c) => c.videos === 0 && c.tgLinks.length === 0);

console.log('=== SUMMARY ===');
console.log('Total courses:', courses.length);
console.log('With video on site/Kinescope:', withVideo.length);
console.log('Telegram-only access (no video):', tgOnly.length);
console.log('No video, no TG link:', noVideoNoTg.length);
console.log('Unique Telegram links:', allLinks.size);

console.log('\n=== TELEGRAM-ONLY COURSES ===');
for (const c of tgOnly) {
  console.log(`\n[${c.id}] ${c.title}`);
  console.log(`  lessons: ${c.lessons}, videos: ${c.videos}`);
  for (const l of c.tgLinks) console.log(`  ${l}`);
}

console.log('\n=== COURSES WITH FEW VIDEOS + TG (may have more in group) ===');
for (const c of courses.filter((x) => x.videos > 0 && x.videos <= 2 && x.tgLinks.length)) {
  console.log(`[${c.id}] ${c.videos}v — ${c.title}`);
  for (const l of c.tgLinks.slice(0, 2)) console.log(`  ${l}`);
}

const report = {
  generatedAt: new Date().toISOString(),
  summary: {
    total: courses.length,
    withVideo: withVideo.length,
    tgOnly: tgOnly.length,
    noVideoNoTg: noVideoNoTg.length,
    uniqueTgLinks: allLinks.size,
  },
  tgOnlyCourses: tgOnly,
  tgLinks: [...allLinks.entries()].map(([url, count]) => ({ url, courseCount: count })),
};

fs.writeFileSync(
  path.join('e:\\КУРСОР МАРИНА КУРС ГЕРМАН', 'export', 'telegram_groups_report.json'),
  JSON.stringify(report, null, 2),
  'utf8'
);
console.log('\nReport saved: export/telegram_groups_report.json');
