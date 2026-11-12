# -*- coding: utf-8 -*-
"""Build ThetaHealing hub + subsection pages."""
from pathlib import Path

ROOT = Path(__file__).resolve().parent

CSS = r"""
:root{--bg:#050505;--ink:#fff;--muted:#b8b0a6;--line:rgba(197,160,112,.28);--gold:#c5a070;--gold-bright:#e0c08a;--gold-dim:#9a7a4f}
*{box-sizing:border-box;margin:0;padding:0}
body{min-height:100vh;background:var(--bg);color:var(--ink);font-family:Georgia,"Times New Roman",serif;line-height:1.6}
.sans{font-family:system-ui,-apple-system,"Segoe UI",sans-serif}
a{color:inherit;text-decoration:none}
.container{width:min(900px,calc(100% - 2rem));margin:0 auto}
.site-topbar{position:sticky;top:0;z-index:50;background:rgba(5,5,5,.92);backdrop-filter:blur(12px);border-bottom:1px solid rgba(197,160,112,.22)}
.topbar-inner{display:flex;align-items:center;justify-content:space-between;gap:.8rem;padding:.55rem 0;flex-wrap:wrap}
.logo-link{display:inline-flex;align-items:center;gap:.55rem}
.logo-img{width:52px;height:52px;object-fit:contain}
.logo-word{display:flex;flex-direction:column;line-height:1.15}
.logo-word strong{font-size:.78rem;letter-spacing:.12em;text-transform:uppercase;color:var(--gold-bright)}
.logo-word span{font-size:.6rem;color:var(--muted)}
.nav-pages{display:flex;flex-wrap:wrap;gap:.28rem}
.nav-pages a{border:1px solid var(--line);border-radius:999px;padding:.32rem .62rem;font-size:.56rem;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:var(--gold-bright)}
.nav-pages a.active,.nav-pages a:hover{border-color:var(--gold);color:#fff}
.top-btn{border-radius:999px;padding:.38rem .75rem;font-size:.6rem;font-weight:700;letter-spacing:.05em;text-transform:uppercase;background:linear-gradient(135deg,var(--gold-bright),var(--gold),var(--gold-dim));color:#111}
.subnav{display:flex;flex-wrap:wrap;gap:.4rem;margin:1rem 0 0}
.subnav a{border:1px solid rgba(197,160,112,.35);border-radius:999px;padding:.4rem .75rem;font-size:.62rem;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:var(--gold-bright)}
.subnav a.on{background:linear-gradient(135deg,var(--gold-bright),var(--gold),var(--gold-dim));color:#111;border-color:transparent}
.hero{padding:2rem 0 1.4rem;border-bottom:1px solid rgba(197,160,112,.16);background:linear-gradient(180deg,#0c0a08,#050505)}
.eyebrow{font-size:.7rem;font-weight:700;letter-spacing:.2em;text-transform:uppercase;color:var(--gold)}
h1{margin-top:.5rem;font-size:clamp(1.5rem,3.6vw,2.25rem);line-height:1.18}
.lead{margin-top:.8rem;color:var(--muted);font-size:1.02rem;max-width:42rem}
.actions{display:flex;flex-wrap:wrap;gap:.55rem;margin-top:1rem}
.btn{display:inline-flex;align-items:center;justify-content:center;border-radius:999px;padding:.7rem 1.1rem;font-size:.72rem;font-weight:700;letter-spacing:.05em;text-transform:uppercase}
.btn-gold{background:linear-gradient(135deg,var(--gold-bright),var(--gold),var(--gold-dim));color:#111}
.btn-ghost{border:1px solid rgba(197,160,112,.4);color:var(--gold-bright)}
section{padding:1.7rem 0}
section+section{border-top:1px solid rgba(197,160,112,.12)}
h2{font-size:clamp(1.1rem,2.3vw,1.45rem);margin-bottom:.65rem;color:var(--gold-bright)}
h3{color:#fff;font-size:1.05rem;margin:.9rem 0 .35rem}
p{margin-top:.65rem;color:var(--muted)}
ul,ol{margin:.7rem 0 0 1.15rem;color:var(--muted)}
li{margin:.35rem 0}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:.85rem;margin-top:1rem}
.card{border:1px solid rgba(197,160,112,.25);border-radius:16px;padding:1.15rem;background:linear-gradient(180deg,rgba(28,24,20,.5),rgba(10,9,8,.92));display:flex;flex-direction:column}
.card h3{margin-top:0}
.tag{font-size:.62rem;letter-spacing:.12em;text-transform:uppercase;color:var(--gold);font-weight:700;margin-bottom:.35rem}
.date{font-size:.88rem;color:var(--gold-bright);margin-top:.35rem}
.price{margin-top:.55rem;font-size:1.05rem;color:#fff;font-weight:700}
.price .old{text-decoration:line-through;opacity:.55;font-weight:500;margin-right:.35rem;font-size:.9rem}
.card .actions{margin-top:auto;padding-top:1rem}
.article p{font-size:1.02rem}
.article h2{margin-top:1.6rem}
.faq details{border:1px solid var(--line);border-radius:14px;background:linear-gradient(160deg,#161310,#0a0908);margin-top:.75rem}
.faq summary{cursor:pointer;list-style:none;padding:1rem 1.1rem;font-weight:700;color:var(--gold-bright)}
.faq summary::-webkit-details-marker{display:none}
.faq details p{padding:0 1.1rem 1.05rem;margin-top:0}
.crumbs{font-size:.75rem;color:var(--muted);margin-bottom:.75rem}
.crumbs a{color:var(--gold-bright);text-decoration:underline;text-underline-offset:2px}
.note{font-size:.85rem;color:#8a8278;margin-top:1rem}
.cta{margin-top:1.2rem;padding:1.25rem 1.1rem;border-radius:18px;border:1px solid rgba(197,160,112,.4);background:linear-gradient(135deg,rgba(197,160,112,.16),rgba(12,10,8,.95))}
.schedule{border:1px solid rgba(197,160,112,.25);border-radius:16px;padding:1.2rem 1.15rem;background:#0a0908;margin-top:1rem}
.schedule li{margin:.45rem 0}
.player-wrap{position:relative;padding-top:56.25%;border-radius:14px;overflow:hidden;border:1px solid rgba(197,160,112,.25);margin-top:.8rem}
.player-wrap iframe{position:absolute;inset:0;width:100%;height:100%;border:0}
.site-footer{border-top:1px solid rgba(197,160,112,.2);padding:1.5rem 0 2rem}
.footer-seller p{margin-top:.3rem;color:var(--muted);font-size:.88rem}
.footer-seller strong{color:var(--gold)}
.footer-seller a,.footer-links a{color:var(--gold-bright)}
.footer-links{display:flex;flex-wrap:wrap;gap:.5rem .9rem;margin-top:1rem}
.footer-links a{font-size:.78rem;color:var(--muted)}
.footer-copy{margin-top:1rem;color:#6f675f;font-size:.75rem}
@media(max-width:720px){.logo-word{display:none}}
"""

