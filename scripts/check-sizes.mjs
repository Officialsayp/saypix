import assert from 'node:assert/strict';
import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';

const dist = path.join(process.cwd(), 'dist');
const assets = path.join(dist, 'assets');
const assetNames = await readdir(assets);

function one(pattern, label) {
  const matches = assetNames.filter(file => pattern.test(file));
  assert.equal(matches.length, 1, `Expected one ${label}, found ${matches.length}`);
  return matches[0];
}

const files = {
  ruHtml: path.join(dist, 'ru', 'index.html'),
  enHtml: path.join(dist, 'en', 'index.html'),
  css: path.join(assets, one(/^styles\.[a-f0-9]{12}\.css$/, 'stylesheet')),
  boot: path.join(assets, one(/^boot\.[A-Z0-9]{8}\.js$/, 'bootstrap')),
  curtain: path.join(assets, one(/^curtain\.[A-Z0-9]{8}\.js$/, 'curtain module')),
  techIcons: path.join(assets, one(/^tech-icons\.[a-f0-9]{12}\.svg$/, 'technology icon sprite')),
  ruFragment: path.join(assets, one(/^page-ru\.[a-f0-9]{12}\.html$/, 'RU fragment')),
  enFragment: path.join(assets, one(/^page-en\.[a-f0-9]{12}\.html$/, 'EN fragment')),
};

// Russian UTF-8 text and visible no-JS Stack labels make localized documents
// slightly larger. Both stay below the 16 KiB network-risk boundary.
const budgets = {
  ruHtml: 16 * 1024,
  enHtml: 16 * 1024,
  css: 13 * 1024,
  boot: 3 * 1024,
  curtain: 12 * 1024,
  techIcons: 6 * 1024,
  ruFragment: 9 * 1024,
  enFragment: 8 * 1024,
};

for (const [key, file] of Object.entries(files)) {
  const size = (await stat(file)).size;
  assert.ok(size <= budgets[key], `${path.basename(file)} is ${size} B; budget is ${budgets[key]} B`);
}

const bootSource = await readFile(files.boot, 'utf8');
assert.match(bootSource, /import\("\.\/curtain\.[A-Z0-9]{8}\.js"\)/, 'bootstrap must lazy-load the curtain module');
assert.doesNotMatch(bootSource, /page-(?:ru|en)\.[a-f0-9]{12}\.html/, 'bootstrap must not embed alternate-language content');

console.log('Initial and lazy asset size budgets passed.');
