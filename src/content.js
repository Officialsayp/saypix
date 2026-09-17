export const projectLinks = {
  maxzolotoyLive: "https://maxzolotoy.com",
  maxzolotoy: "https://github.com/Officialsayp/saypix",
  zolotoyDev: "https://zolotoy.dev",
  zolotoyDevBackend: "https://github.com/Officialsayp/zolotoy-dev-backend",
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
      lead: "Backend-разработчик на Go",
      primary: "Посмотреть проекты",
      secondary: "Связаться"
    },
    about: {
      kicker: "ОБО МНЕ",
      title: "Проектирую backend, который можно развивать",
      body: [
        "Я занимаюсь проектированием микросервисной архитектуры на Golang",
        "Активно использую Codex и Claude Code в разработке",
        "Работаю в Ozon Tech — технологическом направлении российской big tech-компании Ozon",
        "В свободное время занимаюсь разработкой pet-проектов"
      ]
    },
    stack: {
      kicker: "СТЕК",
      title: "Технологии, с которыми работаю и которые изучаю",
      items: stackItems
    },
    projects: {
      kicker: "ПРОЕКТЫ",
      title: "Go-backend проекты",
      cards: [
        {
          id: "maxzolotoy",
          number: "01",
          name: "maxzolotoy.com",
          description: "Персональный двуязычный сайт и портфолио с разделами обо мне, стеком, проектами и прямыми контактами.",
          highlights: [
            "Статическая RU/EN-сборка с canonical, hreflang, sitemap и JSON-LD.",
            "Собственное переключение языка, accessibility и сохранение позиции страницы.",
            "CI проверяет сборку, SEO и ключевые UI-инварианты."
          ],
          tags: [
            "HTML",
            "CSS",
            "JavaScript",
            "Accessibility",
            "Technical SEO",
            "Cloudflare"
          ],
          status: "Опубликован",
          url: projectLinks.maxzolotoyLive,
          linkLabel: "Открыть сайт",
          codeRepository: projectLinks.maxzolotoy,
          codeLinkLabel: "Проект на GitHub",
          programmingLanguages: ["HTML", "CSS", "JavaScript"]
        },
        {
          id: "zolotoy-dev",
          number: "02",
          name: "zolotoy.dev",
          description: "Backend-проект на Go из четырёх сервисов. Order уже развивается в коде, остальные сервисы последовательно добавляются по мере реализации архитектуры.",
          highlights: [
            "Order — заказы, оплаты, состояния, идемпотентность и outbox.",
            "Auth — пользователи, сессии, refresh rotation и RBAC.",
            "Notification — события, задания доставки, retries и восстановление.",
            "URL Shortener — короткие ссылки, redirect, кеширование и аналитика."
          ],
          tags: [
            "Go",
            "REST API",
            "PostgreSQL",
            "SQL",
            "Redis",
            "Kafka",
            "Docker",
            "DDD"
          ],
          status: "В разработке · целевой backend-стек",
          url: projectLinks.zolotoyDev,
          linkLabel: "Открыть zolotoy.dev",
          codeRepository: projectLinks.zolotoyDevBackend,
          codeLinkLabel: "Проект на GitHub",
          programmingLanguages: ["Go"]
        }
      ]
    },
    contacts: {
      kicker: "контакты",
      title: "КОНТАКТЫ И ПРОФИЛИ",
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
      lead: "Go Backend Developer",
      primary: "View projects",
      secondary: "Contact me"
    },
    about: {
      kicker: "ABOUT",
      title: "Building backend systems for reliability and change",
      body: [
        "I design microservice architectures in Go",
        "I actively use Codex and Claude Code as part of my development workflow",
        "I work at Ozon Tech, part of a major big tech company",
        "Outside of work, I build and develop personal projects"
      ]
    },
    stack: {
      kicker: "STACK",
      title: "Technologies I use and continue to study",
      items: stackItems
    },
    projects: {
      kicker: "PROJECTS",
      title: "Go backend projects",
      cards: [
        {
          id: "maxzolotoy",
          number: "01",
          name: "maxzolotoy.com",
          description: "A bilingual personal website and portfolio covering my profile, stack, projects and direct contacts.",
          highlights: [
            "Static RU/EN build with canonical URLs, hreflang, sitemap and JSON-LD.",
            "Custom language switching, accessibility and scroll-position preservation.",
            "CI validates the build, SEO and key UI invariants."
          ],
          tags: [
            "HTML",
            "CSS",
            "JavaScript",
            "Accessibility",
            "Technical SEO",
            "Cloudflare"
          ],
          status: "Published",
          url: projectLinks.maxzolotoyLive,
          linkLabel: "Open website",
          codeRepository: projectLinks.maxzolotoy,
          codeLinkLabel: "Project on GitHub",
          programmingLanguages: ["HTML", "CSS", "JavaScript"]
        },
        {
          id: "zolotoy-dev",
          number: "02",
          name: "zolotoy.dev",
          description: "A Go backend project built around four services. Order is currently being implemented, with the remaining services added as the architecture evolves.",
          highlights: [
            "Order — orders, payments, state transitions, idempotency and outbox.",
            "Auth — users, sessions, refresh rotation and RBAC.",
            "Notification — events, delivery jobs, retries and recovery.",
            "URL Shortener — short links, redirects, caching and analytics."
          ],
          tags: [
            "Go",
            "REST API",
            "PostgreSQL",
            "SQL",
            "Redis",
            "Kafka",
            "Docker",
            "DDD"
          ],
          status: "In development · target backend stack",
          url: projectLinks.zolotoyDev,
          linkLabel: "Open zolotoy.dev",
          codeRepository: projectLinks.zolotoyDevBackend,
          codeLinkLabel: "Project on GitHub",
          programmingLanguages: ["Go"]
        }
      ]
    },
   contacts: {
     kicker: "contacts",
     title: "CONTACTS & PROFILES",
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
