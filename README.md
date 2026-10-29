# maxzolotoy.com

**Bilingual personal portfolio · Go Backend Engineering**

[English](#english) · [Русский](#русский)  
**Live:** [English](https://maxzolotoy.com/en/) · [Русский](https://maxzolotoy.com/ru/)

---

## English

### Overview

maxzolotoy.com is the personal website and engineering portfolio of Maxim Zolotoy. It presents professional experience, technical interests, projects, and contact information through a lightweight, bilingual interface.

Both `/en/` and `/ru/` are independently rendered static pages. A custom language curtain adds an interactive transition without making content or navigation dependent on JavaScript.

### Highlights

- **Interactive RU/EN curtain:** pointer-tracked dragging, click and keyboard navigation, gesture cancellation, and scroll-position restoration.
- **Progressive enhancement:** complete, indexable pages and working language links without JavaScript; alternate-language content loads on demand.
- **Responsive and accessible:** semantic HTML, keyboard focus states, reduced-motion support, and layouts for mobile and desktop.
- **Technical SEO:** canonical URLs, `hreflang`, XML sitemap, Open Graph metadata, and JSON-LD structured data.
- **Lean delivery:** no frontend framework or runtime dependencies; minified, fingerprinted assets, immutable asset caching, and automated size budgets.

### Technology and architecture

HTML, CSS, and native JavaScript (ES modules) power the frontend. Node.js and esbuild generate static assets in `dist/`; no application server or backend is required to serve the website.

```text
src/                  Content, templates, styles, and browser logic
scripts/              Build and validation
dist/                 Generated, versioned production assets
deploy/caddy/         Web server configuration
.github/workflows/    CI and deployment
docs/                 Infrastructure and recovery documentation
```

### Local development

**Requirements:** Node.js 22+, npm, and Python 3 for the preview server.

```bash
git clone https://github.com/Officialsayp/saypix.git
cd saypix
npm ci
npm run preview
```

Open [http://localhost:4173/en/](http://localhost:4173/en/) or [http://localhost:4173/ru/](http://localhost:4173/ru/). The preview command builds the site before serving it.

### Build and checks

```bash
npm run build         # Generate dist/
npm test              # Build and run automated checks
npm run check         # Validate an existing build
npm run check:deploy  # Validate deployment configuration
```

Validation covers generated HTML, SEO, curtain behavior, asset budgets, redirects, and HTTP smoke tests. GitHub Actions additionally checks layout and interactions in Chromium and WebKit.

### Deployment

The production website is served by **Caddy on a Selectel VPS**; Cloudflare provides DNS only. When enabled, GitHub Actions deploys changes from `main` using an atomic release switch and verifies the origin with a smoke test.

Operational procedures and rollback instructions: [Recovery Runbook](docs/recovery-runbook.md).

---

## Русский

### О проекте

maxzolotoy.com — персональный сайт и инженерное портфолио Максима Золотого. Здесь представлены профессиональный опыт, технические интересы, проекты и контакты в лаконичном двуязычном интерфейсе.

Страницы `/ru/` и `/en/` формируются как полноценные независимые статические документы. Собственная языковая шторка обеспечивает интерактивное переключение, при этом доступность контента и навигации не зависит от JavaScript.

### Возможности

- **Интерактивная шторка RU/EN:** отслеживание указателя при перетягивании, переключение по клику и с клавиатуры, обработка отменённых жестов и восстановление позиции прокрутки.
- **Progressive Enhancement:** полноценные индексируемые страницы и рабочие ссылки переключения языка без JavaScript; второй язык загружается по запросу.
- **Адаптивность и доступность:** семантический HTML, видимые состояния фокуса, поддержка уменьшенной анимации и интерфейс для мобильных устройств и компьютеров.
- **Техническое SEO:** canonical, `hreflang`, XML sitemap, метаданные Open Graph и структурированные данные JSON-LD.
- **Оптимизированная загрузка:** без frontend-фреймворка и runtime-зависимостей; минификация, хеширование ресурсов, неизменяемое кеширование и автоматический контроль размера сборки.

### Технологии и архитектура

Frontend построен на HTML, CSS и нативном JavaScript (ES modules). Node.js и esbuild формируют статические файлы в `dist/`; для обслуживания сайта не требуется backend или сервер приложений.

```text
src/                  Контент, шаблоны, стили и браузерная логика
scripts/              Сборка и автоматические проверки
dist/                 Сгенерированные версионированные ресурсы
deploy/caddy/         Конфигурация веб-сервера
.github/workflows/    CI и развёртывание
docs/                 Документация инфраструктуры и восстановления
```

### Локальный запуск

**Требования:** Node.js 22+, npm и Python 3 для локального сервера.

```bash
git clone https://github.com/Officialsayp/saypix.git
cd saypix
npm ci
npm run preview
```

Открой [http://localhost:4173/ru/](http://localhost:4173/ru/) или [http://localhost:4173/en/](http://localhost:4173/en/). Команда предварительно собирает сайт.

### Сборка и проверки

```bash
npm run build         # Сформировать dist/
npm test              # Собрать проект и выполнить проверки
npm run check         # Проверить существующую сборку
npm run check:deploy  # Проверить конфигурацию развёртывания
```

Проверки охватывают сгенерированный HTML, SEO, работу языковой шторки, ограничения размера ресурсов, перенаправления и HTTP smoke-тесты. GitHub Actions дополнительно проверяет геометрию и взаимодействия в Chromium и WebKit.

### Развёртывание

Production-сайт обслуживается **Caddy на Selectel VPS**; Cloudflare используется только для DNS. При включённом деплое GitHub Actions публикует изменения из `main`, атомарно переключает релиз и проверяет сервер с помощью smoke-теста.

Эксплуатация и порядок отката: [Recovery Runbook](docs/recovery-runbook.md).
