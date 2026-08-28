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
      items: ["Go", "PostgreSQL", "SQL", "Docker", "REST", "Git", "DDD", "Linux"]
    },
    projects: {
      kicker: "03 / ПРОЕКТЫ",
      title: "Практика через реальные инженерные сценарии.",
      cards: [
        {
          number: "01",
          name: "Order Domain",
          description: "Учебная доменная модель заказа: позиции, деньги, статусы заказа, онлайн-оплата, отмена и переходы состояния.",
          tags: ["Go", "DDD", "Domain Logic"],
          linkLabel: "Репозиторий будет добавлен"
        }
      ]
    },
    contacts: {
      kicker: "04 /",
      title: "КОНТАКТЫ",
      email: "Email · hello@maxzolotoy.com",
      telegram: "Telegram · @max_zolotoy",
      github: "GitHub · github.com/Officialsayp"
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
      items: ["Go", "PostgreSQL", "SQL", "Docker", "REST", "Git", "DDD", "Linux"]
    },
    projects: {
      kicker: "03 / PROJECTS",
      title: "Learning through realistic engineering scenarios.",
      cards: [
        {
          number: "01",
          name: "Order Domain",
          description: "A learning order-domain model covering items, money, order states, online payments, cancellation and state transitions.",
          tags: ["Go", "DDD", "Domain Logic"],
          linkLabel: "Repository link coming soon"
        }
      ]
    },
    contacts: {
      kicker: "04 /",
      title: "CONTACT",
      email: "Email · hello@maxzolotoy.com",
      telegram: "Telegram · @max_zolotoy",
      github: "GitHub · github.com/Officialsayp"
    },
    footer: "Built without frontend frameworks — HTML, CSS and JavaScript."
  }
};

export const contactLinks = {
  email: "hello@maxzolotoy.com",
  telegram: "https://t.me/max_zolotoy",
  github: "https://github.com/Officialsayp"
};