NAV = """
  <div class="site-topbar"><div class="container topbar-inner sans">
    <a class="logo-link" href="index.html" aria-label="На главную">
      <img class="logo-img" src="logo-mg.png" width="52" height="52" alt="МГ">
      <span class="logo-word"><strong>Марина Герман</strong><span>Тебе можно легче</span></span>
    </a>
    <nav class="nav-pages" aria-label="Разделы">
      <a href="index.html">Главная</a>
      <a href="sdvg.html">СДВГ</a>
      <a href="ya-mogu.html">Я МОГУ!</a>
      <a href="podarki.html">Подарки</a>
      <a href="depressiya.html">Депрессия</a>
      <a class="active" href="tetahiling.html">Тетахилинг</a>
      <a href="kursy.html">Курсы</a>
      <a href="marina-german.html">Обо мне</a>
      <a href="otzyvy.html">Отзывы</a>
      <a href="stati.html">Статьи</a>
    </nav>
    <a class="top-btn" href="https://t.me/marina_germann" target="_blank" rel="noopener">Написать</a>
  </div></div>
"""

SUB = """
<nav class="subnav sans" aria-label="Подразделы Тетахилинг">
  <a href="tetahiling-metodika.html"{m}>Про методику</a>
  <a href="tetahiling-obuchenie.html"{o}>Обучение</a>
  <a href="tetahiling-sessiya.html"{s}>Тета-сессия</a>
  <a href="tetahiling-meditatsii.html"{d}>Медитации</a>
  <a href="tetahiling-faq.html"{f}>FAQ</a>
</nav>
"""

