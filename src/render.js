import { siteContent, contactLinks } from './content.js';

function linkOrDisabled(label, href, className = 'button button--ghost contact-link') {
  if (!href) {
    return `<span class="${className}" aria-disabled="true">${label}</span>`;
  }
  const external = href.startsWith('http');
  return `<a class="${className}" href="${href}"${external ? ' target="_blank" rel="noreferrer"' : ''}>${label}</a>`;
}

export function renderPage(lang) {
  const c = siteContent[lang];
  if (!c) throw new Error(`Unsupported language: ${lang}`);

  const projects = c.projects.cards.map(card => `
    <article class="project-card">
      <div class="project-card__num">${card.number}</div>
      <div>
        <h3>${card.name}</h3>
        <p>${card.description}</p>
        <div class="project-card__tags">${card.tags.map(tag => `<span class="project-card__tag">#${tag.replaceAll(' ', '-')}</span>`).join('')}</div>
      </div>
      <div class="project-card__status">${card.linkLabel}</div>
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
            <div class="chips">${c.stack.items.map(item => `<span class="chip">${item}</span>`).join('')}</div>
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
              ${linkOrDisabled(c.contacts.email, contactLinks.email ? `mailto:${contactLinks.email}` : '')}
              ${linkOrDisabled(c.contacts.telegram, contactLinks.telegram)}
              ${linkOrDisabled(c.contacts.github, contactLinks.github)}
            </div>
          </div>
        </section>
      </main>

      <footer class="footer"><div class="container">${c.footer}</div></footer>
    </div>`;
}
