/**
 * Export GetCourse users + purchases to readable CSV (UTF-8 BOM, semicolon for Excel).
 */
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
        resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString('utf8') })
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
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function csvEscape(v) {
  const s = String(v ?? '');
  if (/[";\\n\\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function writeCsv(file, headers, rows, delimiter = ';') {
  const lines = [headers.join(delimiter)];
  for (const row of rows) lines.push(headers.map((h) => csvEscape(row[h])).join(delimiter));
  fs.writeFileSync(file, '\uFEFF' + lines.join('\n'), 'utf8');
  console.log('Wrote', path.basename(file), rows.length);
}

async function fetchAllPages(basePath, maxPages = 500) {
  let html = '';
  for (let page = 1; page <= maxPages; page++) {
    const sep = basePath.includes('?') ? '&' : '?';
    const url = `${BASE}${basePath}${sep}page=${page}&per-page=100`;
    const res = await request('GET', url);
    if (res.status !== 200) {
      console.log('stop', basePath, 'page', page, 'status', res.status);
      break;
    }
    if (/cms\/system\/login|action="login"/i.test(res.body) && !/gc-user-link/i.test(res.body)) {
      console.log('stop', basePath, 'page', page, 'need login');
      break;
    }
    html += res.body + '\n';
    const userRows = (res.body.match(/class="gc-user-link/gi) || []).length;
    console.log(basePath, 'page', page, 'rows~', userRows, 'len', res.body.length);
    const hasNext =
      res.body.includes(`page=${page + 1}`) ||
      res.body.includes(`page=${page + 1}&`) ||
      res.body.includes(`"page":${page + 1}`);
    if (userRows === 0 && page === 1) {
      console.log('warn: no rows on page 1, saving debug');
      fs.writeFileSync(path.join(OUT, `debug_${basePath.replace(/[^\w]+/g, '_')}_p1.html`), res.body.slice(0, 500000));
    }
    if (!hasNext || userRows === 0) break;
  }
  return html;
}

function parseUsers(html) {
  const users = [];
  const rows = [...html.matchAll(/<tr class="gc-user-link[^"]*"[^>]*data-user-id="(\d+)"[^>]*>([\s\S]*?)<\/tr>/gi)];
  for (const m of rows) {
    const user_id = m[1];
    const chunk = m[2];
    const name = stripHtml((chunk.match(/class="user-name[^"]*"[^>]*>[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/i) || [])[1] || '');
    const email = stripHtml((chunk.match(/data-col-seq="2"[\s\S]*?<div>([\s\S]*?)<\/div>/i) || [])[1] || '');
    const emailClean = email.replace(/Эл\. адрес подтвержден/i, '').trim();
    const type = stripHtml((chunk.match(/data-col-seq="3"[^>]*>([\s\S]*?)<\/td>/i) || [])[1] || '');
    const status = stripHtml((chunk.match(/data-col-seq="4"[^>]*>([\s\S]*?)<\/td>/i) || [])[1] || '');
    const email_status = stripHtml((chunk.match(/data-col-seq="5"[^>]*>([\s\S]*?)<\/td>/i) || [])[1] || '');
    const utm_source = stripHtml((chunk.match(/data-col-seq="6"[^>]*>([\s\S]*?)<\/td>/i) || [])[1] || '');
    const utm_medium = stripHtml((chunk.match(/data-col-seq="7"[^>]*>([\s\S]*?)<\/td>/i) || [])[1] || '');
    const utm_campaign = stripHtml((chunk.match(/data-col-seq="8"[^>]*>([\s\S]*?)<\/td>/i) || [])[1] || '');
    const phone = stripHtml((chunk.match(/data-col-seq="11"[^>]*>([\s\S]*?)<\/td>/i) || [])[1] || '');
    if (!user_id) continue;
    users.push({
      user_id,
      name,
      email: emailClean,
      phone,
      type,
      status,
      email_status,
      utm_source: utm_source === '-' ? '' : utm_source,
      utm_medium: utm_medium === '-' ? '' : utm_medium,
      utm_campaign: utm_campaign === '-' ? '' : utm_campaign,
    });
  }
  return [...new Map(users.map((u) => [u.user_id, u])).values()];
}

function parsePurchases(html) {
  const purchases = [];
  const rows = [
    ...html.matchAll(
      /<tr class="gc-user-link[^"]*"[^>]*data-user-id="(\d+)"[^>]*data-deal-id="(\d+)"[^>]*data-key="(\d+)"[^>]*>([\s\S]*?)<\/tr>/gi
    ),
  ];
  for (const m of rows) {
    const user_id = m[1];
    const deal_id = m[2];
    const purchase_id = m[3];
    const chunk = m[4];
    const number = stripHtml((chunk.match(/data-col-seq="0"[^>]*>[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/i) || [])[1] || '');
    const product = stripHtml((chunk.match(/data-col-seq="1"[^>]*>[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/i) || [])[1] || '');
    const buyer_name = stripHtml((chunk.match(/class="text">([\s\S]*?)<\/span>/i) || [])[1] || '');
    const status = stripHtml((chunk.match(/data-col-seq="3"[^>]*>([\s\S]*?)<\/td>/i) || [])[1] || '');
    const period = stripHtml((chunk.match(/data-col-seq="4"[^>]*>([\s\S]*?)<\/td>/i) || [])[1] || '');
    const finish = stripHtml((chunk.match(/data-col-seq="5"[^>]*>([\s\S]*?)<\/td>/i) || [])[1] || '');
    const sum = stripHtml((chunk.match(/data-col-seq="6"[^>]*>([\s\S]*?)<\/td>/i) || [])[1] || '');
    purchases.push({
      purchase_id,
      deal_id,
      user_id,
      number,
      buyer_name,
      product,
      status,
      period,
      finish,
      sum_rub: sum,
    });
  }
  return [...new Map(purchases.map((p) => [p.purchase_id, p])).values()];
}

async function main() {
  await login();

  console.log('Fetching users...');
  const usersHtml = await fetchAllPages('/pl/user/user/index', 500);
  fs.writeFileSync(path.join(OUT, 'users_raw.html'), usersHtml.slice(0, 5_000_000));
  const users = parseUsers(usersHtml);
  writeCsv(
    path.join(OUT, 'users_FULL.csv'),
    ['user_id', 'name', 'email', 'phone', 'type', 'status', 'email_status', 'utm_source', 'utm_medium', 'utm_campaign'],
    users
  );

  console.log('Fetching purchases...');
  const purchasesHtml = await fetchAllPages('/pl/sales/user-product/index?per-page=100', 500);
  fs.writeFileSync(path.join(OUT, 'purchases_raw.html'), purchasesHtml.slice(0, 5_000_000));
  const purchases = parsePurchases(purchasesHtml);
  writeCsv(
    path.join(OUT, 'purchases_FULL.csv'),
    ['purchase_id', 'deal_id', 'user_id', 'number', 'buyer_name', 'product', 'status', 'period', 'finish', 'sum_rub'],
    purchases
  );

  // Copy orders with readable name
  const ordersPath = path.join(OUT, 'getcourse_clients_orders.csv');
  if (fs.existsSync(ordersPath)) {
    fs.copyFileSync(ordersPath, path.join(OUT, 'orders_FULL.csv'));
    console.log('Copied orders_FULL.csv from getcourse_clients_orders.csv');
  }

  const readme = `Выгрузка GetCourse — ${new Date().toLocaleString('ru-RU')}

users_FULL.csv — ${users.length} пользователей (имя, email, телефон)
purchases_FULL.csv — ${purchases.length} покупок (кто что купил)
orders_FULL.csv — заказы (из getcourse_clients_orders.csv)

Открывать в Excel двойным кликом. Разделитель: точка с запятой.
`;
  fs.writeFileSync(path.join(OUT, 'ЧТО_ВЫГРУЖЕНО.txt'), readme, 'utf8');

  console.log('DONE users:', users.length, 'purchases:', purchases.length);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
