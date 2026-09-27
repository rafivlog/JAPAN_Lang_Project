import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useSearchParams } from 'react-router-dom'
import { db } from '../db/db'
import SpeakButton from '../components/Speak'
import type { PracticeMode, Vocab } from '../lib/types'

type Scope = 'all' | 'weak' | 'wrong' | 'fav' | 'lesson'
type Phase = 'idle' | 'run' | 'done'

const MODES: Array<{ id: PracticeMode; label: string; jp: string; sub: string; icon: string }> = [
  { id: 'jp-meaning', icon: '🏷️', label: 'Japanese → Meaning', jp: '日本語 → 意味', sub: 'Word দেখে অর্থ বাছুন' },
  { id: 'meaning-jp', icon: '💡', label: 'Meaning → Japanese', jp: '意味 → 日本語', sub: 'অর্থ দেখে Word বাছুন' },
  { id: 'jp-reading', icon: '🔊', label: 'Japanese → Reading', jp: '日本語 → 読み方', sub: 'Word দেখে পড়া বাছুন' },
  { id: 'reading-jp', icon: '🎧', label: 'Reading → Japanese', jp: '読み方 → 日本語', sub: 'পড়া দেখে Word বাছুন' },
]

interface Question {
  vocab: Vocab
  prompt: string
  answer: string
  options: string[]
}