FOOT = """
<footer class="site-footer sans"><div class="container">
  <div class="footer-seller">
    <p><strong>ИП Герман Марина Олеговна</strong></p>
    <p>Тел.: <a href="tel:+79897001701">+7 989 700 17 01</a></p>
    <p>Email: <a href="mailto:marinagerman.nails@gmail.com">marinagerman.nails@gmail.com</a></p>
  </div>
  <nav class="footer-links">
    <a href="oferta.html">Оферта</a>
    <a href="https://marinagerman.getcourse.ru/ofertaTETY" target="_blank" rel="noopener">Оферта Тетахилинг</a>
    <a href="privacy.html">Конфиденциальность</a>
    <a href="tetahiling.html">Тетахилинг</a>
  </nav>
  <p class="footer-copy">Copyright © 2026 ИП Герман Марина Олеговна. ThetaHealing® — зарегистрированная методика.</p>
</div></footer>
<script src="js/analytics.js" defer></script>
"""


def page(title, desc, canonical, body, active=""):
    flags = {k: ' class="on"' if active == k else "" for k in "mosdf"}
    sub = SUB.format(m=flags["m"], o=flags["o"], s=flags["s"], d=flags["d"], f=flags["f"])
    return f"""<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{title}</title>
  <link rel="canonical" href="https://marinagerman.github.io/marinagerman/{canonical}">
  <meta name="description" content="{desc}">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="Марина Олеговна Герман">
  <meta property="og:title" content="{title}">
  <meta property="og:description" content="{desc}">
  <meta property="og:image" content="https://marinagerman.github.io/marinagerman/og-share-square.jpg">
  <meta property="og:url" content="https://marinagerman.github.io/marinagerman/{canonical}">
  <link rel="icon" type="image/png" sizes="32x32" href="favicon-32.png">
  <style>{CSS}</style>
</head>
<body>
{NAV}
{body.replace("<!--SUB-->", sub)}
{FOOT}
</body>
</html>
"""


COURSES = [
    ("1 ступень", "Базовый семинар ThetaHealing", "17–19 декабря 2026", "27 000 ₽", "", "https://payform.ru/emcLKzG/"),
    ("2 ступень", "Продвинутый семинар ThetaHealing", "21–23 декабря 2026", "27 000 ₽", "", "https://payform.ru/emcLKzG/"),
    ("Пакет", "Базовый + продвинутый", "", "49 000 ₽", "54 000 ₽", "https://payform.ru/iscLKS2/"),
    ("Ступень", "Глубинные раскопки", "25–26 декабря 2026", "25 000 ₽", "", "https://payform.ru/nmcLLaJ/"),
    ("Пакет", "Базовый + продвинутый + раскопки", "", "72 000 ₽", "79 000 ₽", "https://payform.ru/tocLKXP/"),
    ("Курс", "Игра жизни", "24–26 ноября 2026 · 9:00–17:00 мск", "30 000 ₽", "", "https://payform.ru/qbcLLsh/"),
    ("Курс", "Ты и Творец", "30 ноября — 1 декабря 2026 · 9:00–17:00 мск", "25 000 ₽", "", "https://payform.ru/nmcLLaJ/"),
    ("Курс", "Манифестация и изобилие", "", "25 000 ₽", "", "https://payform.ru/nmcLLaJ/"),
    ("Курс", "Друг Души", "", "25 000 ₽", "", "https://payform.ru/nmcLLaJ/"),
]


def course_cards():
    parts = []
    for tag, name, date, price, old, url in COURSES:
        old_html = f'<span class="old">{old}</span> ' if old else ""
        date_html = f'<p class="date">{date}</p>' if date else ""
        parts.append(f"""
        <article class="card">
          <div class="tag">{tag}</div>
          <h3>{name}</h3>
          {date_html}
          <div class="price">{old_html}{price}</div>
          <div class="actions"><a class="btn btn-gold" href="{url}" target="_blank" rel="noopener">Оплатить</a></div>
        </article>""")
    return "\n".join(parts)


