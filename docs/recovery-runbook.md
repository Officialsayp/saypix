# Recovery Runbook — maxzolotoy.com

Первоначальная версия: **2026-09-01**. Актуализация документа по GitHub и истории миграции: **2026-10-31**.

> **Состояние:** действующая схема использует **Nginx** на Selectel VPS и Cloudflare как авторитетный DNS. Профиль Caddy сохранён в Git для истории/отката. Продакшен-деплой `ac8a30af87caffb898b3f7c1425077d62be7ca46` прошёл GitHub Actions с успешным origin smoke-test; это **не** подтверждает фактические пути конфигурации Nginx, метод продления TLS или состав последнего server-side backup. Перед восстановлением обязательно сверить их по SSH. Значения ниже, зафиксированные в 2026-09-01, считать историческими до повторной проверки.

> **Приоритет инструкций:** для текущей системы применяйте разделы о Nginx, deploy, release-lock, TLS и DNS; раздел 4 содержит хронологию Cloudflare/Caddy и не предписывает возвращать Caddy в production. Nginx-фрагменты и правила проверки: [`deploy/nginx/README.md`](../deploy/nginx/README.md).

Документ предназначен для восстановления production-инфраструктуры `maxzolotoy.com` после потери VPS, повреждения конфигурации, неудачного деплоя или переноса на новый сервер.

> Секреты здесь намеренно не хранятся. S3 Access Key, S3 Secret Key, `RESTIC_PASSWORD`, приватные SSH-ключи и GitHub Secrets должны храниться отдельно.

## 1. Архитектура

```text
GitHub: Officialsayp/saypix
        │ push → main
        ▼
GitHub Actions
        │ SSH (deploy)
        ▼
Selectel VDS — 135.106.186.27
Ubuntu 24.04 LTS
        │
        ├─ Nginx (активный профиль)
        ├─ /var/www/maxzolotoy/releases/<commit>
        └─ /var/www/maxzolotoy/current -> active release
        │
        ▼
maxzolotoy.com
www.maxzolotoy.com
origin.maxzolotoy.com
```

Резервное копирование:

```text
Selectel VDS (Москва)
   ├─ /var/backups/maxzolotoy
   └─ restic (encrypted)
          ▼
Selectel S3 ru-1 (Санкт-Петербург)
bucket: maxzolotoy-backups-s3
```

Cloudflare используется только как **DNS**, без проксирования web-трафика.

## 2. Основные ресурсы

- Production: `https://maxzolotoy.com`
- WWW: `https://www.maxzolotoy.com`
- Staging/origin: `https://origin.maxzolotoy.com`
- VPS IP: `135.106.186.27`
- Hostname: `maxzolotoy-origin`
- VPS: Москва, Ubuntu 24.04 LTS, 1 vCPU, 1 GB RAM, 10 GB NVMe
- GitHub: `Officialsayp/saypix`
- Main branch: `main`
- Local repo on Mac: `~/maxzolotoy-card`
- S3 bucket: `maxzolotoy-backups-s3`
- S3 endpoint: `s3.ru-1.storage.selcloud.ru`
- S3 region: `ru-1`
- S3 service user: `maxzolotoy-backup`
- S3 role: `s3.bucket.user`

## 3. DNS

Web-записи:

```text
maxzolotoy.com         A  135.106.186.27  DNS only
www.maxzolotoy.com     A  135.106.186.27  DNS only
origin.maxzolotoy.com  A  135.106.186.27  DNS only
```

При восстановлении web-сервера **не менять** Proton Mail записи:

- MX
- SPF
- DKIM
- DMARC
- Proton verification

Также не удалять Yandex verification.


## 4. Cloudflare: прежняя конфигурация и миграция на Selectel

Этот раздел фиксирует состояние Cloudflare **до миграции**, изменения, которые делались при диагностике проблем российских сетей, и действия, выполненные для перехода на прямой Selectel origin.

### 4.1. Роль Cloudflare до миграции

Cloudflare выполнял одновременно две функции:

```text
1. Authoritative DNS для maxzolotoy.com
2. Hosting/proxy production-сайта через Cloudflare Workers
```

Zone:

```text
maxzolotoy.com
```

Authoritative nameservers:

```text
celeste.ns.cloudflare.com
yew.ns.cloudflare.com
```

Cloudflare zone после миграции **не удалялась**. Она по-прежнему обслуживает DNS домена, в том числе записи Proton Mail.

### 4.2. Worker `saypix`

