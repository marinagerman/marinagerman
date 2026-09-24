# -*- coding: utf-8 -*-
"""Regenerate access pages with header, footer, welcome + lesson blurbs."""
from __future__ import annotations

import json
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parent
UPLOAD = ROOT / "UPLOAD-NOW"
BASE = "https://marinagerman.github.io/marinagerman"

COURSES = [
    {"id": "900003551", "title": "Активация Личного Бренда", "price": 499, "pay": "https://payform.ru/fcczJgn/"},
    {"id": "935367017", "title": "Быстрый старт в практике", "price": 499, "pay": "https://payform.ru/krczJjh/"},
    {"id": "899970790", "title": "Внутренний Ребёнок", "price": 499, "pay": "https://payform.ru/u7czJoh/"},
    {"id": "935300516", "title": "Выход из зависимости", "price": 499, "pay": "https://payform.ru/4eczJqG/"},
    {"id": "934323468", "title": "Как найти своё дело", "price": 499, "pay": "https://payform.ru/8fczJsP/"},
    {"id": "934639263", "title": "Мама и Папа", "price": 499, "pay": "https://payform.ru/t7czJDS/"},
    {"id": "910034224", "title": "Предназначение и Деньги", "price": 499, "pay": "https://payform.ru/5kczJFJ/"},
    {"id": "905012137", "title": "Психосоматика", "price": 499, "pay": "https://payform.ru/pkczK8d/"},
    {"id": "934012602", "title": "Сила Рода", "price": 499, "pay": "https://payform.ru/r8czLXZ/"},
    {"id": "934323455", "title": "Карма и Судьба", "price": 999, "pay": "https://payform.ru/t7czMfa/"},
    {"id": "934892673", "title": "Магия голоса", "price": 999, "pay": "https://payform.ru/49czMi1/"},
    {"id": "934657331", "title": "Сексуальность", "price": 999, "pay": "https://payform.ru/87czMk7/"},
    {"id": "934990625", "title": "Твоя эксклюзивность", "price": 999, "pay": "https://payform.ru/ggczMow/"},
    {"id": "933821676", "title": "PRO Деньги", "price": 999, "pay": "https://payform.ru/5kczMxe/"},
    {"id": "935416568", "title": "PRO Отношения", "price": 999, "pay": "https://payform.ru/cvczMCL/"},
]

KINESCOPE_LINKS: dict[str, list[str]] = {
    "899970790": ["https://kinescope.io/fkqmXzoJUCN4KT21UsHanU"],
    "900003551": ["https://kinescope.io/3rhaEXkPMQqxBpm2aeEbC8"],
    "905012137": ["https://kinescope.io/7BzsTfL6UwY9Qd7LCMjGhc"],
    "910034224": ["https://kinescope.io/3gt3iALxyEx2Waqinoqcos"],
    "933821676": [
        "https://kinescope.io/kKQadgZ8YxRhrmYdxkpFTX",
        "https://kinescope.io/okHLJfRitfKH2LeBwfztPf",
        "https://kinescope.io/9o2EbKuMNidcfmPa9oWJBj",
        "https://kinescope.io/oTYvq8Xgvzcx1oBEfPYETz",
    ],
    "934012602": ["https://kinescope.io/j3uR69nKr6zYGQiH9JyCDj"],
    "934323455": [
        "https://kinescope.io/3VUCpG9FiAsgiv5vyeDYqn",
        "https://kinescope.io/0Q8Pw4Ticuq2gUng3EztVC",
        "https://kinescope.io/bsJFtMn37msTJ41VVpzkCu",
        "https://kinescope.io/t5KSVyFDE9ZdVpRCFrvjHw",
        "https://kinescope.io/94PFR66jwsn6CRpKu28XjM",
    ],
    "934323468": ["https://kinescope.io/sxQkMA8NWvgQCsZHW7zToK"],
    "934639263": ["https://kinescope.io/8JdmxhTLtnuuzuqBGvjmz3"],
    "934657331": [
        "https://kinescope.io/41bbJYXXxCWXPnmZ3tVZ7e",
        "https://kinescope.io/5JtHf3DVK8igat1Adai1bn",
    ],
    "934892673": ["https://kinescope.io/kKacxfnBq4koLoR3BLYZa6"],
    "934990625": ["https://kinescope.io/eCTE3fSt3fEtPszKKRcdSs"],
    "935300516": ["https://kinescope.io/nqC5WmKu5KNBQaeSqxXgMN"],
    "935367017": ["https://kinescope.io/0otZDG8z78iaDupaacCB38"],
    "935416568": [
        "https://kinescope.io/9RdqPpK9YjSWtMHWru75NT",
        "https://kinescope.io/fYsRrZ6bVUtpk3G25u1Li9",
        "https://kinescope.io/6nv8MUcrkABzuz146z2aUJ",
    ],
}

