/**
 * Download media from Telegram groups for high-priority courses.
 *
 * Needs once:
 * 1) https://my.telegram.org → API development tools → create app
 * 2) Put into website/.env.local:
 *    TG_API_ID=...
 *    TG_API_HASH=...
 *    TG_PHONE=+79...
 * 3) Run: node download_telegram_high_priority.mjs
 *    Enter the login code from Telegram (and 2FA password if asked).
 *
 * Session is saved to export/tg_media/telegram.session.json for next runs.
 */
import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';
import { Api } from 'telegram/tl/index.js';
import { NewMessage } from 'telegram/events/index.js';

const ROOT = 'e:\\КУРСОР МАРИНА КУРС ГЕРМАН';
const BASE = path.join(ROOT, 'export', 'tg_media');
const ENV = path.join(ROOT, 'website', '.env.local');
const SESSION_FILE = path.join(BASE, 'telegram.session.json');
const LOG = path.join(BASE, 'download.log');
const JOBS = path.join(BASE, 'jobs.json');

function loadEnv() {
  const out = {};
  if (!fs.existsSync(ENV)) return out;
  for (const line of fs.readFileSync(ENV, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) out[m[1]] = m[2].trim();
  }
  return out;
}

function log(...args) {
  const line = `[${new Date().toISOString()}] ${args.join(' ')}`;
  console.log(line);
  fs.appendFileSync(LOG, line + '\n', 'utf8');
}

function ask(q) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) =>
    rl.question(q, (a) => {
      rl.close();
      resolve(a.trim());
    })
  );
}

function safeName(s) {
  return String(s || 'file')
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
    .slice(0, 80);
}