Production-сайт был размещён в Cloudflare Workers Static Assets.

```text
Worker: saypix
workers.dev: https://saypix.officialsayp.workers.dev
```

Схема была:

```text
GitHub main
→ Cloudflare build
→ npm run build
→ dist/
→ Worker saypix / Workers Static Assets
→ Cloudflare edge
→ visitor
```

Основной `wrangler.jsonc`:

```json
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "saypix",
  "compatibility_date": "2026-08-23",
  "workers_dev": true,
  "preview_urls": false,
  "assets": {
    "directory": "./dist"
  }
}
```

Apex был подключён к Worker через **Custom Domain**:

```text
maxzolotoy.com → Worker saypix
```

В Cloudflare DNS это отображалось как заблокированная запись:

```text
Name: maxzolotoy.com
Type: Worker
Content: saypix
Proxy: Proxied
```

Пока Custom Domain был привязан к Worker, эту запись нельзя было заменить обычной `A`-записью.

### 4.3. `www` до миграции

Для `www.maxzolotoy.com` использовалась техническая запись:

```text
Type: A
Name: www
Content: 192.0.2.0
Proxy status: Proxied
TTL: Auto
```

`192.0.2.0` не был origin-сервером сайта. Запись использовалась вместе с Cloudflare proxy и Redirect Rule.

Redirect Rule выполнял:

```text
www.maxzolotoy.com/* → https://maxzolotoy.com/<тот же path/query>
```

Path и query string сохранялись.

После перехода на Selectel этот redirect больше не нужен: `www` приходит напрямую на веб-сервер Selectel (сейчас Nginx), который перенаправляет на apex.

### 4.4. Языковая логика, которую пробовали на Cloudflare

До миграции использовалась/тестировалась geo-логика:

```text
RU / BY / KZ → русская версия
прочие страны → английская версия
```

Из-за нестабильной работы Cloudflare для российских сетей принудительный RU/BY/KZ redirect был отключён.

Критическое правило:

```text
/ru/ не должен принудительно переводиться на /en/
/en/ не должен принудительно переводиться на /ru/
```

После Selectel geo-IP routing больше не нужен. Сейчас `/` выбирает язык на Nginx по началу заголовка `Accept-Language` через `deploy/nginx/http-maps.conf` (`ru` → `/ru/`, иначе `/en/`).

### 4.5. Почему Cloudflare proxy был отключён

Проблема была воспроизводимой именно на пути российских ISP/DPI к Cloudflare.

Наблюдалось следующее:

```text
DNS/TCP/TLS/TTFB → быстрые
HTTP response → начинается нормально
после ~16–19 KB → передача зависает/обрывается
```

Пример для файла примерно 105 KB без VPN:

```text
Cloudflare:
HTTP 200
получено ~17–19 KB
15 s timeout
curl exit=28
```

При прямом обращении к Selectel тот же файл загружался полностью:

```text
105216 bytes
примерно 0.16–0.23 s
HTTP 200
```

С VPN через европейские маршруты Cloudflare также работал нормально.

Это стало основанием убрать Cloudflare из web data path.

### 4.6. Frontend-mitigation до окончательной миграции

До переноса frontend дополнительно оптимизировался, чтобы уменьшить вероятность зависания:

- `/ru/` и `/en/` стали usable без JavaScript;
- boot-код был уменьшен;
- curtain вынесен в отдельный lazy-loaded модуль;
- alternate-language fragment загружается лениво;
- assets fingerprinted;
- initial critical path уменьшен;
- введены size budgets.

Эти улучшения остаются полезными, но они не могли исправить системную проблему маршрута ISP → Cloudflare.

### 4.7. Подготовка прямого origin

До production-cutover был создан staging:

```text
origin.maxzolotoy.com
```

DNS:

```text
origin.maxzolotoy.com
A
135.106.186.27
DNS only
```

Cloudflare proxy для `origin` **не включался**.

На origin проверялись:

- Caddy;
- TLS;
- HTTP/1.1 и HTTP/2;
- полная загрузка HTML/assets;
- крупные файлы;
- `/ru/` и `/en/`;
- `/_health`;
- GitHub Actions deploy;
- atomic release switch;
- cache headers.

Origin намеренно получает:

```text
X-Robots-Tag: noindex, nofollow
```

### 4.8. Финальный cutover с Worker на Selectel

Порядок действий был следующим.

#### 4.8.1. Удалён Custom Domain Worker

В Cloudflare:

