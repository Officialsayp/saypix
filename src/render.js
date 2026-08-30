import { siteContent, contactLinks } from './content.js';

const TECH_ICON_IDS = Object.freeze({
  Go: 'go',
  PostgreSQL: 'postgresql',
  Docker: 'docker',
  Git: 'git',
  Kafka: 'kafka',
  gRPC: 'grpc',
  Redis: 'redis',
  'REST API': 'rest-api',
  Grafana: 'grafana',
});

function renderTechChip(name, techIconsPath) {
  const iconId = TECH_ICON_IDS[name];
  if (!iconId) throw new Error(`Missing technology icon: ${name}`);
  return `<span class="chip"><svg class="chip__icon" viewBox="0 0 24 24" aria-hidden="true"><use href="${techIconsPath}#tech-${iconId}"></use></svg>${name}</span>`;
}

const CONTACT_ICON_IDS = Object.freeze({
  email: 'email',
  telegram: 'telegram',
  github: 'github',
});

function renderContactLink(kind, label, href, iconsPath) {
  const iconId = CONTACT_ICON_IDS[kind];
  if (!iconId) throw new Error(`Missing contact icon: ${kind}`);

  const content = `
    <svg class="contact-link__icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <use href="${iconsPath}#contact-${iconId}"></use>
    </svg>
    <span class="contact-link__label">${label}</span>
  `;

  if (!href) {
    return `<span class="button button--ghost contact-link" aria-disabled="true">${content}</span>`;
  }

  const external = href.startsWith('http');
  return `<a class="button button--ghost contact-link" href="${href}"${external ? ' target="_blank" rel="noreferrer"' : ''}>${content}</a>`;
}

export function renderPage(lang, { techIconsPath } = {}) {
  const c = siteContent[lang];
  if (!c) throw new Error(`Unsupported language: ${lang}`);
  if (!techIconsPath) throw new Error('Technology icon sprite path is required');

  const projects = c.projects.cards.map(card => `
    <article class="project-card">
      <div class="project-card__num">${card.number}</div>
      <div class="project-card__content">
        <h3>${card.name}</h3>
        <p>${card.description}</p>
        <ul class="project-card__highlights">
          ${card.highlights.map(highlight => `<li>${highlight}</li>`).join('')}
        </ul>
        <div class="project-card__tags">${card.tags.map(tag => `<span class="project-card__tag">#${tag.replaceAll(' ', '-')}</span>`).join('')}</div>
      </div>
      <div class="project-card__meta">
        <span class="project-card__status">${card.status}</span>
        <a class="project-card__link" href="${card.url}" target="_blank" rel="noreferrer">${card.linkLabel}<span aria-hidden="true"> ↗</span></a>
      </div>
    </article>`).join('');

  return `
    <div class="page" lang="${lang}">
      <header class="header">
        <div class="container header__inner">
          <a class="brand" href="#top-${lang}" aria-label="${lang === 'ru' ? 'Максим Золотой — главная' : 'Maxim Zolotoy — home'}">MZ.</a>
          <nav class="nav" aria-label="${lang === 'ru' ? 'Основная навигация' : 'Main navigation'}">
            ${c.nav.map(([label, id]) => `<a href="#${id}-${lang}">${label}</a>`).join('')}
          </nav>
        </div>
      </header>

      <main id="main-${lang}">
        <section class="hero" id="top-${lang}">
          <div class="container hero__grid">
            <div>
              <div class="eyebrow">${c.hero.eyebrow}</div>
              <h1>${c.hero.title}</h1>
              <p class="hero__lead">${c.hero.lead}</p>
              <div class="hero__actions">
                <a class="button button--primary" href="#projects-${lang}">${c.hero.primary}</a>
                <a class="button button--ghost" href="#contacts-${lang}">${c.hero.secondary}</a>
              </div>
            </div>
            <div class="hero__visual" aria-hidden="true">
              <div class="hero__visual-code"><strong>package</strong> portfolio<br><br><strong>func</strong> main() {<br>&nbsp;&nbsp;focus := "Go backend"<br>&nbsp;&nbsp;build(focus)<br>}</div>
            </div>
          </div>
        </section>

        <section class="section" id="about-${lang}">
          <div class="container">
            <div class="section__head"><div class="kicker">${c.about.kicker}</div><h2>${c.about.title}</h2></div>
            <p class="section__body">${c.about.body}</p>
          </div>
        </section>

        <section class="section" id="stack-${lang}">
          <div class="container">
            <div class="section__head"><div class="kicker">${c.stack.kicker}</div><h2>${c.stack.title}</h2></div>
            <div class="chips">${c.stack.items.map(item => renderTechChip(item, techIconsPath)).join('')}</div>
          </div>
        </section>

        <section class="section" id="projects-${lang}">
          <div class="container">
            <div class="section__head"><div class="kicker">${c.projects.kicker}</div><h2>${c.projects.title}</h2></div>
            <div class="project-list">${projects}</div>
          </div>
        </section>

        <section class="section" id="contacts-${lang}">
          <div class="container">
            <div class="section__head"><div class="kicker">${c.contacts.kicker}</div><h2>${c.contacts.title}</h2></div>
            <div class="contacts__links">
              ${renderContactLink('email', c.contacts.email, contactLinks.email ? `mailto:${contactLinks.email}` : '', techIconsPath)}
              ${renderContactLink('telegram', c.contacts.telegram, contactLinks.telegram, techIconsPath)}
              ${renderContactLink('github', c.contacts.github, contactLinks.github, techIconsPath)}
            </div>
          </div>
        </section>
      </main>

      <footer class="footer"><div class="container">${c.footer}</div></footer>
    </div>`;
}
