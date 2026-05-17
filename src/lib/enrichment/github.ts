/**
 * GitHub public API client.
 *
 * Используем для оценки dev-momentum:
 *   - commits за последние 30 дней (sum по веткам via /commits?since=)
 *   - количество contributors (cap=100)
 *
 * Лимит: без токена — 60 req/час с одного IP. С токеном — 5000 req/час.
 * Если положить GITHUB_TOKEN в env, клиент его подхватит.
 *
 * Возвращает null при любых проблемах (404, rate limit, таймаут) —
 * чтобы scoring мог корректно проставить missing_signals.
 */

const TOKEN = process.env.GITHUB_TOKEN || ''
const UA = 'cryptoassist/1.0 (+enrich)'

export interface GitHubRepoMomentum {
  owner: string
  repo: string
  /** Коммитов в default ветке за последние 30 дней. Cap=300, GH ограничивает выдачу. */
  commits_30d: number
  /** Количество contributors (cap=100, верхняя оценка). */
  contributors: number | null
  stars: number | null
  default_branch: string | null
  archived: boolean
  pushed_at: string | null
}

interface RepoLink {
  owner: string
  repo: string
}

/**
 * Парсит GitHub URL вида https://github.com/owner/repo[/...].
 * Возвращает null для невалидных или агрегаторов (organizations).
 */
export function parseGitHubUrl(url: string): RepoLink | null {
  try {
    const u = new URL(url)
    if (u.hostname !== 'github.com' && u.hostname !== 'www.github.com') return null
    const parts = u.pathname.split('/').filter(Boolean)
    if (parts.length < 2) return null
    const [owner, repo] = parts
    if (!owner || !repo) return null
    return { owner, repo: repo.replace(/\.git$/, '') }
  } catch {
    return null
  }
}

async function ghFetch<T>(
  path: string,
  timeoutMs = 10_000,
): Promise<{ data: T | null; status: number }> {
  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), timeoutMs)
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': UA,
  }
  if (TOKEN) headers.Authorization = `Bearer ${TOKEN}`
  try {
    const res = await fetch(`https://api.github.com${path}`, {
      headers,
      signal: controller.signal,
    })
    if (!res.ok) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn(`[github] ${res.status} ${path}`)
      }
      return { data: null, status: res.status }
    }
    return { data: (await res.json()) as T, status: res.status }
  } catch {
    return { data: null, status: 0 }
  } finally {
    clearTimeout(id)
  }
}

interface RepoMeta {
  default_branch: string
  stargazers_count: number
  archived: boolean
  pushed_at: string
}

interface CommitItem {
  sha: string
}

interface ContributorItem {
  login?: string
  contributions?: number
}

export async function fetchRepoMomentum(
  link: RepoLink,
): Promise<GitHubRepoMomentum | null> {
  const { owner, repo } = link

  // 1. meta
  const meta = await ghFetch<RepoMeta>(`/repos/${owner}/${repo}`)
  if (!meta.data) return null

  const since = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString()

  // 2. коммиты за 30 дней (per_page max 100 — cap'нем счётчик в 300 через 3 страницы,
  //    в практике этого хватает чтобы понять «много / мало / средне»).
  let commits30d = 0
  let page = 1
  while (page <= 3) {
    const r = await ghFetch<CommitItem[]>(
      `/repos/${owner}/${repo}/commits?since=${encodeURIComponent(since)}&per_page=100&page=${page}`,
    )
    const items = r.data ?? []
    commits30d += items.length
    if (items.length < 100) break
    page++
  }

  // 3. contributors (anon=false, max 100 — это потолок без пагинации)
  const cont = await ghFetch<ContributorItem[]>(
    `/repos/${owner}/${repo}/contributors?per_page=100&anon=false`,
  )
  const contributors = cont.data ? cont.data.length : null

  return {
    owner,
    repo,
    commits_30d: commits30d,
    contributors,
    stars: meta.data.stargazers_count ?? null,
    default_branch: meta.data.default_branch ?? null,
    archived: !!meta.data.archived,
    pushed_at: meta.data.pushed_at ?? null,
  }
}

/**
 * Из массива github URL'ов выбирает наиболее активный репо и возвращает momentum.
 * Это нужно когда CoinGecko отдаёт несколько репозиториев — берём тот, у которого
 * больше всего коммитов за 30 дней.
 */
export async function pickBestRepoMomentum(
  urls: string[],
): Promise<GitHubRepoMomentum | null> {
  const links = urls
    .map(parseGitHubUrl)
    .filter((l): l is RepoLink => !!l)
    // первые 3 — чтобы не палить rate limit
    .slice(0, 3)

  if (links.length === 0) return null

  let best: GitHubRepoMomentum | null = null
  for (const link of links) {
    const m = await fetchRepoMomentum(link)
    if (!m) continue
    if (!best || m.commits_30d > best.commits_30d) best = m
  }
  return best
}