```text
Workers & Pages
→ saypix
→ Domains
→ Custom Domains and Routes
→ maxzolotoy.com
→ Remove/Delete Custom Domain
```

Удалялась только связь:

```text
maxzolotoy.com ↔ Worker saypix
```

Сам Worker `saypix` и:

```text
https://saypix.officialsayp.workers.dev
```

оставались доступны как резерв.

После удаления Custom Domain исчезла locked Worker DNS record для apex.

#### 4.8.2. Apex переведён на Selectel

Создано:

```text
Type: A
Name: @
Content: 135.106.186.27
Proxy status: DNS only
TTL: Auto
```

Итог:

```text
maxzolotoy.com → 135.106.186.27 напрямую
```

#### 4.8.3. `www` переведён на Selectel

Старая запись:

```text
www
A
192.0.2.0
Proxied
```

заменена на:

```text
www
A
135.106.186.27
DNS only
```

Redirect теперь выполняет Caddy.

#### 4.8.4. `origin` оставлен прямым

```text
origin
A
135.106.186.27
DNS only
```

### 4.9. Текущее состояние Cloudflare

Cloudflare используется только как **authoritative DNS**.

Web DNS:

```text
maxzolotoy.com         A  135.106.186.27  DNS only
www.maxzolotoy.com     A  135.106.186.27  DNS only
origin.maxzolotoy.com  A  135.106.186.27  DNS only
```

Проверить авторитетный DNS:

```bash
dig @celeste.ns.cloudflare.com +short maxzolotoy.com A
dig @celeste.ns.cloudflare.com +short www.maxzolotoy.com A
```

Проверить public resolver:

```bash
dig @1.1.1.1 +short maxzolotoy.com A
dig @1.1.1.1 +short www.maxzolotoy.com A
```

Ожидаемо:

```text
135.106.186.27
```

Проверка отсутствия proxy:

```bash
curl -I https://maxzolotoy.com/ru/ | grep -Ei 'server|cf-ray'
```

Нужно:

```text
server: nginx (если заголовок Server публикуется)
```

Не должно быть признаков Cloudflare-проксирования (`server: cloudflare`, `cf-ray`). Не полагаться только на `Server`: он может быть скрыт/переопределён, проверяйте DNS-only и фактический HTTPS ответ.

### 4.10. Что не включать обратно

Без отдельной причины **не включать orange cloud / Proxied** для:

```text
maxzolotoy.com
www.maxzolotoy.com
origin.maxzolotoy.com
```

Иначе web-трафик снова пойдёт через Cloudflare edge и исходная проблема для российских сетей может вернуться.

Также не следует без отдельной необходимости:

- заново подключать `maxzolotoy.com` как Worker Custom Domain;
- ставить Cloudflare Tunnel перед текущим Selectel origin;
- проксировать `origin.maxzolotoy.com`;
- возвращать geo-IP redirect RU/BY/KZ.

### 4.11. Mail DNS не связан с web-cutover

При любых изменениях web-маршрута **не трогать**:

```text
MX
SPF
DKIM
DMARC
protonmail-verification
Yandex verification
```

Перенос сайта с Worker на Selectel не требовал изменений Proton Mail.

### 4.12. Emergency rollback обратно на Worker

Это только аварийный fallback. Он может вернуть прежние проблемы Cloudflare в российских сетях.

1. Проверить резервный Worker:

```text
https://saypix.officialsayp.workers.dev
```

2. В `Workers & Pages → saypix → Domains` снова добавить:

```text
maxzolotoy.com
```

как Custom Domain.

3. При необходимости вернуть старый `www`:

```text
www  A  192.0.2.0  Proxied
```

4. Вернуть Redirect Rule:

```text
www → https://maxzolotoy.com
preserve path/query
```

5. Проверить production:

```bash
curl -I https://maxzolotoy.com/ru/
```

При Cloudflare rollback снова будут нормальны заголовки вида:

```text
server: cloudflare
cf-ray: ...
```

6. После восстановления Selectel вернуть текущую DNS-only архитектуру.


## 5. SSH

Root с домашнего Mac:

```bash
ssh -i ~/.ssh/id_ed25519 root@135.106.186.27
```

Deploy user:

```bash
ssh -i ~/.ssh/maxzolotoy_github_actions \
  -o IdentitiesOnly=yes \
  deploy@135.106.186.27
```

Hardening:

```text
/etc/ssh/sshd_config.d/00-maxzolotoy-hardening.conf
```

```text
PasswordAuthentication no
KbdInteractiveAuthentication no
PubkeyAuthentication yes
PermitRootLogin prohibit-password
```