# --- pages ---
hub = page(
    "Тетахилинг — Марина Олеговна Герман | ThetaHealing",
    "Раздел Тетахилинг: методика, обучение, тета-сессии, медитации и FAQ. Инструктор Марина Олеговна Герман.",
    "tetahiling.html",
    """
<header class="hero"><div class="container">
  <p class="crumbs sans"><a href="index.html">Главная</a> · Тетахилинг</p>
  <p class="eyebrow sans">ThetaHealing · онлайн</p>
  <h1 class="sans">Тетахилинг</h1>
  <p class="lead">Инструктор Марина Олеговна Герман. Выберите раздел: методика, обучение с оплатой, личная сессия, медитации или FAQ.</p>
  <!--SUB-->
</div></header>
<main><section><div class="container">
  <div class="grid sans">
    <a class="card" href="tetahiling-metodika.html"><div class="tag">Статьи</div><h3>Про методику</h3><p>Что такое Тетахилинг, базовый, продвинутый и глубинные раскопки.</p></a>
    <a class="card" href="tetahiling-obuchenie.html"><div class="tag">Семинары 2026</div><h3>Обучение</h3><p>Расписание и оплата — как на Taplink.</p></a>
    <a class="card" href="tetahiling-sessiya.html"><div class="tag">1:1</div><h3>Тета-сессия</h3><p>Личная работа с запросом.</p></a>
    <a class="card" href="tetahiling-meditatsii.html"><div class="tag">Практика</div><h3>Тета-медитации</h3><p>Бесплатные медитации Тетахилинг.</p></a>
    <a class="card" href="tetahiling-faq.html"><div class="tag">Вопросы</div><h3>FAQ</h3><p>Образование, запись, сертификат, цена, рассрочка.</p></a>
  </div>
</div></section></main>
""",
    "",
)

metodika = page(
    "Про методику Тетахилинг — статьи | Марина Олеговна Герман",
    "Статьи о методике ThetaHealing: что это, базовый и продвинутый семинары, глубинные раскопки.",
    "tetahiling-metodika.html",
    """
<header class="hero"><div class="container">
  <p class="crumbs sans"><a href="index.html">Главная</a> · <a href="tetahiling.html">Тетахилинг</a> · Методика</p>
  <p class="eyebrow sans">Статьи</p>
  <h1 class="sans">Про методику Тетахилинг</h1>
  <p class="lead">Читайте по порядку — от общего знакомства к обзору семинаров азбуки.</p>
  <!--SUB-->
</div></header>
<main><section><div class="container">
  <div class="grid sans">
    <a class="card" href="tetahiling-statya-chto-eto.html"><div class="tag">Обзор</div><h3>Что это за методика</h3><p>Почему Тетахилинг изучают миллионы людей по всему миру.</p></a>
    <a class="card" href="tetahiling-statya-bazovyy.html"><div class="tag">1 ступень</div><h3>Обзор базового семинара</h3><p>Чему учитесь на базе и для кого подходит.</p></a>
    <a class="card" href="tetahiling-statya-prodvinutyy.html"><div class="tag">2 ступень</div><h3>Продвинутый семинар</h3><p>Как выйти на новый уровень практики.</p></a>
    <a class="card" href="tetahiling-statya-raskopki.html"><div class="tag">3 ступень</div><h3>Глубинные раскопки</h3><p>12 алгоритмов сессий на любой случай.</p></a>
  </div>
  <div class="actions sans" style="margin-top:1.2rem">
    <a class="btn btn-gold" href="tetahiling-obuchenie.html">К обучению и оплате</a>
    <a class="btn btn-ghost" href="tetahiling-sessiya.html">Тета-сессия</a>
  </div>
</div></section></main>
""",
    "m",
)

obuchenie = page(
    "Обучение Тетахилинг онлайн 2026 — расписание и оплата | Марина Олеговна Герман",
    "Расписание семинаров ThetaHealing онлайн 2026: базовый, продвинутый, раскопки, Игра жизни, Ты и Творец. Оплата как на Taplink.",
    "tetahiling-obuchenie.html",
    f"""
<header class="hero"><div class="container">
  <p class="crumbs sans"><a href="index.html">Главная</a> · <a href="tetahiling.html">Тетахилинг</a> · Обучение</p>
  <p class="eyebrow sans">Онлайн 2026</p>
  <h1 class="sans">Обучение Тетахилинг</h1>
  <p class="lead">Инструктор Марина Олеговна Герман · коуч ICF · интегративный психолог. Расписание и оплата — как на Taplink.</p>
  <!--SUB-->
</div></header>
<main>
<section><div class="container">
  <div class="schedule sans">
    <h2 class="sans">Расписание семинаров ThetaHealing онлайн 2026</h2>
    <ul>
      <li><strong style="color:#fff">Игра жизни</strong> — 24–26 ноября 2026, 9:00–17:00 мск</li>
      <li><strong style="color:#fff">Ты и Творец</strong> — 30 ноября — 1 декабря 2026, 9:00–17:00 мск</li>
      <li><strong style="color:#fff">Базовый</strong> — 17–19 декабря 2026</li>
      <li><strong style="color:#fff">Продвинутый</strong> — 21–23 декабря 2026</li>
      <li><strong style="color:#fff">Глубинные раскопки</strong> — 25–26 декабря 2026</li>
    </ul>
  </div>
</div></section>
<section id="oplata"><div class="container">
  <h2 class="sans">Семинары и оплата</h2>
  <p>Оплата через Payform. Есть стипендия и рассрочка — напишите в Telegram.</p>
  <div class="grid sans">{course_cards()}
  </div>
  <p class="note sans">Также на <a href="https://taplink.cc/pogore__lova/p/a35bf7/" target="_blank" rel="noopener" style="color:var(--gold-bright);text-decoration:underline">Taplink</a>.
  <a href="https://marinagerman.getcourse.ru/ofertaTETY" target="_blank" rel="noopener" style="color:var(--gold-bright);text-decoration:underline">Оферта на обучение</a>.
  Статьи о программах — в <a href="tetahiling-metodika.html" style="color:var(--gold-bright);text-decoration:underline">разделе «Про методику»</a>.</p>
</div></section>
</main>
""",
    "o",
)

