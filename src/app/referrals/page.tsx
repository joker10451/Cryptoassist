'use client'

import { useEffect, useMemo, useState, useCallback } from 'react'
import { Link2, Sparkles, Copy, Save, ExternalLink, AtSign, CheckCircle2, Plus, Users, Flame } from 'lucide-react'
import { GlassCard } from '@/components/ui/GlassCard'
import { Badge } from '@/components/ui/Badge'
import { TEMPLATES, twitterLength, type TemplateId } from '@/lib/referrals/templates'

interface RefProject {
  id: string
  name: string
  slug: string
  category: string | null
  token_status: string | null
  probability_score: number | null
  referral_url: string | null
  referral_code: string | null
  referral_notes: string | null
}

export default function ReferralsPage() {
  const [projects, setProjects] = useState<RefProject[]>([])
  const [loading, setLoading] = useState(true)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [refDraft, setRefDraft] = useState({ url: '', code: '', notes: '' })
  const [saving, setSaving] = useState(false)

  const [tplId, setTplId] = useState<TemplateId>('alpha_drop')
  const [feature, setFeature] = useState('')
  const [time, setTime] = useState('')
  const [result, setResult] = useState('')
  const [timeframe, setTimeframe] = useState('')
  const [pointsRaw, setPointsRaw] = useState('')
  const [generated, setGenerated] = useState<string | null>(null)
  const [genStatus, setGenStatus] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)

  const active = useMemo(() => projects.find((p) => p.id === activeId) ?? null, [projects, activeId])

  async function loadProjects() {
    setLoading(true)
    try {
      const res = await fetch('/api/referrals')
      const data = await res.json()
      setProjects(data.projects ?? [])
      if (!activeId && data.projects?.[0]) {
        setActiveId(data.projects[0].id)
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadProjects()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!active) return
    setRefDraft({
      url: active.referral_url ?? '',
      code: active.referral_code ?? '',
      notes: active.referral_notes ?? '',
    })
    setGenerated(null)
    setGenStatus(null)
  }, [activeId, active])

  async function saveRef() {
    if (!active) return
    setSaving(true)
    try {
      const res = await fetch('/api/referrals', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          project_id: active.id,
          referral_url: refDraft.url.trim(),
          referral_code: refDraft.code.trim(),
          referral_notes: refDraft.notes.trim(),
        }),
      })
      if (res.ok) await loadProjects()
    } finally {
      setSaving(false)
    }
  }

  async function generatePost() {
    if (!active) return
    if (!active.referral_url) {
      setGenStatus('Сначала сохрани referral_url для проекта')
      return
    }
    setGenerating(true)
    setGenStatus(null)
    try {
      const points = pointsRaw
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean)

      const res = await fetch('/api/referrals/posts', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          project_id: active.id,
          template_id: tplId,
          inputs: { feature, time, result, timeframe, points },
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setGenStatus(`Ошибка: ${data.error || 'не удалось'}${data.body ? `\n\n${data.body}` : ''}`)
      } else {
        setGenerated(data.body)
        setGenStatus('Сохранено как draft')
      }
    } finally {
      setGenerating(false)
    }
  }

  const tpl = TEMPLATES.find((t) => t.id === tplId)!
  const charCount = generated ? twitterLength(generated) : 0

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <AtSign className="text-cyan-400" size={24} />
        <h1 className="text-2xl font-bold text-text-primary">Реф-кампании</h1>
        <span className="text-xs text-text-muted ml-2">Шаблоны и реф-ссылки для X-аккаунта</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6">
        {/* Projects list */}
        <GlassCard>
          <h2 className="text-sm font-semibold text-text-primary mb-3 flex items-center gap-2">
            <Link2 size={16} />
            Проекты ({projects.length})
          </h2>
          <div className="space-y-1 max-h-[600px] overflow-y-auto pr-1">
            {loading && <p className="text-xs text-text-muted">Загрузка...</p>}
            {!loading &&
              projects.map((p) => {
                const isActive = p.id === activeId
                const hasRef = !!p.referral_url
                return (
                  <button
                    key={p.id}
                    onClick={() => setActiveId(p.id)}
                    className={`w-full text-left px-3 py-2 rounded-lg transition-all border ${
                      isActive
                        ? 'bg-cyan-500/10 border-cyan-500/30'
                        : 'bg-white/0 border-transparent hover:bg-white/5'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-text-primary truncate flex-1">
                        {p.name}
                      </span>
                      {hasRef ? (
                        <span className="text-[10px] text-green-400 font-mono">REF</span>
                      ) : (
                        <span className="text-[10px] text-text-muted">—</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[11px] text-text-muted">{p.category ?? 'other'}</span>
                      {typeof p.probability_score === 'number' && (
                        <span className="text-[11px] text-text-muted ml-auto">
                          {p.probability_score}
                        </span>
                      )}
                    </div>
                  </button>
                )
              })}
          </div>
        </GlassCard>

        {/* Editor */}
        <div className="space-y-6">
          <GlassCard>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-text-primary">
                {active ? active.name : 'Выбери проект'}
              </h2>
              {active && (
                <div className="flex items-center gap-2">
                  {active.token_status && <Badge variant="purple">{active.token_status}</Badge>}
                  <Badge variant="cyan">{active.category ?? 'other'}</Badge>
                </div>
              )}
            </div>

            {active && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-text-muted block mb-1">Реф-ссылка</label>
                  <input
                    type="url"
                    value={refDraft.url}
                    onChange={(e) => setRefDraft({ ...refDraft, url: e.target.value })}
                    placeholder="https://project.xyz/?ref=xxxxx"
                    className="w-full px-3 py-1.5 bg-bg-tertiary border border-white/10 rounded-md text-sm focus:outline-none focus:border-cyan-500/50"
                  />
                </div>
                <div>
                  <label className="text-xs text-text-muted block mb-1">Код (опционально)</label>
                  <input
                    type="text"
                    value={refDraft.code}
                    onChange={(e) => setRefDraft({ ...refDraft, code: e.target.value })}
                    placeholder="ABC123"
                    className="w-full px-3 py-1.5 bg-bg-tertiary border border-white/10 rounded-md text-sm focus:outline-none focus:border-cyan-500/50"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="text-xs text-text-muted block mb-1">Заметки</label>
                  <input
                    type="text"
                    value={refDraft.notes}
                    onChange={(e) => setRefDraft({ ...refDraft, notes: e.target.value })}
                    placeholder="Условия, бонус, дедлайн..."
                    className="w-full px-3 py-1.5 bg-bg-tertiary border border-white/10 rounded-md text-sm focus:outline-none focus:border-cyan-500/50"
                  />
                </div>
                <div className="md:col-span-2 flex items-center gap-3">
                  <button
                    onClick={saveRef}
                    disabled={saving}
                    className="flex items-center gap-2 px-3 py-1.5 bg-cyan-500/15 text-cyan-300 rounded-md border border-cyan-500/30 hover:bg-cyan-500/25 transition-colors disabled:opacity-50 text-sm"
                  >
                    <Save size={14} /> Сохранить
                  </button>
                  {active.referral_url && (
                    <a
                      href={active.referral_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-text-muted hover:text-cyan-400 flex items-center gap-1"
                    >
                      открыть <ExternalLink size={12} />
                    </a>
                  )}
                </div>
              </div>
            )}
          </GlassCard>

          {active && (
            <GlassCard>
              <h2 className="text-sm font-semibold text-text-primary mb-3 flex items-center gap-2">
                <Sparkles size={16} className="text-purple-400" />
                Сгенерировать пост
              </h2>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
                {TEMPLATES.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setTplId(t.id)}
                    className={`p-2 rounded-lg border text-left transition-all ${
                      tplId === t.id
                        ? 'bg-purple-500/10 border-purple-500/30'
                        : 'bg-white/0 border-white/10 hover:border-purple-500/30'
                    }`}
                  >
                    <p className="text-xs font-medium text-text-primary">{t.label}</p>
                    <p className="text-[10px] text-text-muted leading-tight mt-0.5">{t.hint}</p>
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-text-muted block mb-1">
                    feature — что классного у проекта
                  </label>
                  <input
                    type="text"
                    value={feature}
                    onChange={(e) => setFeature(e.target.value)}
                    placeholder="points system + no token"
                    className="w-full px-3 py-1.5 bg-bg-tertiary border border-white/10 rounded-md text-sm focus:outline-none focus:border-purple-500/50"
                  />
                </div>

                {tplId === 'fomo_proof' && (
                  <>
                    <div>
                      <label className="text-xs text-text-muted block mb-1">time</label>
                      <input
                        type="text"
                        value={time}
                        onChange={(e) => setTime(e.target.value)}
                        placeholder="3 weeks"
                        className="w-full px-3 py-1.5 bg-bg-tertiary border border-white/10 rounded-md text-sm focus:outline-none focus:border-purple-500/50"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-text-muted block mb-1">result</label>
                      <input
                        type="text"
                        value={result}
                        onChange={(e) => setResult(e.target.value)}
                        placeholder="top 5% by points"
                        className="w-full px-3 py-1.5 bg-bg-tertiary border border-white/10 rounded-md text-sm focus:outline-none focus:border-purple-500/50"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-text-muted block mb-1">timeframe</label>
                      <input
                        type="text"
                        value={timeframe}
                        onChange={(e) => setTimeframe(e.target.value)}
                        placeholder="2-3 weeks"
                        className="w-full px-3 py-1.5 bg-bg-tertiary border border-white/10 rounded-md text-sm focus:outline-none focus:border-purple-500/50"
                      />
                    </div>
                  </>
                )}

                {tplId === 'thread' && (
                  <div className="md:col-span-2">
                    <label className="text-xs text-text-muted block mb-1">
                      Буллеты (по строке)
                    </label>
                    <textarea
                      rows={4}
                      value={pointsRaw}
                      onChange={(e) => setPointsRaw(e.target.value)}
                      placeholder={'first reason\nsecond reason\nthird reason'}
                      className="w-full px-3 py-1.5 bg-bg-tertiary border border-white/10 rounded-md text-sm font-mono focus:outline-none focus:border-purple-500/50 resize-none"
                    />
                  </div>
                )}
              </div>

              <button
                onClick={generatePost}
                disabled={generating}
                className="mt-3 flex items-center gap-2 px-4 py-1.5 bg-purple-500 text-white rounded-md hover:bg-purple-400 transition-colors disabled:opacity-50 text-sm"
              >
                <Sparkles size={14} /> {generating ? 'Генерация...' : 'Сгенерировать'}
              </button>

              {genStatus && (
                <p className="mt-2 text-xs text-text-muted whitespace-pre-wrap">{genStatus}</p>
              )}

              {generated && (
                <div className="mt-3 p-3 rounded-lg bg-bg-tertiary border border-white/10">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 text-xs text-text-muted">
                      <span>{tpl.label}</span>
                      <span>·</span>
                      <span className={charCount > 280 ? 'text-red-400' : 'text-text-muted'}>
                        {charCount}/280
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => navigator.clipboard.writeText(generated)}
                        className="text-text-muted hover:text-cyan-400 text-xs flex items-center gap-1"
                      >
                        <Copy size={12} /> копировать
                      </button>
                      <a
                        href={`https://x.com/intent/tweet?text=${encodeURIComponent(generated)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-text-muted hover:text-cyan-400 text-xs flex items-center gap-1"
                      >
                        <AtSign size={12} /> в X
                      </a>
                    </div>
                  </div>
                  <pre className="text-sm text-text-secondary whitespace-pre-wrap font-mono">
                    {generated}
                  </pre>
                </div>
              )}
            </GlassCard>
          )}
        </div>
      </div>

      {/* Reply Targets */}
      <ReplyTargets />
    </div>
  )
}


