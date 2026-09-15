import fs from 'fs';
import path from 'path';

const ROOT = 'e:\\КУРСОР МАРИНА КУРС ГЕРМАН';
const DATA = path.join(ROOT, 'website', 'data');
const EXPORT = path.join(ROOT, 'export', 'courses');

function stripHtml(html) {
  return (html || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&[a-z]+;/gi, ' ');
}

function flattenLessons(course) {
  return [
    ...(course.lessons || []),
    ...(course.children || []).flatMap((c) => c.lessons || []),
  ];
}

function lessonHasVideo(les) {
  return Boolean(les.kinescope?.length || les.localVideos?.length || les.videos?.length);
}

function isAdminLesson(les) {
  if (lessonHasVideo(les)) return false;
  const title = (les.title || '').toLowerCase();
  const short = (les.shortDescription || '').toLowerCase();
  return (
    /доступ|перейд|переход|ссылка|сообщ|telegram|телеграм|групп|личн.*сообщ/i.test(title) ||
    (/перейд|переход|ссылк|telegram|телеграм|групп/i.test(short) && !short.includes('част'))
  );
}

function lessonDisplayName(les) {
  const title = (les.title || '').trim();
  const short = (les.shortDescription || '').trim();
  const generic = /^(?:\d+\s*)?урок$/i.test(title) || title === '0 Урок';
  if (short && short.length > 3 && !/^перейд/i.test(short)) {
    if (generic) return short.charAt(0).toUpperCase() + short.slice(1);
    if (short.length > title.length) return short;
  }
  return title;
}

function pluralRu(n, one, few, many) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few;
  return many;
}

function formatWord(course) {
  const t = course.title.toLowerCase();
  const cat = course.category || '';
  if (/сессия|расстанов|энерго/i.test(t) || cat === 'session') {
    return { prep: 'этой сессии', about: 'в этой сессии', whom: 'сессия' };
  }
  if (/вебинар/i.test(t) || cat === 'webinar') {
    return { prep: 'этом вебинаре', about: 'на этом вебинаре', whom: 'вебинар' };
  }
  if (/марафон|интенсив/i.test(t) || cat === 'course') {
    return { prep: 'этом марафоне', about: 'в этом марафоне', whom: 'марафон' };
  }
  if (/тренинг/i.test(t)) {
    return { prep: 'этом тренинге', about: 'на этом тренинге', whom: 'тренинг' };
  }
  return { prep: 'этом курсе', about: 'в этом курсе', whom: 'курс' };
}

function themesOf(title) {
  const t = title.toLowerCase();
  const themes = [];
  if (/таро|tarot|аркана|расклад|таролог|мастер таро/i.test(t)) themes.push('tarot');
  if (/отношен|любов|пар|секс|брак|мужчин|женщин|мж/i.test(t)) themes.push('relations');
  if (/денег|деньг|финанс|изобил|богат|приход/i.test(t)) themes.push('money');
  if (/самоцен|любов.*себ|уверен|легк.*я|быть собой|тень/i.test(t)) themes.push('selfworth');
  if (/тетахил|theta|практик|проводник|игра жизни/i.test(t)) themes.push('theta');
  if (/нумерол|числ|планет/i.test(t)) themes.push('numerology');
  if (/границ|зависим|состояни/i.test(t)) themes.push('boundaries');
  if (/расстанов|сессия|энерго|исцел|круг|переход/i.test(t)) themes.push('energy');
  if (/таролог|обучен|мастер|ступень|успешн/i.test(t)) themes.push('pro');
  return themes;
}

/** Pull meaning from video transcripts (GetCourse often stores "Расшифровка видео"). */
function extractTranscriptInsights(lessons) {
  const insights = [];
  const seen = new Set();

  for (const les of lessons) {
    const raw = `${les.description || ''}\n${stripHtml(les.contentHtml || '')}`;
    const parts = raw.split(/Расшифровка видео/i);
    if (parts.length < 2) continue;

    const transcript = parts
      .slice(1)
      .join(' ')
      .replace(/\d{1,2}:\d{2}/g, ' ')
      .replace(/https?:\/\/\S+/gi, '')
      .replace(/t\.me\/\S+/gi, '')
      .replace(/[\u{1F300}-\u{1FAFF}\u2600-\u27BF]/gu, '')
      .replace(/\s+/g, ' ')
      .trim();

    // Prefer sentence-like chunks with substance
    const sentences = transcript.match(/[А-ЯЁA-Z][^.!?]{40,180}[.!?]/g) || [];
    for (const s of sentences) {
      const clean = s.trim();
      if (/здравствуйте|дорогие мои|итак|смотрите|угу|пожалуйста|сегодня у нас/i.test(clean)) continue;
      if (/маркетинговой программы|имидж предприятия/i.test(clean)) continue;
      const key = clean.slice(0, 50).toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      insights.push(clean);
      if (insights.length >= 8) return insights;
    }
  }
  return insights;
}

