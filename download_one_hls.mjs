import fs from 'fs';
import https from 'https';
import http from 'http';
import { URL } from 'url';
import { spawn } from 'child_process';

const DIR = 'e:\\КУРСОР МАРИНА КУРС ГЕРМАН';
const html = fs.readFileSync(`${DIR}\\player_page_sample.html`, 'utf8');
const m = html.match(/window\.configs = (\{[\s\S]*?\})\s*<\/script>/);
if (!m) {
  console.error('no configs');
  process.exit(1);
}
const configs = JSON.parse(m[1]);
console.log('duration', configs.videoDuration, 'sec');
console.log('master', configs.masterPlaylistUrl);

const outDir = `${DIR}\\export\\videos`;
fs.mkdirSync(outDir, { recursive: true });

function fetchText(urlStr) {
  return new Promise((resolve, reject) => {
    const u = new URL(urlStr);
    const lib = u.protocol === 'http:' ? http : https;
    lib
      .get(
        urlStr,
        {
          headers: {
            'User-Agent': 'Mozilla/5.0',
            Referer: 'https://api2.gcvh.ru/',
          },
        },
        (res) => {
          if ([301, 302].includes(res.statusCode) && res.headers.location) {
            res.resume();
            return resolve(fetchText(res.headers.location));
          }
          const chunks = [];
          res.on('data', (d) => chunks.push(d));
          res.on('end', () =>
            resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString('utf8') })
          );
        }
      )
      .on('error', reject);
  });
}

const master = await fetchText(configs.masterPlaylistUrl);
console.log('master status', master.status);
console.log(master.body.slice(0, 800));
fs.writeFileSync(`${outDir}\\sample_master.m3u8`, master.body);

// Pick highest bandwidth stream
const lines = master.body.split(/\r?\n/);
let bestUrl = null;
let bestBw = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].startsWith('#EXT-X-STREAM-INF:')) {
    const bw = Number((lines[i].match(/BANDWIDTH=(\d+)/) || [])[1] || 0);
    const next = lines[i + 1];
    if (next && !next.startsWith('#') && bw >= bestBw) {
      bestBw = bw;
      bestUrl = next.trim();
    }
  }
}
if (bestUrl && !bestUrl.startsWith('http')) {
  bestUrl = new URL(bestUrl, configs.masterPlaylistUrl).href;
}
console.log('best stream', bestBw, bestUrl);

const outMp4 = `${outDir}\\lesson_332493229_592890647.mp4`;
console.log('Downloading with ffmpeg to', outMp4);

const ff = spawn(
  'ffmpeg',
  [
    '-y',
    '-headers',
    'Referer: https://api2.gcvh.ru/\r\nUser-Agent: Mozilla/5.0\r\n',
    '-i',
    configs.masterPlaylistUrl,
    '-c',
    'copy',
    '-bsf:a',
    'aac_adtstoasc',
    outMp4,
  ],
  { stdio: ['ignore', 'pipe', 'pipe'] }
);

let err = '';
ff.stderr.on('data', (d) => {
  err += d.toString();
});
ff.on('close', (code) => {
  console.log('ffmpeg exit', code);
  if (fs.existsSync(outMp4)) {
    const st = fs.statSync(outMp4);
    console.log('SAVED bytes', st.size);
  } else {
    console.log('NOT SAVED');
    console.log(err.slice(-1500));
  }
});
