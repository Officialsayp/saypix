# Требования платформ и границы проверки

Дата проверки: **2026-09-12**. Это справочник для производных от locked master. Геометрия master не меняется; размеры ниже относятся к холсту экспорта, а не к растяжению самого знака.

## Аватары

| Контекст | Подтверждено первоисточником | Выбор для этого комплекта |
|---|---|---|
| GitHub profile | PNG, JPG или GIF; **строго менее 1 MB**, размеры **строго менее 3000×3000 px**. Для качества рекомендовано около **500×500 px**. [GitHub: Profile reference](https://docs.github.com/en/account-and-profile/reference/profile-reference#profile-picture-requirements) | PNG 500×500; универсальные 512×512 и 1024×1024 также укладываются в размерный предел. Проверять фактический вес. |
| LinkedIn Page logo | PNG/JPEG, максимум **3 MB**; минимум **268×268 px**, рекомендация **400×400 px**. [LinkedIn: Image specifications for Pages](https://www.linkedin.com/help/recruiter/answer/a569383) | PNG 400×400. Проверять квадрат и скруглённый квадрат локально. |
| LinkedIn personal profile | PNG/JPG, максимум **8 MB**; размеры от **400×400** до **7680×4320 px**. Фото должно отражать внешность владельца, допустимо художественное изображение самого человека. [LinkedIn: Photo won't upload](https://www.linkedin.com/help/lms/answer/a549049) | Логотип предназначен для **Page и бренд-контекста**. Не маркировать его как одобренный личный аватар LinkedIn. Круглая примерка служит только проверкой обрезки. |
| YouTube channel | JPG/GIF/BMP/PNG, без анимированного GIF, максимум **15 MB**; изображение должно читаться при отображении **98×98 px**. Актуальная справка не задаёт обязательные 800×800. [YouTube: Manage channel branding](https://support.google.com/youtube/answer/10456525?co=GENIE.Platform%3DDesktop&hl=en) | PNG 800×800 — **рабочий размер экспорта**, не подтверждённое текущее требование YouTube. Обязательна локальная проверка 98×98 и малых круглых слотов. |
| Telegram profile/channel | Официальный API документирует загрузку profile photo и ошибку `PHOTO_CROP_SIZE_SMALL`, но в проверенной странице **нет численного минимального/рекомендованного размера** статического фото. [Telegram: photos.uploadProfilePhoto](https://core.telegram.org/method/photos.uploadProfilePhoto) | PNG 512×512 — **рабочее допущение**; доступен также универсальный 1024×1024. Круглая маска — локальная модель чат-аватара; она не подтверждает работу всех клиентов Telegram. |

Круг, квадрат и скруглённый квадрат — разные тестовые маски одного квадратного холста. Их нельзя считать точной репликой всех экранов платформ: форма, видимый размер и серверная перекодировка могут различаться. Необрезанный квадрат с непрозрачным фоном удобнее для загрузки; платформенная маска применяется поверх него.

## Website, favicon и install icons

| Ресурс | Основание и ограничения | Размеры комплекта |
|---|---|---|
| SVG favicon | HTML допускает `rel="icon"`, SVG `type="image/svg+xml"` и `sizes="any"`. Браузер выбирает ресурс с учётом доступных вариантов. [WHATWG HTML: icon](https://html.spec.whatwg.org/multipage/links.html#rel-icon) | Квадратный SVG viewport; равномерное масштабирование исходной геометрии. |
| ICO/PNG fallback | HTML приводит PNG 16×16 и ICO 32×32/48×48 как примеры; это не универсальный обязательный набор. Google показывает совместное подключение ICO и SVG. [WHATWG HTML](https://html.spec.whatwg.org/multipage/links.html#rel-icon), [web.dev: adaptive favicon](https://web.dev/articles/building/an-adaptive-favicon) | ICO с 16/32/48 px и отдельные PNG — инженерный выбор для совместимости. Проверка 16 px особенно важна для twist. |
| Apple touch icon | Архивная официальная документация Apple демонстрирует `apple-touch-icon` **180×180 px** для Retina iPhone, а также 152 и 167 px для iPad. Страница архивная, поэтому 180 px не объявляется единственным современным размером для всех устройств. [Apple: Configuring Web Applications](https://developer.apple.com/library/archive/documentation/AppleApplications/Reference/SafariWebContent/ConfiguringWebApplications/ConfiguringWebApplications.html) | PNG 180×180 с непрозрачным фоном. Форму углов оставлять системе. |
| PWA `purpose: any` | Google указывает для Chromium минимум **192×192 и 512×512 px** в manifest и рекомендует растровый fallback для SVG. Наличие иконок само по себе не доказывает installability приложения. [web.dev: Add a web app manifest](https://web.dev/articles/add-manifest) | PNG 192×192 и 512×512. |
| PWA `purpose: maskable` | Гарантированная безопасная зона — центральный круг радиусом **40% от меньшей стороны**. За его пределами возможна обрезка. [W3C Web Application Manifest: safe zone](https://www.w3.org/TR/appmanifest/#icon-masks) | Отдельный непрозрачный PNG 512×512; весь знак внутри круга r=204.8 px. При необходимости увеличивать поля контейнера, сохраняя master. |

## OpenGraph / social

**1200×630 px (40:21, около 1.905:1)** — выбранный рабочий формат общей social card. Проверить актуальное численное требование Meta через первоисточник не удалось: [Meta Sharing Images](https://developers.facebook.com/docs/sharing/webmasters/images/) не вернул читаемую страницу в этой сессии. Поэтому 1200×630 не заявляется обязательным стандартом OpenGraph или гарантией одинаковой обрезки на каждой платформе.

Сам [Open Graph protocol](https://ogp.me/#structured) определяет `og:image` и дополнительные `og:image:type`, `og:image:width`, `og:image:height`, `og:image:alt`, но **не устанавливает обязательный размер 1200×630**. В метаданных необходимо указывать реальные размеры готового файла и описательный alt. PNG выбран как растровый формат экспортного комплекта; успешное открытие локального PNG не заменяет проверку публичного URL реальным crawler.

Для локального QA достаточно проверить исходный social canvas и центральные crop 16:9 и 1:1. Знак должен сохраняться целиком при целевых crop; подписи и декор могут иметь отдельную безопасную область. Реальные превью LinkedIn/Telegram/YouTube/GitHub могут использовать разные правила. Banner YouTube и OpenGraph card — разные ресурсы; 1200×630 не следует использовать как объявленный стандарт YouTube banner.

## Проверенный цветовой контекст сайтов

- [maxzolotoy.com](https://maxzolotoy.com/) вернул HTTP 200. HTML: заголовок `Maxim Zolotoy — Go (Golang) Backend Developer`, `theme-color: #0b0c10`. В реально подключённой [таблице стилей](https://maxzolotoy.com/assets/styles.58bd2c41aac0.css) прочитаны `--bg: #0b0c10`, `--text: #f5f7fb`, `--muted: #a2a8b6`; фоновые accents `#2f6bff` и `#6756ff`. Это наблюдение HTML/CSS, а не визуальный браузерный тест сайта. Палитра может обновиться вместе с хешем CSS.
- [zolotoy.dev](https://zolotoy.dev/) вернул HTTP 403 при чтении. Актуальные цвета не подтверждены; не переносить на этот сайт палитру другого проекта как установленный факт.

## Границы QA

Проверки платформ в этом комплекте — **локальные симуляции размеров и crop**, без загрузки в аккаунты и без публикаций. Они могут выявить обрезку знака, недостаточный контраст и потерю деталей при уменьшении, но не подтверждают принятие файлов сервисами, серверную обработку, кэш, живой интерфейс платформ или внешний social crawler. Браузерная матрица и фактически выполненные проверки фиксируются отдельно в отчёте QA. Этот документ описывает требования и допущения, а не объявляет тесты пройденными.
