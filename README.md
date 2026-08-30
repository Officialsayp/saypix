# maxzolotoy.com — bilingual portfolio prototype

Статический сайт-визитка с интерактивным переключением RU ↔ EN через «языковую шторку».

## Что реализовано

- полноценный статический HTML отдельно для `/ru/` и `/en/`;
- один языковой слой в исходном DOM и шторка как lazy progressive enhancement;
- drag-переключение мышью / touch / pen через Pointer Events;
- вертикальная граница следует за жестом;
- threshold 50% + учет скорости свайпа;
- автоматическое завершение анимации после отпускания;
- обычные ссылки RU / EN как crawlable и no-JavaScript fallback;
- управление клавиатурой;
- `prefers-reduced-motion`;
- запоминание выбранного языка в `localStorage`;
- два индексируемых маршрута `/ru/` и `/en/` + `hreflang`, sitemap и robots.txt;
- постоянная нормализация корня и HTML-алиасов через Cloudflare `_redirects`;
- локализованные title/description, Open Graph и Twitter Card;
- JSON-LD граф `WebSite` → `ProfilePage` → `Person` с публичными вариантами имени;
- адаптивная верстка;
- минимальный initial bootstrap, lazy curtain-модуль и lazy HTML-фрагмент второго языка;
- fingerprinted/minified build assets и автоматические size budgets;
- нет runtime-зависимостей и frontend-фреймворков;
- два deployment profile: Cloudflare Workers Static Assets и direct Caddy/VPS.

## Локальный запуск

```bash
npm run preview
```

После сборки открой:

- http://localhost:4173/ru/
- http://localhost:4173/en/

## Сборка

```bash
npm run build
```

Результат появится в `dist/`.

Сборка печатает таблицу raw/gzip/brotli-размеров и разделяет ресурсы на
`INITIAL`, `LAZY` и `STATIC`. `npm test` проверяет budgets, no-JavaScript HTML,
SEO, redirects и локальный HTTP smoke-test.

## Cloudflare Workers Static Assets

Сборка публикуется из `dist/` по настройкам `wrangler.jsonc`. Worker-код,
backend и VPS не нужны.

Каноническая URL-политика:

- `https://maxzolotoy.com/ru/` — русская индексируемая страница;
- `https://maxzolotoy.com/en/` — английская индексируемая страница и
  `x-default`;
- `/`, `/index.html` и другие известные HTML-алиасы постоянно перенаправляются
  сразу на соответствующий конечный URL;
- version preview URLs отключены, а резервная `workers.dev`-копия получает
  `X-Robots-Tag: noindex`;

Для production в Cloudflare дополнительно должны быть включены zone-level
правила, которые невозможно выразить в статическом `_redirects`:

- любой `http://maxzolotoy.com/*` → тот же путь на HTTPS;
- `www.maxzolotoy.com/*` → тот же путь на HTTPS apex-домене;
- path и query string сохраняются, код ответа — постоянный `301` или `308`.

Перед включением HSTS сначала проверь все HTTP/HTTPS и apex/www варианты.
Существующее Dashboard-правило для `/` не должно перекрывать репозиторный
`_redirects`.

Настройки сборки в панели Cloudflare:

- Build command: `npm run build`
- Build output directory: `dist`

Файлы под `/assets/` имеют content fingerprint и получают годовой
`immutable` browser cache через `src/_headers`. HTML и stable-name файлы
обязаны revalidate.

Локальный `python -m http.server` не применяет файлы `_redirects` и `_headers`.
Он подходит для проверки `/ru/` и `/en/`, но HTTP-статусы нужно проверять в
Cloudflare preview/production после deploy.

## Где менять тексты и ссылки

Контент и контакты находятся в:

```text
src/content.js
```

Заполни `contactLinks`:

```js
export const contactLinks = {
  email: "you@example.com",
  telegram: "https://t.me/username",
  github: "https://github.com/username"
};
```

Поисковые и social-метаданные собираются из того же контента в
`src/metadata.js`. Исходники карточек находятся в `src/og-ru.svg` и
`src/og-en.svg`, а опубликованные PNG имеют размер 1200×630.

## Как работает шторка

Сборка сразу помещает в HTML полный контент выбранного URL: русский для
`/ru/`, английский для `/en/`. Основная страница полностью работает без
JavaScript. Маленький bootstrap не загружает механику и второй язык заранее.
Только после реального наведения, фокуса или pointerdown он параллельно
загружает lazy curtain-модуль и fingerprinted HTML-фрагмент второго языка.
Если любой lazy-запрос не удался, обычная RU/EN-ссылка просто открывает другой
канонический URL.

Во время drag двигаются только три композитных объекта: слой шторки, её
однопиксельная граница и иконка под курсором. Основная длинная страница не
перемещается.

Покрытие `coverage` находится в диапазоне `0…1`:

- `0` — панель за краем экрана;
- `0.5` — пройдена половина ширины окна;
- `1` — страница полностью закрыта.

RU → EN: пользователь тянет EN справа налево. EN → RU: RU слева направо.
На отпускании 20% и 40% возвращаются в исходный язык, 60% и 80% завершают
переключение; быстрый уверенный свайп учитывает скорость. После полного
закрытия сохраняется предпочтение в `localStorage` и браузер переходит на
настоящий URL (`/ru/` или `/en/`). Без JavaScript эти же ссылки работают как
обычная навигация, поэтому канонический URL, язык документа и содержимое не
могут разойтись.

## Что менять после Figma

Главная механика не зависит от визуального дизайна. После готового макета обычно достаточно переработать:

```text
src/styles.css
```

и при необходимости HTML-шаблон, генерируемый функцией `renderPage()` в
`src/render.js`.

В исходном документе существует только одна страница. Геометрия основного и
временного языковых слоёв синхронизируется после реального взаимодействия,
перед началом анимации.

## Российские сети и direct origin

Frontend split повышает устойчивость, но не устраняет ISP-level throttling
между российскими сетями и Cloudflare. Полный baseline, Caddy/VPS profile,
GitHub Actions deployment, test-origin procedure, безопасный DNS-only cutover и
rollback описаны в [docs/ru-network-resilience.md](docs/ru-network-resilience.md).

Текущий production нельзя переключать вслепую. Сначала нужен
`origin.maxzolotoy.com` с серым облаком **DNS only**, тесты из РФ и Европы и
подтверждение полной передачи каждого asset по HTTP/1.1 и HTTP/2.
