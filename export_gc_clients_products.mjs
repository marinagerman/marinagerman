import fs from 'fs';
import https from 'https';
import { URL } from 'url';
import path from 'path';

const DIR = 'e:\\КУРСОР МАРИНА КУРС ГЕРМАН';
const BASE = 'https://marinagerman.getcourse.ru';
const EMAIL = 'Marinagerman.nails@gmail.com';
const PASSWORD = 'Marina2609!';
const OUT = path.join(DIR, 'export', 'reports');
fs.mkdirSync(OUT, { recursive: true });

const cookieJar = new Map();
try {
  const saved = JSON.parse(fs.readFileSync(path.join(DIR, 'cookies.json'), 'utf8'));
  for (const [k, v] of Object.entries(saved)) cookieJar.set(k, v);
} catch {}

function parseSetCookie(headers) {
  for (const c of headers['set-cookie'] || []) {
    const part = c.split(';')[0];
    const eq = part.indexOf('=');
    if (eq > 0) cookieJar.set(part.slice(0, eq), part.slice(eq + 1));
  }
}
function cookieHeader() {
  return [...cookieJar.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
}
function request(method, urlStr, { body, headers = {} } = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(urlStr);
    const opts = {
      method,
      hostname: u.hostname,
      path: u.pathname + u.search,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        Cookie: cookieHeader(),
        ...headers,
      },
    };
    if (body) opts.headers['Content-Length'] = Buffer.byteLength(body);
    const req = https.request(opts, (res) => {
      parseSetCookie(res.headers);
      const chunks = [];
      res.on('data', (d) => chunks.push(d));
      res.on('end', () =>
        resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString('utf8') })
      );
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function login() {
  await request('GET', `${BASE}/cms/system/login`);
  const body = new URLSearchParams({
    action: 'processXdget',
    xdgetId: '99945_1_1',
    'params[action]': 'login',
    'params[email]': EMAIL,
    'params[password]': PASSWORD,
    requestType: 'json',
  }).toString();
  await request('POST', `${BASE}/cms/system/login`, {
    body,
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'X-Requested-With': 'XMLHttpRequest',
    },
  });
  fs.writeFileSync(path.join(DIR, 'cookies.json'), JSON.stringify(Object.fromEntries(cookieJar), null, 2));
}

