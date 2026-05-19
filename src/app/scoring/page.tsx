'use client'

import { useEffect, useState } from 'react'
import {
  Radar,
  Sparkles,
  CheckCircle2,
  XCircle,
  Loader2,
  Sliders,
  RefreshCw,
  TrendingUp,
  AlertTriangle,
  Send,
  Inbox,
} from 'lucide-react'
import { GlassCard } from '@/components/ui/GlassCard'
import { Badge } from '@/components/ui/Badge'
import { ProgressBar } from '@/components/ui/ProgressBar'

type Tab = 'detected' | 'outcomes' | 'weights'

interface Detected {
  id: string
  project_name: string
  project_slug: string
  description: string | null
  category: string | null
  confidence: number
  mentions_count: number
  evidence: {
    authors?: string[]
    urls?: string[]
    samples?: string[]
  } | null
  status: string
  first_seen: string
  last_seen: string
}

interface Outcome {
  id: string
  project_id: string | null
  project_name: string
  score_predicted: number
  classification_predicted: string | null
  airdrop_happened: boolean | null
  real_outcome_value_usd: number | null
  user_farmed: boolean | null
  predicted_at: string
  resolved_at: string | null
}

interface CalibrationResult {
  samples: number
  correlations: Record<string, number>
  newWeights: Record<string, number>
  applied: boolean
  reason?: string
}

interface DetectorRunResult {
  signals_processed: number
  batches: number
  candidates_extracted: number
  detected_upserted: number
  reason?: string
}

const COMPONENT_LABELS: Record<string, string> = {
  founding_quality: 'Founding',
  airdrop_likelihood: 'Airdrop',
  farming_accessibility: 'Accessibility',
  market_momentum: 'Momentum',
  signal_freshness: 'Freshness',
  narrative_strength: 'Narrative',
  risk: 'Risk',
}

function formatRelative(iso: string): string {
  const t = new Date(iso).getTime()
  const diff = Date.now() - t
  if (Number.isNaN(t)) return '—'
  const m = Math.round(diff / 60_000)
  if (m < 1) return 'только что'
  if (m < 60) return `${m} мин назад`
  const h = Math.round(m / 60)
  if (h < 24) return `${h} ч назад`
  const d = Math.round(h / 24)
  return `${d} д назад`
}

function classificationColor(c: string | null): 'green' | 'cyan' | 'yellow' | 'red' {
  switch (c) {
    case 'LEGENDARY_ALPHA':
      return 'green'
    case 'HIGH_PRIORITY':
      return 'cyan'
    case 'MEDIUM':
      return 'yellow'
    default:
      return 'red'
  }
}

export default function ScoringPage() {
  const [tab, setTab] = useState<Tab>('detected')

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Radar className="text-cyan-400" size={24} />
        <h1 className="text-2xl font-bold text-text-primary">Scoring v2</h1>
        <span className="text-xs text-text-muted ml-2">
          Детектор alpha, исходы прогнозов, калибровка весов
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {[
          { id: 'detected', label: 'Detected', icon: Sparkles },
          { id: 'outcomes', label: 'Outcomes', icon: TrendingUp },
          { id: 'weights', label: 'Weights', icon: Sliders },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id as Tab)}
            className={`p-3 rounded-xl border text-left transition-all ${
              tab === t.id
                ? 'bg-cyan-500/10 border-cyan-500/30'
                : 'bg-bg-glass border-white/10 hover:border-cyan-500/30'
            }`}
          >
            <t.icon
              size={18}
              className={tab === t.id ? 'text-cyan-400' : 'text-text-muted'}
            />
            <p className="text-sm font-medium text-text-primary mt-1">{t.label}</p>
          </button>
        ))}
      </div>

      {tab === 'detected' && <DetectedTab />}
      {tab === 'outcomes' && <OutcomesTab />}
      {tab === 'weights' && <WeightsTab />}
    </div>
  )
}

// ---------- Detected -------------------------------------------------------