Проверки:

```bash
sshd -t

sshd -T | grep -E \
'passwordauthentication|kbdinteractiveauthentication|pubkeyauthentication|permitrootlogin'
```

Ожидаемо:

```text
passwordauthentication no
kbdinteractiveauthentication no
pubkeyauthentication yes
permitrootlogin without-password
```

Reload:

```bash
systemctl reload ssh
```

## 6. UFW

Разрешены:

```text
22/tcp
80/tcp
443/tcp
```

Проверка:

```bash
ufw status verbose
```

Ожидаемо: `Status: active`, incoming по умолчанию запрещён.

## 7. Nginx — действующий веб-сервер

Git содержит **фрагменты**, а не полный конфиг production-хоста:

```text
deploy/nginx/http-maps.conf  # включить один раз внутри http {}
deploy/nginx/site.conf       # внутри server {} для apex и origin
```

TLS-сертификаты, renew hooks, listen, apex/www redirects и ACME webroot управляются на VPS отдельно; их **реальные пути и способ продления неизвестны** из репозитория. Перед вмешательством получите и проверьте фактическую конфигурацию по SSH (вывод `nginx -T` может содержать чувствительные сведения — не публикуйте его без очистки):

```bash
sudo nginx -t
systemctl status nginx --no-pager
systemctl is-active caddy || true
ss -lntp | grep -E ':80|:443'
systemctl list-timers --all | grep -Ei 'certbot|acme|letsencrypt|certificate|nginx' || true
```

Перед изменением или восстановлением сохраните копию реально используемых host-конфигов и TLS-материалов в защищённое хранилище. **Не заменяйте host-конфиг только фрагментами из репозитория**: в них нет TLS/listener/renewal. Для нового сервера подготовьте полную конфигурацию с существующим способом управления сертификатами; проверьте `nginx -t` до `systemctl reload nginx`. Первичный запуск/reload выполнять только при валидной конфигурации и доступных сертификатах. Проверяйте `/_health`, обе локали, HTTPS и заголовок `X-Robots-Tag` на origin.

Caddy в `deploy/caddy/` — **исторический/резервный профиль**. Не запускать `systemctl enable caddy` и не применять старые Caddy-файлы к действующему Nginx без отдельного утверждённого плана миграции.

## 8. Языковая маршрутизация

Корень `/` выбирает язык по `Accept-Language`:

```text
ru* → /ru/
остальные → /en/
```

Явные `/ru/` и `/en/` не перенаправляются.

Проверка RU:

```bash
curl -I \
  -H 'Accept-Language: ru-RU,ru;q=0.9,en;q=0.8' \
  https://maxzolotoy.com/
```

Ожидаемо:

```text
HTTP/2 302
location: /ru/
```

Проверка EN:

```bash
curl -I \
  -H 'Accept-Language: en-US,en;q=0.9,ru;q=0.8' \
  https://maxzolotoy.com/
```

Ожидаемо:

```text
HTTP/2 302
location: /en/
```

## 9. Cache-Control

Для `/assets/*`:

```text
public, max-age=31536000, immutable
```

Для HTML и прочих mutable-ресурсов:

```text
public, max-age=0, must-revalidate
```

## 10. Origin / staging

Health:

```bash
curl -i https://origin.maxzolotoy.com/_health
```

Ожидаемо:

```text
HTTP/2 200

ok
```

Origin закрыт от индексирования:

```bash
curl -I https://origin.maxzolotoy.com/ru/ | grep -i robots
```

Ожидаемо:

```text
x-robots-tag: noindex, nofollow
```

Production должен быть индексируемым:

```bash
curl -I https://maxzolotoy.com/ru/ | grep -i robots
```

Ожидаемо: пустой вывод.

## 11. Releases

```text
/var/www/maxzolotoy/
├── releases/
└── current -> releases/<active-commit>
```

Активный релиз:

```bash
readlink -f /var/www/maxzolotoy/current
```

Список:

```bash
ls -lt /var/www/maxzolotoy/releases
```

## 12. GitHub Actions deploy

Workflow для `main` проходит `npm test` и `npm run check:nginx` (после установки Nginx/headers-more в CI); далее архивирует `dist`, загружает его по SSH, переключает `current` под `flock` и проверяет origin. Это проверка конфигурационного профиля и ответов origin; она не подтверждает полноту server-side backup и сертификатного renewal.


Workflow:

```text
.github/workflows/deploy-direct-origin.yml
```