sessiya = page(
    "Тета-сессия — записаться | Марина Олеговна Герман",
    "Индивидуальная тета-сессия и сканирование у инструктора ThetaHealing Марины Олеговны Герман.",
    "tetahiling-sessiya.html",
    """
<header class="hero"><div class="container">
  <p class="crumbs sans"><a href="index.html">Главная</a> · <a href="tetahiling.html">Тетахилинг</a> · Сессия</p>
  <p class="eyebrow sans">Личная работа</p>
  <h1 class="sans">Тета-сессия</h1>
  <p class="lead">Если пока не готовы к курсу, но хотите познакомиться с подходом на своём запросе — начните с сессии.</p>
  <!--SUB-->
</div></header>
<main><section><div class="container">
  <div class="grid sans">
    <article class="card">
      <div class="tag">1 час</div>
      <h3>Тетахилинг 1 ч</h3>
      <div class="price">24 000 ₽</div>
      <div class="actions"><a class="btn btn-gold" href="https://payform.ru/bmcAhPz/" target="_blank" rel="noopener">Оплатить</a></div>
    </article>
    <article class="card">
      <div class="tag">2 часа</div>
      <h3>Тетахилинг 2 ч</h3>
      <div class="price">30 000 ₽</div>
      <div class="actions"><a class="btn btn-gold" href="https://payform.ru/g0cAhRS/" target="_blank" rel="noopener">Оплатить</a></div>
    </article>
    <article class="card">
      <div class="tag">Сканирование</div>
      <h3>Сканирование пространства</h3>
      <div class="price">5 000 ₽</div>
      <div class="actions"><a class="btn btn-gold" href="https://payform.ru/cqcAhA2/" target="_blank" rel="noopener">Оплатить</a></div>
    </article>
  </div>
  <p class="note">После оплаты напишите Марине в Telegram для записи слота: <a href="https://t.me/marina_germann" style="color:var(--gold-bright)">@marina_germann</a></p>
  <div class="actions sans"><a class="btn btn-ghost" href="tetahiling-obuchenie.html">К обучению</a></div>
</div></section></main>
""",
    "s",
)

