# Crypto Hunter OS — Telegram Bot

## Настройка

1. Создай бота через @BotFather в Telegram
2. Скопируй токен
3. Запусти бота:

```bash
cd telegram-bot
npm install
TELEGRAM_BOT_TOKEN=your_token_here node index.js
```

## Команды бота

| Команда | Описание |
|---------|----------|
| `/start` | Приветствие + меню |
| `/status` | Прогресс по проектам |
| `/today` | Задачи на сегодня |
| `/upcoming` | Ближайшие дедлайны |
| `/score <проект>` | AI оценка проекта |
| `/add <текст>` | Добавить задачи из текста |
| `/wallets` | Список кошельков |
| `/help` | Справка |

## Примеры

```
/score Monad
/add Bridge 0.1 ETH to Scroll testnet, complete 3 swaps, join Discord
```