Repository variable:

```text
DIRECT_ORIGIN_DEPLOY_ENABLED=true
```

Environment:

```text
direct-origin
```

Environment secrets:

```text
VPS_HOST
VPS_USER
VPS_SSH_KEY
VPS_KNOWN_HOSTS
VPS_ORIGIN_HOST
```

Несекретные значения:

```text
VPS_HOST=135.106.186.27
VPS_USER=deploy
VPS_ORIGIN_HOST=origin.maxzolotoy.com
```

Flow:

```text
push main
→ npm ci
→ npm test
→ npm run build
→ SCP dist
→ /var/www/maxzolotoy/releases/<GITHUB_SHA>
→ flock on releases/.deploy-maxzolotoy.lock
→ atomic current symlink switch
→ smoke test origin
```

Принудительный deploy:

```bash
cd ~/maxzolotoy-card
git commit --allow-empty -m "Trigger direct origin deploy"
git push origin main
```

## 13. Rollback

Посмотреть релизы:

```bash
ls -lt /var/www/maxzolotoy/releases
```

Переключить `current` **атомарно, под тем же lock, что и деплой/ротация**, от имени пользователя с правами на каталог сайта:

```bash
set -eu
base=/var/www/maxzolotoy
previous="$base/releases/<PREVIOUS_COMMIT_SHA>"
lock="$base/releases/.deploy-maxzolotoy.lock"
test -d "$previous" || { echo "Previous release missing" >&2; exit 1; }
test ! -L "$lock" || { echo "Refusing symlinked lock" >&2; exit 1; }
exec 9>"$lock"
flock -w 120 9
ln -sfn "$previous" "$base/current.next"
mv -Tf "$base/current.next" "$base/current"
readlink -f "$base/current"
```

Выполнять в отдельной SSH-сессии после проверки `<PREVIOUS_COMMIT_SHA>`, наличия корректного релиза и свободного места. **Не** переключать симлинк во время очистки релизов или параллельного деплоя; не использовать простую замену `current` вне блокировки. После переключения проверить origin и публичные URL; при необходимости возвратить указатель на ранее активный релиз под той же блокировкой.

Проверить:

```bash
readlink -f /var/www/maxzolotoy/current
curl -I https://maxzolotoy.com/ru/
curl -I https://origin.maxzolotoy.com/ru/
```

## 14. Release rotation

Скрипт:

```text
/usr/local/sbin/maxzolotoy-release-cleanup
```

Systemd:

```text
maxzolotoy-release-cleanup.service
maxzolotoy-release-cleanup.timer
```

По исходной документации политика была: текущий + 9 предыдущих релизов. Фактические параметры и работа `maxzolotoy-release-cleanup.timer` подлежат проверке на VPS. Скрипт очистки должен брать **тот же** lock `/var/www/maxzolotoy/releases/.deploy-maxzolotoy.lock`, что и GitHub Actions deploy, и защищать активный релиз; проверьте реализацию перед первым ручным запуском. Не удалять каталоги релизов вручную без согласованной политики и проверки lock.

## 15. Automatic security updates

Проверить:

```bash
cat /etc/apt/apt.conf.d/20auto-upgrades

systemctl list-timers --all | grep -E 'apt-daily|apt-daily-upgrade'
```

Автоматический reboot отключён.

Проверка необходимости reboot:

```bash
if [ -f /var/run/reboot-required ]; then
  cat /var/run/reboot-required
else
  echo "Reboot not required"
fi
```

## 16. Local config backup

Каталог:

```text
/var/backups/maxzolotoy
```

Скрипт:

```text
/usr/local/sbin/maxzolotoy-config-backup
```

Systemd:

```text
maxzolotoy-config-backup.service
maxzolotoy-config-backup.timer
```

Retention: последние 14 архивов.

Проверить:

```bash
ls -lh /var/backups/maxzolotoy

LATEST=$(ls -1t /var/backups/maxzolotoy/config-*.tar.gz | head -1)
tar -tzf "$LATEST" | head -50
```

В архиве образца сентября 2026 перечислялись **Caddy**, SSH config, authorized_keys, UFW, unattended-upgrades, custom systemd units и custom scripts. **Это не доказывает, что текущие Nginx host-конфиги, TLS-сертификаты, ключи и настройки renewal уже включены в резервное копирование.** До следующего отказа сервера необходимо проверить фактический скрипт и содержимое последнего архива:

