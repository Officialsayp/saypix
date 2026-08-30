export const projectLinks = {
  stockflow: "https://github.com/Officialsayp/stockflow",
  maxzolotoy: "https://github.com/Officialsayp/saypix",
};

const stackItems = Object.freeze([
  "Go",
  "REST API",
  "gRPC",
  "PostgreSQL",
  "Redis",
  "Kafka",
  "Docker",
  "Git",
  "Grafana",
]);

export const siteContent = {
  ru: {
    meta: {
      title: "Максим Золотой — Go (Golang) backend-разработчик",
      description: "Портфолио Максима (Макса) Золотого, backend-разработчика на Go (Golang): проекты, PostgreSQL, REST, Docker, DDD и прямые контакты.",
      locale: "ru_RU",
      socialImage: "/og-ru.png",
      socialImageAlt: "Максим Золотой — Go и Golang backend-разработчик"
    },
    nav: [
      ["Обо мне", "about"],
      ["Стек", "stack"],
      ["Проекты", "projects"],
      ["Контакты", "contacts"]
    ],
    hero: {
      eyebrow: "GO BACKEND DEVELOPER",
      title: "Максим Золотой",
      lead: "Я — Максим Золотой (Макс Золотой), backend-разработчик на Go (Golang). Проектирую доменную логику, API и работу с данными, уделяя внимание понятным инвариантам и надежности.",
      primary: "Посмотреть проекты",
      secondary: "Связаться"
    },
    about: {
      kicker: "01 / ОБО МНЕ",
      title: "Инженерный подход без лишнего шума.",
      body: "Мой основной фокус — Go backend. В учебных проектах прорабатываю доменную модель, жизненный цикл заказа и оплаты, архитектурные границы и хранение данных. Сайт построен как статический frontend и одновременно служит площадкой для экспериментов с интерфейсами и deployment-процессом."
    },
    stack: {
      kicker: "02 / СТЕК",
      title: "Технологии, с которыми работаю и которые изучаю.",
      items: stackItems
    },
    projects: {
      kicker: "03 / ПРОЕКТЫ",
      title: "Go backend-проекты и проверяемые инженерные кейсы.",
      cards: [
        {
          id: "stockflow",
          number: "01",
          name: "StockFlow — домен заказа и оплаты",
          description: "Учебный Go-проект в статусе WIP, где я прорабатываю доменную модель заказа и оплаты, переходы состояний и базовые HTTP-обработчики.",
          highlights: [
            "Value objects для денег и позиций заказа, статусы и проверяемые переходы состояния.",
            "Сценарии онлайн-оплаты, отмены и возврата средств закреплены в доменной модели.",
            "Базовые net/http-обработчики: создание заказа, получение по ID и health check."
          ],
          tags: ["Go", "net/http", "DDD", "WIP"],
          status: "Учебный проект · WIP",
          url: projectLinks.stockflow,
          linkLabel: "Исходный код StockFlow на GitHub",
          programmingLanguages: ["Go"]
        },
        {
          id: "maxzolotoy",
          number: "02",
          name: "maxzolotoy.com — двуязычный сайт",
          description: "Статический RU/EN-сайт на HTML, CSS и JavaScript без runtime-зависимостей — с собственной drag-механикой и SEO-разметкой для двух индексируемых URL.",
          highlights: [
            "Контент /ru/ и /en/ предрендерится в статический HTML с canonical, hreflang, sitemap и JSON-LD.",
            "Переключатель языка поддерживает Pointer Events, клавиатуру, обычные ссылки и prefers-reduced-motion.",
            "CI пересобирает сайт и проверяет SEO-, accessibility- и curtain-инварианты перед публикацией."
          ],
          tags: ["JavaScript", "Accessibility", "Technical SEO", "Cloudflare"],
          status: "Опубликован",
          url: projectLinks.maxzolotoy,
          linkLabel: "Исходный код maxzolotoy.com на GitHub",
          programmingLanguages: ["HTML", "CSS", "JavaScript"]
        }
      ]
    },
    contacts: {
      kicker: "04 /",
      title: "КОНТАКТЫ",
      email: "hello@maxzolotoy.com",
      telegram: "@max_zolotoy",
      github: "github.com/Officialsayp"
    },
    footer: "Сделано без frontend-фреймворков — HTML, CSS и JavaScript."
  },
  en: {
    meta: {
      title: "Maxim Zolotoy — Go (Golang) Backend Developer",
      description: "Portfolio of Maxim (Max) Zolotoy, a Go (Golang) backend developer: projects, PostgreSQL, REST, Docker, DDD and direct contact details.",
      locale: "en_US",
      socialImage: "/og-en.png",
      socialImageAlt: "Maxim Zolotoy — Go and Golang Backend Developer"
    },
    nav: [
      ["About", "about"],
      ["Stack", "stack"],
      ["Projects", "projects"],
      ["Contacts", "contacts"]
    ],
    hero: {
      eyebrow: "GO BACKEND DEVELOPER",
      title: "Maxim Zolotoy",
      lead: "I am Maxim Zolotoy (Max Zolotoy), a Go (Golang) backend developer focused on domain logic, APIs and data, with explicit invariants and reliable systems.",
      primary: "View projects",
      secondary: "Contact me"
    },
    about: {
      kicker: "01 / ABOUT",
      title: "An engineering mindset without unnecessary noise.",
      body: "My main focus is Go backend development. In learning projects I work through domain modelling, order and payment lifecycles, architectural boundaries and data persistence. This site is a static frontend and also a playground for interaction and deployment experiments."
    },
    stack: {
      kicker: "02 / STACK",
      title: "Technologies I use and continue to study.",
      items: stackItems
    },
    projects: {
      kicker: "03 / PROJECTS",
      title: "Go backend projects and verifiable engineering work.",
      cards: [
        {
          id: "stockflow",
          number: "01",
          name: "StockFlow — order and payment domain",
          description: "A work-in-progress educational Go project where I practice order and payment domain modelling, state transitions, and basic HTTP handlers.",
          highlights: [
            "Value objects for money and order items, order states, and validated state transitions.",
            "Online payment, cancellation, and refund scenarios encoded in the domain model.",
            "Basic net/http handlers for creating orders, retrieving them by ID, and health checks."
          ],
          tags: ["Go", "net/http", "DDD", "WIP"],
          status: "Educational project · WIP",
          url: projectLinks.stockflow,
          linkLabel: "View the StockFlow source code on GitHub",
          programmingLanguages: ["Go"]
        },
        {
          id: "maxzolotoy",
          number: "02",
          name: "maxzolotoy.com — bilingual website",
          description: "A static RU/EN website built with HTML, CSS, and JavaScript without runtime dependencies, featuring a custom drag interaction and SEO markup for two indexable URLs.",
          highlights: [
            "The /ru/ and /en/ content is prerendered to static HTML with canonical, hreflang, sitemap, and JSON-LD.",
            "The language switcher supports Pointer Events, keyboard controls, ordinary links, and prefers-reduced-motion.",
            "CI rebuilds the site and verifies SEO, accessibility, and curtain invariants before publishing."
          ],
          tags: ["JavaScript", "Accessibility", "Technical SEO", "Cloudflare"],
          status: "Published",
          url: projectLinks.maxzolotoy,
          linkLabel: "View the maxzolotoy.com source code on GitHub",
          programmingLanguages: ["HTML", "CSS", "JavaScript"]
        }
      ]
    },
   contacts: {
     kicker: "04 /",
     title: "CONTACT",
     email: "hello@maxzolotoy.com",
     telegram: "@max_zolotoy",
     github: "github.com/Officialsayp"
   },
    footer: "Built without frontend frameworks — HTML, CSS and JavaScript."
  }
};

export const contactLinks = {
  email: "hello@maxzolotoy.com",
  telegram: "https://t.me/max_zolotoy",
  github: "https://github.com/Officialsayp"
};
