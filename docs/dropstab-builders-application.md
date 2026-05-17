# DropsTab Builders Program — заявка

> Шаблон для подачи на бесплатный API-ключ. Большая часть полей универсальна
> для подобных Builders/Startup программ; если форма у DropsTab отличается,
> нужные блоки достаём отсюда.

## Куда подавать

Точка входа: <https://dropstab.com/dashboard-api>

1. Зарегистрировать аккаунт DropsTab (email + пароль).
2. Перейти на dashboard-api → выбрать Builders Program (если нет такой кнопки,
   написать в support, ссылаясь на их research-пост:
   `dropstab.com/research/product/how-to-get-free-crypto-data-with-drops-tab-builders-program`).
3. Заполнить форму ниже и приложить ссылку на репозиторий.

---

## Project Name

Crypto Hunter OS

## Tagline (one line)

Personal operating system for crypto airdrop farming — tracks projects,
tasks, wallets, and AI-scored opportunities.

## Description (3–5 sentences)

Crypto Hunter OS is a self-hosted Next.js dashboard that helps individual
farmers run their airdrop pipeline like a job: a project database with v2
deterministic scoring + LLM enrichment, a task tracker linked to wallets,
an AI Opportunity Detector that watches social signals, and a referral
campaign module that turns farming positions into shareable posts. The
goal is to reduce time-to-alpha and stop missing snapshots, without
spreadsheets.

The app uses Supabase for storage and a v2 scoring engine that combines
seven weighted components (founding quality, airdrop likelihood, farming
accessibility, market momentum, signal freshness, narrative strength,
risk). It's missing one thing: structured fundraising and unlock data.

That's where DropsTab comes in.

## Project status

- Stage: working private build, not public yet
- Stack: Next.js 16 (App Router) + TypeScript, Supabase Postgres, Tailwind
- Repo: `<https://github.com/joker10451/Cryptoassist>` (private — happy to
  add a reviewer if needed)
- Build runs green: `npm run build` produces 47 routes, including
  `/api/projects/enrich`, `/api/scoring/*`, `/api/referrals/*`

## What endpoints will I use

Primary:
- `GET /coins` — base price/market data lookup by symbol or ID
- `GET /coins/{id}` — detail page enrichment (chains, tags, links)
- `GET /fundingRounds` — replace what we lost when DefiLlama paywalled
  `/raises`. We use total funding + lead/other investors as a feature in
  scoring.
- `GET /tokenUnlocks` and `/tokenUnlocks/overview` — for the "Reminders"
  module to alert users before large unlock pressure events.
- `GET /activities` — to feed the AI Opportunity Detector with structured
  airdrop / listing / partnership signals instead of raw Twitter scraping.

Estimated request volume: under 1,000 req/day during normal operation
(per-project enrichment is on-demand, batch refresh runs nightly).

## Why I need free access

This is an indie project, not a commercial product. There is no monetization
plan beyond personal use and possibly an open-source release once the
scoring loop has enough resolved outcomes to be useful. Without DropsTab,
the funding/unlocks dimension stays empty and the scoring model has to
ignore the most important V2 feature (founding_quality). With DropsTab,
the system becomes meaningfully better at separating signal from noise.

## How will I credit DropsTab

- "Powered by DropsTab" line in the dashboard footer once a Builders key
  is active.
- Link back to dropstab.com from the project detail page where DropsTab
  data is shown.
- Mention in the project README under Data Sources.

## Contact

- Discord / Telegram: __PUT YOUR HANDLE__
- Email: __PUT YOUR EMAIL__
- X: <https://x.com/__PUT YOUR HANDLE__>

---

## После одобрения

Когда придёт API key:

1. Добавить в `.env.local`:
   ```
   DROPSTAB_API_KEY=...
   ```
2. Сказать мне — я добавлю клиент в `src/lib/enrichment/dropstab.ts`
   (по аналогии с CoinGecko и DefiLlama) и подключу его к
   `enrichProject()`. Это закроет `funding_amount` + `investors` для
   всех проектов где DropsTab их знает.

3. Опциональные следующие шаги:
   - подключить `/tokenUnlocks` к `/reminders` — будет автоматически
     создавать напоминания за N дней до unlocks по проектам, которые
     ты трекаешь;
   - подключить `/activities` к детектору — он перестанет зависеть от
     ручного ввода твитов.
