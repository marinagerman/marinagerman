import fs from 'fs';

const h = fs.readFileSync('e:\\КУРСОР МАРИНА КУРС ГЕРМАН\\sample_lesson.html', 'utf8');

const classes = [...h.matchAll(/class="([^"]*lt-[^"]*)"/g)].map((m) => m[1]);
console.log('lt classes sample', [...new Set(classes)].slice(0, 40));

const videoBlocks = [...h.matchAll(/video[A-Za-z0-9_\-]{0,40}/g)].map((m) => m[0]);
console.log('video tokens', [...new Set(videoBlocks)].slice(0, 40));

// Extract lite block HTML texts
const texts = [...h.matchAll(/lt-lesson-mission-block[\s\S]{0,5000}/g)];
console.log('mission blocks', texts.length);
if (texts[0]) console.log(texts[0][0].slice(0, 1500));

// Look for file hashes like AB.xxx
const hashes = [...h.matchAll(/h\/([A-Z0-9]{2}\.[a-f0-9]{32}\.[a-z0-9.]+)/gi)];
console.log('file hashes', hashes.map((m) => m[1]).slice(0, 20));

const vh = [...h.matchAll(/["']([0-9a-f]{8}-[0-9a-f-]{27,})["']/gi)];
console.log('uuids', vh.map((m) => m[1]).slice(0, 20));

// Find script configs with video
const idx = h.indexOf('VhPlayer');
console.log('VhPlayer', idx);
const idx2 = h.indexOf('videoplayer');
console.log('near videoplayer scripts...');
const matches = [...h.matchAll(/new\s+\w*Video\w*\([^)]*\)|vhPlayer|fileId["']?\s*[:=]\s*["']?([^"'&\s,]+)/gi)];
console.log('player matches', matches.slice(0, 20).map((m) => m[0]));

// Save mission HTML snippets
const missionHtml = [...h.matchAll(/<div[^>]*lt-lesson-mission-block[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/g)];
fs.writeFileSync(
  'e:\\КУРСОР МАРИНА КУРС ГЕРМАН\\mission_snip.txt',
  missionHtml[0] ? missionHtml[0][0].slice(0, 8000) : 'none'
);
console.log('saved mission snip', missionHtml[0] ? missionHtml[0][0].length : 0);

// Look for iframe embeds
const iframes = [...h.matchAll(/<iframe[^>]+>/gi)];
console.log('iframes', iframes.map((m) => m[0]));

// data attributes with video
const dataV = [...h.matchAll(/data-[a-z-]*=\"[^\"]{10,200}\"/gi)].filter((m) =>
  /video|file|hash|src|vh/i.test(m[0])
);
console.log('data attrs', dataV.slice(0, 30).map((m) => m[0]));
