export const siteContent = {
  ru: {
    meta: {
      title: "Максим Золотой — Go Backend Developer",
      description: "Персональный сайт Максима Золотого: Go backend, проекты, стек и контакты."
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
      lead: "Развиваюсь в backend-разработке на Go: проектирую доменную логику, API и работу с данными, уделяя внимание понятным инвариантам и надежности.",
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
      kicker: "04 / КОНТАКТЫ",
      title: "Открыт к профессиональному общению и backend-задачам.",
      note: "Контактные ссылки вынесены в конфигурацию проекта — их можно добавить перед публикацией.",
      email: "Email",
      github: "GitHub",
      cv: "CV"
    },
    footer: "Сделано без frontend-фреймворков — HTML, CSS и JavaScript."
  },
  en: {
    meta: {
      title: "Max Zolotoy — Go Backend Developer",
      description: "Max Zolotoy's personal website: Go backend, projects, stack and contacts."
    },
    nav: [
      ["About", "about"],
      ["Stack", "stack"],
      ["Projects", "projects"],
      ["Contacts", "contacts"]
    ],
    hero: {
      eyebrow: "GO BACKEND DEVELOPER",
      title: "Max Zolotoy",
      lead: "I am developing as a Go backend engineer, focusing on domain logic, APIs and data while keeping invariants explicit and systems reliable.",
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
      kicker: "04 / CONTACTS",
      title: "Open to professional conversations and backend opportunities.",
      note: "Contact links live in the project configuration and can be added before publishing.",
      email: "Email",
      github: "GitHub",
      cv: "CV"
    },
    footer: "Built without frontend frameworks — HTML, CSS and JavaScript."
  }
};

export const contactLinks = {
  email: "",
  github: "",
  cv: ""
};
