import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import VocabCard from '../components/VocabCard'
import SpeakButton from '../components/Speak'
import { syncKanjiFromVocab, refreshKanjiExamples, jlptLabel } from '../lib/kanji'
import type { Kanji } from '../lib/types'

function KanjiCard({ k }: { k: Kanji }) {
  const retry = async () => {
    await db.kanji.delete(k.char)
    await syncKanjiFromVocab()
  }
  return (
    <div className="paper-card flex flex-col items-center p-4 text-center">
      <div className="flex items-center gap-1">
        <span className="jp text-[120px] font-bold leading-none text-black">{k.char}</span>
        <SpeakButton text={k.kunReadings[0] || k.char} className="h-7 w-7" />
      </div>
      {(k.kunReadings.length > 0 || k.onReadings.length > 0) && (
        <div className="mt-1 text-xs leading-relaxed text-amber-800">
          {k.kunReadings.slice(0, 2).join('、')}
          <br />
          <span className="text-red-800/80">{k.onReadings.slice(0, 2).join('、')}</span>
        </div>
      )}
      <div className="mt-2 text-sm font-medium text-ink">
        {k.meanings.slice(0, 3).join(', ') || (k.fetchError ? '(offline)' : '—')}
      </div>
      {k.bengali && k.bengali.length > 0 && (
        <div className="mt-2 w-full rounded-lg bg-emerald-50 px-2 py-1.5 text-xs font-semibold text-emerald-800">
          🇧🇩 {k.bengali.join(' · ')}
        </div>
      )}
      {k.examples && k.examples.length > 0 && (
        <div className="mt-2 w-full space-y-1 text-left">
          {k.examples.slice(0, 2).map((e) => (
            <div key={e.word} className="text-[11px] leading-snug">
              <span className="jp font-bold text-red-900">{e.word}</span>{' '}
              <span className="text-amber-800">{e.hiragana}</span>
              <span className="block text-ink/70">{e.bangla}</span>
            </div>
          ))}
        </div>
      )}
      <div className="mt-2 flex flex-wrap justify-center gap-1">
        <span className="chip bg-amber-100 text-amber-900">
          ✍ {k.strokeCount ? `${k.strokeCount} strokes` : '?'}
        </span>
        <span className="chip bg-red-100 text-red-900">JLPT {jlptLabel(k)}</span>
        {k.grade !== undefined && (
          <span className="chip bg-sky-100 text-sky-800">Gr.{k.grade}</span>
        )}
      </div>
      {k.fetchError && (
        <button
          onClick={retry}
          className="mt-2 text-xs font-semibold text-amber-700 underline hover:text-red-800"
        >
          ↻ Retry fetch
        </button>
      )}
    </div>
  )
}

function VocabTab() {
  const vocab =
    useLiveQuery(
      () => db.vocab.toArray().then((rs) => [...rs].sort((a, b) => a.createdAt - b.createdAt)),
      [],
    ) ?? []
  const lessons = useMemo(() => [...new Set(vocab.map((v) => v.lesson))], [vocab])
  const [sel, setSel] = useState('All')

  const shown = sel === 'All' ? vocab : vocab.filter((v) => v.lesson === sel)
  const groups = useMemo(() => {
    const m = new Map<string, typeof vocab>()
    for (const v of shown) {
      const arr = m.get(v.lesson) ?? []
      arr.push(v)
      m.set(v.lesson, arr)
    }
    return [...m.entries()]
  }, [shown])

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setSel('All')}
          className={`rounded-xl px-3 py-1.5 text-sm font-bold transition-colors ${
            sel === 'All' ? 'bg-red-900 text-white' : 'bg-white text-amber-900 shadow-sm'
          }`}
        >
          All ({vocab.length})
        </button>
        {lessons.map((l) => (
          <button
            key={l}
            onClick={() => setSel(l)}
            className={`rounded-xl px-3 py-1.5 text-sm font-bold transition-colors ${
              sel === l ? 'bg-red-900 text-white' : 'bg-white text-amber-900 shadow-sm'
            }`}
          >
            {l}
          </button>
        ))}
      </div>

      {groups.length === 0 && (
        <div className="paper-card p-10 text-center text-amber-800/70">
          No vocabulary yet — go to 📥 Import and paste some words, or load the sample.
        </div>
      )}

      {groups.map(([lesson, list]) => (
        <section key={lesson} className="space-y-3">
          <h2 className="jp flex items-center gap-2 border-b-2 border-black/15 pb-2 text-2xl font-bold text-black">
            <span className="text-base">📖</span> {lesson}
            <span className="ml-auto text-sm font-normal text-amber-800/60">
              {list.length} word(s)
            </span>
          </h2>
          <div className="grid gap-3">
            {list.map((v, i) => (
              <div key={v.id}>
                <div className="mb-1 flex items-center gap-2 pl-1">
                  <span className="jp text-xs font-bold text-black/40">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                </div>
                <VocabCard v={v} />
              </div>
            ))}
          </div>
        </section>
      ))}
    </section>
  )
}

function KanjiTab() {
  const kanji =
    useLiveQuery(
      () => db.kanji.toArray().then((rs) => [...rs].sort((a, b) => a.char.localeCompare(b.char))),
      [],
    ) ?? []
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)

  useEffect(() => {
    refreshKanjiExamples().catch(() => {})
  }, [])

  async function sync() {
    setBusy(true)
    setProgress(null)
    try {
      await syncKanjiFromVocab((done, total) => setProgress({ done, total }))
    } finally {
      setBusy(false)
      setProgress(null)
    }
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="jp text-2xl font-bold text-red-900">
          🈳 Kanji <span className="text-base font-normal text-amber-800/70">({kanji.length})</span>
        </h2>
        <button className="btn btn-primary" onClick={sync} disabled={busy}>
          {busy ? 'Syncing…' : '⇄ Sync from vocabulary'}
        </button>
        {progress && (
          <span className="text-sm font-semibold text-amber-800">
            {progress.done}/{progress.total}
          </span>
        )}
      </div>

      {kanji.length === 0 ? (
        <div className="paper-card p-10 text-center text-amber-800/70">
          No kanji synced yet. Save vocabulary, then press <b>Sync</b> — meanings & readings come
          from kanjiapi.dev and are cached locally.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {kanji.map((k) => (
            <KanjiCard key={k.char} k={k} />
          ))}
        </div>
      )}
    </section>
  )
}

export default function BookPage() {
  const [tab, setTab] = useState<'vocab' | 'kanji'>('vocab')
  return (
    <div className="space-y-5">
      <header>
        <h1 className="jp text-3xl font-bold text-red-900">📚 Book</h1>
        <p className="mt-1 text-sm text-amber-800/80">Your Japanese textbook — saved vocabulary.</p>
      </header>
      <div className="flex gap-1 border-b border-amber-200">
        {(
          [
            ['vocab', '単語 Vocabulary'],
            ['kanji', '漢字 Kanji'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`rounded-t-xl px-4 py-2 font-bold transition-colors ${
              tab === id
                ? 'border-x border-t border-amber-200 bg-white text-red-900'
                : 'text-amber-800/70 hover:text-red-900'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === 'vocab' ? <VocabTab /> : <KanjiTab />}
    </div>
  )
}