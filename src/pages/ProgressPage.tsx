import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router-dom'
import { db } from '../db/db'
import type { Vocab } from '../lib/types'

function isWeak(v: Vocab): boolean {
  const t = v.correctCount + v.wrongCount
  return v.wrongCount >= 2 || (t >= 5 && v.correctCount / t < 0.6)
}

const MODE_JP: Record<string, string> = {
  'jp-meaning': '日本語 → 意味',
  'meaning-jp': '意味 → 日本語',
  'jp-reading': '日本語 → 読み方',
  'reading-jp': '読み方 → 日本語',
}

export default function ProgressPage() {
  const navigate = useNavigate()
  const vocab = useLiveQuery(() => db.vocab.toArray(), []) ?? []
  const logs = useLiveQuery(
    () => db.practiceLogs.toArray().then((rs) => [...rs].sort((a, b) => b.at - a.at).slice(0, 20)),
    [],
  ) ?? []

  const attempted = vocab.filter((v) => v.correctCount + v.wrongCount > 0)
  const totalAnswered = attempted.reduce((s, v) => s + v.correctCount + v.wrongCount, 0)
  const totalCorrect = attempted.reduce((s, v) => s + v.correctCount, 0)
  const accuracy = totalAnswered ? Math.round((totalCorrect / totalAnswered) * 100) : 0

  const learned = vocab.filter((v) => v.learned)
  const favorites = vocab.filter((v) => v.favorite)
  const wrong = vocab.filter((v) => v.wrongCount > 0).sort((a, b) => b.wrongCount - a.wrongCount)
  const weak = vocab.filter(isWeak)

  const vocabById = new Map(vocab.filter((v) => v.id !== undefined).map((v) => [v.id!, v]))

  const stats = [
    { label: 'Total words', value: vocab.length, color: 'text-red-900' },
    { label: 'Learned', value: learned.length, color: 'text-emerald-600' },
    { label: 'Favorites', value: favorites.length, color: 'text-amber-500' },
    { label: 'Accuracy', value: `${totalAnswered ? `${accuracy}%` : '—'}`, color: 'text-sky-700' },
  ]

  return (
    <div className="space-y-6">
      <header>
        <h1 className="jp text-3xl font-bold text-red-900">Progress 📊</h1>
        <p className="mt-1 text-sm text-amber-800/80">
          Your learning stats & weak spots.
        </p>
      </header>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="paper-card p-4 text-center">
            <div className={`jp text-3xl font-black ${s.color}`}>{s.value}</div>
            <div className="mt-1 text-xs font-semibold text-amber-800/70">{s.label}</div>
          </div>
        ))}
      </section>

      <div className="grid gap-4 sm:grid-cols-2">
        <section className="paper-card p-5">
          <h2 className="font-bold text-rose-900">❌ Wrong words ({wrong.length})</h2>
          <div className="mt-3 space-y-2">
            {wrong.length === 0 && (
              <p className="text-sm text-amber-800/60">No wrong answers yet — nice!</p>
            )}
            {wrong.slice(0, 8).map((v) => (
              <div key={v.id} className="flex items-center gap-2">
                <span className="jp text-xl font-bold text-red-900">{v.word}</span>
                <span className="text-sm text-amber-800">{v.hiragana}</span>
                <span className="chip ml-auto bg-rose-100 text-rose-800">✗ {v.wrongCount}</span>
              </div>
            ))}
            {wrong.length > 0 && (
              <button
                className="btn btn-ghost w-full"
                onClick={() => navigate('/practice?scope=wrong&count=20')}
              >
                📝 Practice wrong words
              </button>
            )}
          </div>
        </section>

        <section className="paper-card p-5">
          <h2 className="font-bold text-amber-700">🥲 Weak words ({weak.length})</h2>
          <div className="mt-3 space-y-2">
            {weak.length === 0 && (
              <p className="text-sm text-amber-800/60">No weak words — すごい!</p>
            )}
            {weak.slice(0, 8).map((v) => {
              const t = v.correctCount + v.wrongCount
              const acc = t ? Math.round((v.correctCount / t) * 100) : 0
              return (
                <div key={v.id} className="flex items-center gap-2">
                  <span className="jp text-xl font-bold text-red-900">{v.word}</span>
                  <span className="text-sm text-amber-800">{v.hiragana}</span>
                  <span className="chip ml-auto bg-amber-100 text-amber-800">{acc}%</span>
                </div>
              )
            })}
            {weak.length > 0 && (
              <button
                className="btn btn-amber w-full"
                onClick={() => navigate('/practice?scope=weak&count=20')}
              >
                🎯 Drill weak words
              </button>
            )}
          </div>
        </section>
      </div>

      <section className="paper-card p-5">
        <h2 className="font-bold text-amber-900">🕘 Recent practice</h2>
        {logs.length === 0 ? (
          <p className="mt-3 text-sm text-amber-800/60">
            No practice yet — start a quiz in 📝 Practice.
          </p>
        ) : (
          <div className="mt-3 divide-y divide-amber-100">
            {logs.map((l) => {
              const v = vocabById.get(l.vocabId)
              return (
                <div key={l.id} className="flex items-center gap-3 py-2 text-sm">
                  <span className={`w-6 text-center font-bold ${l.correct ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {l.correct ? '✓' : '✗'}
                  </span>
                  <span className="jp text-base font-bold text-red-900">
                    {v?.word ?? '(deleted)'}
                  </span>
                  <span className="ml-auto text-xs text-amber-800/60">
                    {MODE_JP[l.mode] ?? l.mode}
                  </span>
                  <span className="w-24 text-right text-xs text-amber-800/50">
                    {new Date(l.at).toLocaleDateString()}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}