// Один раз залогиниться руками и сохранить session для последующего скрейпинга.
// Запуск: node scripts/twitter-login.mjs
//
// Требует: npm install --no-save playwright && npx playwright install chromium

import { chromium } from 'playwright'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const STORAGE_PATH = path.join(__dirname, 'twitter-storage.json')

const browser = await chromium.launch({ headless: false })
const ctx = await browser.newContext()
const page = await ctx.newPage()
await page.goto('https://x.com/login')

console.log('Залогинься в открытом окне. После того как окажешься на /home, нажми Enter в терминале.')
process.stdin.resume()
await new Promise((resolve) => process.stdin.once('data', resolve))

await ctx.storageState({ path: STORAGE_PATH })
console.log('Session сохранена в', STORAGE_PATH)
await browser.close()
process.exit(0)