```bash
LATEST=$(ls -1t /var/backups/maxzolotoy/config-*.tar.gz | head -1)
tar -tzf "$LATEST" | grep -Ei '(^|/)(nginx|letsencrypt|certbot|acme|ssl|systemd)/' || true
```

Если актуальные файлы отсутствуют, пересмотреть backup manifest и выполнить тест восстановления в отдельной среде. Закрытые ключи и пароль restic хранить отдельно и с соответствующими правами; **не** добавлять их в Git.

Не входит:

```text
/root/.config/restic/maxzolotoy.env
```

## 17. Restic + S3

Credentials:

```text
/root/.config/restic/maxzolotoy.env
```

Права:

```bash
chmod 600 /root/.config/restic/maxzolotoy.env
```

Переменные:

```text
AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY
AWS_DEFAULT_REGION=ru-1
RESTIC_REPOSITORY
RESTIC_PASSWORD
```

Repository:

```text
s3:https://s3.ru-1.storage.selcloud.ru/maxzolotoy-backups-s3
```

Restic options:

```text
-o s3.bucket-lookup=dns
-o s3.region=ru-1
```

## 18. Off-site backup

Скрипт:

```text
/usr/local/sbin/maxzolotoy-offsite-backup
```

Systemd:

```text
maxzolotoy-offsite-backup.service
maxzolotoy-offsite-backup.timer
```

Retention:

```text
--keep-daily 14
--keep-weekly 8
--keep-monthly 12
--prune
```

Проверить:

```bash
systemctl start maxzolotoy-offsite-backup.service
systemctl status maxzolotoy-offsite-backup.service --no-pager -l
```

Для oneshot успешный результат после выполнения: `inactive (dead)` и `status=0/SUCCESS`.

## 19. Restic integrity check

Скрипт:

```text
/usr/local/sbin/maxzolotoy-restic-check
```

Systemd:

```text
maxzolotoy-restic-check.service
maxzolotoy-restic-check.timer
```

Проверка:

```bash
/usr/local/sbin/maxzolotoy-restic-check
```

Ожидаемо:

```text
no errors were found
```

## 20. Custom timers

```bash
systemctl list-timers --all | grep maxzolotoy
```

Ожидаются:

```text
maxzolotoy-release-cleanup.timer
maxzolotoy-config-backup.timer
maxzolotoy-offsite-backup.timer
maxzolotoy-restic-check.timer
```

# Disaster Recovery

## 21. Полная потеря VPS

> Начиная с этой ревизии, шаги восстановления ориентированы на текущий Nginx-профиль. **Не** восстанавливайте без проверки Caddy-конфигурацию из старого архива и **не** меняйте production DNS до тестирования нового origin. Все ссылки на реальные host-конфиги/TLS требуют инвентаризации сервера до аварии.


### 21.1 Создать новый VPS

Рекомендовано:

```text
Ubuntu 24.04 LTS
Москва
1 vCPU
1 GB RAM
10 GB NVMe
Public IPv4
```

Добавить личный публичный SSH-ключ при создании.

### 21.2 Подключиться и обновить

```bash
ssh -i ~/.ssh/id_ed25519 root@<NEW_IP>

apt update
apt full-upgrade -y
```

### 21.3 Установить базовые компоненты

```bash
apt install -y curl git ufw unattended-upgrades restic nginx libnginx-mod-http-headers-more-filter
```

Установленный Nginx необходимо дополнить **реальным host-конфигом** (слушающие сокеты, сертификаты, HTTP→HTTPS, www→apex, ACME/renewal) из проверенного резервного источника. Файлы `deploy/nginx/http-maps.conf` и `deploy/nginx/site.conf` — лишь фрагменты и не заменяют полный конфиг. Не запускать Caddy как «восстановление по умолчанию».

### 21.4 Firewall

```bash
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
```

### 21.5 Deploy user

```bash
adduser --disabled-password --gecos "" deploy

install -d -m 0700 -o deploy -g deploy /home/deploy/.ssh
```

Восстановить GitHub Actions public key в:

```text
/home/deploy/.ssh/authorized_keys
```

Права:

```bash
chown deploy:deploy /home/deploy/.ssh/authorized_keys
chmod 600 /home/deploy/.ssh/authorized_keys
```

Web directories:

```bash
install -d -m 0755 -o deploy -g deploy /var/www/maxzolotoy
install -d -m 0755 -o deploy -g deploy /var/www/maxzolotoy/releases
```

### 21.6 Восстановить restic credentials

