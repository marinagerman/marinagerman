import fs from 'fs';
import https from 'https';
import { URL } from 'url';

const DIR = 'e:\\КУРСОР МАРИНА КУРС ГЕРМАН';
const BASE = 'https://marinagerman.getcourse.ru';
const EMAIL = 'Marinagerman.nails@gmail.com';
const PASSWORD = 'Marina2609!';

const cookieJar = new Map();

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
    if (body) {
      opts.headers['Content-Length'] = Buffer.byteLength(body);
    }
    const req = https.request(opts, (res) => {
      parseSetCookie(res.headers);
      const chunks = [];
      res.on('data', (d) => chunks.push(d));
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: Buffer.concat(chunks).toString('utf8'),
          url: urlStr,
        });
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

function extract(html, re) {
  const m = html.match(re);
  return m ? m[1] : null;
}

async function main() {
  console.log('1) Getting login page...');
  let res = await request('GET', `${BASE}/cms/system/login`);
  fs.writeFileSync(`${DIR}\\login_page.html`, res.body);
  const csrf = extract(res.body, /window\.csrfToken = "([^"]+)"/);
  console.log('CSRF:', csrf ? csrf.slice(0, 20) + '...' : 'MISSING');
  console.log('Cookies:', [...cookieJar.keys()].join(', '));

  // Try several known GetCourse login endpoints
  const attempts = [
    {
      name: 'processXdget loginUserForm',
      url: `${BASE}/cms/system/login`,
      body: new URLSearchParams({
        action: 'processXdget',
        xdgetId: '99945_1_1',
        'params[action]': 'login',
        'params[email]': EMAIL,
        'params[password]': PASSWORD,
        requestType: 'json',
      }).toString(),
    },
    {
      name: 'user/login json',
      url: `${BASE}/cms/system/login`,
      body: new URLSearchParams({
        action: 'login',
        email: EMAIL,
        password: PASSWORD,
        requestType: 'json',
      }).toString(),
    },
    {
      name: 'pl/user/user/login',
      url: `${BASE}/pl/user/user/login`,
      body: new URLSearchParams({
        email: EMAIL,
        password: PASSWORD,
      }).toString(),
    },
    {
      name: 'cms/system/login form fields',
      url: `${BASE}/cms/system/login`,
      body: new URLSearchParams({
        'User[email]': EMAIL,
        'User[password]': PASSWORD,
        action: 'login',
      }).toString(),
    },
  ];

  for (const a of attempts) {
    console.log(`\n2) Trying: ${a.name}`);
    res = await request('POST', a.url, {
      body: a.body,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'X-Requested-With': 'XMLHttpRequest',
        'X-CSRF-Token': csrf || '',
        Accept: 'application/json, text/javascript, */*; q=0.01',
        Referer: `${BASE}/cms/system/login`,
        Origin: BASE,
      },
    });
    const snippet = res.body.slice(0, 500).replace(/\s+/g, ' ');
    console.log('Status:', res.status, 'Len:', res.body.length);
    console.log('Body:', snippet);
    fs.writeFileSync(`${DIR}\\login_try_${a.name.replace(/\W+/g, '_')}.txt`, res.body);

    // Check if logged in
    const check = await request('GET', `${BASE}/teach/control/stream`);
    const userId = extract(check.body, /window\.accountUserId = (-?\d+)/);
    const userName = extract(check.body, /window\.accountSafeUserName = "([^"]*)"/);
    const title = extract(check.body, /<title>([^<]*)<\/title>/);
    console.log('Check stream -> userId:', userId, 'name:', userName, 'title:', title);
    if (userId && userId !== '-1') {
      console.log('SUCCESS LOGIN');
      fs.writeFileSync(`${DIR}\\stream.html`, check.body);
      fs.writeFileSync(
        `${DIR}\\cookies.json`,
        JSON.stringify(Object.fromEntries(cookieJar), null, 2)
      );
      return;
    }
  }

  console.log('\nFAILED all login attempts');
  // Save last stream check
  const check = await request('GET', `${BASE}/teach/control/stream`);
  fs.writeFileSync(`${DIR}\\stream.html`, check.body);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
