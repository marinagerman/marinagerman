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
// load existing cookies if any
try {
  const saved = JSON.parse(fs.readFileSync(path.join(DIR, 'cookies.json'), 'utf8'));
  for (const [k, v] of Object.entries(saved)) cookieJar.set(k, v);
} catch {}

function parseSetCookie(headers) {
  const raw = headers['set-cookie'] || [];
  for (const c of raw) {
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
        Accept: '*/*',
        Cookie: cookieHeader(),
        ...headers,
      },
    };
    if (body) opts.headers['Content-Length'] = Buffer.byteLength(body);
    const req = https.request(opts, (res) => {
      parseSetCookie(res.headers);
      const chunks = [];
      res.on('data', (d) => chunks.push(d));
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: Buffer.concat(chunks).toString('utf8'),
        });
      });
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
  const res = await request('POST', `${BASE}/cms/system/login`, {
    body,
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'X-Requested-With': 'XMLHttpRequest',
    },
  });
  fs.writeFileSync(path.join(DIR, 'cookies.json'), JSON.stringify(Object.fromEntries(cookieJar), null, 2));
  console.log('login status', res.status, res.body.slice(0, 200));
}

function csvEscape(v) {
  const s = String(v ?? '');
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function writeCsv(file, headers, rows) {
  const bom = '\uFEFF';
  const lines = [headers.join(',')];
  for (const row of rows) {
    lines.push(headers.map((h) => csvEscape(row[h])).join(','));
  }
  fs.writeFileSync(file, bom + lines.join('\n'), 'utf8');
  console.log('Wrote', file, rows.length, 'rows');
}

async function probe(urls) {
  for (const url of urls) {
    const res = await request('GET', url.startsWith('http') ? url : BASE + url);
    const name = url.replace(/[^\w]+/g, '_').slice(0, 80);
    fs.writeFileSync(path.join(OUT, `probe_${name}.html`), res.body);
    console.log(res.status, url, 'len', res.body.length, /login|войти|password/i.test(res.body) ? 'MAYBE_LOGIN' : 'ok');
  }
}

async function main() {
  await login();

  await probe([
    '/sales/control/deal/index',
    '/pl/sales/deal',
    '/user/control/user/index',
    '/pl/user/user',
    '/sales/control/offerIndex/index',
    '/pl/sales/offer',
    '/teach/control/stream/index',
  ]);

  // products from local courses
  const coursesDir = path.join(DIR, 'website', 'data', 'courses');
  const products = [];
  for (const f of fs.readdirSync(coursesDir).filter((x) => x.endsWith('.json'))) {
    const c = JSON.parse(fs.readFileSync(path.join(coursesDir, f), 'utf8'));
    if (/демонстрац/i.test(c.title || '')) continue;
    const m =
      (c.title || '').match(/(\d[\d\s\u00a0]*)\s*₽/) ||
      (c.title || '').match(/(\d[\d\s\u00a0]*)\s*руб/i);
    const price = m ? m[1].replace(/[\s\u00a0]/g, '') : '';
    products.push({
      course_id: c.id,
      title: c.title,
      category: c.category || '',
      lessons: c.lessonsCount || 0,
      price_rub: price,
      price_source: price ? 'из названия на GetCourse' : 'НУЖНО УТОЧНИТЬ',
      paymentUrl: c.paymentUrl || '',
      sourceUrl: c.sourceUrl || '',
    });
  }
  products.sort((a, b) => a.title.localeCompare(b.title, 'ru'));
  writeCsv(path.join(OUT, 'products_prices.csv'), [
    'course_id',
    'title',
    'category',
    'lessons',
    'price_rub',
    'price_source',
    'paymentUrl',
    'sourceUrl',
  ], products);

  // template for Prodamus mapping
  writeCsv(path.join(OUT, 'prodamus_mapping_template.csv'), [
    'course_id',
    'title',
    'price_rub',
    'prodamus_product_name',
    'prodamus_payment_link',
    'notes',
  ], products.map((p) => ({
    course_id: p.course_id,
    title: p.title,
    price_rub: p.price_rub,
    prodamus_product_name: p.title,
    prodamus_payment_link: '',
    notes: '',
  })));

  console.log('Products with known price:', products.filter((p) => p.price_rub).length, '/', products.length);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
