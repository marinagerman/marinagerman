# Метрика + Яндекс.Вебмастер + Google Search Console

Сайт: `https://marinagerman.github.io/marinagerman/`

Скрипт на страницах: `js/analytics.js` (после согласия cookie).

## 1. Яндекс.Метрика

1. Открой [metrika.yandex.ru](https://metrika.yandex.ru/) → добавить счётчик.
2. Адрес сайта: `https://marinagerman.github.io/marinagerman/`
3. Скопируй **номер счётчика** (цифры).
4. В корне сайта создай/правь перед `analytics.js` на ключевых страницах:

```html
<script>
  window.MG_ANALYTICS = { metrikaId: "НОМЕР_СЧЁТЧИКА" };
</script>
<script src="js/analytics.js" defer></script>
```

Или один раз пропиши номер в `js/analytics.js` в поле `METRIKA_ID` (если cfg пустой — там уже пустая строка).

Цели (рекомендуем):
- клик «Написать» / Telegram
- клик «Я МОГУ!» / Taplink
- отправка / переход на оплату

## 2. Яндекс.Вебмастер

1. [webmaster.yandex.ru](https://webmaster.yandex.ru/) → добавить сайт  
   `https://marinagerman.github.io/marinagerman/`
2. Подтверждение — **HTML-файл** или **meta-тег**.
3. Meta: вставь в `<head>` `index.html` строку вида  
   `<meta name="yandex-verification" content="КОД" />`
4. Sitemap:  
   `https://marinagerman.github.io/marinagerman/sitemap.xml`

## 3. Google Search Console

1. [search.google.com/search-console](https://search.google.com/search-console) → префикс URL  
   `https://marinagerman.github.io/marinagerman/`
2. Подтверждение — meta-тег HTML.
3. Meta уже на главной:  
   `<meta name="google-site-verification" content="vyUF2cMcydEggNJ689osHT676Ke_8LRRpQK_H25NBkM" />`
4. После деплоя в GSC нажми «Подтвердить».
5. Sitemap: `https://marinagerman.github.io/marinagerman/sitemap.xml`

## 4. Что прислать мне

После создания аккаунтов пришли в чат:
- номер Метрики
- meta `yandex-verification`
- meta `google-site-verification`

Я вставлю их в сайт и запушу.

## Примечание про домен

Пока сайт на `github.io`. Свой `.ru`/`.com` для Марины — отдельно (когда купишь).  
`gstmetiz.shop` — это домен **GETSTUFF / болты**, не Марины.
