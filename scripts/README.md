# Scripts (out-of-app workers)

Эти скрипты НЕ являются частью Next.js bundle и не деплоятся в Vercel.
Запускать локально или на отдельной машине (Railway, Hetzner, домашний VPS,
GitHub Action по cron).

## Установка зависимостей

```bash
npm install --no-save playwright dotenv
npx playwright install chromium
```

Или вынеси `scripts/` в отдельный пакет с собственным `package.json`,
если хочешь развести deps окончательно.

## Скрейпер Twitter

```bash
# 1. Один раз: войти в Twitter и сохранить session.
node scripts/twitter-login.mjs
# (откроется Chromium, авторизуйся вручную, скрипт сохранит storage.json)

# 2. Сам скрейпер — отправляет найденные твиты в API.
NEXT_PUBLIC_API_URL=http://localhost:3000 \
INTERNAL_TOKEN=secret \
node scripts/scrape-twitter.mjs
```

## Cron на калибровку

Раз в сутки дёрни эндпоинт:

```bash
curl -X POST $NEXT_PUBLIC_API_URL/api/scoring/calibrate \
  -H "x-internal-token: $INTERNAL_TOKEN" \
  -H "content-type: application/json" \
  -d '{"dryRun": false}'
```

## Замечания

- Twitter блокирует автоматизацию агрессивно; storageState протухает.
- Если есть официальный X API ключ — лучше сразу его и использовать,
  переписать `scrape-twitter.mjs` под `https://api.x.com/2/...`.
- Альтернатива без Playwright: nitter-инстансы (нестабильно) или
  RSS из Hacker News / RSS блогов с фильтром по ключевым словам.
