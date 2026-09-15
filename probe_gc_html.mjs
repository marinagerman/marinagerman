import fs from 'fs';
import path from 'path';

const dir = 'e:\\КУРСОР МАРИНА КУРС ГЕРМАН\\export\\reports';
for (const f of [
  'probe__pl_sales_deal.html',
  'probe__pl_user_user.html',
  'probe__pl_sales_offer.html',
]) {
  const h = fs.readFileSync(path.join(dir, f), 'utf8');
  console.log('===', f, '===');
  console.log('title', (h.match(/<title>([^<]+)/) || [])[1]);
  const links = [...h.matchAll(/href="([^"]+)"/g)]
    .map((m) => m[1])
    .filter((u) => /export|csv|xls|download|deal|user|offer/i.test(u));
  console.log('links', [...new Set(links)].slice(0, 40));
  const api = [...h.matchAll(/\/pl\/[a-zA-Z0-9_\/\-]+/g)].map((m) => m[0]);
  console.log('pl paths', [...new Set(api)].slice(0, 40));
  // tables
  const tables = (h.match(/<table[\s\S]*?<\/table>/gi) || []).length;
  console.log('tables', tables);
  // look for react/state json blobs
  const scripts = [...h.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1]);
  for (const s of scripts) {
    if (s.includes('deals') || s.includes('users') || s.includes('offers') || s.includes('export')) {
      console.log('script snippet', s.slice(0, 300).replace(/\s+/g, ' '));
    }
  }
}