# Course intro + per-lesson blurbs (index 0 = course about; 1..n = lesson)
ABOUT: dict[str, dict] = {
    "900003551": {
        "about": "О чём этот курс: мягко включаем личный бренд — чтобы вас видели и слышали без надрыва.",
        "learn": "Вы узнаете, какие установки мешают проявляться и как начать упаковывать свою экспертность проще.",
        "lessons": ["Практика активации личного бренда и внутреннего разрешения быть видимой."],
    },
    "935367017": {
        "about": "О чём этот курс: быстрый вход в практику Тетахилинг — для тех, кто хочет расти как специалист.",
        "learn": "Вы узнаете, как работать с убеждениями, держать клиентский фокус и не выгорать на старте.",
        "lessons": ["Разбор сценариев практика и шаги к уверенной работе с клиентами."],
    },
    "899970790": {
        "about": "О чём этот курс: встреча с внутренним ребёнком — тепло, безопасность и опора на себя.",
        "learn": "Вы узнаете, где в вас «заморожены» чувства и как вернуть контакт с собой мягко.",
        "lessons": ["Практика контакта с внутренним ребёнком и исцеления детских реакций."],
    },
    "935300516": {
        "about": "О чём этот курс: выход из зависимостей и повторяющихся «крючков» — к людям, еде, контролю.",
        "learn": "Вы узнаете, что держит вас в петле, и какие внутренние опоры помогают выйти.",
        "lessons": ["Разбор механизмов зависимости и практика освобождения пространства."],
    },
    "934323468": {
        "about": "О чём этот курс: поиск своего дела и пути — без паники «я всё ещё не нашла».",
        "learn": "Вы узнаете, как отличить чужие сценарии от своего интереса и сделать следующий шаг.",
        "lessons": ["Практика ясности: куда двигаться и что мешает выбрать своё."],
    },
    "934639263": {
        "about": "О чём этот курс: отношения с мамой и папой — родовые сценарии, которые живут в вас.",
        "learn": "Вы узнаете, какие повторы идут из родительской линии и как мягко их отпустить.",
        "lessons": ["Проработка связей с мамой и папой, выход из родовых повторов."],
    },
    "910034224": {
        "about": "О чём этот курс: предназначение и деньги — как соединить смысл и достаток.",
        "learn": "Вы узнаете, какие блоки режут поток денег и как вернуть право на изобилие.",
        "lessons": ["Практика на стыке предназначения, самоценности и денежного потока."],
    },
    "905012137": {
        "about": "О чём этот курс: психосоматика простым языком — тело как зеркало переживаний.",
        "learn": "Вы узнаете, как читать сигналы тела и что с ними делать через мягкую практику.",
        "lessons": ["Разбор психосоматических связок и практика возвращения в тело."],
    },
    "934012602": {
        "about": "О чём этот курс: сила рода — опора на предков без тяжести и вины.",
        "learn": "Вы узнаете, какие родовые сценарии можно отпустить и какую силу забрать себе.",
        "lessons": ["Практики «Сила рода» и работа с родовыми программами."],
    },
    "934323455": {
        "about": "О чём этот курс: карма и судьба — числа, выборы и ответственность за свой путь.",
        "learn": "Вы узнаете, как читать ключевые темы судьбы и применять это в жизни, а не «в теории».",
        "lessons": [
            "Введение: как устроены карма, выбор и личная ответственность.",
            "Числа и ключевые коды — что они показывают о вашем пути.",
            "Повторяющиеся сценарии: где вы «зациклены» и как мягко сдвинуть.",
            "Практика принятия своей траектории без страха «наказания».",
            "Интеграция: как жить из ясности, а не из вины и долга.",
        ],
    },
    "934892673": {
        "about": "О чём этот урок: голос, тело и состояние — энергия присутствия через контакт с собой.",
        "learn": "Вы узнаете, как голос и тело связаны с внутренней силой и как вернуть живость.",
        "lessons": ["Энергосессия: тело, голос и возвращение в своё состояние."],
    },
    "934657331": {
        "about": "О чём этот курс: сексуальность и близость — без стыда, с теплом и границами.",
        "learn": "Вы узнаете, какие сценарии блокируют живое желание и как бережно их сдвигать.",
        "lessons": [
            "Отношения с телом, желанием и правом на удовольствие.",
            "Близость, границы и исцеление сценариев в паре.",
        ],
    },
    "934990625": {
        "about": "О чём этот урок: ваша эксклюзивность и состояние — когда вы «в себе», мир откликается иначе.",
        "learn": "Вы узнаете, как возвращаться в ресурсное состояние и не обесценивать свою уникальность.",
        "lessons": ["Вебинар про состояние, самоценность и ощущение своей исключительности."],
    },
    "933821676": {
        "about": "О чём этот курс: PRO Деньги — глубокая работа с восприятием денег и собой.",
        "learn": "Вы узнаете, какие установки режут доход и как включать поток изобилия по шагам.",
        "lessons": [
            "Деньги как зеркало: что вы на самом деле о них думаете.",
            "Блоки и программы, которые держат «потолок» дохода.",
            "Практика разрешения зарабатывать больше — без вины.",
            "Интеграция: действия из нового денежного состояния.",
        ],
    },
    "935416568": {
        "about": "О чём этот курс: PRO Отношения — близость, сценарии пары и внутренняя опора.",
        "learn": "Вы узнаете, как роли и ожидания портят любовь — и как вернуть тепло без борьбы.",
        "lessons": [
            "Отношения с собой как основа пары.",
            "Сценарии в паре: жертва, спасатель, контроль — и выход из них.",
            "Практика близости, границ и живого контакта.",
        ],
    },
}


