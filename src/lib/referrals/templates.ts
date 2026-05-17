/**
 * Шаблоны постов для реф-ссылок.
 *
 * Источник истины — xaccount/content/crypto_referral_system.md
 * (приватный submodule). Здесь — рантайм-копия, чтобы не тащить
 * парсинг markdown в bundle и не открывать submodule наружу.
 *
 * Если правишь шаблоны в xaccount/, синхронизируй сюда.
 */

export type TemplateId = 'alpha_drop' | 'fomo_proof' | 'philosophy' | 'thread'

export interface Template {
  id: TemplateId
  label: string
  hint: string
  /**
   * Плейсхолдеры:
   *   {project} — название проекта
   *   {feature} — короткая фича/преимущество
   *   {ref}     — реферальная ссылка
   *   {time}    — как давно фармишь (для fomo_proof)
   *   {result}  — текущий результат (для fomo_proof)
   *   {timeframe} — через сколько CT обнаружит (для fomo_proof)
   *   {points} — массив буллетов для thread (по строкам)
   */
  body: string
}

export const TEMPLATES: Template[] = [
  {
    id: 'alpha_drop',
    label: 'Early Alpha Drop',
    hint: 'Главный шаблон: тихая аудитория, реф в конце.',
    body: `most people wait for CT to shill. by then the snapshot is done.

{project} has {feature}. i'm already farming.

if you want in early — link below. we scale together.

{ref}`,
  },
  {
    id: 'fomo_proof',
    label: 'FOMO + Proof',
    hint: 'Подходит когда уже фармишь и есть результат.',
    body: `been farming {project} for {time}. {result}.

CT will discover this in {timeframe}. by then the multipliers will be gone.

early link for those who move fast:

{ref}`,
  },
  {
    id: 'philosophy',
    label: 'Philosophy + Crypto',
    hint: 'Бренд-войс ZeroFilter, без мольбы.',
    body: `the Void doesn't reward hesitation.

{project} is {feature}. most will watch from sidelines.

i farm. i share. i don't beg.

link if you're ready:

{ref}`,
  },
  {
    id: 'thread',
    label: 'Thread (Deep Dive)',
    hint: 'Раз в неделю. {points} = по строке на буллет.',
    body: `{project} might be the most underrated play right now.

here's why i'm farming it + how to maximize points:

{points}

ref link for those who want in: {ref}`,
  },
]

export interface RenderInputs {
  project: string
  feature?: string
  ref?: string
  time?: string
  result?: string
  timeframe?: string
  points?: string[]
}

/**
 * Подставить переменные в тело шаблона. Безопасно по отношению к
 * отсутствующим полям — оставляем плейсхолдер пустым (а не "undefined").
 */
export function renderTemplate(id: TemplateId, inputs: RenderInputs): string {
  const tpl = TEMPLATES.find((t) => t.id === id)
  if (!tpl) throw new Error(`Unknown template: ${id}`)

  const points = (inputs.points ?? [])
    .filter(Boolean)
    .map((p, i) => `${i + 1}/ ${p.trim()}`)
    .join('\n')

  const map: Record<string, string> = {
    project: inputs.project ?? '',
    feature: inputs.feature ?? '',
    ref: inputs.ref ?? '',
    time: inputs.time ?? '',
    result: inputs.result ?? '',
    timeframe: inputs.timeframe ?? '',
    points,
  }

  return tpl.body.replace(/\{(\w+)\}/g, (_, key: string) => map[key] ?? '')
}

/**
 * Простая валидация для UI: длина в символах, длина в "twitter chars"
 * (ссылки = 23 символа независимо от длины).
 */
export function twitterLength(text: string): number {
  // Заменяем https?:\/\/... на 23 символа.
  const collapsed = text.replace(/https?:\/\/\S+/g, 'x'.repeat(23))
  return collapsed.length
}
