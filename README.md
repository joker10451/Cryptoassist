# Crypto Hunter OS

**Персональная операционная система для крипто-фарминга.**

## Описание

Crypto Hunter OS — мощный дашборд для отслеживания крипто-возможностей: аирдропы, тестнеты, ретроактивные награды, NFT минты, DeFi фарминг, социальные квесты и вайтлисты.

## Фичи

- 🎯 **База проектов** — 8 проектов с AI-скорингом вероятности аирдропов
- 📋 **Трекер задач** — 14 задач с прогрессом и XP
- 💰 **Кошельки** — Управление кошельками с анализом элиджиблити
- 🧠 **ИИ Центр** — Парсер задач, Оценка проектов, Анализ кошелька
- 🔔 **Напоминания** — Умные напоминания о дедлайнах и снимках
- 🏆 **Геймификация** — XP, уровни, стрики, 11 достижений
- 📊 **Дашборд** — Горячие возможности, Аирдропы, Скоро заканчивается, Бесплатные

## Стек

- **Фронтенд:** Next.js 16 (App Router), TypeScript, Tailwind CSS
- **UI:** Framer Motion, Lucide Icons
- **База данных:** Supabase (PostgreSQL) — схема `crypto_hunter`
- **Состояние:** Zustand (localStorage)
- **Всё бесплатно** — Supabase Free Tier

## Быстрый старт

```bash
# Установка зависимостей
npm install

# Запуск
npm run dev
```

Открой http://localhost:3000

## База данных

Проект подключён к Supabase (`sbpdiilpkluslkkajmvs`). Схема `crypto_hunter` содержит:

- **projects** — 8 проектов (LayerZero, zkSync, Scroll, StarkNet, Monad, Berachain, EigenLayer, Hyperlane)
- **tasks** — 14 задач привязанных к проектам
- **achievements** — 8 достижений
- **users, wallets, user_projects, user_tasks, reminders, ai_analyses, missed_opportunities** — таблицы для пользовательских данных

## Структура проекта

```
src/
├── app/                    # Страницы
│   ├── page.tsx            # Дашборд
│   ├── projects/           # Проекты
│   ├── wallets/            # Кошельки
│   ├── tasks/              # Задачи
│   ├── ai/                 # ИИ Центр
│   ├── reminders/          # Напоминания
│   ├── profile/            # Профиль
│   └── settings/           # Настройки
├── components/
│   ├── ui/                 # UI компоненты
│   ├── dashboard/          # Виджеты дашборда
│   └── layout/             # Sidebar, Header
├── lib/                    # Утилиты, seed данные, Supabase
├── store/                  # Zustand хранилища
└── types/                  # TypeScript типы
```