```bash
install -d -m 0700 /root/.config/restic
nano /root/.config/restic/maxzolotoy.env
chmod 600 /root/.config/restic/maxzolotoy.env
```

Восстановить из менеджера паролей:

- S3 Access Key
- S3 Secret Key
- `RESTIC_PASSWORD`

Несекретные значения:

```text
AWS_DEFAULT_REGION='ru-1'
RESTIC_REPOSITORY='s3:https://s3.ru-1.storage.selcloud.ru/maxzolotoy-backups-s3'
```

Загрузить:

```bash
set -a
source /root/.config/restic/maxzolotoy.env
set +a
```

Проверить:

```bash
restic \
  -o s3.bucket-lookup=dns \
  -o s3.region=ru-1 \
  snapshots
```

### 21.7 Restore config backup

```bash
mkdir -p /tmp/maxzolotoy-restore

restic \
  -o s3.bucket-lookup=dns \
  -o s3.region=ru-1 \
  restore latest \
  --target /tmp/maxzolotoy-restore
```

Найти архив:

```bash
find /tmp/maxzolotoy-restore -name 'config-*.tar.gz' -type f
```

Проверить выбранный архив:

```bash
RESTORED_ARCHIVE="<PATH_TO_CONFIG_ARCHIVE>"
tar -tzf "$RESTORED_ARCHIVE" | head -50
```

**Не распаковывать старый архив вслепую в `/`**: он мог содержать конфигурацию Caddy и не включать Nginx/TLS текущей версии. Сначала извлечь в карантинный каталог, сопоставить состав с реально применяемой Nginx-схемой и **выборочно** восстановить проверенные SSH/UFW/systemd/Nginx/TLS файлы по их исходным путям:

```bash
install -d -m 0700 /tmp/maxzolotoy-config-inspect
tar -xzf "$RESTORED_ARCHIVE" -C /tmp/maxzolotoy-config-inspect
find /tmp/maxzolotoy-config-inspect -maxdepth 4 -type f | sort
```

После выборочного восстановления убедиться в правах закрытых ключей, наличии реальной host-конфигурации Nginx и средства обновления TLS, затем выполнить `systemctl daemon-reload`. Если backup не содержит текущие Nginx/TLS файлы, получить их из отдельного защищённого источника; не пытаться восстановить рабочий HTTPS одними фрагментами из Git.

### 21.8 Проверить конфиги до reload

SSH:

```bash
sshd -t
```

Nginx (после восстановления полного host-конфига и сертификатов):

```bash
nginx -t
```

Затем проверить, что `http-maps.conf` включён в `http {}` ровно один раз, а `site.conf` — в нужные content `server {}`; проверить TLS/renewal и наличие `libnginx-mod-http-headers-more-filter`. Не запускать и не перезагружать Nginx при неуспешном `nginx -t`.

Не закрывать текущую root-сессию, пока не проверен второй SSH-вход.

### 21.9 Запустить timers

```bash
systemctl enable --now nginx

systemctl enable --now maxzolotoy-config-backup.timer
systemctl enable --now maxzolotoy-release-cleanup.timer
systemctl enable --now maxzolotoy-offsite-backup.timer
systemctl enable --now maxzolotoy-restic-check.timer
```

### 21.10 Обновить GitHub при новом IP

Environment: `direct-origin`.

Изменить:

```text
VPS_HOST=<NEW_IP>
```

Получить новый host key:

```bash
ssh-keyscan -t ed25519 <NEW_IP>
```

**Сверить fingerprint с доверенным каналом/панелью VPS, а не принимать вывод `ssh-keyscan` без проверки**. Обновить:

```text
VPS_KNOWN_HOSTS
```

### 21.11 Сначала подготовить и проверить новый origin

До выпуска на production отдельно убедиться в исправности Nginx и TLS. При необходимости сначала перевести **только** `origin.maxzolotoy.com` на новый VPS:

```text
origin.maxzolotoy.com A <NEW_IP> DNS only
```

Проверить авторитетный DNS и путь к **новому** IP, а не к старому серверу:

```bash
dig @1.1.1.1 +short origin.maxzolotoy.com A
curl --resolve origin.maxzolotoy.com:443:<NEW_IP> \
  -i https://origin.maxzolotoy.com/_health
```

HTTPS-проверку выполнять только после восстановления/выпуска сертификата для origin и успешного `nginx -t`; **не отключать** проверку TLS через `-k` ради формального зелёного ответа. Перед DNS-переключением production проверить новый origin по обеим локалям, заголовки, noindex, редиректы и актуальный TLS. Если на origin ещё нет корректного сертификата, сначала решить вопрос выдачи/переноса сертификата: порядок зависит от фактической ACME/renewal конфигурации VPS и не фиксируется репозиторием.

