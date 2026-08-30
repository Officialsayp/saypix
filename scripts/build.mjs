import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile, copyFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { brotliCompressSync, constants, gzipSync } from 'node:zlib';
import { build, transform } from 'esbuild';
import { siteContent } from '../src/content.js';
import { renderSeoMetadata } from '../src/metadata.js';
import { renderPage } from '../src/render.js';

const root = process.cwd();
const src = path.join(root, 'src');
const dist = path.join(root, 'dist');
const assets = path.join(dist, 'assets');

await rm(dist, { recursive: true, force: true });
await mkdir(path.join(dist, 'ru'), { recursive: true });
await mkdir(path.join(dist, 'en'), { recursive: true });
await mkdir(assets, { recursive: true });

function minifyMarkup(source) {
  return source.replace(/>\s+</g, '><').trim();
}

function fingerprint(name, extension, contents) {
  const hash = createHash('sha256').update(contents).digest('hex').slice(0, 12);
  return `${name}.${hash}.${extension}`;
}

async function writeFingerprinted(name, extension, contents) {
  const file = fingerprint(name, extension, contents);
  await writeFile(path.join(assets, file), contents);
  return `/assets/${file}`;
}

const rawStyles = await readFile(path.join(src, 'styles.css'), 'utf8');
const minifiedStyles = (await transform(rawStyles, {
  loader: 'css',
  minify: true,
  target: ['safari15.4'],
})).code;
const stylesPath = await writeFingerprinted('styles', 'css', minifiedStyles);

const rawTechIcons = await readFile(path.join(src, 'tech-icons.svg'), 'utf8');
const techIconsPath = await writeFingerprinted('tech-icons', 'svg', minifyMarkup(rawTechIcons));

const fragmentPaths = {};
for (const lang of ['ru', 'en']) {
  fragmentPaths[lang] = await writeFingerprinted(
    `page-${lang}`,
    'html',
    minifyMarkup(renderPage(lang, { techIconsPath })),
  );
}

const jsBuild = await build({
  entryPoints: [path.join(src, 'boot.js')],
  outdir: assets,
  bundle: true,
  splitting: true,
  format: 'esm',
  minify: true,
  target: ['safari15.4', 'chrome100', 'firefox100'],
  entryNames: '[name].[hash]',
  chunkNames: '[name].[hash]',
  legalComments: 'none',
  metafile: true,
  write: true,
});

function outputForEntry(entryName) {
  const match = Object.entries(jsBuild.metafile.outputs).find(([, metadata]) =>
    metadata.entryPoint?.replaceAll('\\', '/').endsWith(`src/${entryName}`));
  if (!match) throw new Error(`Missing esbuild output for ${entryName}`);
  return `/${path.relative(dist, path.resolve(root, match[0])).replaceAll('\\', '/')}`;
}

const bootPath = outputForEntry('boot.js');
const curtainPath = outputForEntry('curtain.js');
const template = await readFile(path.join(src, 'template.html'), 'utf8');
const variants = {
  ru: { lang: 'ru', path: 'ru/' },
  en: { lang: 'en', path: 'en/' },
};

function page(variant) {
  const content = siteContent[variant.lang];
  const isRu = variant.lang === 'ru';
  const curtainLang = isRu ? 'en' : 'ru';
  const html = template
    .replaceAll('__HTML_LANG__', variant.lang)
    .replaceAll('__INITIAL_LANG__', variant.lang)
    .replaceAll('__TITLE__', content.meta.title)
    .replaceAll('__DESCRIPTION__', content.meta.description)
    .replaceAll('__SEO_METADATA__', renderSeoMetadata({ lang: variant.lang, canonicalPath: variant.path }))
    .replaceAll('__CANONICAL_PATH__', variant.path)
    .replaceAll('__CURTAIN_FRAGMENT__', fragmentPaths[curtainLang])
    .replaceAll('__STYLES_PATH__', stylesPath)
    .replaceAll('__BOOT_PATH__', bootPath)
    .replaceAll('__SKIP_LABEL__', isRu ? 'Перейти к содержимому' : 'Skip to content')
    .replaceAll('__LANGUAGE_UI_LABEL__', isRu ? 'Выбор языка' : 'Language switcher')
    .replaceAll('__DRAG_LABEL__', isRu ? 'тянуть' : 'drag')
    .replaceAll('__RU_CURRENT__', isRu ? ' aria-current="page"' : '')
    .replaceAll('__EN_CURRENT__', isRu ? '' : ' aria-current="page"')
    .replaceAll('__PAGE_HTML__', renderPage(variant.lang, { techIconsPath }));
  return minifyMarkup(html);
}

await writeFile(path.join(dist, 'ru', 'index.html'), page(variants.ru));
await writeFile(path.join(dist, 'en', 'index.html'), page(variants.en));

for (const file of [
  'favicon.svg',
  'og-ru.png',
  'og-en.png',
  '_headers',
  '_redirects',
  'robots.txt',
  'sitemap.xml',
]) {
  await copyFile(path.join(src, file), path.join(dist, file));
}

async function outputFiles(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await outputFiles(absolute));
    else files.push(absolute);
  }
  return files;
}

const initialFiles = new Set([
  'ru/index.html',
  'en/index.html',
  stylesPath.slice(1),
  techIconsPath.slice(1),
  bootPath.slice(1),
]);
const lazyFiles = new Set([
  curtainPath.slice(1),
  fragmentPaths.ru.slice(1),
  fragmentPaths.en.slice(1),
]);
const rows = [];
for (const absolute of await outputFiles(dist)) {
  const file = path.relative(dist, absolute).replaceAll('\\', '/');
  const contents = await readFile(absolute);
  rows.push({
    file,
    raw: contents.length,
    gzip: gzipSync(contents, { level: 9 }).length,
    brotli: brotliCompressSync(contents, {
      params: { [constants.BROTLI_PARAM_QUALITY]: 11 },
    }).length,
    class: initialFiles.has(file) ? 'INITIAL' : lazyFiles.has(file) ? 'LAZY' : 'STATIC',
  });
}

console.log('Built static site in dist/');
console.table(rows.sort((a, b) => a.file.localeCompare(b.file)));
