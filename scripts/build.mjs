import { mkdir, readFile, writeFile, copyFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { siteContent } from '../src/content.js';
import { renderSeoMetadata } from '../src/metadata.js';
import { renderPage } from '../src/render.js';

const root = process.cwd();
const src = path.join(root, 'src');
const dist = path.join(root, 'dist');
await rm(dist, { recursive: true, force: true });
await mkdir(path.join(dist, 'ru'), { recursive: true });
await mkdir(path.join(dist, 'en'), { recursive: true });

const template = await readFile(path.join(src, 'template.html'), 'utf8');
const variants = {
  ru: { lang: 'ru', path: 'ru/' },
  en: { lang: 'en', path: 'en/' }
};

function page(v) {
  const content = siteContent[v.lang];
  const isRu = v.lang === 'ru';
  return template
    .replaceAll('__HTML_LANG__', v.lang)
    .replaceAll('__INITIAL_LANG__', v.lang)
    .replaceAll('__TITLE__', content.meta.title)
    .replaceAll('__DESCRIPTION__', content.meta.description)
    .replaceAll('__SEO_METADATA__', renderSeoMetadata({ lang: v.lang, canonicalPath: v.path }))
    .replaceAll('__CANONICAL_PATH__', v.path)
    .replaceAll('__SKIP_LABEL__', isRu ? 'Перейти к содержимому' : 'Skip to content')
    .replaceAll('__LANGUAGE_UI_LABEL__', isRu ? 'Выбор языка' : 'Language switcher')
    .replaceAll('__DRAG_LABEL__', isRu ? 'тянуть' : 'drag')
    .replaceAll('__RU_CURRENT__', isRu ? ' aria-current="page"' : '')
    .replaceAll('__EN_CURRENT__', isRu ? '' : ' aria-current="page"')
    .replaceAll('__PAGE_HTML__', renderPage(v.lang));
}

await writeFile(path.join(dist, 'ru', 'index.html'), page(variants.ru));
await writeFile(path.join(dist, 'en', 'index.html'), page(variants.en));

for (const file of ['styles.css', 'app.js', 'content.js', 'render.js', 'curtain-math.js', 'favicon.svg', 'og-ru.png', 'og-en.png', '_headers', '_redirects', 'robots.txt', 'sitemap.xml']) {
  await copyFile(path.join(src, file), path.join(dist, file));
}

console.log('Built static site in dist/');