// ---------- Reply Targets --------------------------------------------------

interface ReplyTarget {
  id: string
  handle: string
  display_name: string | null
  tier: number
  category: string | null
  notes: string | null
  total_replies: number
  last_replied_at: string | null
  replied_today: boolean
}

const TIER_LABELS: Record<number, string> = { 1: 'Tier 1', 2: 'Tier 2', 3: 'Project' }
const TIER_COLORS: Record<number, 'green' | 'cyan' | 'purple'> = { 1: 'green', 2: 'cyan', 3: 'purple' }

function ReplyTargets() {
  const [targets, setTargets] = useState<ReplyTarget[]>([])
  const [stats, setStats] = useState<{ today: number; week: number }>({ today: 0, week: 0 })
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [newHandle, setNewHandle] = useState('')

  // AI Reply Generator
  const [replyInput, setReplyInput] = useState('')
  const [generatedReplies, setGeneratedReplies] = useState<string[]>([])
  const [generating, setGenerating] = useState(false)
  const [genError, setGenError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/referrals/targets')
      const data = await res.json()
      setTargets(data.targets ?? [])
      setStats(data.stats ?? { today: 0, week: 0 })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function checkin(id: string) {
    setBusyId(id)
    try {
      await fetch('/api/referrals/targets', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id, action: 'checkin' }),
      })
      await load()
    } finally {
      setBusyId(null)
    }
  }

  async function addTarget() {
    const h = newHandle.replace(/^@/, '').trim()
    if (!h) return
    await fetch('/api/referrals/targets', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ handle: h }),
    })
    setNewHandle('')
    setShowAdd(false)
    await load()
  }

  async function generateReply() {
    if (!replyInput.trim() || generating) return
    setGenerating(true)
    setGenError(null)
    setGeneratedReplies([])
    try {
      const res = await fetch('/api/ai/generate-reply', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ post: replyInput }),
      })
      const data = await res.json()
      if (!res.ok) {
        setGenError(data.error || 'Ошибка')
      } else {
        setGeneratedReplies(data.replies || [])
      }
    } catch (err) {
      setGenError((err as Error).message)
    } finally {
      setGenerating(false)
    }
  }

  async function removeTarget(id: string) {
    setBusyId(id)
    try {
      await fetch('/api/referrals/targets', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id, action: 'remove' }),
      })
      await load()
    } finally {
      setBusyId(null)
    }
  }

  const todayCount = targets.filter((t) => t.replied_today).length

  return (
    <GlassCard className="lg:col-span-2">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Users size={18} className="text-cyan-400" />
          <h2 className="text-sm font-semibold text-text-primary">Reply Targets</h2>
          <span className="text-xs text-text-muted">
            Сегодня: {todayCount}/{targets.length} · Неделя: {stats.week}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {todayCount >= 10 && (
            <span className="flex items-center gap-1 text-xs text-green-400">
              <Flame size={12} /> streak
            </span>
          )}
          <button
            onClick={() => setShowAdd(!showAdd)}
            className="flex items-center gap-1 px-2 py-1 text-xs bg-white/5 rounded-md hover:bg-white/10 text-text-muted hover:text-text-primary transition-colors"
          >
            <Plus size={12} /> Добавить
          </button>
        </div>
      </div>

      {showAdd && (
        <div className="flex items-center gap-2 mb-3">
          <input
            type="text"
            value={newHandle}
            onChange={(e) => setNewHandle(e.target.value)}
            placeholder="@handle"
            className="flex-1 px-3 py-1.5 bg-bg-tertiary border border-white/10 rounded-md text-sm focus:outline-none focus:border-cyan-500/50"
            onKeyDown={(e) => e.key === 'Enter' && addTarget()}
          />
          <button
            onClick={addTarget}
            className="px-3 py-1.5 text-xs bg-cyan-500/15 text-cyan-300 rounded-md border border-cyan-500/30 hover:bg-cyan-500/25 transition-colors"
          >
            Добавить
          </button>
        </div>
      )}

      {/* AI Reply Generator */}
      <div className="mb-4 p-3 rounded-lg bg-bg-tertiary border border-white/10">
        <p className="text-xs font-semibold text-text-primary mb-2 flex items-center gap-2">
          <Sparkles size={12} className="text-purple-400" />
          AI Reply Generator — вставь чужой пост, получи 3 ответа
        </p>
        <textarea
          value={replyInput}
          onChange={(e) => setReplyInput(e.target.value)}
          placeholder="Вставь текст поста, на который хочешь ответить..."
          rows={3}
          className="w-full px-3 py-2 bg-bg-secondary border border-white/10 rounded-md text-sm placeholder:text-text-muted focus:outline-none focus:border-purple-500/50 resize-y"
        />
        <div className="mt-2 flex items-center gap-2">
          <button
            onClick={generateReply}
            disabled={generating || !replyInput.trim()}
            className="flex items-center gap-2 px-3 py-1.5 text-xs bg-purple-500/15 text-purple-300 rounded-md border border-purple-500/30 hover:bg-purple-500/25 transition-colors disabled:opacity-50"
          >
            {generating ? (
              <><span className="animate-pulse">⏳</span> Генерация...</>
            ) : (
              <><Sparkles size={11} /> Сгенерировать ответы</>
            )}
          </button>
          {genError && <span className="text-xs text-red-400">{genError}</span>}
        </div>
        {generatedReplies.length > 0 && (
          <div className="mt-3 space-y-2">
            {generatedReplies.map((reply, i) => (
              <div
                key={i}
                className="flex items-start gap-2 p-2 rounded-md bg-white/5 border border-white/5 group"
              >
                <span className="text-[10px] text-text-muted shrink-0 mt-0.5">{i + 1}.</span>
                <p className="text-xs text-text-secondary flex-1 whitespace-pre-wrap">{reply}</p>
                <button
                  onClick={() => navigator.clipboard.writeText(reply)}
                  className="shrink-0 opacity-0 group-hover:opacity-100 text-text-muted hover:text-cyan-400 transition-all"
                  title="Копировать"
                >
                  <Copy size={11} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {loading && <p className="text-xs text-text-muted">Загрузка...</p>}

      <div className="space-y-1 max-h-[500px] overflow-y-auto">
        {targets.map((t) => (
          <div
            key={t.id}
            className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${
              t.replied_today ? 'bg-green-500/5 border border-green-500/20' : 'hover:bg-white/5'
            }`}
          >
            <button
              onClick={() => !t.replied_today && checkin(t.id)}
              disabled={t.replied_today || busyId === t.id}
              className={`shrink-0 w-5 h-5 rounded-full border flex items-center justify-center transition-colors ${
                t.replied_today
                  ? 'bg-green-500/20 border-green-500/50 text-green-400'
                  : 'border-white/20 hover:border-cyan-500/50 text-transparent hover:text-cyan-400'
              }`}
              title={t.replied_today ? 'Ответил сегодня' : 'Отметить reply'}
            >
              <CheckCircle2 size={12} />
            </button>

            <a
              href={`https://x.com/${t.handle}`}
              target="_blank"
              rel="noreferrer"
              className="flex-1 min-w-0 group"
            >
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-text-primary group-hover:text-cyan-400 transition-colors truncate">
                  @{t.handle}
                </span>
                <Badge variant={TIER_COLORS[t.tier] ?? 'cyan'}>
                  {TIER_LABELS[t.tier] ?? `T${t.tier}`}
                </Badge>
                {t.category && (
                  <span className="text-[10px] text-text-muted hidden sm:inline">
                    {t.category}
                  </span>
                )}
              </div>
              {t.notes && (
                <p className="text-[11px] text-text-muted truncate">{t.notes}</p>
              )}
            </a>

            <div className="shrink-0 flex items-center gap-2">
              <span className="text-[11px] text-text-muted font-mono w-6 text-right">
                {t.total_replies}
              </span>
              <button
                onClick={() => removeTarget(t.id)}
                disabled={busyId === t.id}
                className="text-text-muted hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                title="Убрать"
              >
                ×
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-3 pt-3 border-t border-white/5 text-xs text-text-muted space-y-1">
        <p>💡 Кликни на @handle → откроется X. Ответь на свежий пост, вернись и нажми ✓.</p>
        <p>Цель: 10+ replies/день по разным аккаунтам. Не пиши «nice» — добавляй value.</p>
      </div>

      {/* Reply Templates */}
      <div className="mt-4 pt-4 border-t border-white/5">
        <p className="text-xs font-semibold text-text-primary mb-2">Шаблоны ответов (адаптируй под пост)</p>
        <div className="space-y-2">
          {REPLY_TEMPLATES.map((tpl, i) => (
            <div key={i} className="p-2 rounded-md bg-bg-tertiary border border-white/10 group">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-medium text-text-muted">{tpl.label}</span>
                <button
                  onClick={() => navigator.clipboard.writeText(tpl.body)}
                  className="opacity-0 group-hover:opacity-100 text-text-muted hover:text-cyan-400 transition-all"
                  title="Копировать"
                >
                  <Copy size={11} />
                </button>
              </div>
              <p className="text-xs text-text-secondary whitespace-pre-wrap font-mono leading-relaxed">
                {tpl.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </GlassCard>
  )
}


const REPLY_TEMPLATES = [
  {
    label: '🗡️ Bold Truth — для thought-постов',
    body: `this is the part nobody wants to say out loud:\n[вставь свою мысль по теме поста]\n\nmost people see it but stay quiet because engagement > honesty.`,
  },
  {
    label: '🧠 Expert Take — для alpha/news',
    body: `people are missing the real signal here:\n[конкретный факт/число/паттерн]\n\nthis happened before with [пример]. same setup, different ticker.`,
  },
  {
    label: '⚡ Chaos / Hot Take — для мемов и споров',
    body: `the irony is [перевернуть тезис автора].\n\neveryone agrees until they check their own portfolio.`,
  },
  {
    label: '🎯 Personal Proof — для farming-постов',
    body: `been doing exactly this for [время].\n[конкретный результат: points/rank/volume]\n\nthe key most skip: [один инсайт].`,
  },
]