med = page(
    "Тета-медитации — бесплатно | Марина Олеговна Герман",
    "Бесплатные медитации Тетахилинг от Марины Олеговны Герман: ресурс, будущее, прощение.",
    "tetahiling-meditatsii.html",
    """
<header class="hero"><div class="container">
  <p class="crumbs sans"><a href="index.html">Главная</a> · <a href="tetahiling.html">Тетахилинг</a> · Медитации</p>
  <p class="eyebrow sans">Практика</p>
  <h1 class="sans">Тета-медитации</h1>
  <p class="lead">Исцеляющие медитации Тетахилинг — почувствуйте подход до обучения или сессии.</p>
  <!--SUB-->
</div></header>
<main><section><div class="container">
  <article class="card" style="margin-top:0">
    <h3>Медитация: исцеление тревоги и наполнение ресурсом</h3>
    <p>Отпустить переживания · расслабить тело и ум · ощутить спокойствие.</p>
    <div class="player-wrap"><iframe src="https://kinescope.io/embed/6ca3252e-677d-4d27-acb2-9c89ae40849c" allow="autoplay; fullscreen; picture-in-picture; encrypted-media" allowfullscreen title="Медитация ресурс"></iframe></div>
  </article>
  <article class="card" style="margin-top:1rem">
    <h3>Вечерняя медитация на создание счастливого будущего</h3>
    <p>Отпустить тревоги уходящего дня · наполниться спокойствием и радостью.</p>
    <div class="player-wrap"><iframe src="https://kinescope.io/embed/26184315-f75f-4fe2-a217-16744136e562" allow="autoplay; fullscreen; picture-in-picture; encrypted-media" allowfullscreen title="Вечерняя медитация"></iframe></div>
  </article>
  <article class="card" style="margin-top:1rem">
    <h3>Практика прощения</h3>
    <p>Глубокая исцеляющая практика — вернуть ресурс, скрытый за уроком.</p>
    <div class="player-wrap"><iframe src="https://kinescope.io/embed/29d20b0c-5186-4758-9944-cd1ede06e343" allow="autoplay; fullscreen; picture-in-picture; encrypted-media" allowfullscreen title="Практика прощения"></iframe></div>
  </article>
  <p class="note">Больше подарков: <a href="podarki.html" style="color:var(--gold-bright)">podarki.html</a></p>
</div></section></main>
""",
    "d",
)

FAQ_ITEMS = [
    ("Нужно ли специальное образование, чтобы обучаться Тетахилинг?",
     "Нет. Специальное образование, таланты или особые способности не требуются. Обучаются люди всех возрастов — от детей 8–9 лет до 80–90 лет."),
    ("Есть ли запись курса?",
     "После курса остаются мануал (тетрадь с конспектом практик) и книга с описанием методики. Видеозаписи курса нет. Семинары проходят только вживую: студенты в парах отрабатывают каждую технику."),
    ("Можно ли пропустить день или несколько часов?",
     "Нужно спланировать время так, чтобы быть на занятиях все дни от начала до конца с включённой камерой, желательно из дома и со стабильным интернетом. Записи нет — при пропусках инструктор не имеет права выдать сертификат."),
    ("Получу ли я документ о прохождении?",
     "Да. За каждый семинар — сертификат практика ThetaHealing, если вы были на занятиях всё время и участвовали во всех практиках."),
    ("А если у меня не получится сканировать?",
     "Методике обучились сотни тысяч людей из 200+ стран. В первый день курса — техника пробуждения интуитивных способностей. Они есть у каждого. Получится — это проще, чем кажется."),
    ("Сколько стоит один семинар?",
     'Один семинар от 25 000 ₽; при оплате двух и более — ниже. Актуальные цены — на <a href="tetahiling-obuchenie.html" style="color:var(--gold-bright)">странице обучения</a> и <a href="https://taplink.cc/pogore__lova/p/a35bf7/" target="_blank" rel="noopener" style="color:var(--gold-bright)">Taplink</a>.'),
    ("Есть ли рассрочка?",
     "Да, рассрочка от банка без процентов и переплат, с первым платежом через месяц."),
    ("Можно заранее платить маленькими платежами?",
     "Да. Часто копят по 5 000 ₽ один–два раза в месяц. Вся сумма должна быть оплачена полностью за день до обучения."),
    ("Как занять место в группе?",
     'Внесите полную стоимость семинара или организационный сбор 5 000 ₽ за каждый семинар и напишите Марине в <a href="https://t.me/marina_germann" target="_blank" rel="noopener" style="color:var(--gold-bright)">Telegram</a>.'),
    ("Когда ближайшее обучение?",
     'Смотрите актуальное расписание на <a href="tetahiling-obuchenie.html" style="color:var(--gold-bright)">странице обучения</a>.'),
    ("Какие ещё курсы Тетахилинг вы проводите?",
     "Манифестация и изобилие, Ты и Творец, Друг Души, Игра жизни — все на странице обучения."),
    ("Можно ли пройти повторное обучение?",
     "Да. Повторное прохождение — 50% от стоимости."),
    ("Как стать ассистентом на обучении?",
     'Ассистентами беру студентов, прошедших обучение у меня. Заявка в <a href="https://t.me/marina_germann" target="_blank" rel="noopener" style="color:var(--gold-bright)">Telegram</a> + организационный сбор 5 000 ₽.'),
]

faq_html = "\n".join(
    f'<details><summary class="sans">{q}</summary><p>{a}</p></details>' for q, a in FAQ_ITEMS
)