function aboutFromTranscript(insights, programNames, themes, course) {
  const items = [];

  // From program lesson titles (concrete) — primary source
  for (const name of programNames.slice(0, 10)) {
    if (name.length < 4) continue;
    if (/доступ|перейд|ссылка|благодарю|вводн/i.test(name)) continue;
    items.push(name);
    if (items.length >= 5) break;
  }

  const themeAbout = {
    tarot: [
      'работу с колодой как инструментом самопознания (не «гадания»)',
      'расклады, трактовки и этику работы с клиентами',
    ],
    relations: [
      'сценарии в отношениях и способы их исцеления',
      'практики для близости, границ и новой динамики',
    ],
    money: [
      'денежные установки и блоки',
      'практики для включения потока изобилия',
    ],
    selfworth: [
      'самоценность, принятие себя и внутреннюю опору',
      'практики возвращения к себе',
    ],
    theta: [
      'работу с убеждениями методом Тетахилинг',
      'трансформацию жизненных сценариев',
    ],
    numerology: [
      'ведическую нумерологию: числа характера и планетарные энергии',
      'применение знаний в жизни и консультациях',
    ],
    boundaries: [
      'личные границы и устойчивое состояние',
      'как говорить «нет» и сохранять себя',
    ],
    energy: [
      'энергетическую проработку вашего запроса',
      'интеграцию изменений после сессии',
    ],
    pro: [
      'профессиональный рост практика',
      'упаковку экспертности и работу с клиентами',
    ],
  };

  // If we have few program titles, add theme lines
  if (items.length < 4) {
    for (const th of themes) {
      for (const line of themeAbout[th] || []) {
        if (!items.includes(line)) items.push(line);
      }
    }
  }

  // Add 1-2 cleaned transcript insights only if they look like clear teaching points
  for (const insight of insights) {
    if (items.length >= 6) break;
    if (insight.length < 55 || insight.length > 140) continue;
    if (/Да |А |ну |вот |это /i.test(insight.slice(0, 15))) continue;
    if (/структуру колоды|выяснить/i.test(insight)) continue;
    const short = insight;
    if (!items.some((x) => x.includes(short.slice(0, 25)))) items.push(short);
  }

  if (!items.length) {
    items.push(`ключевые темы программы «${course.title}»`);
    items.push('практики и разборы от Марины Герман');
  }

  return items.slice(0, 6);
}

function forWhom(themes) {
  const map = {
    tarot: [
      'хотите освоить Таро глубинно — для себя или как профессию',
      'готовы практиковать регулярно, а не только смотреть теорию',
    ],
    relations: [
      'устали от повторяющихся сценариев в отношениях',
      'хотите исцелить близость и лучше понимать себя в паре',
    ],
    money: [
      'чувствуете блоки в теме денег и готовы их прорабатывать',
      'хотите больше лёгкости и осознанности с финансами',
    ],
    selfworth: [
      'сомневаетесь в себе и хотите вернуть внутреннюю опору',
      'готовы бережно работать с самоценностью',
    ],
    theta: [
      'интересуетесь Тетахилинг и трансформацией убеждений',
      'чувствуете, что корень проблем — глубже, чем «на поверхности»',
    ],
    numerology: [
      'хотите понимать себя и других через числа и энергии планет',
      'планируете применять нумерологию в жизни или работе',
    ],
    boundaries: [
      'сложно отстаивать границы и говорить «нет»',
      'хотите больше спокойствия и уважения к себе',
    ],
    energy: [
      'стоите на пороге изменений и ищете глубокую поддержку',
      'хотите проработать конкретный запрос через практику',
    ],
    pro: [
      'уже практикуете и хотите вырасти как эксперт',
      'готовы инвестировать в систему, практику и результат',
    ],
  };
  const items = [];
  for (const th of themes) {
    for (const line of map[th] || []) {
      if (!items.includes(line)) items.push(line);
    }
  }
  if (!items.length) {
    items.push('ищете проверенные практики личностного и духовного роста');
    items.push('готовы уделять время себе и применять знания');
  }
  return items.slice(0, 4);
}

function outcomes(course, lessons, themes, videoCount) {
  const items = [];
  const contentCount = lessons.filter((l) => !isAdminLesson(l)).length;

  if (videoCount > 0) {
    items.push(
      `${videoCount} ${pluralRu(videoCount, 'видеоурок', 'видеоурока', 'видеоуроков')} в личном кабинете — смотрите в удобном темпе`
    );
  } else {
    items.push('доступ к материалам программы после оплаты');
  }

  if (contentCount > 1) {
    items.push(
      `структурированную программу (${contentCount} ${pluralRu(contentCount, 'тема', 'темы', 'тем')})`
    );
  }

  const byTheme = {
    tarot: ['навык уверенной работы с картами и раскладами', 'понимание этики и глубины Таро'],
    relations: ['ясность в отношениях и новые опоры для близости'],
    money: ['осознание денежных блоков и практический план действий'],
    selfworth: ['больше принятия себя и инструменты ежедневной поддержки'],
    theta: ['проработку ключевых убеждений и ресурс для изменений'],
    numerology: ['умение читать числа и применять их на практике'],
    boundaries: ['уверенность в границах и более устойчивое состояние'],
    energy: ['энергетическую перезагрузку и инсайты по запросу'],
    pro: ['систему роста как практика и понимание монетизации'],
  };

  for (const th of themes) {
    for (const line of byTheme[th] || []) {
      if (!items.includes(line)) items.push(line);
    }
  }

  items.push('формат обучения в школе Марины Герман с доступом в личный кабинет');
  return items.slice(0, 5);
}