TEMPLATE = """<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="robots" content="noindex,nofollow">
  <title>Доступ — {title} — Марина Герман</title>
  <link rel="icon" type="image/png" href="logo-mg.png">
  <style>
    :root {{ --bg:#050505; --ink:#fff; --muted:#b8b0a6; --line:rgba(197,160,112,.28); --gold:#c5a070; --gold-bright:#e0c08a; --gold-dim:#9a7a4f; }}
    * {{ box-sizing:border-box; margin:0; padding:0; }}
    body {{ min-height:100vh; background:var(--bg); color:var(--ink); font-family:Georgia,"Times New Roman",serif; line-height:1.55; }}
    .sans {{ font-family:system-ui,-apple-system,"Segoe UI",sans-serif; }}
    a {{ color:inherit; text-decoration:none; }}
    .container {{ width:min(960px, calc(100% - 2rem)); margin:0 auto; }}
    .site-topbar {{ position:sticky; top:0; z-index:50; background:rgba(5,5,5,.92); backdrop-filter:blur(12px); border-bottom:1px solid rgba(197,160,112,.22); }}
    .topbar-inner {{ display:flex; align-items:center; justify-content:space-between; gap:.75rem; padding:.65rem 0; min-height:4.25rem; }}
    .logo-link {{ display:inline-flex; align-items:center; gap:.75rem; flex-shrink:0; }}
    .logo-img {{ width:56px; height:56px; object-fit:contain; filter:drop-shadow(0 4px 14px rgba(197,160,112,.4)); }}
    .logo-word {{ display:flex; flex-direction:column; line-height:1.15; }}
    .logo-word strong {{ font-size:.92rem; font-weight:800; letter-spacing:.14em; text-transform:uppercase; color:var(--gold-bright); }}
    .logo-word span {{ font-size:.65rem; letter-spacing:.06em; color:var(--muted); }}
    .nav-pages {{ display:flex; flex-wrap:nowrap; align-items:center; gap:.3rem; flex:1 1 auto; justify-content:center; overflow-x:auto; scrollbar-width:none; }}
    .nav-pages::-webkit-scrollbar {{ display:none; }}
    .nav-pages a {{ flex:0 0 auto; white-space:nowrap; border:1px solid rgba(197,160,112,.35); background:linear-gradient(180deg,rgba(28,24,20,.95),rgba(12,10,8,.95)); color:var(--gold-bright); border-radius:999px; padding:.38rem .7rem; font-size:.62rem; font-weight:700; letter-spacing:.05em; text-transform:uppercase; }}
    .nav-pages a:hover {{ border-color:var(--gold); color:#fff; }}
    .top-btn {{ border:1px solid rgba(197,160,112,.35); border-radius:999px; padding:.4rem .8rem; font-size:.65rem; font-weight:700; letter-spacing:.06em; text-transform:uppercase; color:var(--gold-bright); }}
    .top-btn.accent {{ background:linear-gradient(135deg,var(--gold-bright),var(--gold),var(--gold-dim)); color:#111; border-color:transparent; }}
    .wrap {{ padding:2rem 0 2.5rem; }}
    .brand {{ font-size:0.72rem; font-weight:700; letter-spacing:0.22em; text-transform:uppercase; color:var(--gold); }}
    h1 {{ margin-top:0.75rem; font-size:clamp(1.35rem,3vw,2rem); letter-spacing:0.06em; text-transform:uppercase; }}
    .welcome {{ margin-top:1.25rem; padding:1.25rem 1.2rem; border:1px solid rgba(197,160,112,.35); border-radius:16px; background:linear-gradient(160deg,#161310,#0a0908); }}
    .welcome p {{ color:#e8e0d6; margin-top:.65rem; }}
    .welcome p:first-child {{ margin-top:0; color:var(--gold-bright); font-size:1.05rem; }}
    .about {{ margin-top:1.25rem; color:var(--muted); }}
    .about strong {{ color:var(--gold-bright); font-weight:600; }}
    .lesson {{ margin-top:1.5rem; padding-top:.25rem; }}
    .lesson h2 {{ font-size:1rem; color:#fff; margin-bottom:.35rem; }}
    .lesson .blurb {{ color:var(--muted); font-size:.92rem; margin-bottom:.75rem; }}
    .player {{ aspect-ratio:16/9; background:#111; border:1px solid rgba(197,160,112,.28); border-radius:14px; overflow:hidden; }}
    .player iframe {{ width:100%; height:100%; border:0; }}
    .signoff {{ margin-top:2rem; padding:1.25rem 1.2rem; border:1px solid rgba(197,160,112,.3); border-radius:16px; background:linear-gradient(160deg,#141210,#0a0908); color:#e8e0d6; }}
    .signoff .name {{ margin-top:.85rem; color:var(--gold-bright); font-weight:700; letter-spacing:.04em; }}
    .note {{ margin-top:1.25rem; padding:1rem 1.1rem; border:1px solid rgba(197,160,112,.25); border-radius:12px; color:var(--muted); font-size:0.9rem; }}
    .note a, .site-footer a, .welcome a {{ color:var(--gold-bright); text-decoration:underline; }}
    .site-footer {{ border-top:1px solid var(--line); padding:2rem 0; color:var(--muted); font-size:.85rem; }}
    .site-footer .consent {{ margin-top:.85rem; font-size:.78rem; opacity:.9; }}
    .footer-links {{ margin-top:.65rem; display:flex; flex-wrap:wrap; gap:.75rem; }}
    @media (max-width:900px) {{ .logo-word {{ display:none; }} }}
  </style>
</head>
<body>
  <div class="site-topbar">
    <div class="container topbar-inner sans">
      <a class="logo-link" href="index.html" aria-label="На главную">
        <img class="logo-img" src="logo-mg.png" width="56" height="56" alt="МГ">
        <span class="logo-word"><strong>Марина Герман</strong><span>Тебе можно легче</span></span>
      </a>
      <nav class="nav-pages sans" aria-label="Разделы сайта">
        <a href="index.html">АКЦИЯ в мои 43</a>
        <a href="kursy.html">Курсы</a>
        <a href="marina-german.html">Обо мне</a>
        <a href="otzyvy.html">Отзывы</a>
        <a href="stati.html">Статьи</a>
      </nav>
      <a class="top-btn accent" href="https://t.me/marina_germann" target="_blank" rel="noopener">Написать</a>
    </div>
  </div>

  <main class="container wrap sans">
    <p class="brand">Ваш доступ после оплаты</p>
    <h1>{title}</h1>

    <div class="welcome">
      <p>Приветствую, моя Дорогая.</p>
      <p>Спасибо за покупку. Ниже — Ваши уроки. Сохраните эту страницу в закладки, чтобы возвращаться в удобное время.</p>
      <p>Видео открываются на платформе Кинескоп — обычно без VPN, из любой точки мира. Если письма от Продамус нет — напишите в <a href="https://t.me/marina_germann" target="_blank" rel="noopener">Telegram</a>.</p>
    </div>

    <div class="about">
      <p><strong>{about}</strong></p>
      <p style="margin-top:.55rem">{learn}</p>
    </div>

    {players}

    <div class="signoff">
      <p>Вы большая молодец, что выбрали себя.</p>
      <p style="margin-top:.55rem">С наилучшими пожеланиями,</p>
      <p class="name">Ваша Марина Герман</p>
    </div>

    <p class="note">Если видео не открывается — напишите в Telegram <a href="https://t.me/marina_germann">@marina_germann</a> и приложите чек оплаты.</p>
  </main>

  <footer class="site-footer sans">
    <div class="container">
      <p><strong style="color:var(--gold)">ИП Герман Марина Олеговна</strong></p>
      <p style="margin-top:.35rem">Тел.: <a href="tel:+79897001701">+7 989 700 17 01</a> · <a href="mailto:marinagerman.nails@gmail.com">marinagerman.nails@gmail.com</a></p>
      <div class="footer-links">
        <a href="index.html">АКЦИЯ в мои 43</a>
        <a href="kursy.html">Курсы</a>
        <a href="oferta.html">Оферта</a>
        <a href="privacy.html">Конфиденциальность</a>
        <a href="https://t.me/marina_germann" target="_blank" rel="noopener">Telegram</a>
      </div>
      <p class="consent">Оставаясь на этой странице, вы соглашаетесь с условиями оферты и политикой обработки персональных данных. Продолжая просмотр, вы подтверждаете согласие на использование файлов cookie, необходимых для работы сайта и видео.</p>
    </div>
  </footer>
</body>
</html>
"""