faq = page(
    "FAQ Тетахилинг — частые вопросы | Марина Олеговна Герман",
    "Частые вопросы об обучении ThetaHealing: образование, запись, сертификат, цена, рассрочка, ассистирование.",
    "tetahiling-faq.html",
    f"""
<header class="hero"><div class="container">
  <p class="crumbs sans"><a href="index.html">Главная</a> · <a href="tetahiling.html">Тетахилинг</a> · FAQ</p>
  <p class="eyebrow sans">Вопросы</p>
  <h1 class="sans">Часто задаваемые вопросы</h1>
  <p class="lead">Про обучение Тетахилинг онлайн у Марины Олеговны Герман.</p>
  <!--SUB-->
</div></header>
<main><section><div class="container faq">
{faq_html}
  <div class="actions sans" style="margin-top:1.3rem">
    <a class="btn btn-gold" href="tetahiling-obuchenie.html">К обучению</a>
    <a class="btn btn-ghost" href="https://t.me/marina_germann" target="_blank" rel="noopener">Спросить в Telegram</a>
  </div>
</div></section></main>
""",
    "f",
)


def article(fname, title, crumbs_title, body_inner):
    return page(
        f"{title} | Марина Олеговна Герман",
        title[:150],
        fname,
        f"""
<header class="hero"><div class="container">
  <p class="crumbs sans"><a href="index.html">Главная</a> · <a href="tetahiling.html">Тетахилинг</a> · <a href="tetahiling-metodika.html">Методика</a> · {crumbs_title}</p>
  <p class="eyebrow sans">Статья</p>
  <h1 class="sans">{title}</h1>
  <!--SUB-->
</div></header>
<main><section><div class="container article">
{body_inner}
  <div class="actions sans" style="margin-top:1.4rem">
    <a class="btn btn-gold" href="tetahiling-obuchenie.html">Записаться на обучение</a>
    <a class="btn btn-ghost" href="tetahiling-metodika.html">Все статьи</a>
  </div>
</div></section></main>
""",
        "m",
    )


# Article bodies (condensed structure from user copy, full key sections)
a1 = article(
    "tetahiling-statya-chto-eto.html",
    "Тетахилинг: что это за методика и почему её изучают миллионы",
    "Что это",
    """
<p>В мире — более миллиона практиков Тетахилинг из 200+ стран, и число растёт.</p>
<p>Одна из главных причин популярности — сочетание простоты освоения и большого разнообразия техник для работы с собой и другими. Метод объединяет инструменты для изменения убеждений, сценариев, эмоций и состояния, плюс энергетические практики. Специальное психологическое образование не требуется.</p>
<h2 class="sans">С чем можно работать</h2>
<ol>
<li><strong style="color:#fff">Мышление и ограничивающие убеждения</strong> — «у меня не получится», «я недостаточно хороша», «деньги только тяжёлым трудом».</li>
<li><strong style="color:#fff">Поведение и повторяющиеся сценарии</strong> — отношения, прокрастинация, границы.</li>
<li><strong style="color:#fff">Эмоциональное состояние</strong> — страх, вина, стыд, обида, тревога.</li>
<li><strong style="color:#fff">Тело и психосоматика</strong> — без замены медицины; исследование связи эмоций и ощущений.</li>
<li><strong style="color:#fff">Энергетические практики и тонкие тела</strong> — отдельное направление методики.</li>
</ol>
<h2 class="sans">Как применяют на практике</h2>
<p>Можно не только обсуждать трудности, но и осваивать техники самостоятельной работы. Пример: ученица, которая боялась проявляться, стала увереннее общаться, переехала и начала выступать на сцене.</p>
<h2 class="sans">Как проходит обучение у Марины</h2>
<p>Более 70 потоков. Около 70% программы — практика. Онлайн, 9:00–17:00 мск, с перерывами. Книги и рабочие тетради у каждого участника.</p>
<h2 class="sans">С чего начать</h2>
<ul>
<li>Базовый → Продвинутый → Глубинные раскопки</li>
<li>Далее: Игра жизни, Ты и Творец и др.</li>
<li>Или начните с <a href="tetahiling-sessiya.html" style="color:var(--gold-bright)">индивидуальной сессии</a></li>
</ul>
<p>Далее: <a href="tetahiling-statya-bazovyy.html" style="color:var(--gold-bright)">обзор базового семинара →</a></p>
""",
)