function hook(course, themes, fmt) {
  const t = course.title;
  const w = fmt.prep;
  if (themes.includes('tarot'))
    return `На ${w} вы погрузитесь в Таро как в систему самопознания и практики — «${t}».`;
  if (themes.includes('relations'))
    return `На ${w} вы проработаете отношения на глубине и откроете новый сценарий близости — «${t}».`;
  if (themes.includes('money'))
    return `На ${w} вы снимете блоки в теме денег и включите поток изобилия — «${t}».`;
  if (themes.includes('selfworth'))
    return `На ${w} вы вернёте себе опору, ценность и внутреннюю силу — «${t}».`;
  if (themes.includes('theta'))
    return `На ${w} вы трансформируете сценарии через практики Тетахилинг — «${t}».`;
  if (themes.includes('numerology'))
    return `На ${w} вы расшифруете код жизни через ведическую нумерологию — «${t}».`;
  if (themes.includes('energy'))
    return `На ${w} вы получите мощную энергетическую проработку запроса — «${t}».`;
  if (themes.includes('boundaries'))
    return `На ${w} вы научитесь защищать границы и выстраивать здоровые отношения с собой — «${t}».`;
  return `Авторская программа Марины Герман для роста, исцеления и раскрытия потенциала — «${t}».`;
}

function generateDescription(course, lessons) {
  const themes = themesOf(course.title);
  const fmt = formatWord(course);
  const videoLessons = lessons.filter(lessonHasVideo);
  const programNames = lessons
    .filter((l) => !isAdminLesson(l))
    .map(lessonDisplayName)
    .filter((n, i, a) => n && a.indexOf(n) === i);

  const insights = extractTranscriptInsights(lessons);
  const about = aboutFromTranscript(insights, programNames, themes, course);
  const whom = forWhom(themes);
  const get = outcomes(course, lessons, themes, videoLessons.length);

  // Prefer clean program titles over noisy transcript fragments in "about"
  const aboutClean = about.filter((x) => !/А и выяснить|Да структуру|Сортируем ко/i.test(x));

  const parts = [
    hook(course, themes, fmt),
    '',
    `О чём ${fmt.about}:`,
    ...(aboutClean.length ? aboutClean : about).map((x) => `• ${x}`),
    '',
    'Для кого:',
    ...whom.map((x) => `• ${x}`),
    '',
    'Что вы получите:',
    ...get.map((x) => `• ${x}`),
  ];

  let desc = parts.join('\n').trim();
  if (desc.length > 2800) desc = desc.slice(0, 2797) + '…';
  return desc;
}

function catalogBlurb(full) {
  const about = full.split(/О чём /)[1]?.split(/Для кого:/)[0] || '';
  const bullets = about
    .split('•')
    .map((s) => s.trim())
    .filter((s) => s.length > 15)
    .slice(0, 2);
  const hookLine = full.split('\n')[0];
  if (bullets.length) {
    return `${hookLine} ${bullets.map((b) => b.replace(/\n/g, ' ')).join('; ')}`.slice(0, 420);
  }
  return hookLine.slice(0, 380);
}

const catalog = [];
for (const file of fs.readdirSync(path.join(DATA, 'courses')).filter((f) => f.endsWith('.json'))) {
  const coursePath = path.join(DATA, 'courses', file);
  const course = JSON.parse(fs.readFileSync(coursePath, 'utf8').replace(/^\uFEFF/, ''));
  if (/демонстрац/i.test(course.title || '') || course.id === '934657351') continue;

  const lessons = flattenLessons(course);
  const description = generateDescription(course, lessons);
  course.description = description;
  fs.writeFileSync(coursePath, JSON.stringify(course, null, 2), 'utf8');

  const exportPath = path.join(EXPORT, file);
  if (fs.existsSync(exportPath)) {
    const exported = JSON.parse(fs.readFileSync(exportPath, 'utf8').replace(/^\uFEFF/, ''));
    exported.description = description;
    fs.writeFileSync(exportPath, JSON.stringify(exported, null, 2), 'utf8');
  }

  catalog.push({
    id: course.id,
    title: course.title,
    slug: course.slug,
    description: catalogBlurb(description),
    category: course.category,
    paymentUrl: course.paymentUrl || '',
    lessonsCount: course.lessonsCount,
    hasLocalVideo: course.hasLocalVideo,
  });
}

catalog.sort((a, b) => a.title.localeCompare(b.title, 'ru'));
fs.writeFileSync(path.join(DATA, 'catalog.json'), JSON.stringify(catalog, null, 2), 'utf8');

console.log('Updated', catalog.length, 'courses');
console.log('\n--- SAMPLE ---\n');
console.log(JSON.parse(fs.readFileSync(path.join(DATA, 'courses', '885331478.json'), 'utf8')).description);
