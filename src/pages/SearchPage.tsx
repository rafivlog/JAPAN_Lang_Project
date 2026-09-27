import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import VocabCard from '../components/VocabCard'
import { isKanjiChar } from '../lib/parser'

export default function SearchPage() {
  const [q, setQ] = useState('')
  const vocab = useLiveQuery(() => db.vocab.toArray(), []) ?? []

  const query = q.trim().toLowerCase()
  const results = useMemo(() => {
    if (!query) return []
    const kanjiInQuery = [...query].filter(isKanjiChar)
    return vocab.filter((v) => {
      if (v.word.includes(query)) return true
      if (v.hiragana.includes(query)) return true
      if (v.romaji.toLowerCase().includes(query)) return true
      if (v.bangla.toLowerCase().includes(query)) return true
      if (v.english.toLowerCase().includes(query)) return true
      if (kanjiInQuery.some((c) => v.word.includes(c))) return true
      return false
    })
  }, [vocab, query])

  return (
    <div className="space-y-5">
      <header>
        <h1 className="jp text-3xl font-bold text-red-900">Search 🔍</h1>
        <p className="mt-1 text-sm text-amber-800/80">
          Search by Japanese word, kanji, hiragana, romaji, Bangla or English.
        </p>
      </header>

      <input
        autoFocus
        className="input text-base"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="e.g. 丸 · Maru · পাথর · stone · 石 …"
      />

      {query ? (
        <div className="space-y-3">
          <div className="text-sm font-bold text-amber-800">
            {results.length} result(s)
          </div>
          {results.length === 0 ? (
            <div className="paper-card p-10 text-center text-amber-800/70">No matches found.</div>
          ) : (
            results.map((v) => <VocabCard key={v.id} v={v} />)
          )}
        </div>
      ) : (
        <div className="paper-card p-10 text-center text-sm text-amber-800/70">
          Type something to search your notebook.
        </div>
      )}
    </div>
  )
}