function stripHtml(s) {
  return (s || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

function csvEscape(v) {
  const s = String(v ?? '');
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}
function writeCsv(file, headers, rows) {
  const lines = [headers.join(',')];
  for (const row of rows) lines.push(headers.map((h) => csvEscape(row[h])).join(','));
  fs.writeFileSync(file, '\uFEFF' + lines.join('\n'), 'utf8');
  console.log('Wrote', path.basename(file), rows.length);
}

function parseTableRows(html) {
  const rows = [];
  const trs = html.match(/<tr[\s\S]*?<\/tr>/gi) || [];
  for (const tr of trs) {
    if (/<th[\s>]/i.test(tr) && !/<td[\s>]/i.test(tr)) continue;
    const cells = [...tr.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((m) => stripHtml(m[1]));
    if (cells.length >= 2) rows.push(cells);
  }
  return rows;
}

async function fetchAllPages(basePath, maxPages = 80) {
  const allHtml = [];
  for (let page = 1; page <= maxPages; page++) {
    const url = `${BASE}${basePath}${basePath.includes('?') ? '&' : '?'}page=${page}&per-page=100`;
    const res = await request('GET', url);
    if (res.status !== 200) {
      console.log('stop page', page, res.status);
      break;
    }
    allHtml.push(res.body);
    const hasNext = res.body.includes(`page=${page + 1}`) || res.body.includes(`page=${page + 1}&`);
    const rows = parseTableRows(res.body);
    console.log(basePath, 'page', page, 'rows~', rows.length);
    if (!hasNext || rows.length < 5) break;
  }
  return allHtml.join('\n');
}

async function main() {
  await login();

  // OFFERS / products with prices
  const offersHtml = await fetchAllPages('/pl/sales/offer/index', 30);
  fs.writeFileSync(path.join(OUT, 'offers_raw.html'), offersHtml.slice(0, 500000));
  const offerRows = parseTableRows(offersHtml);
  const offers = [];
  for (const cells of offerRows) {
    const joined = cells.join(' | ');
    if (/название|цена|предложен/i.test(joined) && cells.length < 4) continue;
    // try extract id from nearby update links in original - fallback by cells
    const priceCell = cells.find((c) => /\d/.test(c) && /(₽|руб|\d[\d\s]*$)/i.test(c));
    const title = cells.find((c) => c.length > 3 && !/^\d+$/.test(c) && !/актив|архив|да|нет/i.test(c)) || cells[1] || cells[0];
    const priceMatch = (priceCell || joined).match(/(\d[\d\s\u00a0]*)/);
    offers.push({
      title: title.slice(0, 200),
      price_raw: priceCell || '',
      price_rub: priceMatch ? priceMatch[1].replace(/[\s\u00a0]/g, '') : '',
      row: cells.join(' | ').slice(0, 400),
    });
  }
  // better parse via update links + nearby text
  const offerBetter = [];
  const blocks = [...offersHtml.matchAll(/\/pl\/sales\/offer\/update\?id=(\d+)[\s\S]{0,800}/gi)];
  for (const m of blocks) {
    const id = m[1];
    const chunk = m[0];
    const text = stripHtml(chunk);
    const price = (text.match(/(\d[\d\s\u00a0]{0,10})\s*(?:₽|руб)/i) || text.match(/\b(\d{2,7})\b/))?.[1]?.replace(/[\s\u00a0]/g, '') || '';
    // title often in link text
    const titleMatch = chunk.match(/update\?id=\d+[^>]*>([\s\S]*?)<\/a>/i);
    const title = stripHtml(titleMatch?.[1] || text).slice(0, 180);
    if (!title || title.length < 2) continue;
    offerBetter.push({ offer_id: id, title, price_rub: price, snippet: text.slice(0, 250) });
  }
  // unique by offer_id
  const offersUnique = [...new Map(offerBetter.map((o) => [o.offer_id, o])).values()];
  writeCsv(path.join(OUT, 'getcourse_offers_prices.csv'), ['offer_id', 'title', 'price_rub', 'snippet'], offersUnique);

  // DEALS / orders
  const dealsHtml = await fetchAllPages('/pl/sales/deal/index', 100);
  fs.writeFileSync(path.join(OUT, 'deals_raw_head.html'), dealsHtml.slice(0, 200000));
  const deals = [];
  const dealBlocks = [...dealsHtml.matchAll(/\/sales\/control\/deal\/update\/id\/(\d+)[\s\S]{0,1200}/gi)];
  for (const m of dealBlocks) {
    const dealId = m[1];
    const chunk = m[0];
    const text = stripHtml(chunk);
    const userId = (chunk.match(/\/user\/control\/user\/update\/id\/(\d+)/) || [])[1] || '';
    const email = (text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i) || [])[0] || '';
    const money = (text.match(/(\d[\d\s\u00a0]*)\s*(?:₽|руб)/i) || [])[1]?.replace(/[\s\u00a0]/g, '') || '';
    const date = (text.match(/(\d{2}\.\d{2}\.\d{4}(?:\s+\d{2}:\d{2})?)/) || [])[1] || '';
    // status keywords
    let status = '';
    if (/оплачен|payed|paid/i.test(text)) status = 'оплачен';
    else if (/новый|new/i.test(text)) status = 'новый';
    else if (/отмен/i.test(text)) status = 'отменён';
    deals.push({
      deal_id: dealId,
      user_id: userId,
      email,
      date,
      amount_rub: money,
      status,
      details: text.slice(0, 350),
    });
  }
  const dealsUnique = [...new Map(deals.map((d) => [d.deal_id, d])).values()];
  writeCsv(
    path.join(OUT, 'getcourse_clients_orders.csv'),
    ['deal_id', 'user_id', 'email', 'date', 'amount_rub', 'status', 'details'],
    dealsUnique
  );

  // USER PRODUCTS if available
  const up = await request('GET', `${BASE}/pl/sales/user-product/index?per-page=100`);
  fs.writeFileSync(path.join(OUT, 'user_products_page1.html'), up.body.slice(0, 300000));
  console.log('user-product status', up.status, 'len', up.body.length);

  console.log('Offers:', offersUnique.length, 'Deals:', dealsUnique.length);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