async function downloadMediaForJob(client, job) {
  const link = job.inviteLinks[0];
  if (!link) {
    log('SKIP no link', job.courseId);
    return job;
  }

  log('JOIN/OPEN', job.courseId, job.title, link);
  let entity;
  try {
    // join invite if needed
    if (link.includes('t.me/+') || link.includes('joinchat')) {
      const hash = link.split('+').pop().split('/').pop().replace(/^joinchat\//, '');
      try {
        await client.invoke(new Api.messages.ImportChatInvite({ hash }));
        log('Joined invite', hash);
      } catch (e) {
        // already participant is ok
        log('ImportChatInvite:', e.errorMessage || e.message);
      }
      const updates = await client.invoke(new Api.messages.CheckChatInvite({ hash }));
      if (updates?.chat) entity = updates.chat;
    }
    if (!entity) {
      entity = await client.getEntity(link);
    }
  } catch (e) {
    log('ERROR open group', job.courseId, e.errorMessage || e.message);
    job.status = 'error_open_group';
    job.error = e.errorMessage || e.message;
    return job;
  }

  const dir = path.join(BASE, job.courseId);
  const counts = { video: 0, voice: 0, audio: 0, docs: 0, textMessages: 0 };
  const texts = [];
  let offsetId = 0;
  let fetched = 0;
  const LIMIT = 3000; // safety cap per group

  while (fetched < LIMIT) {
    const messages = await client.getMessages(entity, { limit: 100, offsetId: offsetId || undefined });
    if (!messages.length) break;
    for (const msg of messages) {
      fetched++;
      offsetId = msg.id;
      const date = msg.date ? new Date(msg.date * 1000).toISOString().slice(0, 10) : 'nodate';
      const base = `${date}_${msg.id}`;

      if (msg.message && msg.message.trim().length > 20) {
        counts.textMessages++;
        texts.push({
          id: msg.id,
          date,
          text: msg.message,
          hasMedia: Boolean(msg.media),
        });
      }

      if (!msg.media) continue;

      try {
        if (msg.video || msg.media?.document?.mimeType?.startsWith('video/')) {
          const file = path.join(dir, 'video', `${base}.mp4`);
          if (!fs.existsSync(file)) {
            log('DL video', job.courseId, base);
            await client.downloadMedia(msg, { outputFile: file });
          }
          counts.video++;
        } else if (msg.voice) {
          const file = path.join(dir, 'voice', `${base}.ogg`);
          if (!fs.existsSync(file)) {
            log('DL voice', job.courseId, base);
            await client.downloadMedia(msg, { outputFile: file });
          }
          counts.voice++;
        } else if (msg.audio || msg.media?.document?.mimeType?.startsWith('audio/')) {
          const ext = (msg.media?.document?.mimeType || '').includes('mpeg') ? 'mp3' : 'ogg';
          const file = path.join(dir, 'audio', `${base}.${ext}`);
          if (!fs.existsSync(file)) {
            log('DL audio', job.courseId, base);
            await client.downloadMedia(msg, { outputFile: file });
          }
          counts.audio++;
        } else if (msg.document) {
          const name = safeName(msg.file?.name || `${base}.bin`);
          const file = path.join(dir, 'docs', name);
          if (!fs.existsSync(file)) {
            log('DL doc', job.courseId, name);
            await client.downloadMedia(msg, { outputFile: file });
          }
          counts.docs++;
        }
      } catch (e) {
        log('DL fail', job.courseId, msg.id, e.message);
      }
    }
    if (messages.length < 100) break;
  }

  fs.writeFileSync(path.join(dir, 'text', 'messages.json'), JSON.stringify(texts, null, 2), 'utf8');
  // human-readable digest for site import
  const digest = texts
    .slice()
    .reverse()
    .map((t) => `[${t.date}]\n${t.text}`)
    .join('\n\n---\n\n')
    .slice(0, 200000);
  fs.writeFileSync(path.join(dir, 'text', 'messages.txt'), digest, 'utf8');

  job.counts = counts;
  job.status = 'downloaded';
  job.downloadedAt = new Date().toISOString();
  fs.writeFileSync(path.join(dir, 'job.json'), JSON.stringify(job, null, 2), 'utf8');
  log('DONE', job.courseId, JSON.stringify(counts));
  return job;
}

async function main() {
  fs.mkdirSync(BASE, { recursive: true });
  const env = loadEnv();
  const apiId = Number(env.TG_API_ID || process.env.TG_API_ID || 0);
  const apiHash = env.TG_API_HASH || process.env.TG_API_HASH || '';
  const phone = env.TG_PHONE || process.env.TG_PHONE || '';

  if (!apiId || !apiHash) {
    console.error(`
Нужен доступ к Telegram API аккаунта Марины (который уже в учебных группах).

1) Откройте https://my.telegram.org → войдите номером телефона Марины
2) API development tools → Create application
3) Добавьте в website/.env.local:

TG_API_ID=12345678
TG_API_HASH=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TG_PHONE=+79xxxxxxxxx

4) Снова запустите: node download_telegram_high_priority.mjs
`);
    process.exit(2);
  }

  if (!fs.existsSync(JOBS)) {
    console.error('Run prepare_tg_folders.mjs first');
    process.exit(1);
  }

  const sessionStr = fs.existsSync(SESSION_FILE)
    ? JSON.parse(fs.readFileSync(SESSION_FILE, 'utf8')).session || ''
    : '';
  const stringSession = new StringSession(sessionStr);
  const client = new TelegramClient(stringSession, apiId, apiHash, {
    connectionRetries: 5,
  });

  await client.start({
    phoneNumber: async () => phone || (await ask('Phone (+7...): ')),
    password: async () => await ask('2FA password (если есть, иначе Enter): '),
    phoneCode: async () => await ask('Код из Telegram: '),
    onError: (err) => log('auth error', err.message),
  });

  fs.writeFileSync(
    SESSION_FILE,
    JSON.stringify({ session: client.session.save(), savedAt: new Date().toISOString() }, null, 2),
    'utf8'
  );
  log('Logged in');

  const data = JSON.parse(fs.readFileSync(JOBS, 'utf8'));
  const results = [];
  for (const job of data.jobs) {
    const updated = await downloadMediaForJob(client, { ...job });
    results.push(updated);
  }

  data.jobs = results;
  data.lastRun = new Date().toISOString();
  fs.writeFileSync(JOBS, JSON.stringify(data, null, 2), 'utf8');

  console.log('\n=== SUMMARY ===');
  for (const j of results) {
    console.log(j.status, j.courseId, j.title, j.counts || '', j.error || '');
  }

  await client.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