a2 = article(
    "tetahiling-statya-bazovyy.html",
    "Обзор на базовый семинар Тетахилинг",
    "Базовый",
    """
<p>Базовый семинар — первый шаг. На практике вы учитесь входить в тета-состояние, работать с убеждениями и чувствами, знакомитесь с энергетическими техниками.</p>
<h2 class="sans">Чему научитесь</h2>
<ol>
<li>Тета-состояние и работа с вниманием</li>
<li>Интуиция и энергетическая работа, сканирование, техника безопасности</li>
<li>Работа с убеждениями и чувствами</li>
<li>Личные границы и освобождение от прошлого</li>
<li>Реализация целей и работа с будущим</li>
<li>Работа с телом и ДНК в рамках методики</li>
</ol>
<p>Теории около трети времени, остальное — упражнения, демонстрации и отработка в парах.</p>
<h2 class="sans">Для кого</h2>
<p>Для всех желающих. Психологическое образование не нужно. Эффективнее проходить вместе с продвинутым — больше техник и специальная стоимость пакета.</p>
<div class="actions sans"><a class="btn btn-gold" href="tetahiling-obuchenie.html">Даты и оплата базового</a>
<a class="btn btn-ghost" href="tetahiling-statya-prodvinutyy.html">Продвинутый →</a></div>
""",
)

a3 = article(
    "tetahiling-statya-prodvinutyy.html",
    "Продвинутый семинар Тетахилинг: как выйти на новый уровень практики",
    "Продвинутый",
    """
<p>Трёхдневное обучение — вторая ступень после Базового. Глубже практики, новые уровни опыта, темы, влияющие на качество жизни. Рекомендую проходить последовательно с базой.</p>
<h2 class="sans">Чему научитесь</h2>
<ol>
<li>Работа с чувствами, которые мешают двигаться вперёд</li>
<li>Новые уровни работы и восстановления, планы бытия</li>
<li>Работа с Родом и окружающим пространством</li>
<li>Манифестации и создание желаемого будущего</li>
<li>Новые направления энергетической работы</li>
<li>Углубление навыков раскопок</li>
</ol>
<p>Для участия нужен сертификат Базового семинара.</p>
<p>Попробовать метод можно на <a href="tetahiling-sessiya.html" style="color:var(--gold-bright)">индивидуальной сессии</a>.</p>
<div class="actions sans"><a class="btn btn-gold" href="tetahiling-obuchenie.html">Оплата продвинутого</a>
<a class="btn btn-ghost" href="tetahiling-statya-raskopki.html">Глубинные раскопки →</a></div>
""",
)

a4 = article(
    "tetahiling-statya-raskopki.html",
    "Глубинные раскопки Тетахилинг: 12 алгоритмов сессий",
    "Раскопки",
    """
<p>Третий семинар азбуки Тетахилинг — два дня. Для тех, кто прошёл Базовый и Продвинутый. За курс — 12 алгоритмов сессий и много практики в парах.</p>
<ol>
<li>Страхи и панические атаки</li>
<li>Тяжёлые чувства</li>
<li>Раскопка через ситуацию</li>
<li>Раскопка через желаемое</li>
<li>Раскопка болезни (два алгоритма)</li>
<li>Раскопка невозможного</li>
<li>Текущие трудности за 3–5 минут</li>
<li>Родовые программы</li>
<li>Коллективное поле и эгрегоры</li>
<li>Физические и душевные травмы</li>
<li>Прошлые воплощения (в мировоззрении методики)</li>
<li>Раскопка через добродетели</li>
</ol>
<p>Значительная часть — работа в парах: роль практика и клиента. Если ещё не были на сессии — <a href="tetahiling-sessiya.html" style="color:var(--gold-bright)">приходите почувствовать процесс</a>.</p>
<div class="actions sans"><a class="btn btn-gold" href="tetahiling-obuchenie.html">Оплата раскопок</a></div>
""",
)

files = {
    "tetahiling.html": hub,
    "tetahiling-metodika.html": metodika,
    "tetahiling-obuchenie.html": obuchenie,
    "tetahiling-sessiya.html": sessiya,
    "tetahiling-meditatsii.html": med,
    "tetahiling-faq.html": faq,
    "tetahiling-statya-chto-eto.html": a1,
    "tetahiling-statya-bazovyy.html": a2,
    "tetahiling-statya-prodvinutyy.html": a3,
    "tetahiling-statya-raskopki.html": a4,
}

for name, html in files.items():
    (ROOT / name).write_text(html, encoding="utf-8")
    print("wrote", name)

print("done", len(files))