def players_html(course_id: str) -> str:
    links = KINESCOPE_LINKS.get(course_id) or []
    meta = ABOUT.get(course_id, {})
    lesson_blurbs = meta.get("lessons") or []
    if not links:
        return (
            '<div class="note">Записи этого курса ещё нет в Кинескопе. '
            'Напишите в Telegram <a href="https://t.me/marina_germann">@marina_germann</a> '
            "с чеком — пришлём доступ вручную.</div>"
        )
    blocks = []
    for i, link in enumerate(links, 1):
        embed = link
        if "kinescope.io/" in link and "/embed/" not in link:
            vid = link.rstrip("/").split("/")[-1]
            embed = f"https://kinescope.io/embed/{vid}"
        blurb = ""
        if i - 1 < len(lesson_blurbs):
            blurb = f'<p class="blurb">О чём этот урок: {lesson_blurbs[i - 1]}</p>'
        elif lesson_blurbs:
            blurb = f'<p class="blurb">О чём этот урок: {lesson_blurbs[-1]}</p>'
        blocks.append(
            f'<section class="lesson">'
            f"<h2>Урок {i}</h2>"
            f"{blurb}"
            f'<div class="player"><iframe src="{embed}" allow="autoplay; fullscreen; picture-in-picture; encrypted-media;" allowfullscreen></iframe></div>'
            f"</section>"
        )
    return "\n    ".join(blocks)


