export const projectLinks = {
  zolotoyDev: "https://zolotoy.dev",
  zolotoyDevBackend: "https://github.com/Officialsayp/zolotoy-dev-backend",
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
      description: "Максим Золотой — Go backend-разработчик. Проекты zolotoy.dev и maxzolotoy.com: API, доменная логика, данные и инженерные решения.",
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
      eyebrow: "",
      title: "Максим Золотой",
      lead: "Проектирую backend-сервисы на Go: доменную логику, API и данные. Фокус — ясные границы системы, явные состояния и проверяемое поведение.",
      primary: "Посмотреть проекты",
      secondary: "Связаться"
    },
    about: {
      kicker: "01 / ОБО МНЕ",
      title: "Проектирую backend, который можно развивать",
      body: [
        "Я — Максим Золотой, работаю в Ozon Tech. Фокус — backend на Go",
        "Проектирую системы с ясными границами, явными состояниями и предсказуемым поведением",
        "Опыт в учёте и логистике IT-оборудования помогает учитывать не только код, но и данные, зависимости и эксплуатацию"
      ]
    },
    stack: {
      kicker: "02 / СТЕК",
      title: "Технологии, с которыми работаю и которые изучаю.",
      items: stackItems
    },
    projects: {
      kicker: "03 / ПРОЕКТЫ",
      title: "Проекты и инженерные решения.",
      cards: [
        {
          id: "zolotoy-dev",
          number: "01",
          name: "zolotoy.dev — среда Go-сервисов",
          description: "Developer/admin-среда для четырёх сервисов: заказы, аутентификация, уведомления, сокращение ссылок. Frontend опубликован; Go backend развивается поэтапно.",
          highlights: [
            "Vue 3, strict TypeScript, TanStack Query, Pinia: типизированный HTTP-слой, тесты Vitest и Playwright.",
            "Каждый сервис доступен в действии через детерминированные сценарии на моках MSW.",
            "Go backend (order-service): net/http-обработчики заказов; доменная модель заказа и оплаты развивается."
          ],
          tags: ["Go", "Vue 3", "TypeScript", "MSW"],
          status: "Опубликован · развивается",
          url: projectLinks.zolotoyDev,
          linkLabel: "Открыть zolotoy.dev",
          codeRepository: projectLinks.zolotoyDevBackend,
          codeLinkLabel: "Backend на GitHub",
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
      kicker: "контакты",
      title: "СВЯЗАТЬСЯ СО МНОЙ",
      email: "hello@maxzolotoy.com",
      telegram: "@max_zolotoy",
      github: "github.com/Officialsayp"
    }
  },
  en: {
    meta: {
      title: "Maxim Zolotoy — Go (Golang) Backend Developer",
      description: "Maxim Zolotoy — Go backend developer. Explore zolotoy.dev and maxzolotoy.com: APIs, domain logic, data, and engineering work.",
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
      eyebrow: "",
      title: "Maxim Zolotoy",
      lead: "I design backend services in Go: domain logic, APIs and data flows, with a focus on clear system boundaries, explicit states and verifiable behavior.",
      primary: "View projects",
      secondary: "Contact me"
    },
    about: {
      kicker: "01 / ABOUT",
      title: "Building backend systems for reliability and change",
      body: [
        "I'm Maxim Zolotoy, currently working at Ozon Tech with a focus on backend engineering in Go",
        "I design systems around clear boundaries, explicit state transitions and predictable behavior",
        "My background in IT asset accounting and logistics helps me think beyond code — about data, dependencies and operations"
      ]
    },
    stack: {
      kicker: "02 / STACK",
      title: "Technologies I use and continue to study.",
      items: stackItems
    },
    projects: {
      kicker: "03 / PROJECTS",
      title: "Projects and engineering work.",
      cards: [
        {
          id: "zolotoy-dev",
          number: "01",
          name: "zolotoy.dev — an environment for Go services",
          description: "A developer/admin environment for four backend services: orders, auth, notifications and URL shortener. The frontend is live; the Go backend grows service by service.",
          highlights: [
            "Vue 3, strict TypeScript, TanStack Query, Pinia: a typed HTTP boundary with Vitest and Playwright tests.",
            "Every service UI can be explored through deterministic MSW demo scenarios.",
            "Go backend (order-service): net/http handlers for creating and fetching orders; the order and payment domain model keeps growing."
          ],
          tags: ["Go", "Vue 3", "TypeScript", "MSW"],
          status: "Live · in development",
          url: projectLinks.zolotoyDev,
          linkLabel: "Open zolotoy.dev",
          codeRepository: projectLinks.zolotoyDevBackend,
          codeLinkLabel: "Backend source on GitHub",
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
     kicker: "contacts",
     title: "GET IN TOUCH",
     email: "hello@maxzolotoy.com",
     telegram: "@max_zolotoy",
     github: "github.com/Officialsayp"
   }
  }
};

export const contactLinks = {
  email: "hello@maxzolotoy.com",
  telegram: "https://t.me/max_zolotoy",
  github: "https://github.com/Officialsayp"
};