interface QuizResult {
  q: Question
  picked: string
  correct: boolean
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function meaning(v: Vocab): string {
  return v.english ? `${v.bangla} (${v.english})` : v.bangla
}
function reading(v: Vocab): string {
  return v.romaji ? `${v.hiragana} / ${v.romaji}` : v.hiragana
}
function promptOf(v: Vocab, mode: PracticeMode): string {
  if (mode === 'meaning-jp') return meaning(v)
  if (mode === 'reading-jp') return reading(v)
  return v.word
}
function answerOf(v: Vocab, mode: PracticeMode): string {
  if (mode === 'jp-meaning' || mode === 'meaning-jp') return meaning(v)
  return reading(v)
}

function buildQuestions(pool: Vocab[], mode: PracticeMode, count: number): Question[] {
  const chosen = shuffle(pool).slice(0, count)
  return chosen.map((v) => {
    const answer = answerOf(v, mode)
    const opts = new Set<string>([answer])
    for (const o of shuffle(pool.filter((p) => p.id !== v.id))) {
      if (opts.size >= 4) break
      opts.add(answerOf(o, mode))
    }
    return { vocab: v, prompt: promptOf(v, mode), answer, options: shuffle([...opts]) }
  })
}

function filterPool(vocab: Vocab[], scope: Scope, lesson: string): Vocab[] {
  switch (scope) {
    case 'fav':
      return vocab.filter((x) => x.favorite)
    case 'wrong':
      return vocab.filter((x) => x.wrongCount > 0)
    case 'weak':
      return vocab.filter((x) => {
        const t = x.correctCount + x.wrongCount
        return x.wrongCount >= 2 || (t >= 5 && x.correctCount / t < 0.6)
      })
    case 'lesson':
      return vocab.filter((x) => x.lesson === lesson)
    default:
      return vocab
  }
}

const OPTION_LABELS = ['A', 'B', 'C', 'D']

export default function PracticePage() {
  const [params] = useSearchParams()
  const rawMode = (params.get('mode') ?? 'jp-meaning') as PracticeMode
  const initialMode = MODES.some((m) => m.id === rawMode) ? rawMode : 'jp-meaning'
  const rawScope = (params.get('scope') ?? 'all') as Scope
  const initialScope: Scope = ['all', 'weak', 'wrong', 'fav', 'lesson'].includes(rawScope)
    ? rawScope
    : 'all'
  const initialCount = params.get('count') ? Number(params.get('count')) : 10

  const [mode, setMode] = useState<PracticeMode>(initialMode)
  const [scope, setScope] = useState<Scope>(initialScope)
  const [lessonSel, setLessonSel] = useState('')
  const [count, setCount] = useState(Number.isFinite(initialCount) && initialCount > 0 ? initialCount : 10)
  const [phase, setPhase] = useState<Phase>('idle')
  const [questions, setQuestions] = useState<Question[]>([])
  const [idx, setIdx] = useState(0)
  const [picked, setPicked] = useState<string | null>(null)
  const [results, setResults] = useState<QuizResult[]>([])
  const [error, setError] = useState<string | null>(null)

  const vocab = useLiveQuery(() => db.vocab.toArray(), []) ?? []
  const lessons = [...new Set(vocab.map((v) => v.lesson))]
  const lessonsArr = lessonSel || lessons[0] || ''

  function start(poolOverride?: Vocab[]) {
    const pool = poolOverride ?? filterPool(vocab, scope, lessonsArr)
    if (pool.length < 4) {
      setError(`Need at least 4 words in this pool (found ${pool.length}). Try another scope.`)
      return
    }
    setError(null)
    const n = count === 0 ? pool.length : Math.min(count, pool.length)
    setQuestions(buildQuestions(pool, mode, n))
    setPhase('run')
    setIdx(0)
    setPicked(null)
    setResults([])
  }

  const q = questions[idx]

  async function choose(opt: string) {
    if (picked || !q) return
    setPicked(opt)
    const ok = opt === q.answer
    try {
      const cur = await db.vocab.get(q.vocab.id!)
      if (cur) {
        await db.vocab.update(q.vocab.id!, {
          correctCount: cur.correctCount + (ok ? 1 : 0),
          wrongCount: cur.wrongCount + (ok ? 0 : 1),
          learned: true,
          lastPracticedAt: Date.now(),
        })
      }
    } catch {
      /* db write failure — ignore in quiz flow */
    }
    await db.practiceLogs.add({ vocabId: q.vocab.id!, mode, correct: ok, at: Date.now() })
    setResults((r) => [...r, { q, picked: opt, correct: ok }])
  }

  function next() {
    if (idx + 1 >= questions.length) {
      setPhase('done')
      return
    }
    setIdx(idx + 1)
    setPicked(null)
  }

  function retryWrong() {
    const wrongVocabs = results.filter((r) => !r.correct).map((r) => r.q.vocab)
    if (wrongVocabs.length === 0) return
    start(wrongVocabs)
  }

  const done = results
  const correctCount = done.filter((r) => r.correct).length
  const score = done.length ? Math.round((correctCount / done.length) * 100) : 0

  if (phase === 'run' && q) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <div className="flex items-center justify-between">
          <span className="chip bg-red-100 text-red-900">
            {MODES.find((m) => m.id === mode)?.icon} {MODES.find((m) => m.id === mode)?.jp}
          </span>
          <span className="text-sm font-bold text-amber-800">
            {idx + 1} / {questions.length}
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-amber-200">
          <div
            className="h-full rounded-full bg-red-900 transition-all"
            style={{ width: `${(idx + (picked ? 1 : 0)) * (100 / questions.length)}%` }}
          />
        </div>

        <div className="paper-card sunken p-6 text-center">
          <div className="label mb-3">Prompt</div>
          <div className={`${mode === 'meaning-jp' || mode === 'reading-jp' ? 'text-xl sm:text-2xl' : 'jp text-[120px]'} font-bold leading-none [overflow-wrap:anywhere]`}>
            {q.prompt}
          </div>
          {mode === 'jp-meaning' || mode === 'jp-reading' ? (
            <div className="mt-3">
              <SpeakButton text={q.prompt} />
            </div>
          ) : null}
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {q.options.map((opt, i) => {
            const isAnswer = opt === q.answer
            const isPicked = opt === picked
            let cls = 'bg-white text-ink hover:bg-amber-50'
            if (picked) {
              if (isAnswer) cls = 'bg-emerald-600 text-white'
              else if (isPicked) cls = 'bg-rose-600 text-white'
              else cls = 'bg-white text-amber-900/50'
            }
            return (
              <button
                key={i}
                disabled={!!picked}
                onClick={() => choose(opt)}
                className={`rounded-xl border px-4 py-3 text-left font-semibold transition-colors ${cls}`}
              >
                <span className="mr-2 inline-block rounded-md bg-black/10 px-2 text-xs font-bold">
                  {OPTION_LABELS[i]}
                </span>
                <span className={mode === 'meaning-jp' || mode === 'reading-jp' ? 'jp text-3xl' : 'text-base'}>
                  {opt}
                </span>
              </button>
            )
          })}
        </div>

        {picked && (
          <div className="space-y-3">
            <div
              className={`rounded-xl px-4 py-3 text-sm font-semibold ${
                picked === q.answer ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-800'
              }`}
            >
              {picked === q.answer
                ? '✅ Correct!'
                : `❌ Wrong — correct answer: ${q.answer}`}
            </div>
            <div className="paper-card p-4">
              <div className="flex items-center gap-2">
                <span className="jp text-[120px] font-bold leading-none text-black">{q.vocab.word}</span>
                <SpeakButton text={q.vocab.hiragana || q.vocab.word} />
              </div>
              <div className="text-amber-800">
                {q.vocab.hiragana}
                {q.vocab.romaji && ` · ${q.vocab.romaji}`}
              </div>
              <div className="mt-1 text-ink">{q.vocab.bangla}</div>
              {q.vocab.english && (
                <div className="text-sm italic text-amber-800/70">{q.vocab.english}</div>
              )}
            </div>
            <button className="btn btn-primary w-full" onClick={next}>
              {idx + 1 >= questions.length ? 'See result 🏁' : 'Next →'}
            </button>
          </div>
        )}
      </div>
    )
  }

  if (phase === 'done') {
    const wrong = done.filter((r) => !r.correct)
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <header>
          <h1 className="jp text-3xl font-bold text-red-900">Result 📊</h1>
        </header>
        <div className="paper-card p-6 text-center">
          <div
            className={`jp text-6xl font-black ${
              score >= 70 ? 'text-emerald-600' : score >= 40 ? 'text-amber-500' : 'text-rose-600'
            }`}
          >
            {score}%
          </div>
          <div className="mt-2 text-sm font-bold text-amber-800">
            {correctCount} correct · {done.length - correctCount} wrong
          </div>
          <div className="mt-1 text-sm text-amber-800/70">
            {score === 100
              ? '🏆 Perfect! 完璧!'
              : score >= 70
              ? '🎉 Great job! すごい!'
              : score >= 40
              ? '🙂 Good effort — review the wrong ones!'
              : '💪 Keep practicing — がんばって!'}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button className="btn btn-primary" onClick={() => start()}>
            ↻ Practice again
          </button>
          {wrong.length > 0 && (
            <button className="btn btn-amber" onClick={retryWrong}>
              🎯 Retry {wrong.length} wrong
            </button>
          )}
          <button className="btn btn-ghost" onClick={() => setPhase('idle')}>
            ⚙ Change settings
          </button>
        </div>

        {wrong.length > 0 && (
          <section className="space-y-2">
            <h2 className="text-sm font-bold uppercase tracking-wide text-rose-800">Review wrong</h2>
            {wrong.map((r, i) => (
              <div key={i} className="paper-card p-4">
                <div className="text-sm font-semibold text-rose-700">
                  ❌ {r.q.prompt}
                </div>
                <div className="mt-1 text-emerald-700">✅ {r.q.answer}</div>
                <div className="mt-1 text-xs text-amber-800/70">
                  {r.q.vocab.hiragana}
                  {r.q.vocab.romaji && ` · ${r.q.vocab.romaji}`} — {r.q.vocab.bangla}
                </div>
              </div>
            ))}
          </section>
        )}
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <header>
        <h1 className="jp text-3xl font-bold text-red-900">Practice 📝</h1>
        <p className="mt-1 text-sm text-amber-800/80">
          MCQ quiz — 4 modes, 4 options, instant feedback, score at the end.
        </p>
      </header>

      {error && (
        <div className="rounded-xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">
          ⚠ {error}
        </div>
      )}

      <section className="paper-card space-y-5 p-5">
        <div>
          <div className="label mb-2">1 · Mode</div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {MODES.map((m) => (
              <button
                key={m.id}
                onClick={() => setMode(m.id)}
                className={`rounded-xl border p-3 text-left transition-colors ${
                  mode === m.id
                    ? 'border-red-900 bg-red-50'
                    : 'border-amber-200 bg-white hover:bg-amber-50'
                }`}
              >
                <div className="flex items-center gap-2 font-bold text-ink">
                  <span>{m.icon}</span> {m.label}
                </div>
                <div className="mt-0.5 text-xs text-amber-800/70">{m.sub}</div>
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="label mb-2">2 · Pool</div>
          <div className="flex flex-wrap gap-2">
            {(
              [
                ['all', 'All words'],
                ['weak', 'Weak words'],
                ['wrong', 'Wrong words'],
                ['fav', 'Favorites ⭐'],
                ['lesson', 'One lesson'],
              ] as [Scope, string][]
            ).map(([s, label]) => (
              <button
                key={s}
                onClick={() => setScope(s)}
                className={`rounded-xl px-3 py-1.5 text-sm font-bold transition-colors ${
                  scope === s ? 'bg-red-900 text-white' : 'bg-amber-100 text-amber-900 hover:bg-amber-200'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {scope === 'lesson' && (
            <select
              className="input mt-2 max-w-xs"
              value={lessonsArr}
              onChange={(e) => setLessonSel(e.target.value)}
            >
              {lessons.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          )}
        </div>

        <div>
          <div className="label mb-2">3 · Questions</div>
          <div className="flex flex-wrap gap-2">
            {[5, 10, 20].map((n) => (
              <button
                key={n}
                onClick={() => setCount(n)}
                className={`rounded-xl px-3 py-1.5 text-sm font-bold transition-colors ${
                  count === n ? 'bg-red-900 text-white' : 'bg-amber-100 text-amber-900 hover:bg-amber-200'
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        <button
          className="btn btn-primary w-full"
          onClick={() => start()}
          disabled={vocab.length < 4}
        >
          ▶ Start — {vocab.length >= 4 ? `${Math.min(count, vocab.length)} questions from ${vocab.length} words` : 'need 4+ words first'}
        </button>
        {vocab.length < 4 && (
          <p className="text-xs text-rose-700">
            Add at least 4 words in the 📥 Import page first.
          </p>
        )}
      </section>
    </div>
  )
}