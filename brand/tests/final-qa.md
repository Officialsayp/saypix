# Final QA

Дата: 2026-09-12. Проверки локальные; внешние сервисы, аккаунты и сайты не изменялись.

## Locked master

- `master/logo-master-v1.svg` SHA-256: `fe0dde1281b8fe1b4a8a44e54365050becd72e2c8ea21acde61e5f28fc12be31`.
- `master/logo-master-unoptimized.svg` — побитовая копия locked master.
- `master/logo-master.svg` — SVGO-сериализация без преобразования координат.
- Повторная проверка SHA после каждой сборки проходит; master не изменён.

## SVG и оптимизация

`python3 scripts/qa-svg.py` прошёл: 17 SVG проверены на XML, viewBox, конечные координаты, пустые path, дублирующиеся ID, внешние ссылки, raster/image, text, script, filter, gradient и unexpected clipping. В derived SVG exact token-последовательности двух master path сохранены.

`node scripts/qa-assets.cjs` прошёл: 65 PNG имеют заявленные размеры и побитово совпадают с повторным Sharp-рендером собственных SVG-рецептов; ICO содержит точные PNG-кадры 16/32/48. Квадратный, круглый и rounded-square crop не теряют пиксели знака. PWA maskable layout проходит консервативную проверку центральной safe zone.

Для master и optimized SVG pixel diff равен 0 на ширинах 16, 20, 24, 32, 40, 48, 64, 96, 128, 180, 256, 512, 1024 и 2048 px. Это сравнение в одном renderer и не заявляет одинаковый antialiasing между движками.

## Small-size

Master локально проверен на 14 размерах. При alpha-пороговом тесте две ленты объединяются в одну компоненту на 16–96 px и разделяются на 128 px. Это ограничение тонкого negative-space канала, а не дефект locked geometry.

`logo-micro.svg` сохраняет исходные master path и расширяет три существующих канала vector mask. Micro проходит локальный тест двух основных компонентов от 16 до 128 px в Sharp; в браузерах уверенно проходит от 24 px. На 16–20 px результат зависит от движка и DPR, поэтому favicon использует отдельную усиленную mask-настройку и непрозрачный charcoal badge.

В Chromium 151, Firefox 153 и WebKit 26.5 favicon 16/32/48 и micro-проверка от 24 px визуально загружаются. В WebKit на 16 px при DPR2 alpha-компоненты могут объединиться в одну из-за antialiasing; это зафиксировано как caveat в [browser-micro-summary.json](browser-micro-summary.json), а готовый PNG fallback остаётся читаемым. Изменение master для этого не требуется и не выполнялось. Старый сырой снимок threshold-результатов сохранён в `browser-micro-qa.json` для аудита; итоговая интерпретация находится в summary.

## Browser and responsive

`node scripts/browser-tests.cjs` прошёл в локальных Chromium 151.0.7922.34, Firefox 153.0 и WebKit 26.5. Проверены DPR1 и DPR2, ширины SVG 16, 24, 32, 64, 100, 200, 500, 1000 и `100%`, отсутствие overflow на мобильном viewport 390×844, загрузка всех изображений, SVG favicon и screenshot regression до/после оптимизации. Внутри каждого движка changed pixels после оптимизации: 0.

Скриншоты: `tests/browser/*-desktop.png`, `*-mobile.png`, `*-favicon.png`, `*-before.png`, `*-after.png`. Отдельный native Safari просмотр geometry preview был выполнен ранее; этот automated matrix использует WebKit build.

## Цвет и контраст

`brand-colors.json` и `brand-tokens.css` содержат digital sRGB HEX/RGB/HSL. Основной silver `#c4c4c4` и charcoal `#1d1c1b` сняты из approved master/reference context; white и black — context-safe monochrome variants. Расчётные ratios: silver/charcoal 9.756:1, white/charcoal 17.015:1, charcoal/white 17.015:1, black/white 21:1, silver/white 1.744:1 (`avoid`). Калиброванные OLED/IPS не использовались.

## Platform and crop

`tests/platform-requirements.md` содержит актуальные ссылки и отделяет подтверждённые требования от рабочих допущений: GitHub около 500×500, LinkedIn Page 400×400, YouTube rendering 98×98, Telegram 512×512 и OpenGraph 1200×630 как рабочие значения. LinkedIn personal profile не заявлен как допустимое место для логотипа вместо фото человека.

Локальная preview board показывает square, rounded-square, circle, GitHub-like, LinkedIn-like, Telegram-like, YouTube-like contexts, светлую/тёмную рамку, README/CV, maxzolotoy.com background и social card. Это симуляции crop и размера, не загрузки и не проверка серверной перекодировки платформ.

## PDF and deliverables

`tests/vector-proof.pdf` — одна страница, `pdf-qa.json` подтверждает 0 embedded raster images. Рендер страницы просмотрен; два знака построены как PDF paths. Это векторный RGB proof, не CMYK press proof.

## Limitations

Не выполнены публикация, загрузка на GitHub/LinkedIn/Telegram/YouTube, внешний social crawler, installability PWA на устройстве и проверка на отдельных калиброванных OLED/IPS. `zolotoy.dev` ответил HTTP 403, поэтому его палитра не утверждается; `maxzolotoy.com` прочитан только read-only.

**MASTER LOGO STATUS: APPROVED / LOCKED.** Обнаруженная вариативность 16–20 px относится к производным micro/favicon и antialiasing; требование менять master не возникло.
