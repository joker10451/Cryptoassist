/**
 * Telegram Bot API — минимальный клиент для отправки алертов.
 *
 * Env:
 *   TELEGRAM_BOT_TOKEN — токен бота (от @BotFather)
 *   TELEGRAM_CHAT_ID   — id чата/канала куда слать (число или @username)
 *
 * Если переменные не заданы — sendAlert тихо возвращает false.
 */

const BOT_TOKEN = () => process.env.TELEGRAM_BOT_TOKEN || ''
const CHAT_ID = () => process.env.TELEGRAM_CHAT_ID || ''

export interface TelegramAlert {
  text: string
  /** Если true — парсим как HTML (жирный, курсив, ссылки). По умолчанию plain. */
  html?: boolean
  /** Отключить превью ссылок. */
  disablePreview?: boolean
}

/**
 * Отправить сообщение в Telegram. Не бросает — логирует ошибки.
 * Возвращает true если отправлено.
 */
export async function sendTelegramAlert(alert: TelegramAlert): Promise<boolean> {
  const token = BOT_TOKEN()
  const chatId = CHAT_ID()
  if (!token || !chatId) return false

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: alert.text,
        parse_mode: alert.html ? 'HTML' : undefined,
        disable_web_page_preview: alert.disablePreview ?? true,
      }),
    })
    if (!res.ok) {
      const err = await res.text().catch(() => '')
      console.warn('[telegram] send failed:', res.status, err.slice(0, 200))
      return false
    }
    return true
  } catch (err) {
    console.warn('[telegram] exception:', err)
    return false
  }
}

// --- Готовые форматы алертов ---

export function formatDetectedAlert(projects: { name: string; confidence: number; slug: string }[]): string {
  const lines = projects.map(
    (p) => `• <b>${p.name}</b> (${p.confidence}%) — /scoring → approve`,
  )
  return `🔍 <b>AI Detector: новые кандидаты</b>\n\n${lines.join('\n')}\n\nОткрой /scoring → Detected для review.`
}

export function formatDeadlineAlert(projects: { name: string; deadline: string; slug: string }[]): string {
  const lines = projects.map(
    (p) => `• <b>${p.name}</b> — дедлайн ${p.deadline}`,
  )
  return `⏰ <b>Дедлайны ≤72ч</b>\n\n${lines.join('\n')}\n\nНе пропусти snapshot/claim.`
}

export function formatCalibrationAlert(samples: number, applied: boolean): string {
  return applied
    ? `⚖️ <b>Калибровка весов</b>\nПрименена на ${samples} outcomes. Новые скоры будут точнее.`
    : `⚖️ <b>Калибровка</b>\nНедостаточно данных (${samples} outcomes, нужно ≥8).`
}
