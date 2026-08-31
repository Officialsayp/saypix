# Recovery Runbook — maxzolotoy.com

Актуально: **2026-09-01**

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
        ├─ Caddy
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

После перехода на Selectel этот redirect больше не нужен: `www` приходит напрямую на Caddy, который сам перенаправляет на apex.

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

После Selectel geo-IP routing больше не нужен. Сейчас `/` выбирает язык на Caddy по `Accept-Language` браузера.

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
server: Caddy
```

Не должно быть:

```text
server: cloudflare
cf-ray:
```

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

## 7. Caddy

Server-side:

```text
/etc/caddy/Caddyfile
/etc/caddy/site.caddy
```

В Git:

```text
deploy/caddy/Caddyfile.production
deploy/caddy/Caddyfile.origin
deploy/caddy/site.caddy
```

Проверить:

```bash
caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
```

Reload:

```bash
systemctl reload caddy
```

Статус:

```bash
systemctl status caddy --no-pager
```

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
server: Caddy

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

Переключить `current`:

```bash
ln -sfn \
  /var/www/maxzolotoy/releases/<PREVIOUS_COMMIT_SHA> \
  /var/www/maxzolotoy/current
```

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

Политика: текущий + 9 предыдущих релизов.

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

В backup входят Caddy, SSH config, authorized_keys, UFW, unattended-upgrades, custom systemd units и custom scripts.

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

### 20.1 Создать новый VPS

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

### 20.2 Подключиться и обновить

```bash
ssh -i ~/.ssh/id_ed25519 root@<NEW_IP>

apt update
apt full-upgrade -y
```

### 20.3 Установить базовые компоненты

```bash
apt install -y curl git ufw unattended-upgrades restic
```

Установить Caddy из официального репозитория Caddy.

### 20.4 Firewall

```bash
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
```

### 20.5 Deploy user

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

### 20.6 Восстановить restic credentials

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

### 20.7 Restore config backup

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

Распаковать в `/`:

```bash
tar -xzf "$RESTORED_ARCHIVE" -C /
systemctl daemon-reload
```

### 20.8 Проверить конфиги до reload

SSH:

```bash
sshd -t
```

Caddy:

```bash
caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
```

Не закрывать текущую root-сессию, пока не проверен второй SSH-вход.

### 20.9 Запустить timers

```bash
systemctl enable --now caddy

systemctl enable --now maxzolotoy-config-backup.timer
systemctl enable --now maxzolotoy-release-cleanup.timer
systemctl enable --now maxzolotoy-offsite-backup.timer
systemctl enable --now maxzolotoy-restic-check.timer
```

### 20.10 Обновить GitHub при новом IP

Environment: `direct-origin`.

Изменить:

```text
VPS_HOST=<NEW_IP>
```

Получить новый host key:

```bash
ssh-keyscan -t ed25519 <NEW_IP>
```

Обновить:

```text
VPS_KNOWN_HOSTS
```

### 20.11 Сделать GitHub deploy

```bash
cd ~/maxzolotoy-card
git commit --allow-empty -m "Restore production deploy"
git push origin main
```

Дождаться зелёного `Deploy direct origin`.

### 20.12 Сначала переключить origin

Cloudflare:

```text
origin.maxzolotoy.com A <NEW_IP> DNS only
```

Проверить:

```bash
dig @1.1.1.1 +short origin.maxzolotoy.com A
curl -i https://origin.maxzolotoy.com/_health
```

### 20.13 Затем production

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

Ожидаемо:

```text
server: Caddy
```

# 23. Аварийная диагностика

Сайт:

```bash
systemctl status caddy --no-pager
journalctl -u caddy -n 100 --no-pager
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
systemctl status caddy --no-pager
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
2. SSH + UFW + Caddy
3. Restic restore
4. GitHub deploy
5. origin.maxzolotoy.com
6. Полный smoke-test
7. Только затем maxzolotoy.com + www
```

Это позволяет сначала полностью проверить новую инфраструктуру, а затем безопасно переключить production.
