// Crypto Hunter OS — Telegram Bot
// Запуск: node telegram-bot/index.js
// Требуется: npm install node-telegram-bot-api

const TelegramBot = require('node-telegram-bot-api')

const TOKEN = process.env.TELEGRAM_BOT_TOKEN || 'YOUR_BOT_TOKEN'
const APP_URL = process.env.APP_URL || 'http://localhost:3000'

const bot = new TelegramBot(TOKEN, { polling: true })

// Хранилище пользователей
const users = {}

// Команда /start
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id
  users[chatId] = { chatId, username: msg.from.username }

  bot.sendMessage(chatId, `
🎯 *Crypto Hunter OS Bot*

Ваш персональный ассистент для крипто-фарминга.

*Команды:*
/status — Прогресс по проектам
/today — Задачи на сегодня
/upcoming — Ближайшие дедлайны
/score <проект> — AI оценка проекта
/add <текст> — Добавить задачи из текста
/wallets — Список кошельков
/help — Справка

🔗 [Открыть приложение](${APP_URL})
  `, { parse_mode: 'Markdown' })
})

// Команда /status
bot.onText(/\/status/, async (msg) => {
  const chatId = msg.chat.id
  
  try {
    const response = await fetch(`${APP_URL}/api/tasks/status`)
    const statuses = await response.json()
    
    const total = Object.keys(statuses).length
    const completed = Object.values(statuses).filter(s => s === 'completed').length
    const progress = total > 0 ? Math.round((completed / total) * 100) : 0

    bot.sendMessage(chatId, `
📊 *Статус фарминга*

✅ Выполнено: ${completed}
⏳ Всего задач: ${total}
📈 Прогресс: ${progress}%

🔥 Стрик: 1 дней
🏆 Уровень: Новичок
    `, { parse_mode: 'Markdown' })
  } catch {
    bot.sendMessage(chatId, '❌ Ошибка получения данных')
  }
})

// Команда /today
bot.onText(/\/today/, async (msg) => {
  const chatId = msg.chat.id

  bot.sendMessage(chatId, `
📋 *Задачи на сегодня*

☐ Бридж ETH через Stargate (LayerZero)
☐ Свап на SyncSwap (zkSync)
☐ Galxe квесты (Monad)

⏰ Дедлайн zkSync: через 2 дня!
  `, { parse_mode: 'Markdown' })
})

// Команда /upcoming
bot.onText(/\/upcoming/, (msg) => {
  const chatId = msg.chat.id

  bot.sendMessage(chatId, `
⏰ *Ближайшие дедлайны*

🔴 *zkSync* — Snapshot через 2 дня
🟡 *LayerZero* — Round 3 через 5 дней
🟢 *Scroll* — Без дедлайна

Не забудьте выполнить задачи!
  `, { parse_mode: 'Markdown' })
})

// Команда /score <проект>
bot.onText(/\/score (.+)/, async (msg, match) => {
  const chatId = msg.chat.id
  const projectName = match[1]

  bot.sendMessage(chatId, `⏳ Оцениваю проект ${projectName}...`)

  try {
    const response = await fetch(`${APP_URL}/api/ai/score-project`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: projectName }),
    })
    
    const data = await response.json()
    
    bot.sendMessage(chatId, `
🎯 *AI Оценка: ${projectName}*

Вероятность: ${data.probability}/100
ROI: $${data.estimatedRewardMin?.toLocaleString()} — $${data.estimatedRewardMax?.toLocaleString()}
Риск: ${data.riskLevel}/10

📝 ${data.summary}
    `, { parse_mode: 'Markdown' })
  } catch {
    bot.sendMessage(chatId, '❌ Ошибка оценки проекта')
  }
})

// Команда /add <текст>
bot.onText(/\/add (.+)/, async (msg, match) => {
  const chatId = msg.chat.id
  const text = match[1]

  bot.sendMessage(chatId, '⏳ Анализирую текст...')

  try {
    const response = await fetch(`${APP_URL}/api/ai/parse-tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    })
    
    const data = await response.json()
    
    let message = `✅ *Распознано задач: ${data.tasks?.length || 0}*\n\n`
    data.tasks?.forEach((task, i) => {
      message += `${i + 1}. ${task.title} [${task.type}]\n`
    })
    message += `\n⏱️ Время: ~${data.estimatedTime} мин`
    
    bot.sendMessage(chatId, message, { parse_mode: 'Markdown' })
  } catch {
    bot.sendMessage(chatId, '❌ Ошибка парсинга задач')
  }
})

// Команда /wallets
bot.onText(/\/wallets/, (msg) => {
  const chatId = msg.chat.id

  bot.sendMessage(chatId, `
💰 *Мои кошельки*

1️⃣ Основной: 0xabc1...def2
   • Проектов: 12 | Завершено: 4
   • LayerZero: 85% | zkSync: 72%

2️⃣ DeFi: 0x789f...abc3
   • Проектов: 5 | Завершено: 1

🔗 [Управление кошельками](${APP_URL}/wallets)
  `, { parse_mode: 'Markdown' })
})

// Команда /help
bot.onText(/\/help/, (msg) => {
  const chatId = msg.chat.id

  bot.sendMessage(chatId, `
📖 *Справка по командам*

/start — Приветствие
/status — Прогресс по проектам
/today — Задачи на сегодня
/upcoming — Ближайшие дедлайны
/score <проект> — AI оценка проекта
/add <текст> — Добавить задачи из текста
/wallets — Список кошельков
/help — Эта справка

🔗 [Открыть приложение](${APP_URL})
  `, { parse_mode: 'Markdown' })
})

console.log('🤖 Crypto Hunter Bot запущен...')