function DetectedTab() {
  const [items, setItems] = useState<Detected[]>([])
  const [status, setStatus] = useState<'pending' | 'approved' | 'rejected'>('pending')
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [runResult, setRunResult] = useState<DetectorRunResult | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  // Manual signals
  const [signalsText, setSignalsText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitResult, setSubmitResult] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    try {
      const res = await fetch(`/api/scoring/detected?status=${status}`)
      const data = await res.json()
      setItems(data.detected ?? [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status])

  async function submitSignals() {
    const raw = signalsText.trim()
    if (!raw) return
    setSubmitting(true)
    setSubmitResult(null)
    try {
      const signals = parseSignalsFromText(raw)
      if (signals.length === 0) {
        setSubmitResult('Не удалось распарсить ни одного сигнала')
        return
      }
      const res = await fetch('/api/scoring/signals', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ signals }),
      })
      const data = await res.json()
      if (res.ok) {
        const skippedNote =
          data.skipped > 0 ? `, отфильтровано как мусор: ${data.skipped}` : ''
        setSubmitResult(
          `Отправлено: ${signals.length}, записано в БД: ${data.inserted}${skippedNote}`,
        )
        setSignalsText('')
      } else {
        setSubmitResult(`Ошибка: ${data.error || 'unknown'}`)
      }
    } catch (err) {
      setSubmitResult(`Ошибка: ${(err as Error).message}`)
    } finally {
      setSubmitting(false)
    }
  }

  async function runDetector() {
    setRunning(true)
    setRunResult(null)
    try {
      const res = await fetch('/api/scoring/detect', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sinceHours: 48 }),
      })
      const data = await res.json()
      setRunResult(data)
      await load()
    } finally {
      setRunning(false)
    }
  }

  async function review(id: string, action: 'approve' | 'reject') {
    setBusyId(id)
    try {
      await fetch('/api/scoring/detected', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id, action }),
      })
      await load()
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="space-y-4">
      <GlassCard>
        <div className="flex items-start gap-2 mb-3">
          <Inbox size={16} className="text-cyan-400 shrink-0 mt-0.5" />
          <div className="text-xs text-text-secondary leading-relaxed">
            Вставь интересные крипто-посты — каждый твит/пост с новой строки или
            разделяй <code className="text-cyan-300">---</code>. Можно вставлять X-ссылку — id
            возьмём из URL автоматически. Сначала срабатывает keyword-фильтр
            (airdrop / testnet / points / quest / galxe / layer3 и т.п.), мусор отбрасывается до БД.
            После загрузки — жми «Запустить детектор», чтобы AI извлёк проекты.
          </div>
        </div>

        <textarea
          value={signalsText}
          onChange={(e) => setSignalsText(e.target.value)}
          placeholder={'@megaeth_l2 launches incentivized testnet, points start now\nhttps://x.com/megaeth_l2/status/1234567890\n---\n@hyperlane new airdrop campaign on Galxe...'}
          rows={6}
          className="w-full px-3 py-2 bg-bg-tertiary border border-white/10 rounded-md text-sm font-mono placeholder:text-text-muted focus:outline-none focus:border-cyan-500/50 resize-y"
        />

        <div className="mt-2 flex items-center gap-3">
          <button
            onClick={submitSignals}
            disabled={submitting || !signalsText.trim()}
            className="flex items-center gap-2 px-3 py-1.5 rounded-md text-xs bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 hover:bg-cyan-500/25 transition-colors disabled:opacity-50"
          >
            {submitting ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
            Загрузить сигналы
          </button>
          {submitResult && (
            <span className="text-xs text-text-muted">{submitResult}</span>
          )}
        </div>
      </GlassCard>

      <GlassCard>
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={runDetector}
            disabled={running}
            className="flex items-center gap-2 px-4 py-2 bg-purple-500 text-white rounded-md hover:bg-purple-400 transition-colors disabled:opacity-50 text-sm"
          >
            {running ? (
              <>
                <Loader2 size={14} className="animate-spin" /> Запуск...
              </>
            ) : (
              <>
                <Sparkles size={14} /> Запустить детектор
              </>
            )}
          </button>

          <div className="flex items-center gap-1 ml-auto">
            {(['pending', 'approved', 'rejected'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatus(s)}
                className={`px-3 py-1.5 rounded-md text-xs transition-colors ${
                  status === s
                    ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30'
                    : 'text-text-muted hover:text-text-primary border border-transparent'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {runResult && (
          <div className="mt-3 p-3 rounded-md bg-bg-tertiary border border-white/10 text-xs text-text-secondary font-mono space-y-0.5">
            {runResult.reason ? (
              <p className="text-yellow-400">⚠ {runResult.reason}</p>
            ) : (
              <>
                <p>signals_processed: {runResult.signals_processed}</p>
                <p>batches: {runResult.batches}</p>
                <p>candidates_extracted: {runResult.candidates_extracted}</p>
                <p>detected_upserted: {runResult.detected_upserted}</p>
              </>
            )}
          </div>
        )}
      </GlassCard>

      {loading && (
        <p className="text-sm text-text-muted px-1">Загрузка...</p>
      )}

      {!loading && items.length === 0 && (
        <GlassCard>
          <p className="text-sm text-text-muted">
            Пусто. Сначала забей <code className="text-cyan-300">raw_signals</code> через
            скрейпер, потом запусти детектор.
          </p>
        </GlassCard>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {items.map((it) => (
          <GlassCard key={it.id} glowOnHover={false}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-base font-semibold text-text-primary truncate">
                    {it.project_name}
                  </span>
                  {it.category && <Badge variant="cyan">{it.category}</Badge>}
                </div>
                <p className="text-xs text-text-muted font-mono">{it.project_slug}</p>
                {it.description && (
                  <p className="text-xs text-text-secondary mt-1 line-clamp-2">
                    {it.description}
                  </p>
                )}
              </div>
              <div className="text-right shrink-0">
                <p className="text-xl font-bold text-cyan-400 font-mono">{it.confidence}</p>
                <p className="text-[10px] text-text-muted">confidence</p>
              </div>
            </div>

            <div className="mt-2 flex items-center gap-3 text-[11px] text-text-muted">
              <span>mentions: {it.mentions_count}</span>
              <span>·</span>
              <span>{formatRelative(it.last_seen)}</span>
            </div>

            {it.evidence?.authors && it.evidence.authors.length > 0 && (
              <p className="mt-1 text-[11px] text-text-muted truncate">
                {it.evidence.authors.slice(0, 3).join(', ')}
                {it.evidence.authors.length > 3 ? `, +${it.evidence.authors.length - 3}` : ''}
              </p>
            )}

            {it.evidence?.samples && it.evidence.samples.length > 0 && (
              <details className="mt-2">
                <summary className="cursor-pointer text-[11px] text-text-muted hover:text-cyan-400">
                  показать сэмплы ({it.evidence.samples.length})
                </summary>
                <div className="mt-1 space-y-1">
                  {it.evidence.samples.slice(0, 3).map((s, i) => (
                    <p
                      key={i}
                      className="text-[11px] text-text-secondary p-2 rounded bg-white/5 line-clamp-3"
                    >
                      {s}
                    </p>
                  ))}
                </div>
              </details>
            )}

            {status === 'pending' && (
              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => review(it.id, 'approve')}
                  disabled={busyId === it.id}
                  className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 bg-green-500/15 text-green-400 rounded-md border border-green-500/30 hover:bg-green-500/25 transition-colors disabled:opacity-50 text-xs"
                >
                  <CheckCircle2 size={12} /> Approve → projects
                </button>
                <button
                  onClick={() => review(it.id, 'reject')}
                  disabled={busyId === it.id}
                  className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 bg-red-500/10 text-red-400 rounded-md border border-red-500/20 hover:bg-red-500/20 transition-colors disabled:opacity-50 text-xs"
                >
                  <XCircle size={12} /> Reject
                </button>
              </div>
            )}
          </GlassCard>
        ))}
      </div>
    </div>
  )
}

// ---------- Outcomes -------------------------------------------------------

function OutcomesTab() {
  const [items, setItems] = useState<Outcome[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'open' | 'resolved'>('open')
  const [bulkBusy, setBulkBusy] = useState<'hit' | 'miss' | null>(null)

  async function load() {
    setLoading(true)
    try {
      const res = await fetch('/api/scoring/outcomes')
      const data = await res.json()
      setItems(data.outcomes ?? [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const filtered = items.filter((o) => {
    if (filter === 'open') return !o.resolved_at
    if (filter === 'resolved') return !!o.resolved_at
    return true
  })

  async function resolve(
    id: string,
    payload: { airdrop_happened?: boolean; real_outcome_value_usd?: number; user_farmed?: boolean },
  ) {
    setBusyId(id)
    try {
      await fetch('/api/scoring/outcomes', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id, ...payload }),
      })
      await load()
    } finally {
      setBusyId(null)
    }
  }

  async function bulkResolve(action: 'hit' | 'miss') {
    const open = items.filter((o) => !o.resolved_at)
    if (open.length === 0) return
    if (!confirm(`Закрыть ${open.length} прогнозов как ${action === 'hit' ? 'hit' : 'miss'}?`)) return
    setBulkBusy(action)
    try {
      await Promise.all(
        open.map((o) =>
          fetch('/api/scoring/outcomes', {
            method: 'PATCH',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              id: o.id,
              airdrop_happened: action === 'hit',
              user_farmed: action === 'hit' ? true : undefined,
            }),
          }),
        ),
      )
      await load()
    } finally {
      setBulkBusy(null)
    }
  }

  const openCount = items.filter((o) => !o.resolved_at).length
  const resolvedCount = items.length - openCount
  const hits = items.filter((o) => o.airdrop_happened === true).length
  const misses = items.filter((o) => o.airdrop_happened === false).length

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <GlassCard glowOnHover={false}>
          <p className="text-xs text-text-muted">Всего прогнозов</p>
          <p className="text-2xl font-bold text-text-primary font-mono">{items.length}</p>
        </GlassCard>
        <GlassCard glowOnHover={false}>
          <p className="text-xs text-text-muted">Открыто</p>
          <p className="text-2xl font-bold text-cyan-400 font-mono">{openCount}</p>
        </GlassCard>
        <GlassCard glowOnHover={false}>
          <p className="text-xs text-text-muted">Hits</p>
          <p className="text-2xl font-bold text-green-400 font-mono">{hits}</p>
        </GlassCard>
        <GlassCard glowOnHover={false}>
          <p className="text-xs text-text-muted">Misses</p>
          <p className="text-2xl font-bold text-red-400 font-mono">{misses}</p>
        </GlassCard>
      </div>

      <GlassCard>
        <div className="flex items-center gap-1 mb-3 flex-wrap">
          {(['open', 'resolved', 'all'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-md text-xs transition-colors ${
                filter === f
                  ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30'
                  : 'text-text-muted hover:text-text-primary border border-transparent'
              }`}
            >
              {f}
            </button>
          ))}
          {filter === 'open' && openCount > 0 && (
            <div className="flex items-center gap-1 ml-2">
              <button
                onClick={() => bulkResolve('hit')}
                disabled={bulkBusy !== null}
                className="px-2 py-1 text-[11px] rounded bg-green-500/15 text-green-400 border border-green-500/30 hover:bg-green-500/25 transition-colors disabled:opacity-50"
                title={`Закрыть все ${openCount} как hit`}
              >
                {bulkBusy === 'hit' ? '...' : `все hit (${openCount})`}
              </button>
              <button
                onClick={() => bulkResolve('miss')}
                disabled={bulkBusy !== null}
                className="px-2 py-1 text-[11px] rounded bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-colors disabled:opacity-50"
                title={`Закрыть все ${openCount} как miss`}
              >
                {bulkBusy === 'miss' ? '...' : `все miss (${openCount})`}
              </button>
            </div>
          )}
          <span className="text-xs text-text-muted ml-auto">
            resolved: {resolvedCount} (нужно ≥ 8 для калибровки)
          </span>
        </div>

        {loading && <p className="text-sm text-text-muted">Загрузка...</p>}
        {!loading && filtered.length === 0 && (
          <p className="text-sm text-text-muted">
            Нет записей. Прогнозы попадают сюда, когда вызываешь
            <code className="text-cyan-300 mx-1">/api/ai/score-project</code>
            с <code className="text-cyan-300">projectId</code>.
          </p>
        )}

        <div className="space-y-2">
          {filtered.map((o) => (
            <div
              key={o.id}
              className="p-3 rounded-md bg-bg-tertiary border border-white/10 flex flex-col md:flex-row md:items-center gap-3"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-text-primary truncate">
                    {o.project_name}
                  </span>
                  {o.classification_predicted && (
                    <Badge variant={classificationColor(o.classification_predicted)}>
                      {o.classification_predicted}
                    </Badge>
                  )}
                </div>
                <p className="text-[11px] text-text-muted">
                  predicted {formatRelative(o.predicted_at)}
                  {o.resolved_at && ` · resolved ${formatRelative(o.resolved_at)}`}
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <span className="text-base font-bold text-cyan-400 font-mono w-10 text-right">
                  {o.score_predicted}
                </span>

                {o.resolved_at ? (
                  <Badge variant={o.airdrop_happened ? 'green' : 'red'}>
                    {o.airdrop_happened
                      ? `airdrop${o.real_outcome_value_usd ? ` $${o.real_outcome_value_usd}` : ''}`
                      : 'no airdrop'}
                  </Badge>
                ) : (
                  <div className="flex gap-1">
                    <button
                      onClick={() =>
                        resolve(o.id, { airdrop_happened: true, user_farmed: true })
                      }
                      disabled={busyId === o.id}
                      className="px-2 py-1 text-[11px] rounded bg-green-500/15 text-green-400 border border-green-500/30 hover:bg-green-500/25 transition-colors disabled:opacity-50"
                      title="Аирдроп был"
                    >
                      hit
                    </button>
                    <button
                      onClick={() => resolve(o.id, { airdrop_happened: false })}
                      disabled={busyId === o.id}
                      className="px-2 py-1 text-[11px] rounded bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-colors disabled:opacity-50"
                      title="Аирдропа не было"
                    >
                      miss
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </GlassCard>
    </div>
  )
}

// ---------- Weights / Calibration -----------------------------------------

function WeightsTab() {
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<CalibrationResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function calibrate(dryRun: boolean) {
    setRunning(true)
    setError(null)
    setResult(null)
    try {
      const res = await fetch('/api/scoring/calibrate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ dryRun }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'ошибка')
      } else {
        setResult(data)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ошибка')
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="space-y-4">
      <GlassCard>
        <div className="flex items-start gap-2">
          <AlertTriangle size={16} className="text-yellow-400 shrink-0 mt-0.5" />
          <div className="text-xs text-text-secondary">
            Калибратор смотрит resolved-исходы из вкладки Outcomes и пересчитывает
            веса по корреляциям компонентов с фактом аирдропа. Минимум 8 закрытых
            прогнозов. Применённые веса сразу влияют на новые скоры.
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            onClick={() => calibrate(true)}
            disabled={running}
            className="flex items-center gap-2 px-3 py-1.5 rounded-md text-xs bg-white/5 text-text-primary border border-white/10 hover:bg-white/10 transition-colors disabled:opacity-50"
          >
            {running ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <RefreshCw size={12} />
            )}
            Dry run
          </button>
          <button
            onClick={() => calibrate(false)}
            disabled={running}
            className="flex items-center gap-2 px-3 py-1.5 rounded-md text-xs bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 hover:bg-cyan-500/25 transition-colors disabled:opacity-50"
          >
            {running ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <Sliders size={12} />
            )}
            Калибровать и применить
          </button>
        </div>

        {error && (
          <p className="mt-3 text-xs text-red-400">{error}</p>
        )}
      </GlassCard>

      {result && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <GlassCard glowOnHover={false}>
            <h3 className="text-sm font-semibold text-text-primary mb-2">
              Сводка
            </h3>
            <div className="text-xs text-text-secondary font-mono space-y-1">
              <p>samples: {result.samples}</p>
              <p>
                applied:{' '}
                {result.applied ? (
                  <span className="text-green-400">yes</span>
                ) : (
                  <span className="text-yellow-400">no</span>
                )}
              </p>
              {result.reason && <p className="text-yellow-400">{result.reason}</p>}
            </div>
          </GlassCard>

          <GlassCard glowOnHover={false}>
            <h3 className="text-sm font-semibold text-text-primary mb-2">
              Корреляции компонентов
            </h3>
            <div className="space-y-2">
              {Object.entries(result.correlations).map(([key, val]) => {
                const v = Number(val) || 0
                const pct = Math.min(100, Math.abs(v) * 100)
                const color: 'green' | 'red' | 'yellow' =
                  v > 0.2 ? 'green' : v < -0.2 ? 'red' : 'yellow'
                return (
                  <div key={key}>
                    <div className="flex items-center justify-between text-[11px] text-text-secondary">
                      <span>{COMPONENT_LABELS[key] ?? key}</span>
                      <span className="font-mono">{v.toFixed(2)}</span>
                    </div>
                    <ProgressBar progress={pct} color={color} />
                  </div>
                )
              })}
            </div>
          </GlassCard>

          <GlassCard glowOnHover={false} className="md:col-span-2">
            <h3 className="text-sm font-semibold text-text-primary mb-2">
              Новые веса
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {Object.entries(result.newWeights).map(([key, val]) => (
                <div
                  key={key}
                  className="p-2 rounded-md bg-bg-tertiary border border-white/10"
                >
                  <p className="text-[10px] text-text-muted">
                    {COMPONENT_LABELS[key] ?? key}
                  </p>
                  <p className="text-lg font-bold text-text-primary font-mono">
                    {Number(val).toFixed(3)}
                  </p>
                </div>
              ))}
            </div>
          </GlassCard>
        </div>
      )}
    </div>
  )
}


// ---------- Helpers -------------------------------------------------------

interface ParsedSignal {
  source: 'manual'
  external_id?: string
  author?: string
  content: string
  url?: string
}

const X_URL_RE = /https?:\/\/(?:twitter\.com|x\.com)\/([^/\s]+)\/status\/(\d+)/i

/**
 * Парсит произвольный текст в массив ParsedSignal:
 *  - Разделители: `---` на отдельной строке ИЛИ две и более пустых строк.
 *  - Если в блоке есть X-URL — author и external_id берутся из него.
 *  - Если в блоке только URL без текста — пропускаем (ничего скармливать AI).
 *  - Полный JSON-массив тоже понимаем (для копи-пейста из других тулов).
 */
function parseSignalsFromText(raw: string): ParsedSignal[] {
  // 1. JSON-массив целиком
  const trimmed = raw.trim()
  if (trimmed.startsWith('[')) {
    try {
      const arr = JSON.parse(trimmed) as Array<Record<string, unknown>>
      if (Array.isArray(arr)) {
        return arr
          .filter(
            (a) => a && typeof a === 'object' && typeof (a as { content?: unknown }).content === 'string',
          )
          .map((a) => ({
            source: 'manual' as const,
            content: String((a as { content: string }).content).slice(0, 4000),
            external_id:
              typeof (a as { external_id?: unknown }).external_id === 'string'
                ? String((a as { external_id: string }).external_id)
                : undefined,
            author:
              typeof (a as { author?: unknown }).author === 'string'
                ? String((a as { author: string }).author)
                : undefined,
            url:
              typeof (a as { url?: unknown }).url === 'string'
                ? String((a as { url: string }).url)
                : undefined,
          }))
      }
    } catch {
      // не JSON — обрабатываем как plain text дальше
    }
  }

  // 2. Plain text: блоки разделяем "---" или \n\n+
  const blocks = raw
    .split(/^\s*---+\s*$|\n{2,}/m)
    .map((b) => b.trim())
    .filter((b) => b.length > 0)

  const signals: ParsedSignal[] = []
  for (const block of blocks) {
    let content = block
    let external_id: string | undefined
    let author: string | undefined
    let url: string | undefined

    const m = block.match(X_URL_RE)
    if (m) {
      author = m[1]
      external_id = m[2]
      url = m[0]
      // Если block состоит только из URL — пропускаем, нечего отдавать AI.
      const withoutUrl = block.replace(X_URL_RE, '').trim()
      if (withoutUrl.length === 0) continue
      content = withoutUrl
    }

    if (content.length < 8) continue
    signals.push({
      source: 'manual',
      external_id,
      author,
      content: content.slice(0, 4000),
      url,
    })
  }
  return signals
}
