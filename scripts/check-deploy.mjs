import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const [origin, production, shared, workflow, runbook] = await Promise.all([
  readFile(path.join(root, 'deploy', 'caddy', 'Caddyfile.origin'), 'utf8'),
  readFile(path.join(root, 'deploy', 'caddy', 'Caddyfile.production'), 'utf8'),
  readFile(path.join(root, 'deploy', 'caddy', 'site.caddy'), 'utf8'),
  readFile(path.join(root, '.github', 'workflows', 'deploy-direct-origin.yml'), 'utf8'),
  readFile(path.join(root, 'docs', 'ru-network-resilience.md'), 'utf8'),
]);

for (const [name, config] of [['origin', origin], ['production', production]]) {
  assert.match(config, /protocols h1 h2/, `${name}: HTTP/1.1 and HTTP/2 must be explicit`);
  assert.doesNotMatch(config, /protocols[^\n]*h3/, `${name}: HTTP/3 must remain disabled during diagnosis`);
  assert.match(config, /import site\.caddy/, `${name}: shared static policy is missing`);
}

assert.match(origin, /origin\.maxzolotoy\.com/, 'origin: staging hostname is missing');
assert.match(origin, /X-Robots-Tag "noindex, nofollow"/, 'origin: diagnostic host must be noindex');
assert.match(production, /http:\/\/maxzolotoy\.com, http:\/\/www\.maxzolotoy\.com/, 'production: HTTP hosts are missing');
assert.match(production, /https:\/\/www\.maxzolotoy\.com[\s\S]*?https:\/\/maxzolotoy\.com\{uri\}/, 'production: www must redirect to apex');
assert.match(shared, /root \* \/var\/www\/maxzolotoy\/current/, 'shared: atomic release symlink is not the web root');
assert.match(shared, /Cache-Control "public, max-age=31536000, immutable"/, 'shared: immutable asset caching is missing');
assert.match(shared, /respond @health "ok\\n" 200/, 'shared: health check is missing');
assert.match(shared, /\/ru\/\{\?query\}/, 'shared: RU redirects must preserve query strings');
assert.match(shared, /\/en\/\{\?query\}/, 'shared: EN redirects must preserve query strings');

for (const secret of ['VPS_HOST', 'VPS_USER', 'VPS_SSH_KEY', 'VPS_KNOWN_HOSTS', 'VPS_ORIGIN_HOST']) {
  assert.ok(workflow.includes(`secrets.${secret}`), `workflow: missing ${secret}`);
}
assert.match(workflow, /pull_request:\s*\n\s+branches: \[main\]/, 'workflow: pull requests must run verification');
assert.match(
  workflow,
  /if: github\.event_name == 'push' && github\.ref == 'refs\/heads\/main' && vars\.DIRECT_ORIGIN_DEPLOY_ENABLED == 'true'/,
  'workflow: deploy must be limited to enabled pushes on main',
);
assert.match(workflow, /mv -Tf "\$base\/current\.next" "\$base\/current"/, 'workflow: release activation must be atomic');
assert.match(workflow, /node scripts\/check-remote\.mjs/, 'workflow: remote smoke test is missing');
assert.match(runbook, /MX, SPF, DKIM, DMARC/, 'runbook: Proton Mail DNS safeguards are missing');
assert.match(runbook, /DNS only/, 'runbook: direct-origin DNS mode is missing');
assert.match(runbook, /Rollback/, 'runbook: rollback procedure is missing');

console.log('Direct-origin deployment policy checks passed.');