def main() -> None:
    mapping = []
    UPLOAD.mkdir(exist_ok=True)
    for c in COURSES:
        access_url = f"{BASE}/access-{c['id']}.html"
        meta = ABOUT.get(c["id"], {})
        html = TEMPLATE.format(
            title=c["title"],
            about=meta.get("about", f"О чём этот курс: программа «{c['title']}»."),
            learn=meta.get("learn", "Вы узнаете практики, которые помогают жить легче и яснее."),
            players=players_html(c["id"]),
        )
        path = ROOT / f"access-{c['id']}.html"
        path.write_text(html, encoding="utf-8", newline="\n")
        shutil.copy2(path, UPLOAD / path.name)
        content = (
            f'Спасибо за покупку курса «{c["title"]}» за {c["price"]} ₽. '
            f"Ваш доступ к урокам: {access_url}"
        )
        mapping.append(
            {
                "id": c["id"],
                "title": c["title"],
                "price": c["price"],
                "payform": c["pay"],
                "access_url": access_url,
                "prodamus_content_field": content,
                "kinescope_links": KINESCOPE_LINKS.get(c["id"], []),
            }
        )
    (ROOT / "prodamus-access-map.json").write_text(
        json.dumps(mapping, ensure_ascii=False, indent=2), encoding="utf-8", newline="\n"
    )
    print(f"updated {len(COURSES)} access pages + UPLOAD-NOW copies")


if __name__ == "__main__":
    main()
