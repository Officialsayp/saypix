import { mkdir, readFile, writeFile, copyFile, rm } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const src = path.join(root, 'src');
const dist = path.join(root, 'dist');
await rm(dist, { recursive: true, force: true });
await mkdir(path.join(dist, 'ru'), { recursive: true });
await mkdir(path.join(dist, 'en'), { recursive: true });

const template = await readFile(path.join(src, 'template.html'), 'utf8');
const variants = {
  root: { lang: 'ru', title: 'Максим Золотой — Go Backend Developer', description: 'Персональный сайт Максима Золотого: Go backend, проекты, стек и контакты.', path: '' },
  ru: { lang: 'ru', title: 'Максим Золотой — Go Backend Developer', description: 'Персональный сайт Максима Золотого: Go backend, проекты, стек и контакты.', path: 'ru/' },
  en: { lang: 'en', title: 'Max Zolotoy — Go Backend Developer', description: "Max Zolotoy's personal website: Go backend, projects, stack and contacts.", path: 'en/' }
};

function page(v) {
  return template
    .replaceAll('__HTML_LANG__', v.lang)
    .replaceAll('__INITIAL_LANG__', v.lang)
    .replaceAll('__TITLE__', v.title)
    .replaceAll('__DESCRIPTION__', v.description)
    .replaceAll('__CANONICAL_PATH__', v.path);
}

await writeFile(path.join(dist, 'index.html'), page(variants.root));
await writeFile(path.join(dist, 'ru', 'index.html'), page(variants.ru));
await writeFile(path.join(dist, 'en', 'index.html'), page(variants.en));

for (const file of ['styles.css', 'app.js', 'content.js', 'favicon.svg', '_headers', 'robots.txt', 'sitemap.xml']) {
  await copyFile(path.join(src, file), path.join(dist, file));
}

console.log('Built static site in dist/');
