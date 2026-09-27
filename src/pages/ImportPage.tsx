import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { entryToVocab, parsePaste, extractKanji, type PasteItem } from '../lib/parser'
import { syncKanjiFromVocab } from '../lib/kanji'
import { SAMPLE_IMPORT } from '../lib/sample'

export default function ImportPage() {
  const [text, setText] = useState('')
  const [lesson, setLesson] = useState('')
  const [items, setItems] = useState<PasteItem[]>([])
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null)
  const [syncing, setSyncing] = useState(false)

  const allVocab = useLiveQuery(() => db.vocab.toArray(), []) ?? []
  const existingKey = useMemo(
    () => new Set(allVocab.map((v) => `${v.word}|${v.hiragana}`)),
    [allVocab],
  )

  function handleParse() {
    setResult(null)
    setItems(parsePaste(text, lesson))
  }

  const entries = items.filter((p): p is Extract<PasteItem, { kind: 'entry' }> => p.kind === 'entry')
  const newCount = entries.filter((p) => !existingKey.has(`${p.entry.word}|${p.entry.hiragana}`)).length

  async function handleSave() {
    const fresh = entries.filter((p) => !existingKey.has(`${p.entry.word}|${p.entry.hiragana}`))
    const dups = entries.length - fresh.length
    if (fresh.length === 0) {
      setResult({ ok: true, msg: `None saved — all ${dups} were duplicates.` })
      return
    }
    const toAdd = fresh.map((p) => entryToVocab(p.entry, p.lesson))
    await db.vocab.bulkAdd(toAdd)

    setSyncing(true)
    let kanjiMsg = ''
    try {
      const r = await syncKanjiFromVocab()
      kanjiMsg = r.total ? ` · Kanji synced (${r.fetched} new of ${r.total}).` : ''
    } catch {
      kanjiMsg = ' · Kanji sync failed (offline?).'
    }
    setSyncing(false)

    setItems([])
    setText('')
    setResult({
      ok: true,
      msg: `✅ Saved ${toAdd.length} words${dups ? `, skipped ${dups} duplicate(s)` : ''}.${kanjiMsg}`,
    })
  }

  function loadSample() {
    setText(SAMPLE_IMPORT)
    setItems(parsePaste(SAMPLE_IMPORT, lesson))
    setResult(null)
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="jp text-3xl font-bold text-red-900">Import 📥</h1>
        <p className="mt-1 text-sm text-amber-800/80">
          Paste the bookmark text and it will be split into Word · Hiragana · Romaji · Bangla ·
          English automatically.
        </p>
      </header>

      <section className="paper-card sunken space-y-4 p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Default lesson (optional)</label>
            <input
              className="input mt-1"
              value={lesson}
              onChange={(e) => setLesson(e.target.value)}
              placeholder="e.g. Lesson 1"
            />
          </div>
          <div className="flex items-end gap-2">
            <button className="btn btn-amber" onClick={loadSample}>
              ✨ Load sample
            </button>
            <button className="btn btn-ghost" onClick={() => setText('')}>
              Clear
            </button>
          </div>
        </div>
        <textarea
          className="input min-h-[220px] font-mono text-[13px] leading-6"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={
            'Paste here, for example:\n\n- 丸 (まる / Maru) — বৃত্ত / গোল চিহ্ন (Circle)\n- 石 (いし / Ishi) — পাথর (Stone)'
          }
        />
        <div className="flex flex-wrap gap-2">
          <button className="btn btn-primary" onClick={handleParse} disabled={!text.trim()}>
            🔎 Parse preview
          </button>
          {items.length > 0 && (
            <button className="btn btn-amber" onClick={handleSave} disabled={syncing}>
              {syncing ? 'Saving & syncing kanji…' : `💾 Save ${newCount} new word(s)`}
            </button>
          )}
        </div>
        {result && (
          <div
            className={`rounded-xl px-4 py-3 text-sm font-semibold ${
              result.ok ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-800'
            }`}
          >
            {result.msg}
          </div>
        )}
      </section>

      {items.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-bold uppercase tracking-wide text-amber-800/70">
            Preview — {items.length} item(s)
          </h2>
          {items.map((p, i) =>
            p.kind === 'heading' ? (
              <div
                key={i}
                className="rounded-xl border-l-4 border-red-900 bg-red-50 px-4 py-2 font-serif text-lg font-bold text-red-900"
              >
                🏷 {p.lesson}
              </div>
            ) : p.kind === 'error' ? (
              <div
                key={i}
                className="rounded-xl border border-rose-300 bg-rose-50 px-4 py-2 text-sm text-rose-800"
              >
                <b>⚠ Could not parse:</b> {p.raw}
                <span className="block text-xs text-rose-600">
                  Expected format: 単語 (かな / Romaji) — অর্থ (English)
                </span>
              </div>
            ) : (
              (() => {
                const e = p.entry
                const key = `${e.word}|${e.hiragana}`
                const isDup = existingKey.has(key)
                const kanji = extractKanji(e.word)
                return (
                  <div key={i} className="paper-card p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="jp text-xl font-bold text-red-900">{e.word}</span>
                      <span className="text-amber-800">{e.hiragana}</span>
                      {e.romaji && <span className="text-sm text-red-800/70">{e.romaji}</span>}
                      <span className="chip bg-amber-100 text-amber-900">{p.lesson}</span>
                      {kanji.length > 0 && (
                        <span className="chip bg-indigo-100 text-indigo-800">
                          🈳 {kanji.join(' ')}
                        </span>
                      )}
                      {isDup ? (
                        <span className="chip bg-rose-200 text-rose-900">Duplicate</span>
                      ) : (
                        <span className="chip bg-emerald-200 text-emerald-900">New</span>
                      )}
                    </div>
                    <div className="mt-1 text-sm text-ink">{e.bangla}</div>
                    {e.english && <div className="text-xs italic text-amber-800/70">{e.english}</div>}
                  </div>
                )
              })()
            ),
          )}
        </section>
      )}
    </div>
  )
}