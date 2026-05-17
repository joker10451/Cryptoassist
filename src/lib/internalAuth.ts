import type { NextRequest } from 'next/server'

/**
 * Проверка авторизации для server-only роутов (cron, скрейпер, ручные триггеры).
 *
 * Принимаем два варианта заголовков:
 *  - `x-internal-token: <INTERNAL_TOKEN>` — для скрейперов и curl
 *  - `authorization: Bearer <CRON_SECRET>` — формат, который Vercel Cron
 *    использует автоматически, см. vercel.json
 *
 * Если в env нет ни INTERNAL_TOKEN, ни CRON_SECRET — считаем, что аутентификация
 * выключена (полезно в dev). В проде хотя бы одна должна быть задана.
 *
 * Возвращает true если запрос авторизован.
 */
export function isInternalRequestAuthorized(req: NextRequest): boolean {
  const internal = process.env.INTERNAL_TOKEN
  const cron = process.env.CRON_SECRET

  if (!internal && !cron) return true // dev: не настроено — открыто

  const headerToken = req.headers.get('x-internal-token')
  if (internal && headerToken && timingSafeEqual(headerToken, internal)) return true

  const auth = req.headers.get('authorization') || ''
  const m = auth.match(/^Bearer\s+(.+)$/i)
  if (m) {
    const bearer = m[1]
    if (cron && timingSafeEqual(bearer, cron)) return true
    if (internal && timingSafeEqual(bearer, internal)) return true
  }

  return false
}

/**
 * Сравнение строк за константное время — защита от timing-атак.
 * Не используем crypto.timingSafeEqual чтобы код работал и в edge runtime.
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return diff === 0
}
