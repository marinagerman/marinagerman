import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';

const OUT = 'e:\\КУРСОР МАРИНА КУРС ГЕРМАН\\export\\reports';
const html = fs.readFileSync(path.join(OUT, 'offers_raw.html'), 'utf8');

function strip(s) {
  return (s || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function parsePrice(raw) {
  const t = strip(raw);
  if (!t || t === '-' || t === '—') return { text: '', number: '' };
  const m = t.match(/([\d\s\u00a0]+)/);
  const number = m ? m[1].replace(/[\s\u00a0]/g, '') : '';
  return { text: t, number };
}

const rows = [];
const trRe = /<tr class="grid-offers" data-key="(\d+)">([\s\S]*?)<\/tr>/gi;
let m;
while ((m = trRe.exec(html))) {
  const id = m[1];
  const tr = m[2];
  const cells = {};
  const tdRe = /<td[^>]*data-col-seq="(\d+)"[^>]*>([\s\S]*?)<\/td>/gi;
  let td;
  while ((td = tdRe.exec(tr))) {
    cells[td[1]] = td[2];
  }
  // fallback: sequential tds
  if (!cells['1']) {
    const all = [...tr.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((x) => x[1]);
    all.forEach((v, i) => {
      cells[String(i)] = v;
    });
  }

  const titleHtml = cells['1'] || '';
  const titleMatch = titleHtml.match(/<a[^>]*>([\s\S]*?)<\/a>/i);
  const title = strip(titleMatch ? titleMatch[1] : titleHtml);

  const product = strip(cells['3'] || '');
  const price = parsePrice(cells['5'] || cells['4'] || '');
  const actuality = strip(cells['7'] || '');

  if (!title) continue;
  // skip demo driving course
  if (/демо|экстремального вождения/i.test(title)) continue;

  rows.push({
    ID: id,
    Название: title,
    Цена: price.number ? Number(price.number) : '',
    'Цена текстом': price.text,
    Продукт: product,
    Актуальность: /архив|archive/i.test(actuality) ? 'архив' : 'актуально',
  });
}

// unique by ID
const unique = [...new Map(rows.map((r) => [r.ID, r])).values()];
unique.sort((a, b) => String(a.Название).localeCompare(String(b.Название), 'ru'));

// Write clean CSV (Excel-friendly)
function csvEscape(v) {
  const s = String(v ?? '');
  if (/[",\n\r;]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}
const headers = ['ID', 'Название', 'Цена', 'Цена текстом', 'Продукт', 'Актуальность'];
const lines = [headers.join(';')];
for (const r of unique) {
  lines.push(headers.map((h) => csvEscape(r[h])).join(';'));
}
const csvPath = path.join(OUT, 'Прайс_GetCourse.csv');
fs.writeFileSync(csvPath, '\uFEFF' + lines.join('\n'), 'utf8');

// Also JSON for reference
fs.writeFileSync(path.join(OUT, 'offers_clean.json'), JSON.stringify(unique, null, 2), 'utf8');

console.log('Parsed offers:', unique.length);
console.log('Sample:');
unique.slice(0, 5).forEach((r) => console.log(`  ${r.Цена} ₽ | ${r.Название}`));

// Convert to xlsx via Excel COM through PowerShell
const ps = `
$csv = '${csvPath.replace(/'/g, "''")}'
$xlsx = '${path.join(OUT, 'Прайс_GetCourse.xlsx').replace(/'/g, "''")}'
$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$excel.DisplayAlerts = $false
$wb = $excel.Workbooks.Open($csv)
$ws = $wb.Worksheets.Item(1)
$ws.Columns.Item(1).ColumnWidth = 12
$ws.Columns.Item(2).ColumnWidth = 55
$ws.Columns.Item(3).ColumnWidth = 12
$ws.Columns.Item(4).ColumnWidth = 18
$ws.Columns.Item(5).ColumnWidth = 45
$ws.Columns.Item(6).ColumnWidth = 14
$ws.Rows.Item(1).Font.Bold = $true
$used = $ws.UsedRange
$used.EntireColumn.AutoFit() | Out-Null
if (Test-Path $xlsx) { Remove-Item $xlsx -Force }
$wb.SaveAs($xlsx, 51)
$wb.Close($false)
$excel.Quit()
[System.Runtime.Interopservices.Marshal]::ReleaseComObject($excel) | Out-Null
Write-Host "XLSX OK"
`;
const r = spawnSync('powershell', ['-NoProfile', '-Command', ps], { encoding: 'utf8' });
console.log(r.stdout || '');
if (r.stderr) console.error(r.stderr);
console.log('Files:', csvPath);
console.log('Excel:', path.join(OUT, 'Прайс_GetCourse.xlsx'));
