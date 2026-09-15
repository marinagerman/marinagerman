import fs from 'fs';
import path from 'path';

const ROOT = 'e:\\КУРСОР МАРИНА КУРС ГЕРМАН';
const report = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'export', 'telegram_upload_recommendation.json'), 'utf8')
);
const high = report.courses.filter((c) => c.priority === 'high');
const BASE = path.join(ROOT, 'export', 'tg_media');

fs.mkdirSync(BASE, { recursive: true });

const jobs = [];
for (const c of high) {
  const dir = path.join(BASE, c.id);
  fs.mkdirSync(path.join(dir, 'video'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'voice'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'audio'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'docs'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'text'), { recursive: true });

  const job = {
    courseId: c.id,
    title: c.title,
    inviteLinks: c.tg,
    status: 'pending_telegram_login',
    folders: {
      video: path.join(dir, 'video'),
      voice: path.join(dir, 'voice'),
      audio: path.join(dir, 'audio'),
      docs: path.join(dir, 'docs'),
      text: path.join(dir, 'text'),
    },
    counts: { video: 0, voice: 0, audio: 0, docs: 0, textMessages: 0 },
  };
  fs.writeFileSync(path.join(dir, 'job.json'), JSON.stringify(job, null, 2), 'utf8');
  jobs.push(job);
}

fs.writeFileSync(path.join(BASE, 'jobs.json'), JSON.stringify({ createdAt: new Date().toISOString(), jobs }, null, 2), 'utf8');
console.log('Prepared folders for', jobs.length, 'high-priority courses in export/tg_media/');
for (const j of jobs) console.log('-', j.courseId, j.title);