### 21.12 Выполнить GitHub deploy на новый VPS

Убедиться, что `VPS_HOST` и проверенный `VPS_KNOWN_HOSTS` в GitHub указывают на новый сервер, а `VPS_ORIGIN_HOST` разрешается именно в проверенный новый origin. Иначе smoke-test workflow может попасть на **старый** VPS и дать ложное подтверждение.

После этого инициировать разрешённый деплой из `main` (например, через новый проверенный commit) и дождаться успешных `verify`, атомарного переключения и `Smoke test direct origin`. Затем подтвердить по SSH:

```bash
readlink -f /var/www/maxzolotoy/current
curl -i https://origin.maxzolotoy.com/_health
```

Убедиться, что `current` указывает на ожидаемый SHA и что публичный origin обслуживается именно новым VPS. Не менять apex/www до подтверждения.

### 21.13 Затем production

Только после успешного origin smoke-test:

```text
maxzolotoy.com     A <NEW_IP> DNS only
www.maxzolotoy.com A <NEW_IP> DNS only
```

Proton Mail DNS не менять.

# 22. Финальный smoke-test

```bash
curl -I https://maxzolotoy.com/ru/
curl -I https://maxzolotoy.com/en/
curl -I https://www.maxzolotoy.com/ru/
curl -i https://origin.maxzolotoy.com/_health
```

RU root routing:

```bash
curl -I \
  -H 'Accept-Language: ru-RU,ru;q=0.9,en;q=0.8' \
  https://maxzolotoy.com/
```

EN root routing:

```bash
curl -I \
  -H 'Accept-Language: en-US,en;q=0.9' \
  https://maxzolotoy.com/
```

Проверить отсутствие Cloudflare proxy:

```bash
curl -I https://maxzolotoy.com/ru/ | grep -Ei 'server|cf-ray'
```

Ожидаемо: успешный HTTPS-ответ действующего origin/production через Nginx без заголовка `cf-ray`; поле `Server` необязательно и может быть отключено в host-конфигурации. Проверьте сертификат и содержимое ответа, а не только заголовок.

# 23. Аварийная диагностика

Сайт:

```bash
systemctl status nginx --no-pager
journalctl -u nginx -n 100 --no-pager
nginx -t
ss -lntp | grep -E ':80|:443'
ufw status verbose
```

DNS:

```bash
dig @1.1.1.1 +short maxzolotoy.com A
dig @1.1.1.1 +short origin.maxzolotoy.com A
```

Restic:

```bash
systemctl status maxzolotoy-offsite-backup.service --no-pager -l

journalctl \
  -u maxzolotoy-offsite-backup.service \
  -n 100 \
  --no-pager -l
```

# 24. Секреты вне VPS

Обязательно сохранить отдельно:

```text
Selectel S3 Access Key
Selectel S3 Secret Key
RESTIC_PASSWORD
```

Также обеспечить независимую копию приватных SSH-ключей:

```text
~/.ssh/id_ed25519
~/.ssh/maxzolotoy_github_actions
```

Приватные ключи никогда не коммитить в Git.

# 25. Ежемесячный health-check

```bash
apt list --upgradable
ufw status verbose
systemctl --failed
systemctl list-timers --all | grep maxzolotoy
systemctl status nginx --no-pager
nginx -t
systemctl list-timers --all | grep -Ei 'certbot|acme|letsencrypt|certificate|nginx' || true
df -h
readlink -f /var/www/maxzolotoy/current
ls -lh /var/backups/maxzolotoy
```

Restic:

```bash
set -a
source /root/.config/restic/maxzolotoy.env
set +a

restic \
  -o s3.bucket-lookup=dns \
  -o s3.region=ru-1 \
  snapshots
```

Проверить, что последние GitHub Actions `Verify static site` и `Deploy direct origin` зелёные.

# 26. Главное правило disaster recovery

Не переключать production DNS сразу.

```text
1. Новый VPS
2. SSH + UFW + Nginx + проверенная TLS/renewal конфигурация
3. Restic restore
4. GitHub deploy
5. origin.maxzolotoy.com
6. Полный smoke-test
7. Только затем maxzolotoy.com + www
```

Это позволяет сначала полностью проверить новую инфраструктуру, а затем безопасно переключить production.
