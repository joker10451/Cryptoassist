// Скрейпит /search?q=<keyword>&f=live на x.com через сохранённую сессию.
// Отправляет найденные твиты пачкой в /api/scoring/signals.
//
// Запуск:
//   NEXT_PUBLIC_API_URL=http://localhost:3000 \
//   INTERNAL_TOKEN=... \
//   node scripts/scrape-twitter.mjs

import { chromium } from 'playwright'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const STORAGE_PATH = path.join(__dirname, 'twitter-storage.json')

const KEYWORDS = [
  'airdrop',
  'testnet',
  'retroactive',
  'snapshot',
  'points program',
  'galxe campaign',
  'layer3 quest',
]

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000'
const TOKEN = process.env.INTERNAL_TOKEN

const MAX_TWEETS_PER_KEYWORD = 30
const SCROLL_DELAY_MS = 1500

async function main() {
  const browser = await chromium.launch({ headless: true })
  let ctx
  try {
    ctx = await browser.newContext({ storageState: STORAGE_PATH })
  } catch {
    console.error('Нет файла session. Сначала запусти: node scripts/twitter-login.mjs')
    await browser.close()
    process.exit(1)
  }

  const page = await ctx.newPage()
  /** @type {Array<{source:'twitter',external_id:string,author?:string,content:string,url?:string}>} */
  const all = []

  for (const kw of KEYWORDS) {
    console.log(`[scrape] keyword: ${kw}`)
    await page.goto(`https://x.com/search?q=${encodeURIComponent(kw)}&src=typed_query&f=live`, {
      waitUntil: 'domcontentloaded',
    })
    await page.waitForTimeout(3000)

    const seen = new Set()
    for (let i = 0; i < 6 && seen.size < MAX_TWEETS_PER_KEYWORD; i++) {
      const batch = await page.$$eval('article', (nodes) =>
        nodes.map((n) => {
          const text = /** @type {HTMLElement} */ (n).innerText || ''
          const link = n.querySelector('a[href*="/status/"]')
          const href = link ? link.getAttribute('href') : null
          const author = n.querySelector('[data-testid="User-Name"]')
          return {
            text,
            href,
            author: author ? /** @type {HTMLElement} */ (author).innerText.split('\n')[0] : null,
          }
        }),
      )

      for (const t of batch) {
        if (!t.href) continue
        const id = t.href.split('/status/')[1]?.split('?')[0]
        if (!id || seen.has(id)) continue
        seen.add(id)
        all.push({
          source: 'twitter',
          external_id: id,
          author: t.author ?? undefined,
          content: t.text,
          url: `https://x.com${t.href}`,
        })
      }

      await page.mouse.wheel(0, 4000)
      await page.waitForTimeout(SCROLL_DELAY_MS)
    }
    console.log(`  +${seen.size} tweets`)
  }

  await browser.close()
  console.log(`[scrape] total raw: ${all.length}`)

  if (all.length === 0) return

  const headers = { 'content-type': 'application/json' }
  if (TOKEN) headers['x-internal-token'] = TOKEN

  // Шлём пачкой по 100, чтобы не перегружать Supabase upsert
  for (let i = 0; i < all.length; i += 100) {
    const chunk = all.slice(i, i + 100)
    const res = await fetch(`${API_URL}/api/scoring/signals`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ signals: chunk }),
    })
    const body = await res.json().catch(() => ({}))
    console.log(`[scrape] sent ${chunk.length} → ${res.status}`, body)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
