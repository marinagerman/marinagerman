import fs from 'fs';

const html = fs.readFileSync('e:\\КУРСОР МАРИНА КУРС ГЕРМАН\\stream.html', 'utf8');
const rows = [...html.matchAll(
  /data-training-id="(\d+)"[\s\S]*?href='(\/teach\/control\/stream\/view\/id\/\d+)'[\s\S]*?<span class="stream-title">([^<]*)<\/span>/g
)];

const courses = rows.map((m) => ({
  id: m[1],
  url: m[2],
  title: m[3].replace(/\s+/g, ' ').trim(),
}));

console.log('Total courses:', courses.length);
for (const c of courses) {
  console.log(`${c.id}\t${c.title}`);
}
fs.writeFileSync(
  'e:\\КУРСОР МАРИНА КУРС ГЕРМАН\\courses_list.json',
  JSON.stringify(courses, null, 2),
  'utf8'
);
